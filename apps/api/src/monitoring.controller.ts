import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { loadConfig } from '@abd-mission-control/config';
import {
  alertOccurrenceSchema,
  alertRuleSchema,
  dailySummarySchema,
  incidentSchema,
  incidentSeveritySchema,
  incidentStatsSchema,
  incidentTypeSchema,
} from '@abd-mission-control/contracts';
import { z } from 'zod';
import { EventHub } from './events';
import { apiRepository } from './starlink.controller';

const config = loadConfig(process.env);
const listQuerySchema = z.object({
  state: z.enum(['active', 'resolved']).optional(),
  severity: incidentSeveritySchema.optional(),
  type: incidentTypeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
const rulePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    warningThreshold: z.number().finite().nullable().optional(),
    criticalThreshold: z.number().finite().nullable().optional(),
    persistenceSeconds: z.number().int().min(0).max(86400).optional(),
    recoverySeconds: z.number().int().min(0).max(86400).optional(),
    cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  })
  .refine(
    (value) =>
      value.warningThreshold === undefined ||
      value.criticalThreshold === undefined ||
      value.warningThreshold === null ||
      value.criticalThreshold === null ||
      value.criticalThreshold >= value.warningThreshold,
    'criticalThreshold must be greater than or equal to warningThreshold',
  );

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : null;
}
function incidentDto(value: unknown): unknown {
  const row = record(value);
  if (!row) return null;
  const startedAt = iso(row.startedAt) ?? new Date(0).toISOString();
  const endedAt = iso(row.endedAt);
  return incidentSchema.parse({
    id: row.id,
    integrationId: row.integrationId,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    startedAt,
    endedAt,
    state: row.active ? 'active' : 'resolved',
    durationSeconds: Math.max(
      0,
      ((endedAt ? Date.parse(endedAt) : Date.now()) - Date.parse(startedAt)) / 1000,
    ),
    firstObservedValue: row.firstObservedValue ?? null,
    latestObservedValue: row.latestObservedValue ?? null,
    thresholdMetadata: row.thresholdMetadata ?? {},
    source: row.source,
    dedupeKey: row.dedupeKey,
    createdAt: iso(row.createdAt) ?? startedAt,
    updatedAt: iso(row.updatedAt) ?? startedAt,
  });
}
function occurrenceDto(value: unknown): unknown {
  const row = record(value);
  if (!row) return null;
  return alertOccurrenceSchema.parse({
    id: row.id,
    incidentId: row.incidentId,
    type: row.type,
    severity: row.severity,
    message: row.message,
    occurredAt: iso(row.occurredAt) ?? new Date(0).toISOString(),
    acknowledged: row.acknowledged === true,
    acknowledgedAt: iso(row.acknowledgedAt),
  });
}
function ruleDto(value: unknown): unknown {
  const row = record(value);
  if (!row) return null;
  return alertRuleSchema.parse({
    id: row.id,
    integrationId: row.integrationId ?? null,
    incidentType: row.incidentType,
    enabled: row.enabled === true,
    warningThreshold: row.warningThreshold ?? null,
    criticalThreshold: row.criticalThreshold ?? null,
    persistenceSeconds: Number(row.persistenceSeconds),
    recoverySeconds: Number(row.recoverySeconds),
    cooldownSeconds: Number(row.cooldownSeconds),
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
  });
}
function windowFor(range: string): { from: Date; to: Date } {
  const to = new Date();
  const duration =
    range === 'today'
      ? to.getTime() - new Date(to.toDateString()).getTime()
      : range === '7d'
        ? 7 * 86400000
        : range === '30d'
          ? 30 * 86400000
          : 86400000;
  return { from: new Date(to.getTime() - duration), to };
}

@Controller()
export class MonitoringController {
  constructor(private readonly hub: EventHub) {}

  @Get('incidents/active')
  async active() {
    const rows = await apiRepository.getIncidents({
      integrationId: config.starlinkIntegrationId,
      active: true,
      limit: 200,
      offset: 0,
    });
    return rows.map(incidentDto).filter((value) => value !== null);
  }

