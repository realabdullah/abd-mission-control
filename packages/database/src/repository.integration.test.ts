import test from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { createDatabase, TelemetryRepository } from './index.js';

const url = process.env.DATABASE_TEST_URL;
test(
  'PostgreSQL repository integration: upsert, idempotent samples, queries, and cleanup',
  { skip: !url },
  async () => {
    const client = postgres(url as string);
    const database = createDatabase(url as string);
    const repository = new TelemetryRepository(database.db);
    const id = '00000000-0000-0000-0000-000000000099';
    const now = new Date();
    await repository.ensureIntegration(id, 'repository fixture');
    await repository.addSamples(
      [{ timestamp: now.toISOString(), metric: 'latency_ms', value: 20, unit: 'ms' }],
      id,
    );
    await repository.addSamples(
      [{ timestamp: now.toISOString(), metric: 'latency_ms', value: 20, unit: 'ms' }],
      id,
    );
    const rows = await repository.getTelemetry(
      id,
      'latency_ms',
      new Date(now.getTime() - 1000),
      new Date(now.getTime() + 1000),
      10,
    );
    assert.equal(rows.length, 1);
    const result = await repository.cleanupExpired(
      new Date(now.getTime() + 1000),
      new Date(now.getTime() + 1000),
      100,
    );
    assert.equal(result.samples, 1);
    await database.close();
    await client`DELETE FROM integrations WHERE id = ${id}`;
    await client.end();
  },
);

test(
  'PostgreSQL incidents, alert rules, occurrences, and summaries persist safely',
  { skip: !url },
  async () => {
    const database = createDatabase(url as string);
    const repository = new TelemetryRepository(database.db);
    const id = '00000000-0000-0000-0000-000000000098';
    await repository.ensureIntegration(id, 'incident fixture');
    await repository.ensureDefaultAlertRules(id);
    const rules = await repository.getAlertRules(id);
    assert.equal(rules.length, 9);
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const incident = await repository.openIncident({
      integrationId: id,
      type: 'high_latency',
      severity: 'warning',
      title: 'High latency',
      description: 'Fixture latency is elevated',
      startedAt,
      firstObservedValue: 150,
      latestObservedValue: 150,
      thresholdMetadata: { warningThreshold: 120 },
      source: 'rule',
      dedupeKey: 'high_latency',
    });
    assert.ok(incident && typeof incident === 'object' && 'id' in incident);
    const incidentId = String((incident as { id: string }).id);
    await repository.createOccurrence({
      incidentId,
      type: 'opened',
      severity: 'warning',
      message: 'Opened',
      occurredAt: startedAt,
    });
    const resolved = await repository.resolveIncident(
      incidentId,
      new Date('2026-01-01T00:05:00.000Z'),
    );
    assert.ok(resolved);
    await repository.saveDailySummary(id, '2026-01-01', {
      availabilityPercent: 99,
      incidentCount: 1,
      totalOutageSeconds: 300,
      longestOutageSeconds: 300,
      averageLatencyMs: 150,
      p95LatencyMs: 150,
      peakDownlinkBps: null,
      averagePacketLossPercent: null,
      telemetryCompletenessPercent: 100,
      firmwareChanged: false,
      notableIssues: [],
    });
    assert.equal((await repository.getDailySummaries(id, 1)).length, 1);
    await database.close();
  },
);
