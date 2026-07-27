# ADR 0003: Validate Starlink protocol before production integration

## Status

Accepted

## Decision

Do not invent local Starlink methods or fields. First ship a standalone diagnostic tool that captures verified protocol behavior, then isolate that behavior behind the integration provider boundary.

## Rationale

The protocol and availability of Mini telemetry are the highest-risk unknowns in the first increment. Evidence-based integration prevents fabricated health data and protects the rest of the domain model from provider churn.
