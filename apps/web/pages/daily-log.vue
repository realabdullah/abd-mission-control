<script setup lang="ts">
import { onMounted, ref } from 'vue';
const config = useRuntimeConfig();
const api = (path: string) => `${config.public.apiBase}/api/v1${path}`;
const summaries = ref<Record<string, unknown>[]>([]);
const error = ref<string | null>(null);
onMounted(async () => {
  try {
    const response = await fetch(api('/daily-summaries?limit=30'));
    if (!response.ok) throw new Error('Daily summaries are temporarily unavailable.');
    summaries.value = (await response.json()) as Record<string, unknown>[];
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Daily summaries are temporarily unavailable.';
  }
});
function duration(value: unknown): string {
  const seconds = Number(value);
  return seconds < 3600 ? `${Math.round(seconds / 60)}m` : `${(seconds / 3600).toFixed(1)}h`;
}
</script>
<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">MISSION / DAILY LOG</div>
        <h1>Daily mission log</h1>
        <p class="lede">Deterministic records generated from persisted observations.</p>
      </div>
      <StatusPill label="Local history" tone="info" />
    </header>
    <div v-if="error" class="error-banner">{{ error }}</div>
    <section class="logs">
      <div v-if="!summaries.length && !error" class="empty-state">
        <strong>Waiting for today's summary.</strong
        ><span>The collector generates a summary after its scheduled cycle.</span>
      </div>
      <article v-for="summary in summaries" v-else :key="String(summary.id)" class="log">
        <header>
          <div>
            <span class="date">{{ summary.date }}</span>
            <h2>{{ Number(summary.availabilityPercent).toFixed(2) }}% available</h2>
          </div>
          <span>{{ summary.incidentCount }} incidents</span>
        </header>
        <p>
          {{
            summary.incidentCount
              ? `${summary.incidentCount} incident${Number(summary.incidentCount) === 1 ? '' : 's'} recorded with ${duration(summary.totalOutageSeconds)} total outage.`
              : 'Connection remained healthy. No incidents required attention.'
          }}
        </p>
        <div class="log-meta">
          <span>Longest outage {{ duration(summary.longestOutageSeconds) }}</span
          ><span>Telemetry {{ Number(summary.telemetryCompletenessPercent).toFixed(0) }}%</span
          ><span
            >Peak downlink
            {{
              summary.peakDownlinkBps == null
                ? 'Unavailable'
                : `${(Number(summary.peakDownlinkBps) / 1e6).toFixed(1)} Mbps`
            }}</span
          >
        </div>
      </article>
    </section>
  </div>
</template>
<style scoped>
.page {
  width: min(1000px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.crumb {
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
.logs {
  margin-top: 38px;
  display: grid;
  gap: 12px;
}
.log {
  padding: 21px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.log header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.date {
  color: var(--accent);
  font-size: 11px;
}
.log h2 {
  margin: 8px 0 0;
  font-size: 22px;
  letter-spacing: -0.025em;
}
.log header > span {
  color: var(--ink-muted);
  font-size: 11px;
}
.log p {
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.55;
}
.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: var(--ink-muted);
  font-size: 11px;
}
.empty-state {
  padding: 70px 20px;
  text-align: center;
  color: var(--ink-muted);
  font-size: 12px;
}
.empty-state strong {
  display: block;
  color: var(--ink-soft);
  margin-bottom: 6px;
}
.error-banner {
  margin-top: 22px;
  padding: 11px 13px;
  border: 1px solid #68423b;
  color: #e5b4a6;
  background: #211817;
  font-size: 12px;
}
@media (max-width: 600px) {
  .page-head {
    display: block;
  }
  .page-head > :last-child {
    margin-top: 16px;
  }
  .log header {
    display: block;
  }
  .log header > span {
    display: block;
    margin-top: 12px;
  }
}
</style>
