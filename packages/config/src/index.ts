import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  COLLECTOR_HOST: z.string().default('127.0.0.1'),
  COLLECTOR_PORT: z.coerce.number().int().positive().default(3003),
  COLLECTOR_URL: z.string().url().default('http://localhost:3003'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://mission_control:mission_control@localhost:5432/mission_control'),
  STARLINK_HOST: z.string().default('192.168.100.1'),
  STARLINK_PORT: z.coerce.number().int().positive().default(9200),
  STARLINK_INTEGRATION_ID: z.string().uuid().default('00000000-0000-0000-0000-000000000001'),
  STARLINK_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  STARLINK_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  TELEMETRY_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  RETENTION_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(3600000),
  RETENTION_BATCH_SIZE: z.coerce.number().int().positive().max(10000).default(1000),
  AUTH_OWNER_EMAIL: z.string().email().optional(),
  AUTH_OWNER_PASSWORD: z.string().min(16).optional(),
  AUTH_SESSION_SECRET: z.string().min(32).optional(),
});
export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  apiHost: string;
  apiPort: number;
  apiUrl: string;
  apiCorsOrigin: string;
  collectorHost: string;
  collectorPort: number;
  collectorUrl: string;
  databaseUrl: string;
  starlinkHost: string;
  starlinkPort: number;
  starlinkIntegrationId: string;
  starlinkPollIntervalMs: number;
  starlinkRequestTimeoutMs: number;
  telemetryRetentionDays: number;
  eventRetentionDays: number;
  retentionCleanupIntervalMs: number;
  retentionBatchSize: number;
  authOwnerEmail?: string;
  authOwnerPassword?: string;
  authSessionSecret?: string;
};
export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  // Render assigns the port for public web services through `PORT`. Keep the
  // explicit API_PORT override for local/Docker deployments while accepting
  // the platform default when it is the only configured port.
  const value = environmentSchema.parse({
    ...environment,
    API_PORT: environment.API_PORT ?? environment.PORT,
  });
  return {
    nodeEnv: value.NODE_ENV,
    apiHost: value.API_HOST,
    apiPort: value.API_PORT,
    apiUrl: value.API_URL,
    apiCorsOrigin: value.API_CORS_ORIGIN,
    collectorHost: value.COLLECTOR_HOST,
    collectorPort: value.COLLECTOR_PORT,
    collectorUrl: value.COLLECTOR_URL,
    databaseUrl: value.DATABASE_URL,
    starlinkHost: value.STARLINK_HOST,
    starlinkPort: value.STARLINK_PORT,
    starlinkIntegrationId: value.STARLINK_INTEGRATION_ID,
    starlinkPollIntervalMs: value.STARLINK_POLL_INTERVAL_MS,
    starlinkRequestTimeoutMs: value.STARLINK_REQUEST_TIMEOUT_MS,
    telemetryRetentionDays: value.TELEMETRY_RETENTION_DAYS,
    eventRetentionDays: value.EVENT_RETENTION_DAYS,
    retentionCleanupIntervalMs: value.RETENTION_CLEANUP_INTERVAL_MS,
    retentionBatchSize: value.RETENTION_BATCH_SIZE,
    authOwnerEmail: value.AUTH_OWNER_EMAIL,
    authOwnerPassword: value.AUTH_OWNER_PASSWORD,
    authSessionSecret: value.AUTH_SESSION_SECRET,
  };
}
