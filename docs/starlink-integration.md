# Starlink integration

Phase 1B has verified the local Mini endpoint with a fresh run of the standalone diagnostic tool. It does not implement the production provider or call guessed RPC methods.

## Current evidence

Community-maintained Starlink tooling documents a local dish gRPC endpoint at `192.168.100.1:9200`. The same documentation describes `9201` as a gRPC-Web endpoint and `9000/9001` as router endpoints. These are probe candidates, not guarantees for every hardware or firmware version.

Starlink's official Telemetry API is a separate authenticated service intended for Premium Business and Enterprise customers; it is not assumed to be available for this trusted-LAN collector.

The diagnostic tool checks TCP reachability separately from plaintext HTTP/2 gRPC transport. With `grpcurl` resolved from PATH, it attempts server reflection on `192.168.100.1:9200`, records every command and result, describes the reflected request/response types, and invokes only the reflected `Device/Handle` request with the verified `get_status` field. It does not issue mutating calls or normalize values.

## Confirmed on the Starlink Mini

The 2026-07-27 validation run confirmed:

- TCP reachability on ports `9200` and `9201`.
- Plaintext HTTP/2 gRPC compatibility on `192.168.100.1:9200`.
- Server reflection support.
- Services `SpaceX.API.Device.Device`, `grpc.reflection.v1.ServerReflection`, and `grpc.reflection.v1alpha.ServerReflection`.
- Read-only `SpaceX.API.Device.Device/Handle` with `{ "get_status": {} }`, verified against the reflected `Request` and `Response` descriptors.
- A real `dishGetStatus` response containing status-shaped fields for device state, uptime, throughput, latency, obstruction statistics, firmware/software state, readiness, alignment, and power-related structures.

This confirms telemetry availability for the verified status response only. It does not confirm every reflected request, historical telemetry, outage history, power measurement availability, or long-term firmware compatibility.

Phase 5 Wi-Fi capability validation is documented in [the Starlink Mini Wi-Fi diagnostic report](research/starlink-mini-phase5-wifi-capabilities.md). Reflection exposed the requested Wi-Fi response schemas, but the Mini returned `Unimplemented` for each invocable read-only Wi-Fi request; no Wi-Fi fields were populated and the production protobuf subset was intentionally left unchanged.

Run it with:

```bash
pnpm --filter @abd-mission-control/starlink-diagnostic build
pnpm --filter @abd-mission-control/starlink-diagnostic exec node dist/index.js --host 192.168.100.1 --output starlink-diagnostic.json
```

The two `--` tokens in the `pnpm start` form are pnpm's argument forwarding separator plus the script argument separator; the CLI intentionally strips a leading standalone `--`. The preferred form above avoids the extra separator by using `pnpm ... exec node dist/index.js`.

Install `grpcurl` separately if reflection inspection is desired. The tool records a missing dependency distinctly from an endpoint failure and prints an installation message. Keep diagnostic output local; it may reveal device topology and firmware-dependent service names.

Before production integration, the diagnostic must be run against the actual Mini and the response schemas must be reviewed. Evidence must cover the availability of connectivity state, latency, throughput, obstructions, outages, hardware, firmware, and power before those fields are added to normalized contracts. Unknown or unsupported fields remain unavailable.

# Phase 2 production boundary

The production collector now uses `@grpc/grpc-js` with the checked-in `packages/integrations/src/starlink/proto/device.proto` subset derived from the verified reflection descriptors. It invokes only `SpaceX.API.Device.Device/Handle` with `get_status`; it does not shell out to grpcurl or depend on reflection at runtime.

Confirmed mappings are limited to the captured response: `popPingLatencyMs` → latency in milliseconds; `downlinkThroughputBps` and `uplinkThroughputBps` → live throughput in bits per second; `obstructionStats.fractionObstructed` → unitless fraction; `deviceState.uptimeS` → seconds; `deviceInfo.hardwareVersion` and `softwareVersion` → version labels; `upsuStats.dishPower` → watts when present. `popPingDropRate`, outage fields, location, serials, account data, and `secondsToFirstNonemptySlot` remain unavailable or intentionally unmodelled. Missing metrics stay null and are not written as zero.

The default poll interval is 30 seconds with a 5 second request deadline. Samples are stored in UTC and deduplicated by integration, metric, and timestamp. At seven metrics per poll this is approximately 20,160 rows per day before optional fields are excluded (actual growth is lower when fields are absent). The initial PostgreSQL migration is `packages/database/drizzle/0000_phase2.sql`. The API exposes snapshot, bounded telemetry, events, system status, and an SSE stream; the collector forwards successful snapshots and state changes to the API’s in-process event hub.

The UI distinguishes reachability, internet readiness, collector status, stale/unavailable values, and SSE connection state. Historical chart rendering remains deliberately conservative until production history is present; no missing metric is interpolated.

Hardening adds collector states `starting`, `healthy`, `delayed`, `degraded`, `stopped`, `database_unavailable`, `starlink_unreachable`, and `starlink_response_invalid`. Failure events are emitted only on state changes and recovery events are emitted after a successful sample. SSE events are `snapshot`, `sample`, `event`, and `health`; each has an ID and JSON data, with 15-second heartbeat events and bounded replay using `Last-Event-ID`.

Completion checklist status: live gRPC collection and normalization are verified; retries, health transitions, retention, migration smoke, repository integration, bounded historical aggregation, range-driven charts, API query validation, and SSE replay tests are implemented. Full Docker Compose runtime verification and a production-like collector-to-API E2E test remain environment-dependent and must be run before declaring Phase 2 complete.
