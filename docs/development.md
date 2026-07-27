# Development

Prerequisites: Node 22+, pnpm 10+, and Docker for PostgreSQL.

Run `pnpm install`, copy `.env.example` to `.env`, then use `pnpm dev` to start the workspace applications. Run PostgreSQL separately with `docker compose -f infrastructure/docker/docker-compose.yml up postgres`.

```bash
pnpm format:check
pnpm lint
pnpm type-check
pnpm test
```

Use package filters for focused work, for example `pnpm --filter @abd-mission-control/api type-check`.

## Starlink vertical slice

Run `pnpm format:check`, `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build`. For local hardware, keep the Starlink Mini reachable on its local network and set `STARLINK_HOST`, `STARLINK_PORT`, and `DATABASE_URL`. Apply the checked-in Phase 2 SQL migration before starting the collector.

The collector retries only timeout/unavailable Starlink errors, up to three attempts with 250ms base exponential backoff, a 5s cap, and ±20% jitter. Telemetry is retained for 30 days and events for 90 days; cleanup runs hourly in batches of 1,000. Historical API queries return raw samples through six hours, then PostgreSQL buckets with min/max/average/latest/count.

If Docker Desktop cannot reach `192.168.100.1`, run PostgreSQL/API/web in Docker and start the collector on the host.

With the stack running, execute `pnpm exec tsx tools/phase2-smoke.ts` to verify API health, system status, integration snapshot, telemetry, web availability, and the SSE handshake. The PostgreSQL repository integration test runs when `DATABASE_TEST_URL` points at a migrated isolated database; otherwise it is skipped deliberately.

For an empty-database migration check, set `DATABASE_TEST_URL` to an isolated PostgreSQL database and run `pnpm exec tsx tools/migration-smoke.ts`.

The conditional PostgreSQL repository test can be run with `DATABASE_TEST_URL=postgresql://... pnpm test`. The complete fixture-backed Phase 2 path is run with `DATABASE_TEST_URL=postgresql://... pnpm test:e2e:phase2`; it applies the migration and exercises the fixture gRPC server, real collector, PostgreSQL, API, and SSE.

Phase 3 checks use the same database prerequisite: `DATABASE_TEST_URL=postgresql://... pnpm --filter @abd-mission-control/database test` and `DATABASE_TEST_URL=postgresql://... pnpm test:e2e:phase3`. The E2E applies both checked-in migrations, starts the API, evaluates fixture observations, verifies incident and alert API/SSE responses, and verifies recovery.

The API allows the local web origins `http://localhost:3000` and `http://127.0.0.1:3000` by default. If a browser shows a 404 with a missing CORS header, restart the API so it loads the current build and verify `curl http://localhost:3001/api/v1/health`; an already-running pre-Phase-3 process will not have the new routes. Set `API_CORS_ORIGIN` to a comma-separated origin list when using another local web origin.

The root development task sources `.env` before starting the Turbo child processes, and `turbo.json` explicitly forwards the runtime configuration variables to those processes. If you are invoking a package task directly, export the collector settings yourself:

```bash
export COLLECTOR_PORT=3003
export COLLECTOR_URL=http://127.0.0.1:3003
pnpm dev
```

Alternatively, prefix a single run with those variables. This prevents the collector from falling back to its default port 3002.
