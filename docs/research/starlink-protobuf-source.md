# Protobuf and descriptor source

The primary Phase 1B source of truth is live server reflection from the actual Mini at `192.168.100.1:9200`. This avoids importing an unverified reverse-engineered schema into production.

Fallback reference:

- Origin: [`sparky8512/starlink-grpc-tools`](https://github.com/sparky8512/starlink-grpc-tools), including its `extract_protoset.py` and generated protocol tooling.
- License: public-domain dedication / Unlicense, as shown by the repository license.
- Version: repository `main` as observed on 2026-07-27; no immutable commit is vendored in this workspace.
- Compatibility risk: high. The repository documents that Starlink firmware changes can alter the exposed service and message schema, so a checked-in fallback descriptor is only a diagnostic aid and must be compared with live reflection before use.

If a future endpoint does not support reflection, Phase 1B should record the exact grpcurl error and use a pinned commit or extracted protoset from this source only after a compatibility review. Do not silently switch to guessed method or field names.
