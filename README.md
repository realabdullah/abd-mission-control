# ABD Mission Control

ABD Mission Control is a local-first monitoring application for Starlink Mini and future home-infrastructure integrations. It collects verified read-only telemetry, stores operational history in PostgreSQL, and presents connection health, incidents, alerts, and reliability data through a Nuxt dashboard.

## Features

- Authenticated single-owner web interface.
- Starlink Mini status, latency, throughput, uptime, and obstruction telemetry.
- Persisted telemetry, network events, incidents, alert occurrences, and daily summaries.
- Incident detection with configurable alert rules and acknowledgements.
- REST API, Swagger documentation, and Server-Sent Event updates.
- Standalone Starlink diagnostic utility for validating local protocol capabilities.

## Requirements

- Node.js 22 or later
- pnpm 10 or later
- PostgreSQL 16 or later, or Docker Desktop for the supplied PostgreSQL service
- A Starlink Mini reachable from the collector host for live collection

## Setup

Install dependencies and create the local environment file:

```bash
pnpm install
cp .env.example .env
```

Configure the authentication values in `.env` before starting the API:

```dotenv
AUTH_OWNER_EMAIL=owner@example.com
AUTH_OWNER_PASSWORD=use-a-unique-password-of-at-least-16-characters
AUTH_SESSION_SECRET=use-a-random-secret-of-at-least-32-characters
COLLECTOR_API_TOKEN=use-a-second-random-token-of-at-least-32-characters
```

The API seeds the owner account when it starts against an empty `auth_users` table. Public registration is not provided. `COLLECTOR_API_TOKEN` authenticates collector-to-API event publishing and must be available to both services.

### Database

For a new local database, start PostgreSQL with Docker. The container runs the checked-in migrations during initialization.

```bash
docker compose -f infrastructure/docker/docker-compose.yml up postgres
```

For an existing database, source the environment and apply any missing migrations in order:

```bash
set -a; source .env; set +a
psql "$DATABASE_URL" -f packages/database/drizzle/0000_phase2.sql
psql "$DATABASE_URL" -f packages/database/drizzle/0001_phase3_incidents.sql
psql "$DATABASE_URL" -f packages/database/drizzle/0002_auth.sql
psql "$DATABASE_URL" -f packages/database/drizzle/0003_path_probes.sql
psql "$DATABASE_URL" -f packages/database/drizzle/0004_speed_tests.sql
```

### Run locally

```bash
pnpm dev
```

| Service           | Address                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| Web application   | [http://localhost:3000](http://localhost:3000)                             |
| API health        | [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health) |
| API documentation | [http://localhost:3001/docs](http://localhost:3001/docs)                   |

## Configuration

The default Starlink Mini target is `192.168.100.1:9200`. Override it in `.env` when required:

```dotenv
STARLINK_HOST=192.168.100.1
STARLINK_PORT=9200
```

`API_CORS_ORIGIN` accepts a comma-separated list of allowed web origins. `DATABASE_URL` configures the PostgreSQL connection. Refer to `.env.example` for the complete configuration surface.

## Commands

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `pnpm dev`             | Starts workspace development tasks.             |
| `pnpm build`           | Builds all workspace packages and applications. |
| `pnpm format:check`    | Verifies formatting.                            |
| `pnpm lint`            | Runs linting.                                   |
| `pnpm type-check`      | Runs TypeScript and Vue type checks.            |
| `pnpm test`            | Runs the automated test suite.                  |
| `pnpm test:e2e:phase2` | Runs the Phase 2 end-to-end test.               |
| `pnpm test:e2e:phase3` | Runs the Phase 3 end-to-end test.               |

## Architecture

```text
Starlink Mini → Collector → PostgreSQL → API → Nuxt web application
                                      └── SSE updates ──┘
```

- `apps/web` contains the Nuxt presentation layer.
- `apps/api` exposes the authenticated REST and SSE boundary.
- `apps/collector` owns device polling, normalization, retention, and incident evaluation.
- `packages/contracts` defines runtime-validated domain contracts.
- `packages/database` contains the schema, migrations, and repositories.
- `packages/integrations` isolates provider-specific protocol adapters.

See [docs/architecture.md](docs/architecture.md) for the full design and [docs/development.md](docs/development.md) for contributor workflow details.

## Starlink protocol safety

The collector uses only the verified read-only Starlink status path. Do not add device protocol calls directly to the collector without documenting and validating them through the standalone diagnostic utility:

```bash
pnpm --filter @abd-mission-control/starlink-diagnostic dev
```

## Troubleshooting

| Symptom                                           | Resolution                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| API exits with `Authentication is not configured` | Set `AUTH_OWNER_EMAIL`, `AUTH_OWNER_PASSWORD`, and `AUTH_SESSION_SECRET` in `.env`, then restart the API. |
| Dashboard has no telemetry                        | Verify that the collector is running and that `STARLINK_HOST` is reachable from the collector host.       |
| Browser requests fail CORS checks                 | Add the web origin to `API_CORS_ORIGIN` and restart the API.                                              |
| A database lacks a recent table                   | Apply the relevant SQL file from `packages/database/drizzle/` and restart dependent services.             |
