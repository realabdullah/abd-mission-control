# ADR 0006: Bounded collector retries and retention cleanup

The collector makes at most three attempts per cycle. Starlink timeout/unavailable errors are transient; malformed responses and configuration errors are not retried. Delays are 250ms, 500ms, and 1s capped at 5s with ±20% jitter. Retry waits are abortable during shutdown. Telemetry defaults to 30 days, events to 90 days, with hourly cleanup in batches of 1,000.
