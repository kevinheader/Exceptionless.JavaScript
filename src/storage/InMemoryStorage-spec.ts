import { IEvent } from '../models/IEvent';
import { InMemoryStorage } from './InMemoryStorage';
import { IStorageItem } from './IStorageItem';
import { expect } from 'chai';

describe('InMemoryStorage', () => {
  it('should save events', () => {
    let storage = new InMemoryStorage();
    let key = 'ex-q-';
    let event1: IEvent = { type: 'log', reference_id: key + '123454321' };
    let event2: IEvent = { type: 'log', reference_id: key + '098765432' };
    expect(storage.getList().length).to.equal(0);
    storage.save(event1.reference_id, event1);
    expect(storage.getList().length).to.equal(1);
    expect(storage.getList(key).length).to.equal(1);
    storage.save(event2.reference_id, event2);
    expect(storage.getList().length).to.equal(2);
    expect(storage.getList(key).length).to.equal(2);
    expect(storage.getList(key + '1').length).to.equal(1);
  });

  it('should save once', () => {
    let storage = new InMemoryStorage();
    storage.save('one', 1);
    expect(storage.getList().length).to.equal(1);
    storage.save('one', 1);
    expect(storage.getList().length).to.equal(1);
  });

  it('should get by key', () => {
    let storage = new InMemoryStorage();
    storage.save('ex-server-settings.json-version', 1);
    storage.save('ex-server-settings.json', { exist: true });
    expect(storage.getList().length).to.equal(2);
    expect(storage.get('ex-server-settings.json-version')).to.equal(1);
    expect(storage.get('ex-server-settings.json')).to.eql({ exist: true });
  });

  it('should get saved events', () => {
    let storage = new InMemoryStorage();
    let key = 'ex-q-';
    let event1: IEvent = { type: 'log', reference_id: key + '11' };
    let event2: IEvent = { type: 'log', reference_id: key + '12' };
    let event3: IEvent = { type: 'log', reference_id: key + '13' };
    let event4: IEvent = { type: 'log', reference_id: key + '14' };
    let event5: IEvent = { type: 'log', reference_id: key + '15' };
    let event6: IEvent = { type: 'log', reference_id: key + '16' };
    expect(storage.getList().length).to.equal(0);

    storage.save(event1.reference_id, event1);
    storage.save(event2.reference_id, event2);
    storage.save(event3.reference_id, event3);
    storage.save(event4.reference_id, event4);
    storage.save(event5.reference_id, event5);
    storage.save(event6.reference_id, event6);
    expect(storage.getList().length).to.equal(6);

    let ev = storage.get(event1.reference_id);
    expect(ev).to.equal(event1);
    expect(ev).to.equal(storage.getList(event1.reference_id, 1)[0].value);
    expect(storage.getList().length).to.equal(6);
    storage.remove(event1.reference_id);
    expect(storage.get(event1.reference_id)).to.equal(null);
    expect(storage.getList().length).to.equal(5);

    ev = storage.getList(event2.reference_id, 1)[0].value;
    expect(ev).to.equal(event2);
    storage.remove(event2.reference_id);
    expect(storage.getList().length).to.equal(4);

    let events = storage.getList(key, 2);
    expect(events.length).to.equal(2);
    expect(events[0].value).not.to.equal(events[1].value);
    storage.remove(events[0].path);
    storage.remove(events[1].path);
    expect(storage.getList().length).to.equal(2);

    events = storage.getList(key);
    expect(events.length).to.equal(2);
    expect(events[0].value).not.to.equal(events[1].value);
  });

  it('should clear all events', () => {
    let storage = new InMemoryStorage();
    let key = 'ex-q-';
    let event1: IEvent = { type: 'log', reference_id: key + '11' };
    let event2: IEvent = { type: 'log', reference_id: key + '12' };
    let event3: IEvent = { type: 'log', reference_id: key + '13' };
    let event4: IEvent = { type: 'log', reference_id: key + '14' };
    let event5: IEvent = { type: 'log', reference_id: key + '15' };
    let event6: IEvent = { type: 'log', reference_id: key + '16' };
    expect(storage.getList().length).to.equal(0);

    storage.save(event1.reference_id, event1);
    storage.save(event2.reference_id, event2);
    storage.save(event3.reference_id, event3);
    storage.save(event4.reference_id, event4);
    storage.save(event5.reference_id, event5);
    storage.save(event6.reference_id, event6);
    expect(storage.getList().length).to.equal(6);

    storage.remove(event1.reference_id);
    expect(storage.getList().length).to.equal(5);

    let events = storage.getList();
    for (let index = 0; index < events.length; index++) {
      storage.remove(events[index].path);
    }

    expect(storage.getList().length).to.equal(0);
  });

  it('should get with limit', () => {
    let storage = new InMemoryStorage(250);
    for (let index: number = 0; index < 260; index++) {
      storage.save('ex-q-' + index, { type: 'log', reference_id: index.toString() });
    }

    expect(storage.getList().length).to.equal(250);
    expect(storage.getList(null).length).to.equal(250);
    expect(storage.getList(null, 1).length).to.equal(1);
  });

  it('should get the oldest events', () => {
    function getDate(baseDate: Date, offset: number) {
      return new Date(baseDate.getTime() + (offset * 60000));
    }

    const DATE: Date = new Date();
    let storage = new InMemoryStorage();
    for (let index: number = 0; index < 10; index++) {
      storage.save('ex-q-' + index, {
        date: getDate(DATE, index),
        type: 'log',
        reference_id: index.toString()
      });

      expect(storage.getList().length).to.equal(index + 1);
    }

    let offset: number = 0;
    let events: IStorageItem[] = storage.getList('ex-q-', 2);
    while (events && events.length > 0) {
      expect(2).to.equal(events.length);
      for (let ei = 0; ei < 2; ei++) {
        expect(getDate(DATE, offset++)).to.eql(events[ei].value.date);
        storage.remove(events[ei].path);
      }

      events = storage.getList('ex-q-', 2);
    }
  });

  it('should respect max items limit', () => {
    let storage = new InMemoryStorage(5);
    for (let index: number = 0; index < 5; index++) {
      storage.save('ex-q-' + index, { type: 'log', reference_id: index.toString() });
    }

    let events: IStorageItem[] = storage.getList();
    expect(events.length).to.equal(5);
    expect(events[0].path).to.equal('ex-q-0');
    storage.save('ex-q-6', { type: 'log', reference_id: '6' });

    events = storage.getList();
    expect(events.length).to.equal(5);
    expect(events[0].path).to.equal('ex-q-1');
  });
});
