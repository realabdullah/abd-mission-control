import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectorPoller, type Clock, type CollectorSink } from './poller.js';
import { StarlinkError } from '@abd-mission-control/integrations';
import type { StarlinkSnapshot } from '@abd-mission-control/contracts';

const snapshot = (state: 'nominal' | 'degraded' = 'nominal'): StarlinkSnapshot => ({
  integrationId: '00000000-0000-0000-0000-000000000001',
  name: 'fixture',
  state,
  reachable: true,
  internetConnected: state === 'nominal',
  latencyMs: 20,
  packetLossPercent: null,
  downlinkThroughputBps: 10,
  uplinkThroughputBps: 5,
  obstructionFraction: null,
  uptimeSeconds: 10,
  powerWatts: null,
  hardwareVersion: null,
  firmwareVersion: null,
  lastSuccessfulSampleAt: new Date(1000).toISOString(),
  updatedAt: new Date(1000).toISOString(),
});
function fixtureClock(): Clock & { sleeps: number[]; time: number } {
  const value = {
    time: 1000,
    sleeps: [] as number[],
    now() {
      return value.time;
    },
    sleep(ms: number) {
      value.sleeps.push(ms);
      value.time += ms;
      return Promise.resolve();
    },
  };
  return value;
}
function sink(): CollectorSink {
  return {
    ensureIntegration: async () => undefined,
    saveSnapshot: async () => undefined,
    addSamples: async () => undefined,
    addEvent: async () => undefined,
  };
}
test('retries transient failures, then succeeds and resets retry state', async () => {
  let attempts = 0;
  const clock = fixtureClock();
  const poller = new CollectorPoller({
    intervalMs: 30000,
    timeoutMs: 5000,
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    jitterRatio: 0,
    random: () => 0.5,
    clock,
    integrationId: snapshot().integrationId,
    sink: sink(),
    provider: {
      getStatus: async () => {
        attempts += 1;
        if (attempts < 3) throw new StarlinkError('timeout', 'timeout');
        return snapshot();
      },
    },
  });
  assert.equal(await poller.runCycle(), true);
  assert.equal(attempts, 3);
  assert.deepEqual(clock.sleeps, [100, 200]);
  assert.equal(poller.getHealth().retryAttempt, 0);
});
test('does not retry malformed responses and prevents overlapping cycles', async () => {
  let attempts = 0;
  const clock = fixtureClock();
  let release!: () => void;
  const poller = new CollectorPoller({
    intervalMs: 30000,
    timeoutMs: 5000,
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    jitterRatio: 0,
    random: () => 0.5,
    clock,
    integrationId: snapshot().integrationId,
    sink: sink(),
    provider: {
      getStatus: async () => {
        attempts += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        throw new StarlinkError('malformed', 'bad');
      },
    },
  });
  const first = poller.runCycle();
  assert.equal(await poller.runCycle(), false);
  release();
  assert.equal(await first, false);
  assert.equal(attempts, 1);
  assert.equal(poller.getHealth().state, 'starlink_response_invalid');
});
test('shutdown aborts a retry wait and reports stopped', async () => {
  const clock: Clock = {
    now: () => 1000,
    sleep: (_ms, signal) =>
      new Promise<void>((resolve) =>
        signal.aborted
          ? resolve()
          : signal.addEventListener('abort', () => resolve(), { once: true }),
      ),
  };
  const poller = new CollectorPoller({
    intervalMs: 30000,
    timeoutMs: 5000,
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    jitterRatio: 0,
    random: () => 0.5,
    clock,
    integrationId: snapshot().integrationId,
    sink: sink(),
    provider: {
      getStatus: async () => {
        throw new StarlinkError('timeout', 'timeout');
      },
    },
  });
  const run = poller.runCycle();
  poller.stop();
  assert.equal(await run, false);
  assert.equal(poller.getHealth().state, 'stopped');
});
