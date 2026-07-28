# Phase 3 connection-path probes

The collector performs bounded, rate-limited observations from its own host: one DNS lookup for
`cloudflare.com`, plus TCP connection attempts to Cloudflare and Google HTTPS endpoints. The
default interval is 60 seconds and the default timeout is two seconds.

These probes are not Starlink protocol calls and do not inspect the router, Wi-Fi clients, or
external application health. Router and any additional Starlink protocol capability remain
deferred until they are validated by the standalone diagnostic tool.
