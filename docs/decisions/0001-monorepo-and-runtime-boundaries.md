# ADR 0001: Monorepo and runtime boundaries

## Status

Accepted

## Decision

Use a pnpm workspace orchestrated by Turborepo. Keep Nuxt, NestJS API, and the collector as separate runtime applications. Share contracts and infrastructure libraries through packages.

## Rationale

This supports atomic changes and shared validation while keeping device-facing failure modes independent from the UI. It avoids premature microservices while preserving clear process boundaries.
