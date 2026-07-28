<script setup lang="ts">
import { onMounted, ref } from 'vue';
const { request } = useMissionApi();
const incidents = ref<Record<string, unknown>[]>([]);
const range = ref('30d');
const loading = ref(true);
const error = ref<string | null>(null);
async function load() {
  loading.value = true;
  const duration = range.value === '24h' ? 86400000 : range.value === '7d' ? 604800000 : 2592000000;
  try {
    const response = await request(
      `/incidents?limit=100&from=${encodeURIComponent(new Date(Date.now() - duration).toISOString())}`,
    );
    if (!response.ok) throw new Error('Incident history is temporarily unavailable.');
    incidents.value = (await response.json()) as Record<string, unknown>[];
    error.value = null;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Incident history is temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
function duration(value: unknown): string {
  const seconds = Number(value);
  return seconds < 60
    ? `${Math.round(seconds)}s`
    : seconds < 3600
      ? `${Math.round(seconds / 60)}m`
      : `${(seconds / 3600).toFixed(1)}h`;
}
function tone(value: unknown): 'warning' | 'critical' | 'info' {
  return value === 'critical' ? 'critical' : value === 'info' ? 'info' : 'warning';
}
function relative(value: unknown): string {
  const date = new Date(String(value));
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  return seconds < 60
    ? 'just now'
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}
onMounted(() => void load());
</script>
<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">MISSION / INCIDENTS</div>
        <h1>Incident timeline</h1>
        <p class="lede">Meaningful changes, measured from the local collector.</p>
      </div>
      <StatusPill
        :label="incidents.length ? `${incidents.length} in view` : 'No active incidents'"
        :tone="incidents.length ? 'warning' : 'success'"
      />
    </header>
    <div v-if="error" class="error-banner">
      {{ error }} <button @click="load">Try again</button>
    </div>
    <nav class="range-switch" aria-label="Incident range">
      <button
        v-for="item in ['24h', '7d', '30d']"
        :key="item"
        :class="{ selected: range === item }"
        @click="
          range = item;
          load();
        "
      >
        {{ item }}
      </button>
    </nav>
    <PageSkeleton v-if="loading" variant="timeline" />
    <section v-else class="timeline">
      <div v-if="!incidents.length" class="empty-state">
        <span class="empty-icon">✓</span><strong>Everything has been operating normally.</strong
        ><span
          >No incidents were recorded in this window. When the collector confirms a condition, it
          will appear here with its duration and resolution.</span
        >
      </div>
      <NuxtLink
        v-for="incident in incidents"
        v-else
        :key="String(incident.id)"
        :to="`/incidents/${String(incident.id)}`"
        class="incident-row"
      >
        <div class="timeline-rail"><span :class="tone(incident.severity)"></span></div>
        <div class="incident-content">
          <div class="incident-top">
            <div>
              <StatusPill :label="String(incident.severity)" :tone="tone(incident.severity)" />
              <h2>{{ incident.title }}</h2>
            </div>
            <span class="state">{{ incident.state }}</span>
          </div>
          <p>{{ incident.description }}</p>
          <div class="incident-meta">
            <span>{{ new Date(String(incident.startedAt)).toLocaleString() }}</span
            ><span>{{ duration(incident.durationSeconds) }}</span
            ><span>{{
              incident.state === 'active' ? 'Active now' : `Resolved ${relative(incident.endedAt)}`
            }}</span>
          </div>
        </div>
      </NuxtLink>
    </section>
  </div>
</template>
<style scoped>
.page {
  width: min(1000px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
  min-width: 0;
  overflow-x: clip;
}
.page-head {
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
.timeline {
  border-top: 1px solid var(--line);
}
.incident-row {
  display: flex;
  gap: 18px;
  padding: 22px 0;
  border-bottom: 1px solid var(--line-soft);
  text-decoration: none;
  transition: background-color 160ms ease-out;
}
.incident-row:hover {
  background: color-mix(in srgb, var(--panel) 60%, transparent);
}
.timeline-rail {
  position: relative;
  width: 12px;
  flex: 0 0 12px;
}
.timeline-rail::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 7px;
  bottom: -28px;
  width: 1px;
  background: var(--line);
}
.incident-row:last-child .timeline-rail::before {
  display: none;
}
.timeline-rail span {
  position: relative;
  z-index: 1;
  display: block;
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--warning) 10%, transparent);
}
.timeline-rail .critical {
  background: var(--critical);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--critical) 10%, transparent);
}
.timeline-rail .info {
  background: var(--info);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--info) 10%, transparent);
}
.incident-content {
  flex: 1;
}
.incident-top {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}
.incident-top h2 {
  margin: 9px 0 0;
  font-size: 16px;
}
.state {
  color: var(--ink-muted);
  font-size: 11px;
  text-transform: capitalize;
}
.incident-content p {
  max-width: 65ch;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.55;
}
.incident-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--ink-muted);
  font-size: 10px;
}
.empty-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 70px 20px;
  color: var(--ink-muted);
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
}
.empty-state strong {
  color: var(--ink-soft);
}
.empty-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--success);
  border-radius: 50%;
  color: var(--success);
}
@media (max-width: 600px) {
  .page-head {
    display: block;
  }
  .page-head > :last-child {
    margin-top: 16px;
  }
  .incident-top {
    display: block;
  }
  .state {
    display: block;
    margin-top: 10px;
  }
  .incident-row {
    gap: 12px;
  }
}
</style>
