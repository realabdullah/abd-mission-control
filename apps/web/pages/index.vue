<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { ChartPoint } from '~/components/TelemetryChart.vue';

type Snapshot = {
  state: string;
  reachable: boolean;
  internetConnected: boolean | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
  downlinkThroughputBps: number | null;
  uplinkThroughputBps: number | null;
  obstructionFraction: number | null;
  uptimeSeconds: number | null;
  powerWatts: number | null;
  firmwareVersion: string | null;
  hardwareVersion: string | null;
  lastSuccessfulSampleAt: string | null;
  updatedAt: string;
};
type TelemetryRow = {
  timestamp: string;
  metric: string;
  value?: number;
  latest?: number;
  average?: number;
  minimum?: number;
  maximum?: number;
  unit?: string;
};
type Incident = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  durationSeconds: number;
  startedAt: string;
  state: string;
};
type EventRow = {
  id: string;
  description: string;
  severity: string;
  category: string;
  occurredAt: string;
  timestamp?: string;
};
type Stats = {
  uptimePercent: number;
  outageCount: number;
  longestOutageSeconds: number;
  latencyP95Ms: number | null;
  telemetryCompletenessPercent: number;
};
type Summary = {
  availabilityPercent: number;
  incidentCount: number;
  totalOutageSeconds: number;
  telemetryCompletenessPercent: number;
  notableIssues: string[];
};
type Alert = { id: string; message: string; severity: string };
const config = useRuntimeConfig();
const integrationId = '00000000-0000-0000-0000-000000000001';
const api = (path: string) => `${config.public.apiBase}/api/v1${path}`;
const snapshot = ref<Snapshot | null>(null);
const telemetry = ref<TelemetryRow[]>([]);
const incidents = ref<Incident[]>([]);
const events = ref<EventRow[]>([]);
const stats = ref<Stats | null>(null);
const summary = ref<Summary | null>(null);
const alerts = ref<Alert[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const range = ref<'1h' | '6h' | '24h' | '7d' | '30d'>('1h');
const streamState = ref<'connecting' | 'live' | 'reconnecting'>('connecting');
const cursorTime = ref<number | null>(null);
let source: EventSource | undefined;
async function get<T>(path: string): Promise<T | null> {
  const response = await fetch(api(path));
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return (await response.json()) as T;
}
async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await Promise.all([
      get<Snapshot>(`/integrations/${integrationId}/snapshot`),
      get<TelemetryRow[]>(
        `/integrations/${integrationId}/telemetry?range=${range.value}&limit=400`,
      ),
      get<EventRow[]>(`/integrations/${integrationId}/events?limit=8`),
      get<Incident[]>('/incidents/active'),
      get<Stats>('/incidents/stats?range=24h'),
      get<Summary[]>(`/daily-summaries?limit=1`),
      get<Alert[]>('/alerts?acknowledged=false&limit=20'),
    ]);
    snapshot.value = result[0];
    telemetry.value = result[1] ?? [];
    events.value = result[2] ?? [];
    incidents.value = result[3] ?? [];
    stats.value = result[4];
    summary.value = result[5]?.[0] ?? null;
    alerts.value = result[6] ?? [];
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'The API could not provide the mission view.';
  } finally {
    loading.value = false;
  }
}
const state = computed(() => {
  if (incidents.value.some((i) => i.type === 'internet_connectivity_lost'))
    return { label: 'Internet offline', tone: 'critical' as const };
  if (incidents.value.some((i) => i.type === 'starlink_device_unreachable'))
    return { label: 'Starlink unreachable', tone: 'critical' as const };
  if (incidents.value.length) return { label: 'Connection degraded', tone: 'warning' as const };
  if (snapshot.value?.state === 'nominal')
    return { label: 'Everything looks healthy', tone: 'success' as const };
  return { label: 'Telemetry unavailable', tone: 'muted' as const };
});
const healthCopy = computed(() => {
  if (!snapshot.value) return 'Waiting for the first successful sample from the local collector.';
  if (state.value.tone === 'success')
    return `Your Starlink has been online for ${duration(snapshot.value.uptimeSeconds)}. No active issues need attention.`;
  return 'The collector is watching the link and will update this view when the condition changes.';
});
const lastSample = computed(() =>
  snapshot.value?.lastSuccessfulSampleAt
    ? relative(snapshot.value.lastSuccessfulSampleAt)
    : 'No successful sample',
);
function pointValue(row: TelemetryRow): number | null {
  const value = row.latest ?? row.value ?? row.average;
  return typeof value === 'number' ? value : null;
}
function points(metric: string): ChartPoint[] {
  return telemetry.value
    .filter((row) => row.metric === metric && pointValue(row) !== null)
    .map((row) => ({ timestamp: row.timestamp, value: pointValue(row)! }));
}
function duration(seconds: number | null | undefined): string {
  if (seconds == null) return 'Unavailable';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h`;
}
function relative(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
  return seconds < 60
    ? 'just now'
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}
function number(value: number | null | undefined, unit: string): string {
  return typeof value === 'number'
    ? `${value.toFixed(value > 100 ? 0 : 1)} ${unit}`
    : 'Unavailable';
}
function mbps(value: number | null | undefined): string {
  return typeof value === 'number'
    ? `${(value / 1e6).toFixed(value > 1e6 ? 1 : 2)} Mbps`
    : 'Unavailable';
}
function tone(severity: string): 'success' | 'warning' | 'critical' | 'info' | 'muted' {
  return severity === 'critical'
    ? 'critical'
    : severity === 'warning'
      ? 'warning'
      : severity === 'info'
        ? 'info'
        : 'muted';
}
async function acknowledge(id: string): Promise<void> {
  await fetch(api(`/alerts/${id}/acknowledge`), { method: 'POST' });
  await load();
}
function selectRange(value: typeof range.value) {
  range.value = value;
  void load();
}
onMounted(() => {
  void load();
  source = new EventSource(api('/stream'));
  source.onopen = () => {
    streamState.value = 'live';
  };
  source.onerror = () => {
    streamState.value = 'reconnecting';
  };
  source.addEventListener('snapshot', (event) => {
    snapshot.value = JSON.parse((event as MessageEvent).data) as Snapshot;
  });
  [
    'event',
    'incident.opened',
    'incident.updated',
    'incident.resolved',
    'alert.created',
    'alert.acknowledged',
  ].forEach((type) => source?.addEventListener(type, () => void load()));
});
onUnmounted(() => source?.close());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">MISSION / OVERVIEW</div>
        <h1>Mission overview</h1>
        <p class="lede">A calm read on the health of your local Starlink connection.</p>
      </div>
      <div class="head-status">
        <StatusPill
          :label="
            streamState === 'live'
              ? 'Live telemetry'
              : streamState === 'reconnecting'
                ? 'Reconnecting'
                : 'Connecting'
          "
          :tone="streamState === 'live' ? 'success' : 'warning'"
        /><span>Updated {{ lastSample }}</span>
      </div>
    </header>
    <div v-if="error" class="error-banner" role="alert">
      {{ error }} <button @click="load">Try again</button>
    </div>
    <section class="mission-summary" :class="state.tone">
      <div class="summary-mark"><span>●</span></div>
      <div class="summary-main">
        <StatusPill :label="state.label" :tone="state.tone" />
        <h2>{{ healthCopy }}</h2>
        <p>
          Starlink Mini · local network observation ·
          {{ snapshot?.reachable ? 'Device reachable' : 'Waiting for device' }}
        </p>
      </div>
      <div class="summary-side">
        <span>LAST SAMPLE</span
        ><strong>{{
          snapshot?.lastSuccessfulSampleAt
            ? new Date(snapshot.lastSuccessfulSampleAt).toLocaleTimeString()
            : '—'
        }}</strong
        ><NuxtLink to="/incidents"
          >{{
            incidents.length
              ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}`
              : 'No active incidents'
          }}
          →</NuxtLink
        >
      </div>
    </section>
    <section class="section-block">
      <div class="section-title">
        <div>
          <span class="section-kicker">CURRENT CONNECTION</span>
          <h2>Live metrics</h2>
        </div>
        <span class="section-note">Direct from the latest device sample</span>
      </div>
      <div class="metric-grid">
        <MetricCard
          label="Latency"
          :value="number(snapshot?.latencyMs, 'ms')"
          context="POP ping"
          :help="{
            title: 'Latency',
            text: 'The round-trip time to Starlink’s point of presence. Lower is generally better for calls, games, and responsive browsing.',
          }"
        /><MetricCard
          label="Download"
          :value="mbps(snapshot?.downlinkThroughputBps)"
          context="Live throughput"
          :help="{
            title: 'Download throughput',
            text: 'The current receive rate reported by the device. It is a momentary gauge, not a data-usage total.',
          }"
        /><MetricCard
          label="Upload"
          :value="mbps(snapshot?.uplinkThroughputBps)"
          context="Live throughput"
        /><MetricCard
          label="Packet loss"
          :value="number(snapshot?.packetLossPercent, '%')"
          :context="
            snapshot?.packetLossPercent == null
              ? 'Not exposed by this device'
              : 'Recent observation'
          "
          tone="muted"
          :help="{
            title: 'Packet loss',
            text: 'The share of packets that did not arrive. This Starlink response does not currently expose the metric.',
          }"
        /><MetricCard
          label="Uptime"
          :value="duration(snapshot?.uptimeSeconds)"
          context="Device runtime"
        /><MetricCard
          label="Obstruction"
          :value="
            snapshot?.obstructionFraction == null
              ? 'Unavailable'
              : `${(snapshot.obstructionFraction * 100).toFixed(2)}%`
          "
          context="Sky view fraction"
          :help="{
            title: 'Obstruction',
            text: 'The fraction of the observed sky view affected by obstructions. Lower is better; this is not a direct outage percentage.',
          }"
        />
      </div>
    </section>
    <section class="section-block">
      <div class="section-title">
        <div>
          <span class="section-kicker">TELEMETRY</span>
          <h2>Connection behaviour</h2>
        </div>
        <div class="range-switch" aria-label="Telemetry time range">
          <button
            v-for="option in ['1h', '6h', '24h', '7d', '30d']"
            :key="option"
            :class="{ selected: range === option }"
            @click="selectRange(option as typeof range)"
          >
            {{ option }}
          </button>
        </div>
      </div>
      <div class="charts">
        <TelemetryChart
          title="Latency"
          unit="ms"
          :points="points('latency_ms')"
          :range-label="range"
          color="var(--mission)"
          :cursor-time="cursorTime"
          @update:cursor-time="cursorTime = $event"
        /><TelemetryChart
          title="Throughput"
          unit="Mbps"
          :points="points('downlink_throughput_bps')"
          :range-label="range"
          color="var(--telemetry)"
          :cursor-time="cursorTime"
          @update:cursor-time="cursorTime = $event"
        /><TelemetryChart
          title="Upload"
          unit="Mbps"
          :points="points('uplink_throughput_bps')"
          :range-label="range"
          color="var(--reliability)"
          :cursor-time="cursorTime"
          @update:cursor-time="cursorTime = $event"
        /><TelemetryChart
          title="Obstruction"
          unit="fraction"
          :points="points('obstruction_fraction')"
          :range-label="range"
          color="var(--info)"
          :cursor-time="cursorTime"
          @update:cursor-time="cursorTime = $event"
        />
      </div>
      <p class="chart-footnote">
        Hover to inspect a sample. Drag to pan and scroll to zoom. Missing observations remain gaps.
      </p>
    </section>
    <section class="split-block">
      <div class="section-block">
        <div class="section-title">
          <div>
            <span class="section-kicker">TIMELINE</span>
            <h2>Recent activity</h2>
          </div>
          <NuxtLink to="/incidents">View incidents →</NuxtLink>
        </div>
        <div class="event-list">
          <div v-if="!events.length" class="empty-state">
            <strong>Everything has been operating normally.</strong
            ><span>Meaningful state changes will appear here as the mission develops.</span>
          </div>
          <article v-for="event in events" :key="event.id" class="event-row">
            <span class="event-icon" :class="tone(event.severity)">●</span>
            <div>
              <strong>{{ event.description }}</strong
              ><small
                >{{ relative(event.occurredAt ?? event.timestamp ?? '') }} ·
                {{ event.category }}</small
              >
            </div>
          </article>
        </div>
      </div>
      <div class="section-block attention">
        <div class="section-title">
          <div>
            <span class="section-kicker">ATTENTION</span>
            <h2>Open issues</h2>
          </div>
          <NuxtLink to="/alerts">All alerts →</NuxtLink>
        </div>
        <div v-if="!incidents.length && !alerts.length" class="empty-state">
          <strong>No action needed.</strong
          ><span>Active incidents and unacknowledged alerts will be surfaced here.</span>
        </div>
        <div v-for="incident in incidents" :key="incident.id" class="issue-row">
          <StatusPill :label="incident.severity" :tone="tone(incident.severity)" />
          <div>
            <strong>{{ incident.title }}</strong
            ><small>{{ duration(incident.durationSeconds) }} · {{ incident.description }}</small>
          </div>
        </div>
        <div v-for="alert in alerts" :key="alert.id" class="issue-row">
          <StatusPill :label="alert.severity" :tone="tone(alert.severity)" />
          <div>
            <strong>{{ alert.message }}</strong
            ><button class="text-button" @click="acknowledge(alert.id)">Acknowledge</button>
          </div>
        </div>
      </div>
    </section>
    <section class="bottom-grid">
      <article class="insight-block">
        <div class="section-title">
          <div>
            <span class="section-kicker">RELIABILITY / 24H</span>
            <h2>How the link held</h2>
          </div>
          <NuxtLink to="/analytics">Open analytics →</NuxtLink>
        </div>
        <div class="insight-values">
          <div>
            <strong>{{ stats ? `${stats.uptimePercent.toFixed(2)}%` : '—' }}</strong
            ><span
              >Availability
              <InfoTip
                title="Availability"
                text="The proportion of the selected window without confirmed local connectivity incidents. It is not a carrier SLA."
            /></span>
          </div>
          <div>
            <strong>{{ stats?.outageCount ?? '—' }}</strong
            ><span>Outages</span>
          </div>
          <div>
            <strong>{{ stats ? duration(stats.longestOutageSeconds) : '—' }}</strong
            ><span>Longest outage</span>
          </div>
          <div>
            <strong>{{
              stats?.latencyP95Ms == null ? '—' : `${Math.round(stats.latencyP95Ms)} ms`
            }}</strong
            ><span
              >Latency p95
              <InfoTip
                title="P95"
                text="95% of observed latency samples were at or below this value. It shows typical worst-case behaviour without being dominated by one spike."
            /></span>
          </div>
        </div>
      </article>
      <article class="insight-block">
        <div class="section-title">
          <div>
            <span class="section-kicker">DAILY MISSION</span>
            <h2>Today's record</h2>
          </div>
          <NuxtLink to="/daily-log">Daily log →</NuxtLink>
        </div>
        <div v-if="summary" class="daily-copy">
          <strong>{{ summary.availabilityPercent.toFixed(2) }}% available today</strong
          ><span
            >{{
              summary.incidentCount
                ? `${summary.incidentCount} incident${summary.incidentCount === 1 ? '' : 's'} recorded.`
                : 'No incidents have required attention.'
            }}
            Telemetry completeness: {{ summary.telemetryCompletenessPercent.toFixed(0) }}%.</span
          >
        </div>
        <div v-else class="empty-state">
          <strong>Waiting for today's summary.</strong
          ><span>The collector creates a deterministic daily record after its summary cycle.</span>
        </div>
      </article>
    </section>
    <footer class="technical">
      <span>{{ snapshot?.hardwareVersion ?? 'Starlink Mini' }}</span
      ><span>Firmware {{ snapshot?.firmwareVersion ?? 'Unavailable' }}</span
      ><span>Power {{ number(snapshot?.powerWatts, 'W') }}</span
      ><span>Local timezone display</span>
    </footer>
  </div>
