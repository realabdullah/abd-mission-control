import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  real,
  bigint,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authUsers = pgTable(
  'auth_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    email: uniqueIndex('auth_users_email_idx').on(table.email),
    owner: uniqueIndex('auth_users_one_owner_idx').on(table.role),
  }),
);
export const integrationSnapshots = pgTable('integration_snapshots', {
  integrationId: uuid('integration_id')
    .primaryKey()
    .references(() => integrations.id),
  state: text('state').notNull(),
  reachable: boolean('reachable').notNull(),
  internetConnected: boolean('internet_connected'),
  latencyMs: real('latency_ms'),
  packetLossPercent: real('packet_loss_percent'),
  downlinkThroughputBps: real('downlink_throughput_bps'),
  uplinkThroughputBps: real('uplink_throughput_bps'),
  obstructionFraction: real('obstruction_fraction'),
  uptimeSeconds: bigint('uptime_seconds', { mode: 'number' }),
  powerWatts: real('power_watts'),
  hardwareVersion: text('hardware_version'),
  firmwareVersion: text('firmware_version'),
  lastSuccessfulSampleAt: timestamp('last_successful_sample_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const telemetrySamples = pgTable(
  'telemetry_samples',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    metric: text('metric').notNull(),
    value: real('value').notNull(),
    unit: text('unit').notNull(),
  },
  (table) => ({
    query: index('telemetry_query_idx').on(table.integrationId, table.metric, table.recordedAt),
    dedupe: uniqueIndex('telemetry_dedupe_idx').on(
      table.integrationId,
      table.metric,
      table.recordedAt,
    ),
  }),
);
export const pathProbes = pgTable(
  'path_probes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id),
    kind: text('kind').notNull(),
    target: text('target').notNull(),
    status: text('status').notNull(),
    latencyMs: real('latency_ms'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    detail: text('detail'),
  },
  (table) => ({
    query: index('path_probes_query_idx').on(table.integrationId, table.observedAt),
  }),
);
export const speedTests = pgTable('speed_tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id')
    .notNull()
    .references(() => integrations.id),
  state: text('state').notNull(),
  bytesTransferred: bigint('bytes_transferred', { mode: 'number' }).notNull(),
  downloadBps: real('download_bps'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  error: text('error'),
});
export const networkEvents = pgTable(
  'network_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    category: text('category').notNull(),
    severity: text('severity').notNull(),
    description: text('description').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    fingerprint: text('fingerprint').notNull(),
  },
  (table) => ({
    query: index('events_query_idx').on(table.integrationId, table.occurredAt),
    dedupe: uniqueIndex('events_dedupe_idx').on(
      table.integrationId,
      table.fingerprint,
      table.occurredAt,
    ),
  }),
);

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    firstObservedValue: real('first_observed_value'),
    latestObservedValue: real('latest_observed_value'),
    thresholdMetadata: jsonb('threshold_metadata').$type<Record<string, unknown>>().notNull(),
    source: text('source').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeQuery: index('incidents_active_query_idx').on(
      table.integrationId,
      table.active,
      table.startedAt,
    ),
    historyQuery: index('incidents_history_query_idx').on(
      table.integrationId,
      table.startedAt,
      table.type,
    ),
  }),
);

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id').references(() => integrations.id),
    incidentType: text('incident_type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    warningThreshold: real('warning_threshold'),
    criticalThreshold: real('critical_threshold'),
    persistenceSeconds: bigint('persistence_seconds', { mode: 'number' }).notNull(),
    recoverySeconds: bigint('recovery_seconds', { mode: 'number' }).notNull(),
    cooldownSeconds: bigint('cooldown_seconds', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lookup: uniqueIndex('alert_rules_scope_type_idx').on(table.integrationId, table.incidentType),
  }),
);

export const alertOccurrences = pgTable(
  'alert_occurrences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    message: text('message').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    acknowledged: boolean('acknowledged').notNull().default(false),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (table) => ({
    query: index('alert_occurrences_query_idx').on(table.occurredAt, table.acknowledged),
    incident: index('alert_occurrences_incident_idx').on(table.incidentId, table.occurredAt),
  }),
);

export const dailySummaries = pgTable(
  'daily_summaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id),
    summaryDate: text('summary_date').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueDay: uniqueIndex('daily_summaries_integration_day_idx').on(
      table.integrationId,
      table.summaryDate,
    ),
  }),
);
