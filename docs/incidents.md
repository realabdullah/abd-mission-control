# Incidents

Incidents are provider-neutral conditions with an active interval. They are opened by debounced rule observations, updated when observed values or severity change, and resolved only after the configured recovery window.

Initial rules cover confirmed internet connectivity loss, repeated Starlink RPC failures, collector delay or stop, invalid responses, database persistence failure, sustained latency, packet loss when present, and obstruction when present. A null optional metric is telemetry unavailable and never a zero.

Severity is restrained: `info` describes informational changes, `warning` describes persistent degradation, and `critical` is reserved for sustained or confirmed outages. Each incident has one active deduplication key per integration. Alert occurrences record opened, escalated, and resolved transitions separately from the incident.

Availability is measured from local collector observations. An unresolved outage is counted through the end of the requested window. This is operational insight, not a carrier SLA.
