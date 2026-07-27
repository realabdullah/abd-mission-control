import { loadConfig } from '@abd-mission-control/config';
import { createDatabase, TelemetryRepository } from '@abd-mission-control/database';

const config = loadConfig(process.env);

export const apiDatabase = createDatabase(config.databaseUrl);
export const apiRepository = new TelemetryRepository(apiDatabase.db);
