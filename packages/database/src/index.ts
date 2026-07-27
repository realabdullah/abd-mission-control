import postgres = require('postgres');
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
export * from './schema';
export * from './repository';
export function createDatabase(url: string) {
  const client = postgres(url, { max: 5 });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