  @Get('incidents/stats')
  async stats(@Query('range') range = '24h') {
    const parsed = z.enum(['today', '24h', '7d', '30d']).parse(range);
    const window = windowFor(parsed);
    return incidentStatsSchema.parse(
      await apiRepository.getIncidentStats(config.starlinkIntegrationId, window.from, window.to),
    );
  }

  @Get('incidents')
  async list(@Query() query: Record<string, string | undefined>) {
    const parsed = listQuerySchema.parse(query);
    const window =
      parsed.from || parsed.to
        ? {
            from: parsed.from ? new Date(parsed.from) : new Date(0),
            to: parsed.to ? new Date(parsed.to) : new Date(),
          }
        : undefined;
    const rows = await apiRepository.getIncidents({
      integrationId: config.starlinkIntegrationId,
      active: parsed.state ? parsed.state === 'active' : undefined,
      type: parsed.type,
      severity: parsed.severity,
      from: window?.from,
      to: window?.to,
      limit: parsed.limit,
      offset: parsed.offset,
    });
    return rows.map(incidentDto).filter((value) => value !== null);
  }

  @Get('incidents/:id')
  async get(@Param('id') id: string) {
    const value = incidentDto(await apiRepository.getIncidentById(id));
    if (!value) throw new NotFoundException('Incident not found');
    const incidentRecord = record(value);
    const occurrences = incidentRecord?.id
      ? await apiRepository.getOccurrencesForIncident(String(incidentRecord.id), 200)
      : [];
    return {
      incident: value,
      occurrences: occurrences.map(occurrenceDto).filter((item) => item !== null),
    };
  }

  @Get('alert-rules')
  async rules() {
    await apiRepository.ensureDefaultAlertRules(config.starlinkIntegrationId);
    return (await apiRepository.getAlertRules(config.starlinkIntegrationId))
      .map(ruleDto)
      .filter((value) => value !== null);
  }

  @Patch('alert-rules/:id')
  async updateRule(@Param('id') id: string, @Body() body: unknown) {
    const updated = await apiRepository.updateAlertRule(id, rulePatchSchema.parse(body));
    if (!updated) throw new NotFoundException('Alert rule not found');
    const dto = ruleDto(updated);
    this.hub.publish({ type: 'alert-rule.updated', data: dto });
    return dto;
  }

  @Get('alerts')
  async alerts(@Query('limit') limit?: string, @Query('acknowledged') acknowledged?: string) {
    const count = z.coerce.number().int().min(1).max(200).default(50).parse(limit);
    const acknowledgedValue =
      acknowledged === undefined
        ? undefined
        : z
            .enum(['true', 'false'])
            .transform((value) => value === 'true')
            .parse(acknowledged);
    return (await apiRepository.getOccurrences(count, acknowledgedValue))
      .map(occurrenceDto)
      .filter((value) => value !== null);
  }

  @Post('alerts/:id/acknowledge')
  async acknowledge(@Param('id') id: string) {
    const updated = await apiRepository.acknowledgeOccurrence(id);
    if (!updated) throw new NotFoundException('Alert not found');
    const dto = occurrenceDto(updated);
    this.hub.publish({ type: 'alert.acknowledged', data: dto });
    return dto;
  }

  @Get('daily-summaries')
  async summaries(@Query('limit') limit?: string) {
    const count = z.coerce.number().int().min(1).max(30).default(7).parse(limit);
    return (await apiRepository.getDailySummaries(config.starlinkIntegrationId, count))
      .map((row) => {
        const value = record(row);
        if (!value) return null;
        const data = record(value.data) ?? {};
        return dailySummarySchema.parse({
          ...data,
          id: value.id,
          integrationId: value.integrationId,
          date: value.summaryDate,
          generatedAt: iso(value.generatedAt) ?? new Date(0).toISOString(),
        });
      })
      .filter((value) => value !== null);
  }
}
