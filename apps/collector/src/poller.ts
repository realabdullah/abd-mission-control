import { randomUUID } from 'node:crypto';

import type {
  NetworkEvent,
  StarlinkSnapshot,
  TelemetrySample,
} from '@abd-mission-control/contracts';
import { StarlinkError, type StarlinkTelemetryProvider } from '@abd-mission-control/integrations';
import { IncidentRuleEngine } from './incidents';

export type CollectorState =
  | 'starting'
  | 'healthy'
  | 'delayed'
  | 'degraded'
  | 'stopped'
  | 'database_unavailable'
  | 'starlink_unreachable'
  | 'starlink_response_invalid';
export type RetryClassification = 'transient' | 'non_transient';
export type Clock = { now(): number; sleep(ms: number, signal: AbortSignal): Promise<void> };
export type CollectorSink = {
  ensureIntegration(id: string, name: string): Promise<void>;
  saveSnapshot(snapshot: StarlinkSnapshot): Promise<void>;
  addSamples(samples: TelemetrySample[], integrationId: string): Promise<void>;
  addEvent(event: NetworkEvent, integrationId: string): Promise<void>;
};
export type CollectorPublisher = (type: string, data: unknown) => Promise<void>;
export type PollerOptions = {
  intervalMs: number;
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  random: () => number;
  clock: Clock;
  integrationId: string;
  sink: CollectorSink;
  provider: StarlinkTelemetryProvider;
  incidentEngine?: IncidentRuleEngine;
  publish?: CollectorPublisher;
  logger?: (event: string, details: Record<string, unknown>) => void;
};

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('retry wait aborted'));
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('retry wait aborted'));
        },
        { once: true },
      );
    }),
};
export function telemetrySamples(snapshot: StarlinkSnapshot): TelemetrySample[] {
  const rows: Array<[TelemetrySample['metric'], number | null, string]> = [
    ['latency_ms', snapshot.latencyMs, 'ms'],
    ['packet_loss_percent', snapshot.packetLossPercent, '%'],
    ['downlink_throughput_bps', snapshot.downlinkThroughputBps, 'bps'],
    ['uplink_throughput_bps', snapshot.uplinkThroughputBps, 'bps'],
    ['obstruction_fraction', snapshot.obstructionFraction, 'fraction'],
    ['uptime_seconds', snapshot.uptimeSeconds, 's'],
    ['power_watts', snapshot.powerWatts, 'W'],
  ];
  return rows.flatMap(([metric, value, unit]) =>
    value === null ? [] : [{ timestamp: snapshot.updatedAt, metric, value, unit }],
  );
}
export function classifyError(error: unknown): RetryClassification {
  return error instanceof StarlinkError &&
    (error.code === 'unavailable' || error.code === 'timeout')
    ? 'transient'
    : 'non_transient';
}
export function stateForFailure(error: unknown): CollectorState {
  if (error instanceof StarlinkError && error.code === 'malformed')
    return 'starlink_response_invalid';
  if (error instanceof StarlinkError) return 'starlink_unreachable';
  return 'database_unavailable';
}

