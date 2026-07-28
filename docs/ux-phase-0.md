# Mission Control UX foundation

## Purpose

Mission Control should answer four questions in order: **Is the connection healthy? Is this
information current? What changed? What should I do next?** The interface should make the
answer obvious before it asks a person to interpret telemetry.

This document is the approval checkpoint for the interface work in Phase 1. It is grounded in
the telemetry currently collected by Mission Control; it does not imply new device-protocol
capabilities.

## Product position

Mission Control is a local-observation tool for a Starlink connection. It is not a carrier
status page, and it must not imply facts that the collector has not observed.

The visual register is a calm, high-contrast dark operational workspace: restrained mint is
reserved for healthy, interactive, and focused states; warning and critical colours identify
conditions that require attention. The interface should not reproduce Starlink's terrain artwork
or consumer-app visual treatment.

## Principles

1. **Answer before evidence.** Lead with a plain-language health state, then provide the
   measurements that support it.
2. **Progressive disclosure.** The overview is for orientation; detailed metrics belong in a
   focused diagnostic view.
3. **Observation, not inference.** Show unavailable data as unavailable. Label local observations
   and avoid presenting them as provider guarantees or external service status.
4. **Changes have context.** A timeline item should explain its severity, duration, relationship
   to other observations, and next useful action.
5. **Numbers need a baseline.** Where data exists, present a current value beside a stable
   comparison such as a median, selected-range average, or p95.
6. **One experience across screens.** Small screens reveal the same information in a different
   order; they do not receive a cramped desktop dashboard.

## User journeys

### 1. Check the connection

**Trigger:** A person wants reassurance that the local Starlink connection is working.

1. Open Mission overview.
2. Read the connection state and freshness without scrolling.
3. If healthy, see a brief indication of recent behavior and no-action-needed copy.
4. If not healthy, open the active issue or connection-quality detail view.

**Success:** Within five seconds, the user can state the health, freshness, and next action.

### 2. Investigate a degradation

**Trigger:** The overview reports degradation or a user notices poor service.

1. Open the relevant summary: connection quality, latency, throughput, power, or obstruction.
2. Compare the latest observation with a baseline for the selected time range.
3. Inspect related incidents/events at the same point in time.
4. Read a concise explanation of the metric and its local-observation limitation.

**Success:** The user can distinguish a current condition from a historical spike and identify
whether Mission Control has confirmed an incident.

### 3. Understand an event

**Trigger:** A timeline entry or alert needs explanation.

1. Open the event/incident detail.
2. See what happened, when it began, duration, current/resolved state, and severity.
3. See related events and the measured values that triggered the incident when available.
4. Follow a clear next action, or be told that no action is required.

**Success:** The user does not have to interpret an internal event name or infer whether it is
still active.

### 4. Review reliability

**Trigger:** A person wants to understand the connection over time.

1. Choose a time range.
2. Scan availability, outage count/duration, latency p95, and telemetry completeness.
3. Drill into a chart only when a metric warrants investigation.

**Success:** The user can separate actual connection behavior from incomplete collector data.

## Information architecture

```text
Mission overview
├── Current connection health
├── Connection quality (latency, throughput, availability)
├── What changed recently
├── Open issues
└── Today at a glance

Connection quality
├── Latency detail
├── Throughput detail
├── Power detail
└── Obstruction detail

Incidents and events
├── Timeline
├── Filters
└── Event / incident detail

Reliability
├── Selected-range summary
├── Historical evidence
└── Data completeness and definitions
```

The existing `/`, `/analytics`, `/incidents`, `/alerts`, `/daily-log`, and `/settings` routes
remain valid. Phase 1 can use focused panels or query-state drill-downs before introducing
additional routes in Phase 2.

## Overview layout contract

### Desktop

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Mission overview                           Live monitoring · updated 1m │
│ Calm read on your local Starlink connection.                            │
├────────────────────────────────────────────────────────────────────────┤
│ ● Everything looks healthy                                               │
│   Online for 3d 4h. No active issue needs attention.       Last 12:41   │
│   [Open connection quality]                              No incidents → │
├───────────────────────────────┬────────────────────────────────────────┤
│ Connection quality →          │ Latency →                                │
│ Available 99.98% · last 24h   │ 27 ms median · 37 ms latest              │
│ [small evidence sparkline]    │ [small evidence sparkline]               │
├────────────────────────────────────────────────────────────────────────┤
│ What changed recently                              View incidents →     │
│ timeline with concise event explanations and related issue state        │
├────────────────────────────────────────────────────────────────────────┤
│ Today at a glance              Reliability                               │
└────────────────────────────────────────────────────────────────────────┘
```

The hero is a health statement, not a decorative giant metric. The two summaries are the only
equal-weight metric surfaces above the fold. Other passive telemetry moves below the fold or into
focused detail.

### Mobile

```text
Mission overview                         live · updated 1m
Everything looks healthy
Online for 3d 4h. No active issue needs attention.
[Open connection quality]

