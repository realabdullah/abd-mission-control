import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDailySummary } from './daily-summary';

test('daily summary is deterministic and preserves unavailable metrics', async () => {
  const summary = await generateDailySummary(
    {
      getIncidentStats: async () => ({
        uptimePercent: 99,
        outageCount: 1,
        totalOutageSeconds: 60,
        longestOutageSeconds: 60,
        latencyAverageMs: 40,
        latencyP95Ms: 60,
        packetLossAveragePercent: null,
        telemetryCompletenessPercent: 90,
      }),
      getTelemetry: async () => [{ value: 1000 }],
      getEvents: async () => [{ category: 'firmware', description: 'Firmware changed' }],
      saveDailySummary: async (_integrationId, date, data) => ({ id: `summary-${date}`, data }),
    },
    '00000000-0000-0000-0000-000000000001',
    new Date('2026-01-02T12:00:00.000Z'),
  );
  assert.equal(summary.date, '2026-01-02');
  assert.equal(summary.peakDownlinkBps, 1000);
  assert.equal(summary.averagePacketLossPercent, null);
  assert.equal(summary.firmwareChanged, true);
  assert.deepEqual(summary.notableIssues, ['Firmware changed']);
});
