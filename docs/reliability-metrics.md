# Reliability metrics

Reliability queries accept `today`, `24h`, `7d`, and `30d`.

- Availability is `(window seconds - confirmed outage seconds) / window seconds`.
- Outage duration is clipped to the requested window; active incidents run through query end.
- Outage count includes connectivity-loss and device-unreachable incidents intersecting the window.
- Latency average, p95, and maximum use persisted `latency_ms` samples.
- Packet-loss and obstruction averages are null when no samples exist.
- Telemetry completeness compares persisted samples with the expected 30-second polling cadence and is capped at 100%.

These calculations describe what the local collector observed and do not imply carrier-grade SLA accuracy.
