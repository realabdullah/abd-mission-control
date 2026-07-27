import { Controller, Get } from '@nestjs/common';
import { loadConfig } from '@abd-mission-control/config';
import { systemStatusSchema } from '@abd-mission-control/contracts';
import { Public } from './auth';

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
    let collector: 'ok' | 'unavailable' = 'unavailable';
    try {
      const response = await fetch(`${config.collectorUrl}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      collector = response.ok ? 'ok' : 'unavailable';
    } catch {
      collector = 'unavailable';
    }
    return systemStatusSchema.parse({
      status: collector === 'ok' ? 'operational' : 'degraded',
      api: 'ok',
      collector,
      starlink: collector === 'ok' ? 'nominal' : 'unavailable',
    });
  }
}
