import test = require('node:test');
import assert = require('node:assert/strict');
import { EventHub } from './events';

test('SSE hub delivers events, replays after Last-Event-ID, and cleans subscribers', () => {
  const hub = new EventHub();
  const received: string[] = [];
  const unsubscribe = hub.subscribe((event) => received.push(event.id));
  hub.publish({ type: 'health', data: { status: 'ok' } });
  assert.equal(received.length, 1);
  unsubscribe();
  const replayed: string[] = [];
  hub.subscribe((event) => replayed.push(event.id), '0');
  assert.equal(replayed.length, 1);
  hub.onModuleDestroy();
});
test('SSE hub bounds subscriber storage and isolates listener failures', () => {
  const hub = new EventHub();
  for (let i = 0; i < 100; i += 1) hub.subscribe(() => undefined);
  let delivered = false;
  hub.subscribe(() => {
    delivered = true;
  });
  hub.publish({ type: 'health', data: {} });
  assert.equal(delivered, false);
  const healthy = new EventHub();
  healthy.subscribe(() => {
    throw new Error('slow subscriber');
  });
  const received: string[] = [];
  healthy.subscribe((event) => received.push(event.id));
  healthy.publish({ type: 'health', data: {} });
  assert.equal(received.length, 1);
  hub.onModuleDestroy();
  healthy.onModuleDestroy();
});
