# Shared packages

Packages must remain framework-light where possible. Contracts are the source of truth for runtime validation and inferred types. Avoid leaking provider-specific protocol types outside `packages/integrations`.