Connection quality →
Availability · 99.98% in the last 24h

Latency →
27 ms median · 37 ms latest

What changed recently →
Open issues →
```

Stack sections in order of decision value. Never hide active severity, freshness, or the primary
action behind a disclosure control.

## State and copy contract

| State                 | Primary statement                  | Supporting copy                                                                 | Primary action              |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| Healthy               | `Everything looks healthy`         | `Online for {uptime}. No active issue needs attention.`                         | `Open connection quality`   |
| Degraded              | `Connection needs attention`       | `{issue summary}. Mission Control is monitoring the link.`                      | `View active issue`         |
| Offline               | `Internet connection is offline`   | `A local connectivity incident has been confirmed since {time}.`                | `View incident`             |
| Device unreachable    | `Starlink cannot be reached`       | `The collector has not received a response since {time}.`                       | `Troubleshoot reachability` |
| Collector delayed     | `Monitoring data is delayed`       | `The last successful sample was {relative time}. Connection health is unknown.` | `View collector status`     |
| Telemetry unavailable | `Connection status is unavailable` | `Mission Control is waiting for a successful local sample.`                     | `Try again`                 |

Rules:

- Use `healthy` only after a current, successful observation and no active relevant issue.
- Use `unknown`/`unavailable` when fresh data is missing; do not fall back to a reassuring state.
- Pair every warning or critical state with one explicit next action.
- State source matters: label `Local observation` where the scope might otherwise be mistaken for
  Starlink-wide service status.

## Data contract for the first UI release

| UI element           | Current source                            | Presentation rule                                                            |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Health and freshness | snapshot, system status, active incidents | State and last successful sample must remain visible.                        |
| Connection quality   | incident stats, incidents, telemetry      | Use observed availability and preserve the local-observation caveat.         |
| Latency              | `latency_ms` telemetry                    | Show latest plus a selected-range median/baseline when enough samples exist. |
| Throughput           | downlink/uplink telemetry                 | Label as live throughput, not speed-test performance.                        |
| Power                | `power_watts` telemetry                   | Show only where available; compare current with selected-range average.      |
| Obstruction          | `obstruction_fraction` telemetry          | Show a fraction/trend only; no alignment or visual sky-map claim.            |
| Timeline             | events, incidents, alerts                 | Preserve timestamps, category, severity, duration, and resolution state.     |
| Completeness         | incident stats, daily summary             | Explain that missing collection is not zero activity.                        |

## Interaction and accessibility requirements

- Every linked metric summary has a visible label, a keyboard-accessible target, and a descriptive
  destination.
- Charts must expose a text summary: time range, latest value, baseline, extrema where relevant,
  and data gaps.
- Hover interactions enhance data inspection but cannot be the only way to read a value.
- Respect `prefers-reduced-motion`; state changes may crossfade but must never delay visibility.
- Maintain at least 4.5:1 contrast for body text and controls; severity colour is never the sole
  indicator of state.
- Controls meet a 40 px minimum target height on touch devices.

## Phase 1 acceptance criteria

1. At the top of the overview, a user can identify state, freshness, active-issue status, and next
   action without scrolling.
2. The overview exposes no more than two peer diagnostic metric summaries before the activity
   section.
3. Each displayed metric has a unit, time context, and an explanation or direct route to one.
4. A user can reach related incidents from a degraded state in one action.
5. Healthy, degraded, offline, device-unreachable, collector-delayed, and unavailable states are
   designed and manually verified at desktop and mobile breakpoints.
6. No UI uses unavailable data as `0`, an empty chart as healthy, or local observation as a
   carrier guarantee.
7. Keyboard navigation, focus visibility, contrast, chart text alternatives, and reduced-motion
   behavior are verified before release.

## Deliberate deferrals

The following belong to later phases and must not be represented as existing functionality:

- router/Wi-Fi client and band-switching events;
- DNS/public-endpoint or multi-hop probe results;
- manual speed-test measurements and history;
- Starlink alignment guidance or visual obstruction maps;
- external service-outage data;
- AI/chat support or automated root-cause claims.

Each requires an explicit data contract and, for device protocol access, standalone diagnostic
validation before production collection.
