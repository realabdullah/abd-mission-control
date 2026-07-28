<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChartPoint } from '~/components/TelemetryChart.vue';

type MetricKey = 'quality' | 'latency' | 'throughput' | 'power' | 'obstruction';
type TelemetryRow = {
  timestamp: string;
  value?: number;
  latest?: number;
  average?: number;
  minimum?: number;
  maximum?: number;
};
type Snapshot = {
  latencyMs: number | null;
  downlinkThroughputBps: number | null;
  uplinkThroughputBps: number | null;
  powerWatts: number | null;
  obstructionFraction: number | null;
  hardwareVersion: string | null;
  lastSuccessfulSampleAt: string | null;
};
type Stats = {
  uptimePercent: number;
  outageCount: number;
  totalOutageSeconds: number;
  latencyP95Ms: number | null;
  telemetryCompletenessPercent: number;
};

const integrationId = '00000000-0000-0000-0000-000000000001';
const { request } = useMissionApi();
const route = useRoute();
const range = ref<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
const rows = ref<TelemetryRow[]>([]);
const snapshot = ref<Snapshot | null>(null);
const stats = ref<Stats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const metric = computed<MetricKey>(() => {
  const value = route.query.metric;
  return typeof value === 'string' &&
    ['quality', 'latency', 'throughput', 'power', 'obstruction'].includes(value)
    ? (value as MetricKey)
    : 'quality';
});
const details = computed(() => {
  const all: Record<
    MetricKey,
    {
      title: string;
      label: string;
      telemetry?: string;
      unit: string;
      definition: string;
      caveat: string;
    }
  > = {
    quality: {
      title: 'Connection quality',
      label: 'Observed availability',
      unit: '%',
      definition:
        'Availability is the portion of this selected window without a confirmed local connectivity incident.',
      caveat: 'This is a local collector observation, not a Starlink service-level agreement.',
    },
    latency: {
      title: 'Latency',
      label: 'Point-of-presence response time',
      telemetry: 'latency_ms',
      unit: 'ms',
      definition:
        'Latency measures the round-trip time from the Starlink Mini to Starlink’s point of presence.',
      caveat: 'Short spikes can affect calls and games even when a full outage is not confirmed.',
    },
    throughput: {
      title: 'Throughput',
      label: 'Current transfer rate',
      telemetry: 'downlink_throughput_bps',
      unit: 'Mbps',
      definition:
        'Download throughput is the momentary rate reported by the device; it describes current use, not the maximum connection speed.',
      caveat:
        'A quiet line can correctly show near-zero throughput. Use a future manual speed test for capacity measurement.',
    },
    power: {
      title: 'Power draw',
      label: 'Device power',
      telemetry: 'power_watts',
      unit: 'W',
      definition:
        'Power draw is the amount of power the Starlink terminal reports using at each observation.',
      caveat:
        'This is device telemetry only; it is not a measurement of total household energy use.',
    },
    obstruction: {
      title: 'Obstruction',
      label: 'Observed sky-view fraction',
      telemetry: 'obstruction_fraction',
      unit: 'fraction',
      definition:
        'Obstruction is the fraction of the observed sky view affected by an obstruction. Lower is better.',
      caveat: 'Mission Control has no validated obstruction map or alignment data yet.',
    },
  };
  return all[metric.value];
});
function pointValue(row: TelemetryRow): number | null {
  const value = row.latest ?? row.value ?? row.average;
  return typeof value === 'number' ? value : null;
}
const points = computed<ChartPoint[]>(() =>
  rows.value
    .map((row) => ({ timestamp: row.timestamp, value: pointValue(row) }))
    .filter((row): row is ChartPoint => row.value !== null),
);
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function display(value: number | null, unit: string): string {
  if (value == null) return 'Unavailable';
  if (unit === 'Mbps') return `${(value / 1e6).toFixed(value > 1e6 ? 1 : 2)} Mbps`;
  if (unit === 'fraction') return `${(value * 100).toFixed(2)}%`;
  if (unit === '%') return `${value.toFixed(2)}%`;
  return `${value.toFixed(value > 100 ? 0 : 1)} ${unit}`;
}
function duration(seconds: number): string {
  return seconds < 60
    ? `${Math.round(seconds)}s`
    : seconds < 3600
      ? `${Math.round(seconds / 60)}m`
      : `${(seconds / 3600).toFixed(1)}h`;
}
const summary = computed(() => {
  if (metric.value === 'quality') {
    return {
      current: stats.value ? display(stats.value.uptimePercent, '%') : 'Unavailable',
      baseline: stats.value
        ? `${stats.value.outageCount} outage${stats.value.outageCount === 1 ? '' : 's'} in this window`
        : 'Waiting for reliability observations',
      supporting: stats.value
        ? `${duration(stats.value.totalOutageSeconds)} confirmed outage time`
        : 'No outage summary is available yet',
    };
  }
  const values = points.value.map((point) => point.value);
  const latest = values.at(-1) ?? null;
  return {
    current: display(latest, details.value.unit),
    baseline:
      median(values) == null
        ? 'No baseline yet'
        : `${display(median(values), details.value.unit)} median`,
    supporting: snapshot.value?.lastSuccessfulSampleAt
      ? `Last device sample ${new Date(snapshot.value.lastSuccessfulSampleAt).toLocaleTimeString()}`
      : 'No successful device sample',
  };
});
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [snapshotResponse, statsResponse, telemetryResponse] = await Promise.all([
      request(`/integrations/${integrationId}/snapshot`),
      request(
        `/incidents/stats?range=${range.value === '1h' || range.value === '6h' ? '24h' : range.value}`,
      ),
      details.value.telemetry
        ? request(
            `/integrations/${integrationId}/telemetry?metric=${details.value.telemetry}&range=${range.value}&limit=400`,
          )
        : Promise.resolve(null),
    ]);
    if (!snapshotResponse.ok || !statsResponse.ok || (telemetryResponse && !telemetryResponse.ok))
      throw new Error('Diagnostic data is temporarily unavailable.');
    snapshot.value = (await snapshotResponse.json()) as Snapshot;
    stats.value = (await statsResponse.json()) as Stats;
    rows.value = telemetryResponse ? ((await telemetryResponse.json()) as TelemetryRow[]) : [];
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Diagnostic data is temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
watch([metric, range], () => void load(), { immediate: true });
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">MISSION / CONNECTION</div>
        <h1>{{ details.title }}</h1>
        <p class="lede">{{ details.label }} from the local Starlink collector.</p>
      </div>
      <div class="head-actions">
        <DataFreshness :at="snapshot?.lastSuccessfulSampleAt ?? null" />
        <NuxtLink to="/" class="back-link">← Mission overview</NuxtLink>
      </div>
    </header>

    <nav class="metric-tabs" aria-label="Connection diagnostic">
      <NuxtLink
        v-for="item in ['quality', 'latency', 'throughput', 'power', 'obstruction']"
        :key="item"
        :to="{ path: '/connection', query: { metric: item } }"
        :class="{ active: metric === item }"
      >
        {{ item === 'quality' ? 'Quality' : item[0].toUpperCase() + item.slice(1) }}
      </NuxtLink>
    </nav>

    <div v-if="error" class="error-banner" role="alert">
      {{ error }} <button @click="load">Try again</button>
    </div>
    <PageSkeleton v-else-if="loading" variant="connection" />
    <template v-else>
      <section class="reading">
        <div>
          <span>NOW</span>
          <strong>{{ summary.current }}</strong>
          <small>{{ summary.supporting }}</small>
        </div>
        <div>
          <span>BASELINE</span>
          <strong>{{ summary.baseline }}</strong>
          <small>{{ range }} view · gaps remain gaps</small>
        </div>
      </section>

      <nav v-if="metric !== 'quality'" class="range-switch" aria-label="Diagnostic time range">
        <button
          v-for="item in ['1h', '6h', '24h', '7d', '30d']"
          :key="item"
          :class="{ selected: range === item }"
          @click="range = item as typeof range"
        >
          {{ item }}
        </button>
      </nav>

      <section v-if="metric === 'quality'" class="quality-detail">
        <div>
          <h2>How the link held</h2>
          <p>
            Availability is calculated from confirmed local connectivity incidents. Telemetry
            completeness is shown separately so missing observations do not look like good service.
          </p>
        </div>
        <dl>
          <div>
            <dt>Latency p95</dt>
            <dd>
              {{
                stats?.latencyP95Ms == null ? 'Unavailable' : `${Math.round(stats.latencyP95Ms)} ms`
              }}
            </dd>
          </div>
          <div>
            <dt>Telemetry complete</dt>
            <dd>
              {{ stats ? `${stats.telemetryCompletenessPercent.toFixed(1)}%` : 'Unavailable' }}
            </dd>
          </div>
        </dl>
      </section>
      <section v-else-if="metric === 'obstruction'" class="obstruction-detail">
        <StarlinkObstructionView
          :fraction="snapshot?.obstructionFraction ?? null"
          :hardware-version="snapshot?.hardwareVersion ?? null"
          :observed-at="snapshot?.lastSuccessfulSampleAt ?? null"
        />
        <TelemetryChart
          :title="details.title"
          :unit="details.unit"
          :points="points"
          :range-label="range"
          color="var(--mission)"
        />
      </section>
      <TelemetryChart
        v-else
        :title="details.title"
        :unit="details.unit"
        :points="points"
        :range-label="range"
        color="var(--mission)"
      />

      <aside class="definition">
        <h2>Reading this view</h2>
        <p>{{ details.definition }}</p>
        <p>{{ details.caveat }}</p>
      </aside>
    </template>
  </div>
