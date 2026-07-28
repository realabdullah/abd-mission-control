import { Controller, Get } from '@nestjs/common';
import { loadConfig } from '@abd-mission-control/config';
import { systemStatusSchema } from '@abd-mission-control/contracts';
import { Public } from './auth';

type CollectorHealth = { state?: string };

function collectorHealth(value: unknown): CollectorHealth {
  return typeof value === 'object' && value !== null ? (value as CollectorHealth) : {};
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
    let starlink: 'nominal' | 'degraded' | 'offline' | 'unavailable' = 'unavailable';
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
    return systemStatusSchema.parse({
      status: starlink === 'nominal' ? 'operational' : 'degraded',
      api: 'ok',
      collector,
      starlink,
    });
  }
}
