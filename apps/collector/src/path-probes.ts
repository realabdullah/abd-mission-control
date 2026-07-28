import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import type { PathProbe } from '@abd-mission-control/contracts';

export type PathProbeSink = {
  addPathProbes(probes: PathProbe[], integrationId: string): Promise<void>;
};
export type PathProbeTransport = {
  dns(hostname: string): Promise<void>;
  tcp(host: string, port: number): Promise<void>;
};

function withTimeout(task: Promise<void>, timeoutMs: number): Promise<void> {
  return Promise.race([
    task,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
}

export const realPathProbeTransport: PathProbeTransport = {
  dns: async (hostname) => void (await lookup(hostname)),
  tcp: (host, port) =>
    new Promise<void>((resolve, reject) => {
      const socket = connect({ host, port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', reject);
    }),
};

export class PathProbeRunner {
  private running = false;
  constructor(
    private readonly options: {
      integrationId: string;
      timeoutMs: number;
      sink: PathProbeSink;
      transport?: PathProbeTransport;
      now?: () => number;
      logger?: (event: string, details: Record<string, unknown>) => void;
    },
  ) {}
  async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const transport = this.options.transport ?? realPathProbeTransport;
    const now = this.options.now ?? Date.now;
    const probes = await Promise.all([
      this.run('dns', 'cloudflare.com', () => transport.dns('cloudflare.com'), now),
      this.run('public_tcp', 'cloudflare:443', () => transport.tcp('1.1.1.1', 443), now),
      this.run('public_tcp', 'google:443', () => transport.tcp('8.8.8.8', 443), now),
    ]);
    try {
      await this.options.sink.addPathProbes(probes, this.options.integrationId);
    } catch (error) {
      this.options.logger?.('collector.path_probes_persistence_failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.running = false;
    }
  }
  private async run(
    kind: PathProbe['kind'],
    target: string,
    task: () => Promise<void>,
    now: () => number,
  ): Promise<PathProbe> {
    const started = now();
    try {
      await withTimeout(task(), this.options.timeoutMs);
      return {
        id: randomUUID(),
        integrationId: this.options.integrationId,
        kind,
        target,
        status: 'success',
        latencyMs: now() - started,
        observedAt: new Date(now()).toISOString(),
        detail: null,
      };
    } catch (error) {
      const timeout = error instanceof Error && error.message === 'timeout';
      return {
        id: randomUUID(),
        integrationId: this.options.integrationId,
        kind,
        target,
        status: timeout ? 'timeout' : 'failure',
        latencyMs: null,
        observedAt: new Date(now()).toISOString(),
        detail: timeout ? 'Timed out' : 'Connection failed',
      };
    }
  }
}