export class CollectorPoller {
  private running = false;
  private stopped = false;
  private abortController = new AbortController();
  private state: CollectorState = 'starting';
  private lastAttempt: number | null = null;
  private lastSuccess: number | null = null;
  private retryAttempt = 0;
  private previous: StarlinkSnapshot | null = null;
  private lastFailure: CollectorState | null = null;
  constructor(private readonly options: PollerOptions) {}
  getHealth(now = this.options.clock.now()): {
    state: CollectorState;
    lastAttempt: string | null;
    lastSuccess: string | null;
    retryAttempt: number;
  } {
    const stale =
      this.lastAttempt !== null &&
      (this.lastSuccess === null || now - this.lastSuccess > this.options.intervalMs * 2);
    const state = this.stopped
      ? 'stopped'
      : stale && this.state === 'healthy'
        ? 'delayed'
        : this.state;
    return {
      state,
      lastAttempt: this.lastAttempt === null ? null : new Date(this.lastAttempt).toISOString(),
      lastSuccess: this.lastSuccess === null ? null : new Date(this.lastSuccess).toISOString(),
      retryAttempt: this.retryAttempt,
    };
  }
  async runCycle(): Promise<boolean> {
    if (this.running || this.stopped) return false;
    this.running = true;
    this.lastAttempt = this.options.clock.now();
    try {
      const snapshot = await this.withRetry();
      const samples = telemetrySamples(snapshot);
      const events = [
        this.transition(snapshot),
        this.recovery(snapshot),
        this.firmwareTransition(snapshot),
      ].filter((value): value is NetworkEvent => value !== null);
      try {
        await this.options.sink.ensureIntegration(this.options.integrationId, snapshot.name);
        await this.options.sink.saveSnapshot({
          ...snapshot,
          integrationId: this.options.integrationId,
        });
        await this.options.sink.addSamples(samples, this.options.integrationId);
        for (const event of events)
          await this.options.sink.addEvent(event, this.options.integrationId);
      } catch (error: unknown) {
        this.state = 'database_unavailable';
        this.options.logger?.('collector.persistence_failed', {
          error: error instanceof Error ? error.message : 'unknown',
        });
        return false;
      }
      this.previous = snapshot;
      this.lastSuccess = this.options.clock.now();
      this.state = 'healthy';
      this.retryAttempt = 0;
      this.lastFailure = null;
      await this.options.publish?.('snapshot', snapshot);
      for (const sample of samples) await this.options.publish?.('sample', sample);
      for (const event of events) await this.options.publish?.('event', event);
      await this.options.incidentEngine?.evaluateSnapshot(snapshot);
      return true;
    } catch (error: unknown) {
      this.state = stateForFailure(error);
      if (this.lastFailure !== this.state) {
        const failureEvent: NetworkEvent = {
          id: randomUUID(),
          timestamp: new Date(this.options.clock.now()).toISOString(),
          category: this.state === 'starlink_unreachable' ? 'reachability' : 'collector',
          severity: 'error',
          description:
            this.state === 'starlink_unreachable'
              ? 'Starlink became unreachable'
              : this.state === 'starlink_response_invalid'
                ? 'Starlink response validation failed'
                : 'Collector persistence failed',
          resolvedAt: null,
        };
        try {
          await this.options.sink.addEvent(failureEvent, this.options.integrationId);
          await this.options.publish?.('event', failureEvent);
        } catch {
          this.options.logger?.('collector.failure_event_failed', {});
        }
        this.lastFailure = this.state;
      }
      await this.options.publish?.('health', { status: this.state });
      await this.options.incidentEngine?.evaluateHealth({
        state: this.state,
        lastSuccess: this.lastSuccess === null ? null : new Date(this.lastSuccess).toISOString(),
      });
      return false;
    } finally {
      this.running = false;
    }
  }
  stop(): void {
    this.stopped = true;
    this.abortController.abort();
    this.state = 'stopped';
    void this.options.incidentEngine?.evaluateHealth({ state: 'stopped', lastSuccess: null });
  }
  private async withRetry(): Promise<StarlinkSnapshot> {
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      this.retryAttempt = attempt - 1;
      try {
        const result = await this.options.provider.getStatus();
        this.retryAttempt = 0;
        return result;
      } catch (error: unknown) {
        const classification = classifyError(error);
        const final = attempt >= this.options.maxAttempts || classification === 'non_transient';
        this.options.logger?.(final ? 'collector.poll_failed' : 'collector.retry_scheduled', {
          attempt,
          classification,
          final,
          error: error instanceof Error ? error.message : 'unknown',
        });
        if (final) throw error;
        const exponential = Math.min(
          this.options.maxDelayMs,
          this.options.baseDelayMs * 2 ** (attempt - 1),
        );
        const jitter = exponential * this.options.jitterRatio * (this.options.random() * 2 - 1);
        await this.options.clock.sleep(
          Math.max(0, exponential + jitter),
          this.abortController.signal,
        );
      }
    }
    throw new Error('retry policy exhausted');
  }
  private transition(snapshot: StarlinkSnapshot): NetworkEvent | null {
    if (!this.previous || this.previous.state === snapshot.state) return null;
    return {
      id: randomUUID(),
      timestamp: snapshot.updatedAt,
      category: 'connectivity',
      severity: snapshot.state === 'nominal' ? 'info' : 'warning',
      description:
        snapshot.state === 'nominal'
          ? 'Starlink internet connectivity restored'
          : 'Starlink internet connectivity degraded',
      resolvedAt: snapshot.state === 'nominal' ? snapshot.updatedAt : null,
    };
  }
  private recovery(snapshot: StarlinkSnapshot): NetworkEvent | null {
    if (!this.lastFailure) return null;
    return {
      id: randomUUID(),
      timestamp: snapshot.updatedAt,
      category: this.lastFailure === 'starlink_unreachable' ? 'reachability' : 'collector',
      severity: 'info',
      description:
        this.lastFailure === 'starlink_unreachable'
          ? 'Starlink became reachable'
          : 'Collector recovered',
      resolvedAt: snapshot.updatedAt,
    };
  }
  private firmwareTransition(snapshot: StarlinkSnapshot): NetworkEvent | null {
    if (
      !this.previous?.firmwareVersion ||
      !snapshot.firmwareVersion ||
      this.previous.firmwareVersion === snapshot.firmwareVersion
    )
      return null;
    return {
      id: randomUUID(),
      timestamp: snapshot.updatedAt,
      category: 'firmware',
      severity: 'info',
      description: 'Starlink firmware changed',
      resolvedAt: snapshot.updatedAt,
    };
  }
}
