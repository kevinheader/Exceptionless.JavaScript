/// <reference path="references.ts" />

// TODO: Verify that stack traces are parsed properly.
// TODO: Handle Server Settings
// TODO: Lock configuration.
// TODO: Look into using templated strings `${1 + 1}`.

module Exceptionless {
  export class ExceptionlessClient {
    public config:Configuration;

    constructor(apiKey?:string, serverUrl?:string) {
      var settings = this.getSettingsFromScriptTag() || {};
      this.config = new Configuration(apiKey || settings.apiKey, serverUrl || settings.serverUrl);
    }

    public createException(exception:Error): EventBuilder {
      var pluginContextData = new ContextData();
      pluginContextData.setException(exception);
      return this.createEvent(pluginContextData).setType('error');
    }

    public submitException(exception:Error): Promise<any> {
      return this.createException(exception).submit();
    }

    public createUnhandledException(exception:Error): EventBuilder {
      var builder = this.createException(exception);
      builder.pluginContextData.markAsUnhandledError();

      return builder;
    }

    public submitUnhandledException(exception:Error): Promise<any> {
      return this.createUnhandledException(exception).submit();
    }

    public createFeatureUsage(feature:string): EventBuilder {
      return this.createEvent().setType('usage').setSource(feature);
    }

    public submitFeatureUsage(feature:string): Promise<any> {
      return this.createFeatureUsage(feature).submit();
    }

    public createLog(message:string): EventBuilder;
    public createLog(source:string, message:string): EventBuilder;
    public createLog(source:string, message:string, level:string): EventBuilder;
    public createLog(sourceOrMessage:string, message?:string, level?:string): EventBuilder {
      var builder = this.createEvent().setType('log');

      if (sourceOrMessage && message && level) {
        builder = builder.setSource(sourceOrMessage).setMessage(message).setProperty('@level', level);
      } else if (sourceOrMessage && message) {
        builder = builder.setSource(sourceOrMessage).setMessage(message);
      } else {
        // TODO: Look into using https://www.stevefenton.co.uk/Content/Blog/Date/201304/Blog/Obtaining-A-Class-Name-At-Runtime-In-TypeScript/
        var source = (<any>(arguments.callee.caller)).name;
        builder = builder.setSource(source).setMessage(sourceOrMessage);
      }

      return builder;
    }

    public submitLog(message:string): Promise<any>;
    public submitLog(source:string, message:string): Promise<any>;
    public submitLog(source:string, message:string, level:string): Promise<any>;
    public submitLog(sourceOrMessage:string, message?:string, level?:string): Promise<any> {
      return this.createLog(sourceOrMessage, message, level).submit();
    }

    public createNotFound(resource:string): EventBuilder {
      return this.createEvent().setType('404').setSource(resource);
    }

    public submitNotFound(resource:string): Promise<any> {
      return this.createNotFound(resource).submit();
    }

    public createSessionStart(sessionId:string): EventBuilder {
      return this.createEvent().setType('start').setSessionId(sessionId);
    }

    public submitSessionStart(sessionId:string): Promise<any> {
      return this.createSessionStart(sessionId).submit();
    }

    public createSessionEnd(sessionId:string): EventBuilder {
      return this.createEvent().setType('end').setSessionId(sessionId);
    }

    public submitSessionEnd(sessionId:string): Promise<any> {
      return this.createSessionEnd(sessionId).submit();
    }

    public createEvent(pluginContextData?:ContextData): EventBuilder {
      return new EventBuilder({ date: new Date() }, this, pluginContextData);
    }

    public submitEvent(event:IEvent, pluginContextData?:ContextData): Promise<any> {
      if (!event) {
        return Promise.reject(new Error('Unable to submit undefined event.'));
      }

      if (!this.config.enabled) {
        var message:string = 'Event submission is currently disabled.';
        this.config.log.info(message);
        return Promise.reject(new Error(message));
      }

      var context = new EventPluginContext(this, event, pluginContextData);
      return EventPluginManager.run(context)
        .then(() => {
          if (context.cancel) {
            var message:string = 'Event submission cancelled by plugin": id=' + event.reference_id + ' type=' + event.type;
            this.config.log.info(message);
            return Promise.reject(new Error(message));
          }

          // ensure all required data
          if (!event.type || event.type.length === 0) {
            event.type = 'log';
          }

          if (!event.date) {
            event.date = new Date();
          }

          this.config.log.info('Submitting event: type=' + event.type + !!event.reference_id ? ' refid=' + event.reference_id : '');
          this.config.queue.enqueue(event);

          if (event.reference_id && event.reference_id.length > 0) {
            this.config.log.info('Setting last reference id "' + event.reference_id + '"');
            this.config.lastReferenceIdManager.setLast(event.reference_id);
          }

          return Promise.resolve();
        })
        .catch((error:Error) => {
          var message:string = 'Event submission cancelled. An error occurred while running the plugins: ' + error && error.message ? error.message : <any>error;
          this.config.log.error(message);
          return Promise.reject(new Error(message));
        });
    }

    public getLastReferenceId(): string {
      return this.config.lastReferenceIdManager.getLast();
    }

    public register(): void {
      var oldOnErrorHandler:any = window.onerror;
      (<any>window).onerror = (message:string, filename:string, lineno:number, colno:number, error:Error) => {
        if(error !== null && typeof error === 'object') {
          this.submitUnhandledException(error);
        } else {
          // Only message, filename and lineno work here.
          var e:IError = { message: message, stack_trace: [{ file_name: filename, line_number: lineno, column: colno }]};
          this.createUnhandledException(new Error(message)).setMessage(message).setProperty('@error', e).submit();
        }

        if (oldOnErrorHandler) {
          try {
            return oldOnErrorHandler(message, filename, lineno, colno, error);
          } catch(e) {
            this.config.log.error('An error occurred while calling previous error handler: ' + e.message);
          }
        }

        return false;
      }
    }

    private getSettingsFromScriptTag(): any {
      var scripts = document.getElementsByTagName('script');

      for (var index = 0; index < scripts.length; index++) {
        if (scripts[index].src && scripts[index].src.indexOf('/exceptionless') > -1) {
          return Utils.parseQueryString(scripts[index].src.split('?').pop());
        }
      }

      return null;
    }

    private static _instance:ExceptionlessClient = null;
    public static get default() {
      if(ExceptionlessClient._instance === null) {
        ExceptionlessClient._instance = new ExceptionlessClient(null);
      }
      return ExceptionlessClient._instance;
    }
  }
}
