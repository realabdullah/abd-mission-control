# Daily summaries

The collector writes one deterministic UTC daily summary from persisted incidents and telemetry. Re-running the day replaces the same integration/day record, so historical summaries remain stable and do not depend on generated prose.

The summary contains availability, incident count, outage durations, latency average and p95, peak downlink, packet loss when available, telemetry completeness, firmware-change status, and notable issue labels. It is exposed through `GET /api/v1/daily-summaries`.
