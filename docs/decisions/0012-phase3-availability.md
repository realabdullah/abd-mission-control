# ADR 0012: Phase 3 availability calculation

Availability is calculated from local observations and persisted connectivity incidents. Requested windows clip incident intervals, active incidents count through the window end, and missing telemetry reduces completeness rather than silently becoming healthy time. The result is operational monitoring data, not a carrier SLA.
