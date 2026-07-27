# Deployment

The supported Phase 0 deployment is Docker Compose on a home server. PostgreSQL has persistent named storage and is bound to loopback only. API, collector, and web ports are also bound to loopback in the provided Compose file; place an intentional LAN reverse proxy in front of them when needed.

Do not expose this stack directly to the public internet. Remote access, authentication, TLS, secret management, and backup policy should be deliberate follow-up work.

## Phase 2 deployment notes

PostgreSQL is the only persistence dependency. Run the Phase 2 migration before the collector. Set `API_URL` so collector events can reach the API, and set `STARLINK_HOST`/`STARLINK_PORT` for the local dish. Reflection and grpcurl are diagnostic-only dependencies and are not required in the collector runtime.

The SSE endpoint is single-instance and in-process, with bounded replay history. Docker Desktop may not route private Starlink traffic into containers; use the host-run collector mode documented in `docs/development.md` when necessary.

Phase 3 adds no external services. Apply `packages/database/drizzle/0000_phase2.sql` followed by `0001_phase3_incidents.sql`. The collector and API share PostgreSQL for incident state; the API's existing in-process SSE hub remains single-instance delivery.

The Compose init directory applies migrations only when PostgreSQL initializes a new volume. For an existing volume, apply `0001_phase3_incidents.sql` once before restarting the API and collector.

## Hosted deployment: Vercel + Render

Deploy `apps/web` as a Vercel project, with the repository root selected as the
monorepo root and `apps/web` as the project root directory. Set
`NUXT_PUBLIC_API_BASE` to the public Render API URL, without a trailing slash.

`render.yaml` defines the API web service and its Render PostgreSQL database.
On its first deployment, apply these migrations to the Render database in order:

1. `packages/database/drizzle/0000_phase2.sql`
2. `packages/database/drizzle/0001_phase3_incidents.sql`

Set the Render API service's `API_CORS_ORIGIN` to the exact Vercel production
origin. The API reads Render's `PORT` automatically and binds to `0.0.0.0`.

The collector must run on an always-on machine that can reach the Starlink Mini
on the local network. It cannot run on Render and collect from
`192.168.100.1:9200`, because that address is private to the Starlink LAN. Run
it using `pnpm --filter @abd-mission-control/collector start` on the LAN-side
host, with `DATABASE_URL` set to the Render PostgreSQL external connection
string and `API_URL` set to the public Render API URL. Do not publish the
collector health endpoint or the Starlink device to the internet.

Because the API's current SSE hub is in process, run a single API instance. A
multi-instance deployment needs a shared event transport before scaling out.
