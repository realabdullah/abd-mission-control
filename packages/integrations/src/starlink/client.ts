import {
  credentials,
  loadPackageDefinition,
  type Client,
  type ServiceError,
  type ServiceClientConstructor,
} from '@grpc/grpc-js';
import { loadSync, type PackageDefinition, type ServiceDefinition } from '@grpc/proto-loader';
import { join } from 'node:path';
import { z } from 'zod';
import { starlinkSnapshotSchema, type StarlinkSnapshot } from '@abd-mission-control/contracts';

export const rawStarlinkResponseSchema = z
  .object({
    apiVersion: z.union([z.string(), z.number()]).optional(),
    dishGetStatus: z
      .object({
        deviceInfo: z
          .object({
            hardwareVersion: z.string().optional(),
            softwareVersion: z.string().optional(),
          })
          .optional(),
        deviceState: z.object({ uptimeS: z.union([z.string(), z.number()]).optional() }).optional(),
        obstructionStats: z
          .object({
            fractionObstructed: z.number().optional(),
            currentlyObstructed: z.boolean().optional(),
          })
          .optional(),
        alerts: z.record(z.unknown()).optional(),
        downlinkThroughputBps: z.number().optional(),
        uplinkThroughputBps: z.number().optional(),
        popPingLatencyMs: z.number().optional(),
        readyStates: z
          .object({
            scp: z.boolean().optional(),
            l1l2: z.boolean().optional(),
            xphy: z.boolean().optional(),
            aap: z.boolean().optional(),
            rf: z.boolean().optional(),
          })
          .optional(),
        upsuStats: z
          .object({ dishPower: z.number().optional(), routerPower: z.number().optional() })
          .optional(),
      })
      .optional(),
  })
  .passthrough();
export type RawStarlinkResponse = z.infer<typeof rawStarlinkResponseSchema>;

export class StarlinkError extends Error {
  constructor(
    readonly code: 'unavailable' | 'timeout' | 'malformed' | 'configuration',
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
export interface StarlinkTelemetryProvider {
  getStatus(): Promise<StarlinkSnapshot>;
}
export interface StarlinkHealthProvider {
  checkHealth(): Promise<{ reachable: boolean; latencyMs: number | null }>;
}
export interface StarlinkCapabilities {
  readonly telemetry: true;
  readonly reflectionRequired: false;
  readonly metrics: readonly string[];
}
export const starlinkCapabilities: StarlinkCapabilities = {
  telemetry: true,
  reflectionRequired: false,
  metrics: [
    'latency_ms',
    'downlink_throughput_bps',
    'uplink_throughput_bps',
    'obstruction_fraction',
    'uptime_seconds',
    'power_watts',
  ],
};

function isService(value: PackageDefinition[string]): value is ServiceDefinition {
  return typeof value === 'object' && value !== null && 'Handle' in value;
}
function getService(definition: PackageDefinition): {
  constructor: ServiceClientConstructor;
  service: ServiceDefinition;
} {
  const pkg = loadPackageDefinition(definition);
  const root = pkg.SpaceX;
  if (!root || typeof root !== 'object' || !('API' in root))
    throw new StarlinkError(
      'configuration',
      'Verified Starlink protobuf service is missing SpaceX.API',
    );
  const api = root.API;
  if (!api || typeof api !== 'object' || !('Device' in api))
    throw new StarlinkError(
      'configuration',
      'Verified Starlink protobuf service is missing SpaceX.API.Device',
    );
  const device = api.Device;
  if (
    !device ||
    typeof device !== 'object' ||
    !('Device' in device) ||
    typeof device.Device !== 'function' ||
    !('service' in device.Device)
  )
    throw new StarlinkError('configuration', 'Verified Starlink Device client is unavailable');
  const service = definition['SpaceX.API.Device.Device'];
  if (!isService(service))
    throw new StarlinkError(
      'configuration',
      'Verified Starlink Device service definition is unavailable',
    );
  return { constructor: device.Device, service };
}

export class StarlinkClient implements StarlinkTelemetryProvider, StarlinkHealthProvider {
  readonly capabilities = starlinkCapabilities;
  private readonly client: Client;
  private readonly service: ServiceDefinition;
  constructor(
    private readonly endpoint: string,
    timeoutMs = 5000,
    protoPath = join(__dirname, 'proto/device.proto'),
  ) {
    const definition = loadSync(protoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: false,
      oneofs: true,
    });
    const loaded = getService(definition);
    this.service = loaded.service;
    this.client = new loaded.constructor(endpoint, credentials.createInsecure());
    this.timeoutMs = timeoutMs;
  }
  private timeoutMs: number;
  async getStatus(): Promise<StarlinkSnapshot> {
    const request = { getStatus: {} };
    const method = this.service.Handle;
    if (!method)
      throw new StarlinkError('configuration', 'Verified Starlink Handle method is unavailable');
    const raw = await new Promise<unknown>((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/SpaceX.API.Device.Device/Handle',
        method.requestSerialize,
        method.responseDeserialize,
        request,
        { deadline: new Date(Date.now() + this.timeoutMs) },
        (error: ServiceError | null, response: unknown) =>
          error ? reject(error) : resolve(response),
      );
    }).catch((error: unknown) => {
      const code =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 4
          ? 'timeout'
          : 'unavailable';
      throw new StarlinkError(code, 'Starlink get_status failed', error);
    });
    const parsed = rawStarlinkResponseSchema.safeParse(raw);
    if (!parsed.success)
      throw new StarlinkError(
        'malformed',
        'Starlink get_status response failed runtime validation',
        parsed.error.flatten(),
      );
    return normalize(parsed.data, this.endpoint);
  }
  async checkHealth(): Promise<{ reachable: boolean; latencyMs: number | null }> {
    const started = Date.now();
    try {
      await this.getStatus();
      return { reachable: true, latencyMs: Date.now() - started };
    } catch {
      return { reachable: false, latencyMs: null };
    }
  }
  close(): void {
    this.client.close();
  }
}

function numberOrNull(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function normalize(raw: RawStarlinkResponse, endpoint: string): StarlinkSnapshot {
  const status = raw.dishGetStatus;
  const ready = status?.readyStates;
  const connected = ready
    ? [ready.scp, ready.l1l2, ready.xphy, ready.aap, ready.rf].every((v) => v === true)
    : null;
  const reachable = true;
  const internetConnected = connected;
  const state = connected === false ? 'degraded' : 'nominal';
  return starlinkSnapshotSchema.parse({
    integrationId: '00000000-0000-0000-0000-000000000001',
    name: `Starlink Mini (${endpoint})`,
    state,
    reachable,
    internetConnected,
    latencyMs: status?.popPingLatencyMs ?? null,
    packetLossPercent: null,
    downlinkThroughputBps: status?.downlinkThroughputBps ?? null,
    uplinkThroughputBps: status?.uplinkThroughputBps ?? null,
    obstructionFraction: status?.obstructionStats?.fractionObstructed ?? null,
    uptimeSeconds: numberOrNull(status?.deviceState?.uptimeS),
    powerWatts: status?.upsuStats?.dishPower ?? null,
    hardwareVersion: status?.deviceInfo?.hardwareVersion ?? null,
    firmwareVersion: status?.deviceInfo?.softwareVersion ?? null,
    lastSuccessfulSampleAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
