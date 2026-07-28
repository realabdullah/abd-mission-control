import { Controller, Get } from '@nestjs/common';
import { loadConfig } from '@abd-mission-control/config';
import { systemStatusSchema } from '@abd-mission-control/contracts';
import { Public } from './auth';
import { apiRepository } from './api-database';

type CollectorHealth = { state?: string };
type StarlinkState = 'nominal' | 'degraded' | 'offline' | 'unavailable';

function collectorHealth(value: unknown): CollectorHealth {
  return typeof value === 'object' && value !== null ? (value as CollectorHealth) : {};
}

function snapshotState(value: unknown, staleAfterMs: number): StarlinkState {
  if (typeof value !== 'object' || value === null) return 'unavailable';
  const snapshot = value as Record<string, unknown>;
  const observedAt = snapshot.lastSuccessfulSampleAt ?? snapshot.updatedAt;
  const timestamp =
    observedAt instanceof Date
      ? observedAt.getTime()
      : typeof observedAt === 'string'
        ? Date.parse(observedAt)
        : Number.NaN;
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > staleAfterMs) return 'unavailable';
  return snapshot.state === 'nominal' ||
    snapshot.state === 'degraded' ||
    snapshot.state === 'offline'
    ? snapshot.state
    : 'unavailable';
}

@Controller()
export class HealthController {
  @Get('health')
  @Public()
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'api' };
  }

  @Get('system/status')
  async systemStatus() {
    const config = loadConfig(process.env);
    let collector: 'ok' | 'unavailable' | 'delayed' | 'stopped' = 'unavailable';
    let starlink: StarlinkState = 'unavailable';
    try {
      const response = await fetch(`${config.collectorUrl}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const { state } = collectorHealth(await response.json());
        collector = state === 'delayed' ? 'delayed' : state === 'stopped' ? 'stopped' : 'ok';
        starlink = state === 'healthy' ? 'nominal' : 'unavailable';
      }
    } catch {
      collector = 'unavailable';
    }
    if (collector === 'unavailable') {
      const staleAfterMs = config.starlinkPollIntervalMs * 2 + config.starlinkRequestTimeoutMs * 3;
      starlink = snapshotState(
        await apiRepository.getSnapshot(config.starlinkIntegrationId),
        staleAfterMs,
      );
    }
    return systemStatusSchema.parse({
      status: starlink === 'nominal' ? 'operational' : 'degraded',
      api: 'ok',
      collector,
      starlink,
    });
  }
}
