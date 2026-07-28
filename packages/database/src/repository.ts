import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type {
  StarlinkSnapshot,
  TelemetrySample,
  NetworkEvent,
  PathProbe,
  SpeedTest,
} from '@abd-mission-control/contracts';
import * as schema from './schema';
import {
  integrations,
  integrationSnapshots,
  telemetrySamples,
  pathProbes,
  speedTests,
  networkEvents,
  incidents,
  alertRules,
  alertOccurrences,
  dailySummaries,
  authUsers,
} from './schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
type Db = PostgresJsDatabase<typeof schema>;

export type IncidentRecord = {
  id: string;
  integrationId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  startedAt: Date;
  endedAt: Date | null;
  active: boolean;
  firstObservedValue: number | null;
  latestObservedValue: number | null;
  thresholdMetadata: Record<string, unknown>;
  source: string;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IncidentInput = Omit<
  IncidentRecord,
  'id' | 'createdAt' | 'updatedAt' | 'endedAt' | 'active'
> & {
  endedAt?: Date | null;
  active?: boolean;
};

export const defaultAlertRules = [
  {
    incidentType: 'internet_connectivity_lost',
    warningThreshold: null,
    criticalThreshold: null,
    persistenceSeconds: 60,
    recoverySeconds: 30,
    cooldownSeconds: 300,
  },
  {
    incidentType: 'starlink_device_unreachable',
    warningThreshold: null,
    criticalThreshold: null,
    persistenceSeconds: 60,
    recoverySeconds: 30,
    cooldownSeconds: 300,
  },
  {
    incidentType: 'collector_delayed',
    warningThreshold: null,
    criticalThreshold: null,
    persistenceSeconds: 60,
    recoverySeconds: 60,
    cooldownSeconds: 300,
  },
  {
    incidentType: 'collector_stopped',
    warningThreshold: null,
    criticalThreshold: null,
    persistenceSeconds: 0,
    recoverySeconds: 60,
    cooldownSeconds: 300,
  },
  {
    incidentType: 'invalid_starlink_response',
    warningThreshold: null,
    criticalThreshold: null,
    persistenceSeconds: 0,
    recoverySeconds: 60,
    cooldownSeconds: 300,
  },
  {
    incidentType: 'database_unavailable',
    warningThreshold: null,
    criticalThreshold: null,
    persistenceSeconds: 0,
    recoverySeconds: 60,
    cooldownSeconds: 300,
  },
  {
    incidentType: 'high_latency',
    warningThreshold: 120,
    criticalThreshold: 300,
    persistenceSeconds: 180,
    recoverySeconds: 120,
    cooldownSeconds: 600,
  },
  {
    incidentType: 'elevated_packet_loss',
    warningThreshold: 2,
    criticalThreshold: 10,
    persistenceSeconds: 180,
    recoverySeconds: 120,
    cooldownSeconds: 600,
  },
  {
    incidentType: 'obstruction_degradation',
    warningThreshold: 0.1,
    criticalThreshold: 0.25,
    persistenceSeconds: 300,
    recoverySeconds: 180,
    cooldownSeconds: 900,
  },
] as const;

export class TelemetryRepository {
  constructor(private readonly db: Db) {}
  async ensureIntegration(id: string, name: string): Promise<void> {
    await this.db
      .insert(integrations)
      .values({ id, type: 'starlink', name, enabled: true })
      .onConflictDoNothing();
  }
  async saveSnapshot(snapshot: StarlinkSnapshot): Promise<void> {
    await this.db
      .insert(integrationSnapshots)
      .values({
        integrationId: snapshot.integrationId,
        state: snapshot.state,
        reachable: snapshot.reachable,
        internetConnected: snapshot.internetConnected,
        latencyMs: snapshot.latencyMs,
        packetLossPercent: snapshot.packetLossPercent,
        downlinkThroughputBps: snapshot.downlinkThroughputBps,
        uplinkThroughputBps: snapshot.uplinkThroughputBps,
        obstructionFraction: snapshot.obstructionFraction,
        uptimeSeconds: snapshot.uptimeSeconds,
        powerWatts: snapshot.powerWatts,
        hardwareVersion: snapshot.hardwareVersion,
        firmwareVersion: snapshot.firmwareVersion,
        lastSuccessfulSampleAt: snapshot.lastSuccessfulSampleAt
          ? new Date(snapshot.lastSuccessfulSampleAt)
          : null,
        updatedAt: new Date(snapshot.updatedAt),
      })
      .onConflictDoUpdate({
        target: integrationSnapshots.integrationId,
        set: {
          state: snapshot.state,
          reachable: snapshot.reachable,
          internetConnected: snapshot.internetConnected,
          latencyMs: snapshot.latencyMs,
          packetLossPercent: snapshot.packetLossPercent,
          downlinkThroughputBps: snapshot.downlinkThroughputBps,
          uplinkThroughputBps: snapshot.uplinkThroughputBps,
          obstructionFraction: snapshot.obstructionFraction,
          uptimeSeconds: snapshot.uptimeSeconds,
          powerWatts: snapshot.powerWatts,
          hardwareVersion: snapshot.hardwareVersion,
          firmwareVersion: snapshot.firmwareVersion,
          lastSuccessfulSampleAt: new Date(snapshot.lastSuccessfulSampleAt ?? snapshot.updatedAt),
          updatedAt: new Date(snapshot.updatedAt),
        },
      });
  }
  async addSamples(samples: TelemetrySample[], integrationId: string): Promise<void> {
    if (!samples.length) return;
    await this.db
      .insert(telemetrySamples)
      .values(
        samples.map((s) => ({
          integrationId,
          recordedAt: new Date(s.timestamp),
          metric: s.metric,
          value: s.value,
          unit: s.unit,
        })),
      )
      .onConflictDoNothing();
  }
  async addPathProbes(probes: PathProbe[], integrationId: string): Promise<void> {
    if (!probes.length) return;
    await this.db.insert(pathProbes).values(
      probes.map((probe) => ({
        id: probe.id,
        integrationId,
        kind: probe.kind,
        target: probe.target,
        status: probe.status,
        latencyMs: probe.latencyMs,
        observedAt: new Date(probe.observedAt),
        detail: probe.detail,
      })),
    );
  }
  async addSpeedTest(test: SpeedTest): Promise<void> {
    await this.db.insert(speedTests).values({
      id: test.id,
      integrationId: test.integrationId,
      state: test.state,
      bytesTransferred: test.bytesTransferred,
      downloadBps: test.downloadBps,
      startedAt: new Date(test.startedAt),
      completedAt: new Date(test.completedAt),
      error: test.error,
    });
  }
  async getSpeedTests(id: string, limit: number): Promise<unknown[]> {
    return this.db
      .select()
      .from(speedTests)
      .where(eq(speedTests.integrationId, id))
      .orderBy(desc(speedTests.completedAt))
      .limit(limit);
  }
  async addEvent(event: NetworkEvent, integrationId: string): Promise<void> {
    await this.db
      .insert(networkEvents)
      .values({
        id: event.id,
        integrationId,
        occurredAt: new Date(event.timestamp),
        category: event.category,
        severity: event.severity,
        description: event.description,
        resolvedAt: event.resolvedAt ? new Date(event.resolvedAt) : null,
        fingerprint: `${event.category}:${event.description}`,
      })
      .onConflictDoNothing();
  }
  async getSnapshot(id: string): Promise<unknown> {
    const rows = await this.db
      .select()
      .from(integrationSnapshots)
      .where(eq(integrationSnapshots.integrationId, id))
      .limit(1);
    return rows[0] ?? null;
  }
  async getTelemetry(
    id: string,
    metric: string | undefined,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<unknown[]> {
    const conditions = [
      eq(telemetrySamples.integrationId, id),
      gte(telemetrySamples.recordedAt, from),
      lte(telemetrySamples.recordedAt, to),
    ];
    if (metric) conditions.push(eq(telemetrySamples.metric, metric));
    return this.db
      .select()
      .from(telemetrySamples)
      .where(and(...conditions))
      .orderBy(desc(telemetrySamples.recordedAt))
      .limit(limit);
  }
  async getTelemetryAggregated(
    id: string,
    metric: string | undefined,
    from: Date,
    to: Date,
    bucketSeconds: number,
    limit: number,
  ): Promise<unknown[]> {
    const filter = metric ? sql`AND metric = ${metric}` : sql``;
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const rows = await this.db.execute(
      sql`WITH bucketed AS (SELECT metric, date_bin(${`${bucketSeconds} seconds`}::interval, recorded_at, TIMESTAMPTZ '1970-01-01') AS bucket, value, recorded_at FROM telemetry_samples WHERE integration_id = ${id} AND recorded_at >= ${fromIso} AND recorded_at <= ${toIso} ${filter}), stats AS (SELECT metric, bucket, min(value) AS minimum, max(value) AS maximum, avg(value) AS average, count(*)::int AS sample_count FROM bucketed GROUP BY metric, bucket), latest AS (SELECT DISTINCT ON (metric, bucket) metric, bucket, value AS latest FROM bucketed ORDER BY metric, bucket, recorded_at DESC) SELECT stats.bucket AS timestamp, stats.metric, stats.minimum, stats.maximum, stats.average, latest.latest, stats.sample_count AS "sampleCount" FROM stats JOIN latest USING(metric, bucket) ORDER BY stats.bucket ASC LIMIT ${limit}`,
    );
    return [...rows];
  }
  async getEvents(id: string, limit: number): Promise<unknown[]> {
    return this.db
      .select()
      .from(networkEvents)
      .where(eq(networkEvents.integrationId, id))
      .orderBy(desc(networkEvents.occurredAt))
      .limit(limit);
  }
  async getPathProbes(id: string, limit: number): Promise<unknown[]> {
    return this.db
      .select()
      .from(pathProbes)
      .where(eq(pathProbes.integrationId, id))
      .orderBy(desc(pathProbes.observedAt))
      .limit(limit);
  }

  async ensureDefaultAlertRules(integrationId: string): Promise<void> {
    await this.db
      .insert(alertRules)
      .values(
        defaultAlertRules.map((rule) => ({
          integrationId,
          incidentType: rule.incidentType,
          enabled: true,
          warningThreshold: rule.warningThreshold,
          criticalThreshold: rule.criticalThreshold,
          persistenceSeconds: rule.persistenceSeconds,
          recoverySeconds: rule.recoverySeconds,
          cooldownSeconds: rule.cooldownSeconds,
        })),
      )
      .onConflictDoNothing();
  }

  async getAlertRules(integrationId?: string): Promise<unknown[]> {
    return this.db
      .select()
      .from(alertRules)
      .where(integrationId ? eq(alertRules.integrationId, integrationId) : undefined)
      .orderBy(alertRules.incidentType);
  }

  async updateAlertRule(
    id: string,
    patch: Partial<{
      enabled: boolean;
      warningThreshold: number | null;
      criticalThreshold: number | null;
      persistenceSeconds: number;
      recoverySeconds: number;
      cooldownSeconds: number;
    }>,
  ): Promise<unknown | null> {
    const rows = await this.db
      .update(alertRules)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async getActiveIncident(integrationId: string, dedupeKey: string): Promise<unknown | null> {
    const rows = await this.db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.integrationId, integrationId),
          eq(incidents.dedupeKey, dedupeKey),
          eq(incidents.active, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async openIncident(input: IncidentInput): Promise<unknown> {
    const rows = await this.db
      .insert(incidents)
      .values({
        ...input,
        thresholdMetadata: input.thresholdMetadata,
        active: input.active ?? true,
        endedAt: input.endedAt ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (rows[0]) return rows[0];
    return this.getActiveIncident(input.integrationId, input.dedupeKey);
  }

  async updateIncident(
    id: string,
    patch: Partial<
      Pick<IncidentRecord, 'severity' | 'description' | 'latestObservedValue' | 'thresholdMetadata'>
    >,
  ): Promise<unknown | null> {
    const rows = await this.db
      .update(incidents)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async resolveIncident(id: string, endedAt: Date): Promise<unknown | null> {
    const rows = await this.db
      .update(incidents)
      .set({ active: false, endedAt, updatedAt: endedAt })
      .where(eq(incidents.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async getIncidents(options: {
    integrationId: string;
    active?: boolean;
    type?: string;
    severity?: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }): Promise<unknown[]> {
    const conditions = [eq(incidents.integrationId, options.integrationId)];
    if (options.active !== undefined) conditions.push(eq(incidents.active, options.active));
    if (options.type) conditions.push(eq(incidents.type, options.type));
    if (options.severity) conditions.push(eq(incidents.severity, options.severity));
    if (options.from) conditions.push(gte(incidents.startedAt, options.from));
    if (options.to) conditions.push(lte(incidents.startedAt, options.to));
    return this.db
      .select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.startedAt))
      .limit(options.limit)
      .offset(options.offset);
  }

  async getIncidentById(id: string): Promise<unknown | null> {
    const rows = await this.db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createOccurrence(input: {
    incidentId: string;
    type: 'opened' | 'escalated' | 'resolved';
    severity: string;
    message: string;
    occurredAt: Date;
  }): Promise<unknown> {
    const rows = await this.db.insert(alertOccurrences).values(input).returning();
    return rows[0];
  }

  async getOccurrences(limit: number, acknowledged?: boolean): Promise<unknown[]> {
    return this.db
      .select()
      .from(alertOccurrences)
      .where(
        acknowledged === undefined ? undefined : eq(alertOccurrences.acknowledged, acknowledged),
      )
      .orderBy(desc(alertOccurrences.occurredAt))
      .limit(limit);
  }

  async getOccurrencesForIncident(incidentId: string, limit: number): Promise<unknown[]> {
    return this.db
      .select()
      .from(alertOccurrences)
      .where(eq(alertOccurrences.incidentId, incidentId))
      .orderBy(desc(alertOccurrences.occurredAt))
      .limit(limit);
  }

  async acknowledgeOccurrence(id: string): Promise<unknown | null> {
    const rows = await this.db
      .update(alertOccurrences)
      .set({ acknowledged: true, acknowledgedAt: new Date() })
      .where(eq(alertOccurrences.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async getIncidentStats(
    integrationId: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, unknown>> {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const [incidentsRows, metricRows, totalRows] = await Promise.all([
      this.db.execute(
        sql`SELECT started_at AS "startedAt", ended_at AS "endedAt", active FROM incidents WHERE integration_id = ${integrationId} AND type IN ('internet_connectivity_lost', 'starlink_device_unreachable') AND started_at <= ${toIso} AND (ended_at IS NULL OR ended_at >= ${fromIso}) ORDER BY started_at`,
      ),
      this.db.execute(
        sql`SELECT metric, avg(value) AS average, max(value) AS maximum, percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95 FROM telemetry_samples WHERE integration_id = ${integrationId} AND recorded_at >= ${fromIso} AND recorded_at <= ${toIso} GROUP BY metric`,
      ),
      this.db.execute(
        sql`SELECT count(*)::int AS count FROM telemetry_samples WHERE integration_id = ${integrationId} AND recorded_at >= ${fromIso} AND recorded_at <= ${toIso}`,
      ),
    ]);
    const outageDurations = incidentsRows
      .map((row) => {
        const started = new Date(String(row.startedAt)).getTime();
        const ended = row.endedAt ? new Date(String(row.endedAt)).getTime() : to.getTime();
        return (
          Math.max(0, Math.min(ended, to.getTime()) - Math.max(started, from.getTime())) / 1000
        );
      })
      .sort((a, b) => a - b);
    const metric = (name: string): Record<string, unknown> | undefined =>
      metricRows.find((row) => row.metric === name);
    const totalSeconds = Math.max(1, (to.getTime() - from.getTime()) / 1000);
    const totalOutageSeconds = Math.min(
      totalSeconds,
      outageDurations.reduce((sum, value) => sum + value, 0),
    );
    const latency = metric('latency_ms');
    const loss = metric('packet_loss_percent');
    const obstruction = metric('obstruction_fraction');
    const count = Number(totalRows[0]?.count ?? 0);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      uptimePercent: Math.max(
        0,
        Math.min(100, ((totalSeconds - totalOutageSeconds) / totalSeconds) * 100),
      ),
      totalOutageSeconds,
      outageCount: outageDurations.length,
      longestOutageSeconds: outageDurations.at(-1) ?? 0,
      medianOutageSeconds: outageDurations.length
        ? outageDurations[Math.floor(outageDurations.length / 2)]
        : 0,
      meanOutageSeconds: outageDurations.length ? totalOutageSeconds / outageDurations.length : 0,
      latencyAverageMs: latency ? Number(latency.average) : null,
      latencyP95Ms: latency ? Number(latency.p95) : null,
      latencyMaximumMs: latency ? Number(latency.maximum) : null,
      packetLossAveragePercent: loss ? Number(loss.average) : null,
      obstructionAverageFraction: obstruction ? Number(obstruction.average) : null,
      telemetryCompletenessPercent: Math.min(
        100,
        (count / Math.max(1, Math.ceil(totalSeconds / 30))) * 100,
      ),
    };
  }

  async saveDailySummary(
    integrationId: string,
    date: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    const rows = await this.db
      .insert(dailySummaries)
      .values({ integrationId, summaryDate: date, data, generatedAt: new Date() })
      .onConflictDoUpdate({
        target: [dailySummaries.integrationId, dailySummaries.summaryDate],
        set: { data, generatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }

  async getDailySummaries(integrationId: string, limit: number): Promise<unknown[]> {
    return this.db
      .select()
      .from(dailySummaries)
      .where(eq(dailySummaries.integrationId, integrationId))
      .orderBy(desc(dailySummaries.summaryDate))
      .limit(limit);
  }
  async cleanupExpired(
    beforeTelemetry: Date,
    beforeEvents: Date,
    batchSize: number,
  ): Promise<{ samples: number; events: number }> {
    const sampleRows = await this.db.execute(
      sql`WITH doomed AS (SELECT id FROM telemetry_samples WHERE recorded_at < ${beforeTelemetry.toISOString()}::timestamptz LIMIT ${batchSize}) DELETE FROM telemetry_samples USING doomed WHERE telemetry_samples.id = doomed.id RETURNING telemetry_samples.id`,
    );
    const eventRows = await this.db.execute(
      sql`WITH doomed AS (SELECT id FROM network_events WHERE occurred_at < ${beforeEvents.toISOString()}::timestamptz LIMIT ${batchSize}) DELETE FROM network_events USING doomed WHERE network_events.id = doomed.id RETURNING network_events.id`,
    );
    return { samples: sampleRows.length, events: eventRows.length };
  }
}

export type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
};

export class AuthRepository {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const rows = await this.db
      .select({
        id: authUsers.id,
        email: authUsers.email,
        passwordHash: authUsers.passwordHash,
        role: authUsers.role,
      })
      .from(authUsers)
      .where(eq(authUsers.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Pick<AuthUserRecord, 'id' | 'email' | 'role'> | null> {
    const rows = await this.db
      .select({ id: authUsers.id, email: authUsers.email, role: authUsers.role })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async createOwner(email: string, passwordHash: string): Promise<void> {
    await this.db
      .insert(authUsers)
      .values({ email: email.toLowerCase(), passwordHash, role: 'owner' })
      .onConflictDoNothing();
  }
}
