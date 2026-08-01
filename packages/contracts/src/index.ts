import { z } from 'zod';

export const systemStatusSchema = z.object({
  status: z.enum(['operational', 'degraded', 'offline']),
  api: z.literal('ok'),
  collector: z.enum(['ok', 'unavailable', 'delayed', 'stopped']),
  starlink: z.enum(['nominal', 'degraded', 'offline', 'unavailable']),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;

export const integrationTypeSchema = z.enum([
  'starlink',
  'deco',
  'home_assistant',
  'generic_network_device',
]);
export const integrationMetadataSchema = z.object({
  id: z.string().uuid(),
  type: integrationTypeSchema,
  name: z.string().min(1),
  enabled: z.boolean(),
  capabilities: z.array(z.string()),
  lastCollectionAt: z.string().datetime().nullable(),
});

export const telemetryMetricSchema = z.enum([
  'latency_ms',
  'packet_loss_percent',
  'downlink_throughput_bps',
  'uplink_throughput_bps',
  'obstruction_fraction',
  'uptime_seconds',
  'power_watts',
]);
export type TelemetryMetric = z.infer<typeof telemetryMetricSchema>;

export const starlinkSnapshotSchema = z.object({
  integrationId: z.string().uuid(),
  name: z.string(),
  state: z.enum(['nominal', 'degraded', 'offline', 'unavailable']),
  reachable: z.boolean(),
  internetConnected: z.boolean().nullable(),
  latencyMs: z.number().nullable(),
  packetLossPercent: z.number().nullable(),
  downlinkThroughputBps: z.number().nullable(),
  uplinkThroughputBps: z.number().nullable(),
  obstructionFraction: z.number().nullable(),
  uptimeSeconds: z.number().nullable(),
  powerWatts: z.number().nullable(),
  hardwareVersion: z.string().nullable(),
  firmwareVersion: z.string().nullable(),
  lastSuccessfulSampleAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type StarlinkSnapshot = z.infer<typeof starlinkSnapshotSchema>;

export const telemetrySampleSchema = z.object({
  timestamp: z.string().datetime(),
  metric: telemetryMetricSchema,
  value: z.number(),
  unit: z.string(),
});
export type TelemetrySample = z.infer<typeof telemetrySampleSchema>;

export const pathProbeKindSchema = z.enum(['dns', 'public_tcp']);
export const pathProbeStatusSchema = z.enum(['success', 'failure', 'timeout']);
export const pathProbeSchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().uuid(),
  kind: pathProbeKindSchema,
  target: z.string().min(1),
  status: pathProbeStatusSchema,
  latencyMs: z.number().nonnegative().nullable(),
  observedAt: z.string().datetime(),
  detail: z.string().nullable(),
});
export type PathProbe = z.infer<typeof pathProbeSchema>;

export const speedTestSchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().uuid(),
  state: z.enum(['completed', 'failed']),
  bytesTransferred: z.number().int().nonnegative(),
  downloadBps: z.number().nonnegative().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  error: z.string().nullable(),
});
export type SpeedTest = z.infer<typeof speedTestSchema>;
export const speedTestClientResultSchema = z.object({
  state: z.enum(['completed', 'failed']),
  bytesTransferred: z.number().int().nonnegative().max(100000000),
  downloadBps: z.number().nonnegative().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  error: z.string().max(500).nullable(),
});
export type SpeedTestClientResult = z.infer<typeof speedTestClientResultSchema>;
export const speedTestLiveSchema = z.object({
  state: z.enum(['idle', 'running', 'completed', 'failed']),
  bytesTransferred: z.number().int().nonnegative(),
  downloadBps: z.number().nonnegative().nullable(),
  startedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  samples: z.array(z.object({ at: z.string().datetime(), bps: z.number().nonnegative() })).max(120),
});
export type SpeedTestLive = z.infer<typeof speedTestLiveSchema>;

export const networkEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  category: z.enum(['reachability', 'connectivity', 'collector', 'firmware', 'outage']),
  severity: z.enum(['info', 'warning', 'error']),
  description: z.string(),
  resolvedAt: z.string().datetime().nullable(),
});
export type NetworkEvent = z.infer<typeof networkEventSchema>;

