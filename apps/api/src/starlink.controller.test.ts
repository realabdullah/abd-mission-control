import test = require('node:test');
import assert = require('node:assert/strict');
import { parseTelemetryQuery } from './starlink.controller';

test('API telemetry query accepts bounded range shortcuts and metric filters', () => {
  const parsed = parseTelemetryQuery({ range: '7d', metric: 'latency_ms', limit: '200' });
  assert.equal(parsed.range, '7d');
  assert.equal(parsed.limit, 200);
});
test('API telemetry query rejects invalid metric and reversed timestamps', () => {
  assert.throws(() => parseTelemetryQuery({ metric: 'not_a_metric' }));
  assert.throws(() =>
    parseTelemetryQuery({ from: '2026-01-02T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }),
  );
});
