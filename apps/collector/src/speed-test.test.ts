import test from 'node:test';
import assert from 'node:assert/strict';
import { RollingRateEstimator } from './speed-test.js';

test('smooths buffered chunk bursts over a rolling time window', () => {
  const rate = new RollingRateEstimator(0, 2000);
  assert.equal(rate.observe(1000, 3_000_000), 24_000_000);
  assert.ok(rate.observe(1001, 4_000_000) < 32_000_000);
  assert.equal(rate.observe(2000, 6_000_000), 24_000_000);
});

test('moves the baseline forward while retaining a full rolling interval', () => {
  const rate = new RollingRateEstimator(0, 2000);
  rate.observe(1000, 2_000_000);
  rate.observe(2000, 4_000_000);
  assert.equal(rate.observe(3000, 6_000_000), 16_000_000);
});
