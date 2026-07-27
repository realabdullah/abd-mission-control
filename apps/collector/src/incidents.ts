import { randomUUID } from 'node:crypto';
import type {
  AlertRule,
  IncidentSeverity,
  IncidentType,
  StarlinkSnapshot,
} from '@abd-mission-control/contracts';
import { alertRuleSchema } from '@abd-mission-control/contracts';

export type CollectorObservationHealth = {
  state: string;
  lastSuccess: string | null;
};

export type IncidentStore = {
  ensureDefaultAlertRules(integrationId: string): Promise<void>;
  getAlertRules(integrationId?: string): Promise<unknown[]>;
  getActiveIncident(integrationId: string, dedupeKey: string): Promise<unknown | null>;
  openIncident(input: {
    integrationId: string;
    type: IncidentType;
    severity: IncidentSeverity;
    title: string;
    description: string;
    startedAt: Date;
    firstObservedValue: number | null;
    latestObservedValue: number | null;
    thresholdMetadata: Record<string, unknown>;
    source: 'collector' | 'rule' | 'system';
    dedupeKey: string;
  }): Promise<unknown>;
  updateIncident(id: string, patch: Record<string, unknown>): Promise<unknown | null>;
  resolveIncident(id: string, endedAt: Date): Promise<unknown | null>;
  createOccurrence(input: {
    incidentId: string;
    type: 'opened' | 'escalated' | 'resolved';
    severity: IncidentSeverity;
    message: string;
    occurredAt: Date;
  }): Promise<unknown>;
};

type StoredIncident = { id: string; severity: IncidentSeverity; startedAt: Date; active: boolean };
type StoredRule = AlertRule;
type Pending = { since: number; recoverySince: number | null };

const titleByType: Record<IncidentType, string> = {
  internet_connectivity_lost: 'Internet offline',
  starlink_device_unreachable: 'Starlink unreachable',
  collector_delayed: 'Telemetry delayed',
  collector_stopped: 'Collector stopped',
  invalid_starlink_response: 'Invalid Starlink response',
  database_unavailable: 'Monitoring unavailable',
  high_latency: 'High latency',
  elevated_packet_loss: 'Elevated packet loss',
  obstruction_degradation: 'Obstruction degradation',
};