export const telemetryAggregateSchema = z.object({
  timestamp: z.string().datetime(),
  metric: telemetryMetricSchema,
  minimum: z.number(),
  maximum: z.number(),
  average: z.number(),
  latest: z.number(),
  sampleCount: z.number().int().nonnegative(),
});
export type TelemetryAggregate = z.infer<typeof telemetryAggregateSchema>;
export const telemetryResponseSchema = z.union([telemetrySampleSchema, telemetryAggregateSchema]);
export const streamEventTypeSchema = z.enum([
  'snapshot',
  'sample',
  'event',
  'health',
  'incident.opened',
  'incident.updated',
  'incident.resolved',
  'alert.created',
  'alert.acknowledged',
  'alert-rule.updated',
]);
export const streamEventSchema = z.object({
  id: z.string(),
  type: streamEventTypeSchema,
  data: z.unknown(),
});

export const incidentTypeSchema = z.enum([
  'internet_connectivity_lost',
  'starlink_device_unreachable',
  'collector_delayed',
  'collector_stopped',
  'invalid_starlink_response',
  'database_unavailable',
  'high_latency',
  'elevated_packet_loss',
  'obstruction_degradation',
]);
export type IncidentType = z.infer<typeof incidentTypeSchema>;
export const incidentSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export const incidentStateSchema = z.enum(['active', 'resolved']);
export type IncidentState = z.infer<typeof incidentStateSchema>;
export const incidentSourceSchema = z.enum(['collector', 'rule', 'system']);
export const incidentSchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().uuid(),
  type: incidentTypeSchema,
  severity: incidentSeveritySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  state: incidentStateSchema,
  durationSeconds: z.number().nonnegative(),
  firstObservedValue: z.number().nullable(),
  latestObservedValue: z.number().nullable(),
  thresholdMetadata: z.record(z.unknown()),
  source: incidentSourceSchema,
  dedupeKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const alertOccurrenceTypeSchema = z.enum(['opened', 'escalated', 'resolved']);
export const alertOccurrenceSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  type: alertOccurrenceTypeSchema,
  severity: incidentSeveritySchema,
  message: z.string().min(1),
  occurredAt: z.string().datetime(),
  acknowledged: z.boolean(),
  acknowledgedAt: z.string().datetime().nullable(),
});
export type AlertOccurrence = z.infer<typeof alertOccurrenceSchema>;

export const alertRuleSchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().uuid().nullable(),
  incidentType: incidentTypeSchema,
  enabled: z.boolean(),
  warningThreshold: z.number().nullable(),
  criticalThreshold: z.number().nullable(),
  persistenceSeconds: z.number().int().nonnegative(),
  recoverySeconds: z.number().int().nonnegative(),
  cooldownSeconds: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type AlertRule = z.infer<typeof alertRuleSchema>;

export const incidentStatsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  uptimePercent: z.number().min(0).max(100),
  totalOutageSeconds: z.number().nonnegative(),
  outageCount: z.number().int().nonnegative(),
  longestOutageSeconds: z.number().nonnegative(),
  medianOutageSeconds: z.number().nonnegative(),
  meanOutageSeconds: z.number().nonnegative(),
  latencyAverageMs: z.number().nullable(),
  latencyP95Ms: z.number().nullable(),
  latencyMaximumMs: z.number().nullable(),
  packetLossAveragePercent: z.number().nullable(),
  obstructionAverageFraction: z.number().nullable(),
  telemetryCompletenessPercent: z.number().min(0).max(100),
});
export type IncidentStats = z.infer<typeof incidentStatsSchema>;

export const dailySummarySchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().uuid(),
  date: z.string(),
  availabilityPercent: z.number().min(0).max(100),
  incidentCount: z.number().int().nonnegative(),
  totalOutageSeconds: z.number().nonnegative(),
  longestOutageSeconds: z.number().nonnegative(),
  averageLatencyMs: z.number().nullable(),
  p95LatencyMs: z.number().nullable(),
  peakDownlinkBps: z.number().nullable(),
  averagePacketLossPercent: z.number().nullable(),
  telemetryCompletenessPercent: z.number().min(0).max(100),
  firmwareChanged: z.boolean(),
  notableIssues: z.array(z.string()),
  generatedAt: z.string().datetime(),
});
export type DailySummary = z.infer<typeof dailySummarySchema>;

export const incidentStreamEventTypeSchema = z.enum([
  'incident.opened',
  'incident.updated',
  'incident.resolved',
  'alert.created',
  'alert.acknowledged',
  'alert-rule.updated',
]);
