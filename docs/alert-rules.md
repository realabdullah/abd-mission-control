# Alert rules

Alert rules are persisted, validated records. They can be enabled or disabled and scoped to an integration. Thresholds are numeric values in the metric's documented unit; persistence, recovery, and cooldown values are seconds.

Safe defaults:

- reachability and confirmed connectivity: 60-second trigger, 30-second recovery;
- collector and response failures: immediate trigger, 60-second recovery;
- latency: 120 ms warning, 300 ms critical, 180-second trigger;
- packet loss: 2% warning, 10% critical, 180-second trigger;
- obstruction: 0.10 warning, 0.25 critical, 300-second trigger.

The current rule engine applies persistence, recovery hysteresis, and cooldown before a resolved condition can reopen. External notification delivery is out of scope for Phase 3. Rules are updated through `PATCH /api/v1/alert-rules/:id`.
