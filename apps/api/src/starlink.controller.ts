import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { loadConfig } from '@abd-mission-control/config';
import { createDatabase, TelemetryRepository } from '@abd-mission-control/database';
import { streamEventTypeSchema, telemetryMetricSchema } from '@abd-mission-control/contracts';
import { EventHub } from './events';

export const telemetryQuerySchema = z
  .object({
    metric: telemetryMetricSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    range: z.enum(['1h', '6h', '24h', '7d', '30d']).optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(1000),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && new Date(value.from) > new Date(value.to))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be before to',
        path: ['from'],
      });
    if (
      value.from &&
      value.to &&
      new Date(value.to).getTime() - new Date(value.from).getTime() > 30 * 86400000
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maximum query range is 30 days',
        path: ['to'],
      });
  });
export function parseTelemetryQuery(query: Record<string, string | undefined>) {
  return telemetryQuerySchema.parse(query);
}
const config = loadConfig(process.env);
export const apiDatabase = createDatabase(config.databaseUrl);
export const apiRepository = new TelemetryRepository(apiDatabase.db);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function snapshotDto(row: unknown): unknown {
  if (!isRecord(row)) return null;
  const value = row;
  return {
    integrationId: value.integrationId,
    name: 'Starlink Mini',
    state: value.state,
    reachable: value.reachable,
    internetConnected: value.internetConnected ?? null,
    latencyMs: value.latencyMs ?? null,
    packetLossPercent: value.packetLossPercent ?? null,
    downlinkThroughputBps: value.downlinkThroughputBps ?? null,
    uplinkThroughputBps: value.uplinkThroughputBps ?? null,
    obstructionFraction: value.obstructionFraction ?? null,
    uptimeSeconds: value.uptimeSeconds ?? null,
    powerWatts: value.powerWatts ?? null,
    hardwareVersion: value.hardwareVersion ?? null,
    firmwareVersion: value.firmwareVersion ?? null,
    lastSuccessfulSampleAt:
      value.lastSuccessfulSampleAt instanceof Date
        ? value.lastSuccessfulSampleAt.toISOString()
        : (value.lastSuccessfulSampleAt ?? null),
    updatedAt: value.updatedAt instanceof Date ? value.updatedAt.toISOString() : value.updatedAt,
  };
}

@Controller()
export class StarlinkController {
  constructor(private readonly hub: EventHub) {}
  private validateIntegration(id: string): void {
    if (id !== config.starlinkIntegrationId) throw new NotFoundException('Integration not found');
  }
  @Get('integrations') async integrations() {
    return [
      {
        id: config.starlinkIntegrationId,
        type: 'starlink',
        name: 'Starlink Mini',
        enabled: true,
        capabilities: [
          'connectivity',
          'latency',
          'throughput',
          'obstruction',
          'hardware',
          'firmware',
        ],
        lastCollectionAt: null,
      },
    ];
  }
  @Get('integrations/:id/snapshot') async snapshot(@Param('id') id: string) {
    this.validateIntegration(id);
    const value = snapshotDto(await apiRepository.getSnapshot(id));
    if (value === null) throw new NotFoundException('Snapshot not found');
    return value;
  }
  @Get('integrations/:id/telemetry') async telemetry(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.validateIntegration(id);
    const parsed = parseTelemetryQuery(query);
    const to = parsed.to ? new Date(parsed.to) : new Date();
    const from = parsed.from
      ? new Date(parsed.from)
      : new Date(
          to.getTime() -
            { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[
              parsed.range ?? '1h'
            ],
        );
    if (from > to) return [];
    const duration = to.getTime() - from.getTime();
    const rows =
      duration > 6 * 3600000
        ? await apiRepository.getTelemetryAggregated(
            id,
            parsed.metric,
            from,
            to,
            duration > 7 * 86400000 ? 3600 : duration > 86400000 ? 900 : 60,
            parsed.limit,
          )
        : await apiRepository.getTelemetry(id, parsed.metric, from, to, parsed.limit);
    return rows
      .map((row) => {
        if (!isRecord(row)) return null;
        const timestamp = row.timestamp ?? row.recordedAt;
        return {
          timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
          metric: row.metric,
          value: row.value ?? row.average,
          unit: row.unit ?? 'provider unit',
          minimum: row.minimum,
          maximum: row.maximum,
          average: row.average,
          latest: row.latest,
          sampleCount: row.sampleCount,
        };
      })
      .filter((row) => row !== null);
  }
  @Get('integrations/:id/events') async events(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    this.validateIntegration(id);
    const count = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    const rows = await apiRepository.getEvents(id, count);
    return rows
      .map((row) => {
        if (!isRecord(row)) return null;
        return {
          id: row.id,
          timestamp: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : row.occurredAt,
          category: row.category,
          severity: row.severity,
          description: row.description,
          resolvedAt:
            row.resolvedAt instanceof Date
              ? row.resolvedAt.toISOString()
              : (row.resolvedAt ?? null),
        };
      })
      .filter((row) => row !== null);
  }
  @Post('internal/events') internalEvent(@Body() event: { type: string; data: unknown }) {
    const parsed = streamEventTypeSchema.safeParse(event.type);
    if (!parsed.success) return { accepted: false };
    this.hub.publish({ type: parsed.data, data: event.data });
    return { accepted: true };
  }
  @Get('stream') stream(
    @Headers('last-event-id') lastEventId: string | undefined,
    @Res() response: Response,
  ): void {
    response.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.flushHeaders();
    response.write(': connected\n\n');
    let paused = false;
    const unsubscribe = this.hub.subscribe((event) => {
      if (paused) return;
      paused = !response.write(
        `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
      );
    }, lastEventId);
    response.on('drain', () => {
      paused = false;
    });
    response.on('close', unsubscribe);
  }
}
