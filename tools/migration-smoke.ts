import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_TEST_URL;
if (!url) throw new Error('DATABASE_TEST_URL is required');

async function main(): Promise<void> {
  const client = postgres(url);
  try {
    for (const filename of ['0000_phase2.sql', '0001_phase3_incidents.sql']) {
      const migration = await readFile(
        new URL(`../packages/database/drizzle/${filename}`, import.meta.url),
        'utf8',
      );
      await client.unsafe(migration);
    }
    const rows =
      await client`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('integrations', 'integration_snapshots', 'telemetry_samples', 'network_events', 'incidents', 'alert_rules', 'alert_occurrences', 'daily_summaries')`;
    if (rows.length !== 8) throw new Error(`expected eight Phase 3 tables, found ${rows.length}`);
    console.log('Phase 3 migration: ok');
  } finally {
    await client.end();
  }
}
void main();
