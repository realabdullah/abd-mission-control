import { randomUUID } from 'node:crypto';
import type { SpeedTest, SpeedTestLive } from '@abd-mission-control/contracts';

export class RollingRateEstimator {
  private readonly points: Array<{ at: number; bytes: number }>;
  constructor(
    startedAt: number,
    private readonly windowMs = 2000,
  ) {
    this.points = [{ at: startedAt, bytes: 0 }];
  }
  observe(at: number, bytes: number): number {
    this.points.push({ at, bytes });
    while (this.points.length > 2 && this.points[1]!.at <= at - this.windowMs) this.points.shift();
    const baseline = this.points[0]!;
    return ((bytes - baseline.bytes) * 8000) / Math.max(at - baseline.at, 1);
  }
}

export class SpeedTestRunner {
  private running = false;
  private progress: SpeedTestLive = {
    state: 'idle',
    bytesTransferred: 0,
    downloadBps: null,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    samples: [],
  };
  constructor(
    private readonly options: {
      integrationId: string;
      url: string;
      maxBytes: number;
      timeoutMs: number;
      sink: { addSpeedTest(test: SpeedTest): Promise<void> };
    },
  ) {}
  getProgress(): SpeedTestLive {
    return this.progress;
  }
  start(): boolean {
    if (this.running) return false;
    void this.run();
    return true;
  }
  async run(): Promise<SpeedTest | null> {
    if (this.running) return null;
    this.running = true;
    const started = Date.now();
    let bytes = 0;
    let lastPublishedAt = started;
    const rateEstimator = new RollingRateEstimator(started);
    const samples: SpeedTestLive['samples'] = [];
    this.progress = {
      state: 'running',
      bytesTransferred: 0,
      downloadBps: 0,
      startedAt: new Date(started).toISOString(),
      updatedAt: new Date(started).toISOString(),
      samples,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(this.options.url, {
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(`Download failed with ${response.status}`);
      const reader = response.body.getReader();
      while (bytes < this.options.maxBytes) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += Math.min(chunk.value.byteLength, this.options.maxBytes - bytes);
        const now = Date.now();
        if (now - lastPublishedAt >= 250 || bytes >= this.options.maxBytes) {
          const bps = rateEstimator.observe(now, bytes);
          samples.push({ at: new Date(now).toISOString(), bps });
          while (samples.length > 120) samples.shift();
          this.progress = {
            ...this.progress,
            bytesTransferred: bytes,
            downloadBps: bps,
            updatedAt: new Date(now).toISOString(),
            samples: [...samples],
          };
          lastPublishedAt = now;
        }
        if (bytes >= this.options.maxBytes) await reader.cancel();
      }
      const completed = Date.now();
      const test: SpeedTest = {
        id: randomUUID(),
        integrationId: this.options.integrationId,
        state: 'completed',
        bytesTransferred: bytes,
        downloadBps: completed === started ? null : (bytes * 8000) / (completed - started),
        startedAt: new Date(started).toISOString(),
        completedAt: new Date(completed).toISOString(),
        error: null,
      };
      await this.options.sink.addSpeedTest(test);
      this.progress = {
        ...this.progress,
        state: 'completed',
        bytesTransferred: bytes,
        downloadBps: test.downloadBps,
        updatedAt: test.completedAt,
        samples: [...samples],
      };
      return test;
    } catch (cause) {
      const test: SpeedTest = {
        id: randomUUID(),
        integrationId: this.options.integrationId,
        state: 'failed',
        bytesTransferred: bytes,
        downloadBps: null,
        startedAt: new Date(started).toISOString(),
        completedAt: new Date().toISOString(),
        error: cause instanceof Error ? cause.message : 'Speed test failed',
      };
      await this.options.sink.addSpeedTest(test);
      this.progress = {
        ...this.progress,
        state: 'failed',
        bytesTransferred: bytes,
        downloadBps: null,
        updatedAt: test.completedAt,
        samples: [...samples],
      };
      return test;
    } finally {
      clearTimeout(timeout);
      this.running = false;
    }
  }
}
