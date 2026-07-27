# ADR 0005: Use a verified Node gRPC client for Phase 2

## Decision

Use `@grpc/grpc-js` and `@grpc/proto-loader` with a small, version-controlled protobuf subset captured from Starlink reflection. Production invokes only `Device/Handle` with `get_status`; reflection and grpcurl remain diagnostic tools.

## Rationale

The Phase 1B run successfully invoked a real read-only RPC and captured its response shape. Shelling out to grpcurl per poll would add process, PATH, and timeout failure modes. A checked-in subset makes the runtime deterministic while keeping unsupported fields optional and visible as a compatibility risk.

## Risks

Starlink firmware may change field definitions or remove reflection. The client treats malformed responses as typed errors, records unavailable values as null, and requires a future protocol validation before expanding the subset.
