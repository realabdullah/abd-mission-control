import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Server, ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import postgres from 'postgres';
import { NestFactory } from '@nestjs/core';
import {
  starlinkSnapshotSchema,
  telemetryResponseSchema,
  networkEventSchema,
} from '@abd-mission-control/contracts';
import { StarlinkClient } from '@abd-mission-control/integrations';
import { createDatabase, TelemetryRepository } from '@abd-mission-control/database';
import { CollectorPoller, realClock } from '../apps/collector/src/poller';

const databaseUrl = process.env.DATABASE_TEST_URL;
const integrationId = '00000000-0000-0000-0000-000000000001';
const protoPath = new URL(
  '../packages/integrations/src/starlink/proto/device.proto',
  import.meta.url,
).pathname;

function fixtureResponse(degraded: boolean): Record<string, unknown> {
  return {
    dishGetStatus: {
      deviceInfo: { hardwareVersion: 'fixture-hardware', softwareVersion: 'fixture-firmware' },
      deviceState: { uptimeS: '12345' },
      obstructionStats: { fractionObstructed: 0.01 },
      alerts: {},
      downlinkThroughputBps: 1000000,
      uplinkThroughputBps: 200000,
      popPingLatencyMs: 24,
      readyStates: { scp: !degraded, l1l2: true, xphy: true, aap: true, rf: true },
      upsuStats: {},
    },
  };
}

async function startFixture(): Promise<{
  address: string;
  setDegraded: () => void;
  close: () => Promise<void>;
}> {
  const definition = loadSync(protoPath, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: false,
    oneofs: true,
  });
  const serviceDefinition = definition['SpaceX.API.Device.Device'];
  if (
    !serviceDefinition ||
    typeof serviceDefinition !== 'object' ||
    !('Handle' in serviceDefinition)
  )
    throw new Error('fixture protobuf service is missing Handle');
  const server = new Server();
  let degraded = false;
  server.addService(serviceDefinition as never, {
    Handle: (_call: unknown, callback: (error: null, response: Record<string, unknown>) => void) =>
      callback(null, fixtureResponse(degraded)),
  });
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, boundPort) =>
      error ? reject(error) : resolve(boundPort),
    ),
  );
  return {
    address: `127.0.0.1:${port}`,
    setDegraded: () => {
      degraded = true;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.tryShutdown((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function applyMigration(url: string): Promise<postgres.Sql> {
  const client = postgres(url);
  const migration = await readFile(
    new URL('../packages/database/drizzle/0000_phase2.sql', import.meta.url),
    'utf8',
  );
  await client.unsafe(migration);
  return client;
}

test(
  'Phase 2 E2E: fixture gRPC → real poller → PostgreSQL → API → SSE',
  { skip: databaseUrl ? false : 'DATABASE_TEST_URL is not configured; skipping Phase 2 E2E' },
  async () => {
    assert.ok(databaseUrl);
    const originalEnv = { ...process.env };
    const fixture = await startFixture();
    const databaseClient = await applyMigration(databaseUrl);
    const collectorDatabase = createDatabase(databaseUrl);
    const repository = new TelemetryRepository(collectorDatabase.db);
    let app: { getUrl(): string; close(): Promise<void> } | undefined;
    let apiDatabase: { close(): Promise<void> } | undefined;
    let streamController: AbortController | undefined;
    let streamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
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
      const client = new StarlinkClient(fixture.address, 1000);
      const publish = async (type: 'snapshot' | 'sample' | 'event' | 'health', data: unknown) => {
        const response = await fetch(`${apiUrl}/api/v1/internal/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type, data }),
        });
        assert.equal(response.ok, true);
      };
      const poller = new CollectorPoller({
        intervalMs: 30000,
        timeoutMs: 1000,
        maxAttempts: 1,
        baseDelayMs: 1,
        maxDelayMs: 1,
        jitterRatio: 0,
        random: () => 0.5,
        clock: realClock,
        integrationId,
        sink: repository,
        provider: client,
        publish,
      });
      assert.equal(await poller.runCycle(), true);
      const streamControllerLocal = new AbortController();
      streamController = streamControllerLocal;
      const stream = await fetch(`${apiUrl}/api/v1/stream`, {
        signal: streamControllerLocal.signal,
      });
      assert.equal(stream.ok, true);
      assert.ok(stream.body);
      streamReader = stream.body.getReader();
      const connected = await streamReader.read();
      assert.match(new TextDecoder().decode(connected.value), /connected/);
      fixture.setDegraded();
      assert.equal(await poller.runCycle(), true);
      const snapshotResponse = await fetch(
        `${apiUrl}/api/v1/integrations/${integrationId}/snapshot`,
      );
      const snapshot = starlinkSnapshotSchema.parse(await snapshotResponse.json());
      assert.equal(snapshot.state, 'degraded');
      const telemetryResponse = await fetch(
        `${apiUrl}/api/v1/integrations/${integrationId}/telemetry?range=1h&limit=100`,
      );
      const telemetry = telemetryResponseSchema.array().parse(await telemetryResponse.json());
      assert.ok(telemetry.length >= 4);
      const eventsResponse = await fetch(
        `${apiUrl}/api/v1/integrations/${integrationId}/events?limit=10`,
      );
      const events = networkEventSchema.array().parse(await eventsResponse.json());
      assert.ok(events.some((event) => event.description.includes('degraded')));
      const eventChunk = await Promise.race([
        streamReader.read(),
        new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
          setTimeout(() => reject(new Error('SSE event timeout')), 2000),
        ),
      ]);
      assert.match(new TextDecoder().decode(eventChunk.value), /event: snapshot/);
      const persisted = await repository.getSnapshot(integrationId);
      assert.ok(persisted);
      assert.ok(
        (
          await repository.getTelemetry(
            integrationId,
            undefined,
            new Date(Date.now() - 60000),
            new Date(Date.now() + 60000),
            100,
          )
        ).length >= 4,
      );
      poller.stop();
      client.close();
    } finally {
      streamReader?.cancel().catch(() => undefined);
      streamController?.abort();
      await app?.close();
      await apiDatabase?.close();
      await collectorDatabase.close();
      await databaseClient.end();
      await fixture.close();
      process.env = originalEnv;
    }
  },
);
