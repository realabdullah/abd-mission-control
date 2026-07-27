import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { NestFactory } from '@nestjs/core';
import { incidentSchema, alertOccurrenceSchema } from '@abd-mission-control/contracts';
import { createDatabase, TelemetryRepository } from '@abd-mission-control/database';
import { IncidentRuleEngine } from '../apps/collector/src/incidents';

const databaseUrl = process.env.DATABASE_TEST_URL;
const integrationId = '00000000-0000-0000-0000-000000000097';

async function applyMigrations(url: string): Promise<postgres.Sql> {
  const client = postgres(url);
  for (const file of ['0000_phase2.sql', '0001_phase3_incidents.sql']) {
    await client.unsafe(
      await readFile(new URL(`../packages/database/drizzle/${file}`, import.meta.url), 'utf8'),
    );
  }
  return client;
}
function observation(connected: boolean, timestamp: string) {
  return {
    integrationId,
    name: 'Fixture Starlink',
    state: connected ? ('nominal' as const) : ('degraded' as const),
    reachable: true,
    internetConnected: connected,
    latencyMs: 40,
    packetLossPercent: null,
    downlinkThroughputBps: 1000,
    uplinkThroughputBps: 200,
    obstructionFraction: null,
    uptimeSeconds: 100,
    powerWatts: null,
    hardwareVersion: 'fixture',
    firmwareVersion: 'fixture',
    lastSuccessfulSampleAt: timestamp,
    updatedAt: timestamp,
  };
}

test(
  'Phase 3 E2E: fixture observations → incident → alert → API → SSE → recovery',
  { skip: databaseUrl ? false : 'DATABASE_TEST_URL is not configured; skipping Phase 3 E2E' },
  async () => {
    assert.ok(databaseUrl);
    const originalEnv = { ...process.env };
    const databaseClient = await applyMigrations(databaseUrl);
    const collectorDatabase = createDatabase(databaseUrl);
    const repository = new TelemetryRepository(collectorDatabase.db);
    let app: { getUrl(): string; close(): Promise<void> } | undefined;
    let apiDatabase: { close(): Promise<void> } | undefined;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      process.env.DATABASE_URL = databaseUrl;
      process.env.STARLINK_INTEGRATION_ID = integrationId;
      const { AppModule } = await import('../apps/api/dist/apps/api/src/app.module.js');
      const apiModule = await import('../apps/api/dist/apps/api/src/starlink.controller.js');
      apiDatabase = apiModule.apiDatabase;
      const nest = await NestFactory.create(AppModule, { logger: false });
      nest.setGlobalPrefix('api/v1');
      await nest.listen(0, '127.0.0.1');
      app = nest;
      const apiUrl = await nest.getUrl();
      await repository.ensureIntegration(integrationId, 'Fixture Starlink');
      const publish = async (type: string, data: unknown) => {
        const response = await fetch(`${apiUrl}/api/v1/internal/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type, data }),
        });
        assert.equal(response.ok, true);
      };
      const engine = new IncidentRuleEngine(integrationId, repository, publish);
      const stream = await fetch(`${apiUrl}/api/v1/stream`, { signal: controller.signal });
      assert.equal(stream.ok, true);
      assert.ok(stream.body);
      reader = stream.body.getReader();
      await reader.read();
      await engine.evaluateSnapshot(
        observation(false, '2026-01-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      );
      await engine.evaluateSnapshot(
        observation(false, '2026-01-01T00:01:00.000Z'),
        new Date('2026-01-01T00:01:00.000Z'),
      );
      const activeResponse = await fetch(`${apiUrl}/api/v1/incidents/active`);
      const active = incidentSchema.array().parse(await activeResponse.json());
      assert.equal(active.length, 1);
      const alertsResponse = await fetch(`${apiUrl}/api/v1/alerts?acknowledged=false`);
      const alerts = alertOccurrenceSchema.array().parse(await alertsResponse.json());
      assert.equal(alerts.length, 1);
      const sse = await Promise.race([
        reader.read(),
        new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
          setTimeout(() => reject(new Error('SSE incident timeout')), 2000),
        ),
      ]);
      assert.match(new TextDecoder().decode(sse.value), /incident\.opened/);
      await engine.evaluateSnapshot(
        observation(true, '2026-01-01T00:01:30.000Z'),
        new Date('2026-01-01T00:01:30.000Z'),
      );
      await engine.evaluateSnapshot(
        observation(true, '2026-01-01T00:02:00.000Z'),
        new Date('2026-01-01T00:02:00.000Z'),
      );
      const resolvedResponse = await fetch(`${apiUrl}/api/v1/incidents?state=resolved&limit=10`);
      const resolved = incidentSchema.array().parse(await resolvedResponse.json());
      assert.ok(resolved.some((item) => item.type === 'internet_connectivity_lost'));
    } finally {
      await reader?.cancel().catch(() => undefined);
      controller.abort();
      await app?.close();
      await apiDatabase?.close();
      await collectorDatabase.close();
      await databaseClient.end();
      process.env = originalEnv;
    }
  },
);
