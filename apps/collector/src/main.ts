import { createServer } from 'node:http';
import { loadConfig } from '@abd-mission-control/config';
import { createDatabase, TelemetryRepository } from '@abd-mission-control/database';
import { StarlinkClient } from '@abd-mission-control/integrations';
import { IncidentRuleEngine } from './incidents';
import { generateDailySummary } from './daily-summary';
import { CollectorPoller, realClock } from './poller';
import { PathProbeRunner } from './path-probes';
import { SpeedTestRunner } from './speed-test';

const config = loadConfig(process.env);
const database = createDatabase(config.databaseUrl);
const repository = new TelemetryRepository(database.db);
const client = new StarlinkClient(
  `${config.starlinkHost}:${config.starlinkPort}`,
  config.starlinkRequestTimeoutMs,
);
let cleanupRunning = false;
const log = (event: string, details: Record<string, unknown>): void =>
  console.log(JSON.stringify({ event, ...details, at: new Date().toISOString() }));
async function publish(type: string, data: unknown): Promise<void> {
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/internal/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.collectorApiToken ? { 'x-collector-token': config.collectorApiToken } : {}),
      },
      body: JSON.stringify({ type, data }),
    });
    if (!response.ok) throw new Error(`API event publish failed with ${response.status}`);
  } catch {
    log('collector.event_publish_failed', { type });
  }
}
const incidentEngine = new IncidentRuleEngine(config.starlinkIntegrationId, repository, publish);
const poller = new CollectorPoller({
  intervalMs: config.starlinkPollIntervalMs,
  timeoutMs: config.starlinkRequestTimeoutMs,
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5000,
  jitterRatio: 0.2,
  random: Math.random,
  clock: realClock,
  integrationId: config.starlinkIntegrationId,
  sink: repository,
  provider: client,
  incidentEngine,
  publish,
  logger: log,
});
const pathProbeRunner = new PathProbeRunner({
  integrationId: config.starlinkIntegrationId,
  timeoutMs: config.pathProbeTimeoutMs,
  sink: repository,
  logger: log,
});
const speedTestRunner = config.speedTestUrl
  ? new SpeedTestRunner({
      integrationId: config.starlinkIntegrationId,
      url: config.speedTestUrl,
      maxBytes: config.speedTestMaxBytes,
      timeoutMs: config.speedTestTimeoutMs,
      sink: repository,
    })
  : null;
const server = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/speed-tests') {
    if (
      !config.collectorApiToken ||
      request.headers['x-collector-token'] !== config.collectorApiToken
    ) {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Collector authentication failed' }));
      return;
    }
    if (!speedTestRunner) {
      response.writeHead(409, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Speed test is not configured' }));
      return;
    }
    if (!speedTestRunner.start()) {
      response.writeHead(409, { 'content-type': 'application/json' });
      response.end(JSON.stringify(speedTestRunner.getProgress()));
      return;
    }
    response.writeHead(202, { 'content-type': 'application/json' });
    response.end(JSON.stringify(speedTestRunner.getProgress()));
    return;
  }
  if (request.method === 'GET' && request.url === '/speed-tests/status') {
    if (
      !config.collectorApiToken ||
      request.headers['x-collector-token'] !== config.collectorApiToken
    ) {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Collector authentication failed' }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify(
        speedTestRunner?.getProgress() ?? {
          state: 'idle',
          bytesTransferred: 0,
          downloadBps: null,
          startedAt: null,
          updatedAt: new Date().toISOString(),
          samples: [],
        },
      ),
    );
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ service: 'collector', ...poller.getHealth() }));
});
async function cleanup(): Promise<void> {
  if (cleanupRunning) return;
  cleanupRunning = true;
  const started = Date.now();
  try {
    const result = await repository.cleanupExpired(
      new Date(Date.now() - config.telemetryRetentionDays * 86400000),
      new Date(Date.now() - config.eventRetentionDays * 86400000),
      config.retentionBatchSize,
    );
    log('collector.cleanup_completed', { ...result, durationMs: Date.now() - started });
    await generateDailySummary(repository, config.starlinkIntegrationId);
  } catch (error: unknown) {
    log('collector.cleanup_failed', {
      error: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - started,
    });
  } finally {
    cleanupRunning = false;
  }
}
void poller.runCycle().finally(() => incidentEngine.evaluateHealth(poller.getHealth()));
void pathProbeRunner.runCycle();
const pollInterval = setInterval(() => {
  void poller.runCycle().finally(() => incidentEngine.evaluateHealth(poller.getHealth()));
}, config.starlinkPollIntervalMs);
const pathProbeInterval = setInterval(
  () => void pathProbeRunner.runCycle(),
  config.pathProbeIntervalMs,
);
const cleanupInterval = setInterval(() => {
  void cleanup();
}, config.retentionCleanupIntervalMs);
server.listen(config.collectorPort, config.collectorHost, () => {
  log('collector.started', {
    host: config.collectorHost,
    port: config.collectorPort,
    pollIntervalMs: config.starlinkPollIntervalMs,
  });
});
const shutdown = (): void => {
  log('collector.shutdown_started', {});
  clearInterval(pollInterval);
  clearInterval(pathProbeInterval);
  clearInterval(cleanupInterval);
  poller.stop();
  client.close();
  void database.close();
  server.close(() => process.exit(0));
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
