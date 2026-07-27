# ADR 0008: In-process bounded SSE delivery

The API owns one in-process event hub. It keeps at most 100 subscribers and 100 recent events, accepts `Last-Event-ID` replay, emits 15-second heartbeats, and removes failing listeners. This is sufficient for the single-instance Phase 2 deployment; multi-instance deployment requires a shared event transport.
