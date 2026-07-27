# ADR 0004: Standalone Starlink protocol diagnostic

## Status

Accepted

## Decision

Validate Starlink local access with a standalone tool before adding a production provider. The first tool performs bounded TCP probes and optional gRPC server reflection; it does not call guessed methods, perform control operations, or write telemetry.

## Rationale

The local endpoint is undocumented and firmware-sensitive. Separating evidence gathering from the collector lets us inspect actual service availability and failure modes without making the production process responsible for protocol discovery.
