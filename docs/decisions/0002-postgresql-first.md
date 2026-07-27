# ADR 0002: PostgreSQL first, without TimescaleDB

## Status

Accepted

## Decision

Use PostgreSQL with Drizzle and versioned migrations as the initial durable store. Model telemetry as indexed metric samples plus explicit snapshots and events; evaluate TimescaleDB only when query volume demonstrates a need.

## Rationale

This keeps local deployment simple and avoids specializing the storage layer before actual retention and query patterns are known.
