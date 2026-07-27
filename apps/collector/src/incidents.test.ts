import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlertRule } from '@abd-mission-control/contracts';
import { IncidentRuleEngine } from './incidents';

const integrationId = '00000000-0000-0000-0000-000000000001';
const baseRule = (incidentType: AlertRule['incidentType']): AlertRule => ({
  id: '00000000-0000-0000-0000-000000000002',
  integrationId,
  incidentType,
  enabled: true,
  warningThreshold: null,
  criticalThreshold: null,
  persistenceSeconds: 60,
  recoverySeconds: 30,
  cooldownSeconds: 300,
  updatedAt: '2026-01-01T00:00:00.000Z',
});
function snapshot(internetConnected: boolean) {
  return {
    integrationId,
    name: 'Fixture Starlink',
    state: internetConnected ? ('nominal' as const) : ('degraded' as const),
    reachable: true,
    internetConnected,
    latencyMs: 40,
    packetLossPercent: null,
    downlinkThroughputBps: 100,
    uplinkThroughputBps: 20,
    obstructionFraction: null,
    uptimeSeconds: 10,
    powerWatts: null,
    hardwareVersion: null,
    firmwareVersion: null,
    lastSuccessfulSampleAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('incident rule engine debounces, opens, resolves, and avoids duplicates', async () => {
  const rules = [baseRule('internet_connectivity_lost')];
  const opened: unknown[] = [];
  const occurrences: string[] = [];
  let active: Record<string, unknown> | null = null;
  const store = {
    ensureDefaultAlertRules: async () => undefined,
    getAlertRules: async () => rules,
    getActiveIncident: async () => active,
    openIncident: async (input: Record<string, unknown>) => {
      active = {
        ...input,
        id: '00000000-0000-0000-0000-000000000003',
        severity: 'critical',
        startedAt: input.startedAt,
        active: true,
      };
      opened.push(active);
      return active;
    },
    updateIncident: async () => active,
    resolveIncident: async () => {
      if (active) active = { ...active, active: false };
      return active;
    },
    createOccurrence: async (input: { type: string }) => {
      occurrences.push(input.type);
      return input;
    },
  };
  const engine = new IncidentRuleEngine(integrationId, store);
  await engine.evaluateSnapshot(snapshot(false), new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(opened.length, 0);
  await engine.evaluateSnapshot(
    { ...snapshot(false), updatedAt: '2026-01-01T00:01:00.000Z' },
    new Date('2026-01-01T00:01:00.000Z'),
  );
  assert.equal(opened.length, 1);
  await engine.evaluateSnapshot(
    { ...snapshot(false), updatedAt: '2026-01-01T00:02:00.000Z' },
    new Date('2026-01-01T00:02:00.000Z'),
  );
  assert.equal(opened.length, 1);
  await engine.evaluateSnapshot(
    { ...snapshot(true), updatedAt: '2026-01-01T00:02:30.000Z' },
    new Date('2026-01-01T00:02:30.000Z'),
  );
  assert.equal((active as { active: boolean } | null)?.active, true);
  await engine.evaluateSnapshot(
    { ...snapshot(true), updatedAt: '2026-01-01T00:03:00.000Z' },
    new Date('2026-01-01T00:03:00.000Z'),
  );
  assert.equal((active as { active: boolean } | null)?.active, false);
  assert.deepEqual(occurrences, ['opened', 'resolved']);
});

test('incident rules do not infer unavailable optional metrics', async () => {
  const rules = [baseRule('elevated_packet_loss')];
  let opened = 0;
  const engine = new IncidentRuleEngine(integrationId, {
    ensureDefaultAlertRules: async () => undefined,
    getAlertRules: async () => rules,
    getActiveIncident: async () => null,
    openIncident: async () => {
      opened += 1;
      return null;
    },
    updateIncident: async () => null,
    resolveIncident: async () => null,
    createOccurrence: async () => null,
  });
  await engine.evaluateSnapshot(snapshot(true), new Date('2026-01-01T00:02:00.000Z'));
  assert.equal(opened, 0);
});
