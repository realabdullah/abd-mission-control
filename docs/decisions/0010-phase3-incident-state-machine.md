# ADR 0010: Phase 3 incident state machine

Incidents are keyed by integration and rule deduplication key. A rule enters a pending state when its trigger condition is observed; it opens only after persistence elapses. Recovery has an independent window and hysteresis. The database enforces one active incident per key. Alert occurrences record opened, escalated, and resolved transitions without resolving the incident on acknowledgement.