</template>

<style scoped>
.page {
  width: min(1000px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
  min-width: 0;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.crumb,
.reading span {
  color: #78908f;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}
h1 {
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
.back-link {
  min-height: 40px;
  color: var(--accent);
  font-size: 12px;
  text-decoration: none;
}
.head-actions {
  display: grid;
  justify-items: end;
  gap: 8px;
}
.metric-tabs,
.range-switch {
  display: flex;
  gap: 3px;
  width: fit-content;
  max-width: 100%;
  margin-top: 30px;
  padding: 3px;
  overflow-x: auto;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.metric-tabs a,
.range-switch button {
  min-height: 34px;
  padding: 8px 10px;
  border: 0;
  color: var(--ink-muted);
  background: transparent;
  font-size: 11px;
  text-decoration: none;
  white-space: nowrap;
}
.metric-tabs a:hover,
.metric-tabs a.active,
.range-switch button:hover,
.range-switch button.selected {
  color: var(--ink);
  background: var(--selected);
}
.reading {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 28px;
  background: var(--line-soft);
  gap: 1px;
}
.reading > div {
  display: grid;
  gap: 8px;
  min-height: 154px;
  padding: 22px;
  background: var(--panel);
}
.reading strong {
  font-size: clamp(1.55rem, 3.5vw, 2.5rem);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.reading small {
  align-self: end;
  color: var(--ink-muted);
  font-size: 11px;
}
.range-switch {
  margin-top: 24px;
}
.quality-detail {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 32px;
  margin-top: 24px;
  padding: 24px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line-soft);
}
.obstruction-detail {
  display: grid;
  gap: 24px;
}
h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.quality-detail p,
.definition p {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.55;
  text-wrap: pretty;
}
dl {
  display: grid;
  gap: 1px;
  margin: 0;
  background: var(--line-soft);
}
dl div {
  display: grid;
  gap: 7px;
  padding: 16px;
  background: var(--panel);
}
dt {
  color: var(--ink-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
dd {
  margin: 0;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.definition {
  max-width: 68ch;
  margin-top: 26px;
  padding: 18px 0 0;
  border-top: 1px solid var(--line-soft);
}
.definition p {
  margin: 10px 0 0;
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
  color: var(--accent);
  background: transparent;
}
@media (max-width: 640px) {
  .page-head,
  .quality-detail {
    display: grid;
    grid-template-columns: 1fr;
  }
  .head-actions {
    justify-items: start;
  }
  .reading {
    grid-template-columns: 1fr;
  }
  .metric-tabs {
    width: 100%;
  }
}
</style>
