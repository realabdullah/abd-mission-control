import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, rawStarlinkResponseSchema } from './client.js';

test('validates uint64 JSON strings, optional fields, and preserves absent metrics as null', () => {
  const parsed = rawStarlinkResponseSchema.parse({
    dishGetStatus: {
      deviceState: { uptimeS: '12879' },
      readyStates: { scp: true, l1l2: true, xphy: true, aap: true, rf: true },
      downlinkThroughputBps: 48452.6,
      popPingLatencyMs: 21.1,
      alerts: {},
      upsuStats: {},
    },
  });
  const snapshot = normalize(parsed, '192.168.100.1:9200');
  assert.equal(snapshot.uptimeSeconds, 12879);
  assert.equal(snapshot.packetLossPercent, null);
  assert.equal(snapshot.uplinkThroughputBps, null);
  assert.equal(snapshot.internetConnected, true);
});

test('rejects malformed required response shapes without guessing fields', () => {
  const result = rawStarlinkResponseSchema.safeParse({
    dishGetStatus: { downlinkThroughputBps: 'not-a-number' },
  });
  assert.equal(result.success, false);
});