</template>

<style scoped>
.page {
  width: min(1240px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
  min-width: 0;
  overflow-x: clip;
}
.page-head,
.section-title,
.head-status,
.summary-side,
.technical {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.crumb,
.section-kicker {
  color: #78908f;
  font-size: 10px;
  letter-spacing: 0.13em;
  font-weight: 700;
}
.page h1 {
  margin: 9px 0 4px;
  font-size: clamp(1.9rem, 3.2vw, 2.8rem);
  line-height: 1;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.lede {
  margin: 0;
  color: var(--ink-muted);
  font-size: 13px;
}
.head-status {
  align-items: flex-end;
  flex-direction: column;
  color: var(--ink-muted);
  font-size: 11px;
}
.mission-summary {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 17px;
  margin-top: 36px;
  padding: 25px 26px;
  border: 1px solid var(--summary-line);
  border-radius: var(--radius);
  background: var(--summary);
}
.mission-summary.warning {
  border-color: #59462d;
  background: var(--summary-warning);
}
.mission-summary.critical {
  border-color: #5d3732;
  background: var(--summary-critical);
}
.summary-mark {
  padding-top: 7px;
}
.summary-mark span {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border: 1px solid var(--accent-strong);
  border-radius: 50%;
  color: var(--accent);
  font-size: 12px;
}
.warning .summary-mark span {
  border-color: var(--warning);
  color: var(--warning);
}
.critical .summary-mark span {
  border-color: var(--critical);
  color: var(--critical);
}
.summary-main h2 {
  max-width: 700px;
  margin: 13px 0 6px;
  font-size: clamp(1.2rem, 2.3vw, 1.8rem);
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.summary-main p {
  color: var(--ink-muted);
  font-size: 12px;
  margin: 0;
}
.summary-side {
  align-items: flex-end;
  flex-direction: column;
  color: var(--ink-muted);
  font-size: 10px;
  letter-spacing: 0.09em;
}
.summary-side strong {
  color: var(--ink);
  font-size: 13px;
  letter-spacing: 0;
}
.summary-side a,
.section-title a {
  color: var(--accent);
  text-decoration: none;
  font-size: 11px;
  letter-spacing: 0;
}
.section-block {
  margin-top: 38px;
}
.section-title {
  align-items: flex-end;
  margin-bottom: 14px;
}
.section-title h2 {
  margin: 7px 0 0;
  font-size: 17px;
  letter-spacing: -0.015em;
}
.section-note,
.chart-footnote {
  color: var(--ink-muted);
  font-size: 11px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--line-soft);
  background: var(--line-soft);
}
.charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--line-soft);
  background: var(--line-soft);
}
.chart-footnote {
  margin: 9px 0 0;
}
.range-switch {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.range-switch button {
  min-height: 28px;
  height: 28px;
  padding: 6px 9px;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: 11px;
  border-radius: var(--radius-sm);
}
.range-switch button:hover,
.range-switch button.selected {
  color: var(--ink);
  background: var(--selected);
}
.split-block,
.bottom-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 26px;
}
.split-block {
  margin-top: 38px;
}
.event-list,
.attention {
  border-top: 1px solid var(--line);
}
.event-row,
.issue-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 0;
  border-bottom: 1px solid var(--line-soft);
}
.event-row div,
.issue-row div {
  display: grid;
  gap: 4px;
}
.event-row strong,
.issue-row strong {
  font-size: 12px;
  font-weight: 600;
}
.event-row small,
.issue-row small {
  color: var(--ink-muted);
  font-size: 11px;
}
.event-icon {
  margin-top: 2px;
  font-size: 12px;
}
.event-icon.success {
  color: var(--success);
}
.event-icon.warning {
  color: var(--warning);
}
.event-icon.critical {
  color: var(--critical);
}
.text-button {
  border: 0;
  padding: 0;
  color: var(--accent);
  background: transparent;
  font-size: 11px;
  text-align: left;
}
.empty-state {
  display: grid;
  gap: 6px;
  padding: 22px 0;
  color: var(--ink-muted);
  font-size: 11px;
  line-height: 1.5;
}
.empty-state strong {
  color: var(--ink-soft);
  font-size: 12px;
}
.bottom-grid {
  margin-top: 38px;
}
.insight-block {
  padding: 20px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.insight-values {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 24px;
}
.insight-values div {
  display: grid;
  gap: 6px;
}
.insight-values strong {
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
}
.insight-values span {
  color: var(--ink-muted);
  font-size: 10px;
}
.daily-copy {
  display: grid;
  gap: 8px;
  margin-top: 24px;
}
.daily-copy strong {
  font-size: 1.25rem;
}
.daily-copy span {
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.55;
}
.technical {
  margin-top: 30px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
  color: #607878;
  font-size: 10px;
  flex-wrap: wrap;
}
.error-banner {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 22px;
  padding: 11px 13px;
  border: 1px solid #68423b;
  background: #211817;
  color: #e5b4a6;
  font-size: 12px;
}
.error-banner button {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
}
@media (max-width: 980px) {
  .metric-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .split-block,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .page {
    padding-top: 25px;
  }
  .page-head {
    display: block;
  }
  .head-status {
    align-items: flex-start;
    margin-top: 16px;
  }
  .mission-summary {
    grid-template-columns: 32px 1fr;
    padding: 19px;
  }
  .summary-side {
    grid-column: 2;
    align-items: flex-start;
  }
  .charts {
    grid-template-columns: 1fr;
  }
  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }
  .range-switch {
    align-self: stretch;
    overflow-x: auto;
  }
  .range-switch button {
    flex: 1;
  }
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .insight-values {
    grid-template-columns: repeat(2, 1fr);
  }
  .technical {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
