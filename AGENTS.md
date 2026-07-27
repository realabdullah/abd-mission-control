# ABD Mission Control

This is a pnpm + Turborepo monorepo. Keep domain contracts in `packages/contracts`, infrastructure adapters at application boundaries, and Starlink protocol details inside `packages/integrations`.

Before changing architecture, read `docs/architecture.md` and the relevant ADRs. Run `pnpm format:check`, `pnpm lint`, `pnpm type-check`, and `pnpm test` for coherent changes. Do not add real Starlink protocol calls without first documenting and validating the protocol in a standalone diagnostic tool.