const descriptionByType: Record<IncidentType, string> = {
  internet_connectivity_lost:
    'The Starlink device is reachable, but its confirmed readiness state is offline.',
  starlink_device_unreachable: 'The collector cannot reach the local Starlink RPC endpoint.',
  collector_delayed:
    'The collector has not produced a successful sample within the expected window.',
  collector_stopped: 'The collector process has stopped reporting health.',
  invalid_starlink_response: 'The Starlink response failed runtime validation.',
  database_unavailable: 'The collector cannot persist the latest observation.',
  high_latency: 'Latency has remained above the configured threshold.',
  elevated_packet_loss: 'Packet loss has remained above the configured threshold.',
  obstruction_degradation: 'Obstruction has remained above the configured threshold.',
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
function incident(value: unknown): StoredIncident | null {
  const row = record(value);
  if (!row || typeof row.id !== 'string' || typeof row.severity !== 'string') return null;
  if (!['info', 'warning', 'critical'].includes(row.severity)) return null;
  return {
    id: row.id,
    severity: row.severity as IncidentSeverity,
    startedAt: new Date(String(row.startedAt)),
    active: row.active === true,
  };
}
function rule(value: unknown): StoredRule | null {
  const row = record(value);
  if (!row) return null;
  const parsed = alertRuleSchema.safeParse({
    id: row.id,
    integrationId: row.integrationId ?? null,
    incidentType: row.incidentType,
    enabled: row.enabled,
    warningThreshold: row.warningThreshold ?? null,
    criticalThreshold: row.criticalThreshold ?? null,
    persistenceSeconds: Number(row.persistenceSeconds),
    recoverySeconds: Number(row.recoverySeconds),
    cooldownSeconds: Number(row.cooldownSeconds),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  });
  return parsed.success ? parsed.data : null;
}

export class IncidentRuleEngine {
  private readonly pending = new Map<IncidentType, Pending>();
  private readonly cooldownUntil = new Map<IncidentType, number>();
  private defaultsEnsured = false;
  constructor(
    private readonly integrationId: string,
    private readonly store: IncidentStore,
    private readonly publish?: (type: string, data: unknown) => Promise<void>,
  ) {}

  async evaluateSnapshot(snapshot: StarlinkSnapshot, now = new Date()): Promise<void> {
    await this.evaluateAll(snapshot, { state: 'healthy', lastSuccess: snapshot.updatedAt }, now);
  }

  async evaluateHealth(health: CollectorObservationHealth, now = new Date()): Promise<void> {
    await this.evaluateAll(null, health, now);
  }

  private async evaluateAll(
    snapshot: StarlinkSnapshot | null,
    health: CollectorObservationHealth,
    now: Date,
  ): Promise<void> {
    if (!this.defaultsEnsured) {
      await this.store.ensureDefaultAlertRules(this.integrationId);
      this.defaultsEnsured = true;
    }
    const rules = (await this.store.getAlertRules(this.integrationId))
      .map(rule)
      .filter((v): v is StoredRule => v !== null);
    const byType = new Map(rules.map((item) => [item.incidentType, item]));
    const checks: Array<[IncidentType, number | null, boolean]> = [
      [
        'internet_connectivity_lost',
        null,
        snapshot?.reachable === true && snapshot.internetConnected === false,
      ],
      ['starlink_device_unreachable', null, health.state === 'starlink_unreachable'],
      ['collector_delayed', null, health.state === 'delayed'],
      ['collector_stopped', null, health.state === 'stopped'],
      ['invalid_starlink_response', null, health.state === 'starlink_response_invalid'],
      ['database_unavailable', null, health.state === 'database_unavailable'],
      [
        'high_latency',
        snapshot?.latencyMs ?? null,
        snapshot?.latencyMs !== null &&
          snapshot?.latencyMs !== undefined &&
          snapshot.latencyMs >=
            Number(byType.get('high_latency')?.warningThreshold ?? Number.MAX_SAFE_INTEGER),
      ],
      [
        'elevated_packet_loss',
        snapshot?.packetLossPercent ?? null,
        snapshot?.packetLossPercent !== null &&
          snapshot?.packetLossPercent !== undefined &&
          snapshot.packetLossPercent >=
            Number(byType.get('elevated_packet_loss')?.warningThreshold ?? Number.MAX_SAFE_INTEGER),
      ],
      [
        'obstruction_degradation',
        snapshot?.obstructionFraction ?? null,
        snapshot?.obstructionFraction !== null &&
          snapshot?.obstructionFraction !== undefined &&
          snapshot.obstructionFraction >=
            Number(
              byType.get('obstruction_degradation')?.warningThreshold ?? Number.MAX_SAFE_INTEGER,
            ),
      ],
    ];
    for (const [type, value, triggered] of checks) {
      const configured = byType.get(type);
      if (!configured?.enabled) continue;
      await this.evaluateRule(
        type,
        value,
        triggered,
        configured,
        snapshot?.updatedAt ? new Date(snapshot.updatedAt) : now,
      );
    }
  }

  private async evaluateRule(
    type: IncidentType,
    value: number | null,
    triggered: boolean,
    configured: StoredRule,
    observedAt: Date,
  ): Promise<void> {
    const now = observedAt.getTime();
    const existing = incident(await this.store.getActiveIncident(this.integrationId, type));
    const current = this.pending.get(type);
    if (triggered) {
      const pending = current ?? { since: now, recoverySince: null };
      pending.recoverySince = null;
      this.pending.set(type, pending);
      if (
        !existing &&
        now >= (this.cooldownUntil.get(type) ?? 0) &&
        now - pending.since >= configured.persistenceSeconds * 1000
      ) {
        const severity = this.severityFor(type, value, configured);
        const created = incident(
          await this.store.openIncident({
            integrationId: this.integrationId,
            type,
            severity,
            title: titleByType[type],
            description: descriptionByType[type],
            startedAt: new Date(pending.since),
            firstObservedValue: value,
            latestObservedValue: value,
            thresholdMetadata: {
              warningThreshold: configured.warningThreshold,
              criticalThreshold: configured.criticalThreshold,
              persistenceSeconds: configured.persistenceSeconds,
            },
            source: 'rule',
            dedupeKey: type,
          }),
        );
        if (created) await this.opened(created, severity, observedAt);
      } else if (existing && value !== null) {
        const severity = this.severityFor(type, value, configured);
        if (severity !== existing.severity) {
          const updated = incident(
            await this.store.updateIncident(existing.id, { severity, latestObservedValue: value }),
          );
          if (updated) {
            await this.store.createOccurrence({
              incidentId: existing.id,
              type: 'escalated',
              severity,
              message: `${titleByType[type]} severity increased`,
              occurredAt: observedAt,
            });
            await this.publish?.('incident.updated', updated);
            await this.publish?.('alert.created', {
              incidentId: existing.id,
              type: 'escalated',
              severity,
            });
          }
        } else await this.store.updateIncident(existing.id, { latestObservedValue: value });
      }
      return;
    }
    if (!existing) {
      this.pending.delete(type);
      return;
    }
    const recovery = current ?? { since: existing.startedAt.getTime(), recoverySince: now };
    recovery.recoverySince ??= now;
    this.pending.set(type, recovery);
    if (now - recovery.recoverySince >= configured.recoverySeconds * 1000) {
      const resolved = await this.store.resolveIncident(existing.id, observedAt);
      if (resolved) {
        await this.store.createOccurrence({
          incidentId: existing.id,
          type: 'resolved',
          severity: existing.severity,
          message: `${titleByType[type]} resolved`,
          occurredAt: observedAt,
        });
        await this.publish?.('incident.resolved', resolved);
        this.cooldownUntil.set(type, now + configured.cooldownSeconds * 1000);
      }
      this.pending.delete(type);
    }
  }

  private severityFor(
    type: IncidentType,
    value: number | null,
    configured: StoredRule,
  ): IncidentSeverity {
    if (
      value !== null &&
      configured.criticalThreshold !== null &&
      value >= configured.criticalThreshold
    )
      return 'critical';
    if (type === 'internet_connectivity_lost' || type === 'starlink_device_unreachable')
      return 'critical';
    return 'warning';
  }

  private async opened(
    value: StoredIncident,
    severity: IncidentSeverity,
    occurredAt: Date,
  ): Promise<void> {
    await this.store.createOccurrence({
      incidentId: value.id,
      type: 'opened',
      severity,
      message: `${titleByTypeForId(value.id)} requires attention`,
      occurredAt,
    });
    await this.publish?.('incident.opened', value);
    await this.publish?.('alert.created', { incidentId: value.id, type: 'opened', severity });
  }
}

function titleByTypeForId(id: string): string {
  return `Incident ${id.slice(0, 8)}`;
}

export function createIncidentId(): string {
  return randomUUID();
}
