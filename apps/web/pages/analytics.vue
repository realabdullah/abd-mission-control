<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ChartPoint } from '~/components/TelemetryChart.vue';
const { request } = useMissionApi();
const id = '00000000-0000-0000-0000-000000000001';
const range = ref<'today' | '24h' | '7d' | '30d'>('7d');
const stats = ref<Record<string, number | null> | null>(null);
const telemetry = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [s, t] = await Promise.all([
      request(`/incidents/stats?range=${range.value}`),
      request(
        `/integrations/${id}/telemetry?range=${range.value === 'today' ? '24h' : range.value}&limit=400`,
      ),
    ]);
    if (!s.ok || !t.ok) throw new Error('Reliability data is temporarily unavailable.');
    stats.value = (await s.json()) as Record<string, number | null>;
    telemetry.value = (await t.json()) as Record<string, unknown>[];
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Reliability data is temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
function chart(metric: string): ChartPoint[] {
  return telemetry.value
    .filter(
      (row) =>
        row.metric === metric && typeof (row.latest ?? row.value ?? row.average) === 'number',
    )
    .map((row) => ({
      timestamp: String(row.timestamp),
      value: Number(row.latest ?? row.value ?? row.average),
    }));
}
function percent(value: number | null | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'Unavailable';
}
function duration(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Unavailable';
  return value < 60
    ? `${Math.round(value)}s`
    : value < 3600
      ? `${Math.round(value / 60)}m`
      : `${(value / 3600).toFixed(1)}h`;
}
onMounted(() => void load());
</script>
<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">ANALYTICS / LINK RELIABILITY</div>
        <h1>Reliability</h1>
        <p class="lede">A measured view of how the local connection has behaved.</p>
      </div>
      <StatusPill label="Local observation" tone="info" />
    </header>
    <div v-if="error" class="error-banner">
      {{ error }} <button @click="load">Try again</button>
    </div>
    <nav class="range-switch" aria-label="Reliability range">
      <button
        v-for="item in ['today', '24h', '7d', '30d']"
        :key="item"
        :class="{ selected: range === item }"
        @click="
          range = item as typeof range;
          load();
        "
      >
        {{ item }}
      </button>
    </nav>
    <PageSkeleton v-if="loading" variant="analytics" />
    <section id="reliability" v-else-if="stats" class="stats-grid">
      <MetricCard
        label="Availability"
        :value="percent(stats.uptimePercent)"
        context="Observed uptime"
        :help="{
          title: 'Availability',
          text: 'The portion of the selected window without a confirmed local connectivity incident. It is measured by this collector, not a carrier SLA.',
        }"
      /><MetricCard
        label="Outage time"
        :value="duration(stats.totalOutageSeconds)"
        :context="`${stats.outageCount ?? 0} recorded outages`"
      /><MetricCard
        label="Longest outage"
        :value="duration(stats.longestOutageSeconds)"
        context="Single incident"
      /><MetricCard
        label="Median outage"
        :value="duration(stats.medianOutageSeconds)"
        context="Typical incident"
      /><MetricCard
        label="Latency p95"
        :value="stats.latencyP95Ms == null ? 'Unavailable' : `${Math.round(stats.latencyP95Ms)} ms`"
        context="95th percentile"
        :help="{
          title: 'P95',
          text: '95% of observed samples were at or below this value. It is a useful view of typical worst-case behaviour.',
        }"
      /><MetricCard
        label="Telemetry complete"
        :value="percent(stats.telemetryCompletenessPercent)"
        context="Expected poll observations"
        :help="{
          title: 'Telemetry completeness',
          text: 'The share of expected polling observations that were stored in this window. Missing values are not treated as zero.',
        }"
      />
    </section>
    <section v-if="!loading && stats" class="analysis-grid">
      <div id="latency">
        <div class="section-title">
          <div>
            <span class="section-kicker">SIGNAL HISTORY</span>
            <h2>Latency profile</h2>
          </div>
          <InfoTip
            title="Latency"
            text="Round-trip time to Starlink’s point of presence. Spikes and gaps are preserved rather than smoothed away."
          />
        </div>
        <TelemetryChart
          title="Latency"
          unit="ms"
          :points="chart('latency_ms')"
          :range-label="range"
          color="var(--mission)"
        />
      </div>
      <div>
        <div class="section-title">
          <div>
            <span class="section-kicker">SIGNAL HISTORY</span>
            <h2>Throughput</h2>
          </div>
        </div>
        <TelemetryChart
          title="Download"
          unit="Mbps"
          :points="chart('downlink_throughput_bps')"
          :range-label="range"
          color="var(--telemetry)"
        />
      </div>
    </section>
    <section v-if="!loading" class="analysis-grid">
      <div>
        <div class="section-title">
          <div>
            <span class="section-kicker">LINK CONDITIONS</span>
            <h2>Obstruction trend</h2>
          </div>
        </div>
        <TelemetryChart
          title="Obstruction"
          unit="fraction"
          :points="chart('obstruction_fraction')"
          :range-label="range"
          color="var(--info)"
        />
      </div>
      <div class="definition">
        <span class="section-kicker">READING THIS VIEW</span>
        <h2>Honest numbers, useful context.</h2>
        <p>
          Availability is calculated from local collector observations. Packet loss is shown only
          when the Starlink response exposes it. Gaps mean the collector did not store an
          observation.
        </p>
      </div>
    </section>
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
.section-title {
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
}
.lede {
  color: var(--ink-muted);
  font-size: 13px;
  margin: 0;
}
.error-banner {
  display: flex;
  justify-content: space-between;
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
.range-switch {
  display: flex;
  width: fit-content;
  gap: 3px;
  margin: 32px 0 15px;
  padding: 3px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.range-switch button {
  min-height: 28px;
  height: 28px;
  padding: 7px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
  background: transparent;
  font-size: 11px;
}
.range-switch button.selected,
.range-switch button:hover {
  color: var(--ink);
  background: var(--selected);
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  border: 1px solid var(--line-soft);
  background: var(--line-soft);
}
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 27px;
  margin-top: 38px;
}
.section-title {
  align-items: flex-end;
  margin-bottom: 13px;
}
.section-title h2 {
  margin: 7px 0 0;
  font-size: 17px;
}
.definition {
  min-height: 220px;
  padding: 23px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.definition h2 {
  max-width: 250px;
  margin: 19px 0 12px;
  font-size: 23px;
  letter-spacing: -0.025em;
}
.definition p {
  max-width: 45ch;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.7;
}
@media (max-width: 980px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 680px) {
  .page-head {
    display: block;
  }
  .page-head > :last-child {
    margin-top: 16px;
  }
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .range-switch {
    width: 100%;
  }
  .range-switch button {
    flex: 1;
  }
}
</style>
