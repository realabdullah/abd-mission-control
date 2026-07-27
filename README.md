# ABD Mission Control

An open-source home network operations platform for calm, precise monitoring of Starlink and future home-infrastructure integrations.

Phase 0 establishes the repository and application boundaries. Starlink communication is intentionally not implemented until the local Mini protocol is validated with a standalone diagnostic tool.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

For PostgreSQL and the full local stack: `docker compose -f infrastructure/docker/docker-compose.yml up --build`.

The web app is at `http://localhost:3000`, API health is at `http://localhost:3001/api/v1/health`, and Swagger is at `http://localhost:3001/docs`.

Read [the architecture](docs/architecture.md) and [development guide](docs/development.md) before extending the foundation.

# ABD Mission Control

Phase 2 provides a local Starlink Mini vertical slice: verified gRPC telemetry → normalized collector → PostgreSQL → NestJS API/SSE → Nuxt Mission Overview. Copy `.env.example`, start PostgreSQL, apply `packages/database/drizzle/0000_phase2.sql`, then run `pnpm build` and `pnpm dev`. The collector defaults to `192.168.100.1:9200` and only invokes the verified read-only `get_status` RPC.

Phase 3 adds local outage intelligence: debounced incidents, configurable alert rules, in-app alert occurrences, acknowledgements, reliability analytics, incident history, and deterministic daily summaries. Apply `0001_phase3_incidents.sql` after the Phase 2 migration. No external notification providers or remote-access features are included.
