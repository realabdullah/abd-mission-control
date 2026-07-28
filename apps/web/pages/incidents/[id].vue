<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Occurrence = {
  id: string;
  type: string;
  severity: string;
  message: string;
  occurredAt: string;
  acknowledged: boolean;
};
type Incident = {
  id: string;
  title: string;
  description: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  state: 'active' | 'resolved';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  firstObservedValue: number | null;
  latestObservedValue: number | null;
  thresholdMetadata: Record<string, unknown>;
};

const route = useRoute();
const { request } = useMissionApi();
const incident = ref<Incident | null>(null);
const occurrences = ref<Occurrence[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const duration = computed(() => {
  const value = incident.value?.durationSeconds;
  if (value == null) return 'Unavailable';
  return value < 60
    ? `${Math.round(value)}s`
    : value < 3600
      ? `${Math.round(value / 60)}m`
      : `${(value / 3600).toFixed(1)}h`;
});
function observed(value: number | null): string {
  return value == null ? 'Unavailable' : Number.isInteger(value) ? String(value) : value.toFixed(2);
}
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const response = await request(`/incidents/${encodeURIComponent(String(route.params.id))}`);
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? 'This incident could not be found.'
          : 'Incident details are temporarily unavailable.',
      );
    const result = (await response.json()) as { incident: Incident; occurrences: Occurrence[] };
    incident.value = result.incident;
    occurrences.value = result.occurrences;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Incident details are temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
onMounted(() => void load());
</script>

<template>
  <div class="page">
    <NuxtLink to="/incidents" class="back-link">← Incident timeline</NuxtLink>
    <div v-if="error" class="error-banner" role="alert">
      {{ error }} <button @click="load">Try again</button>
    </div>
    <PageSkeleton v-else-if="loading" variant="timeline" />
    <template v-else-if="incident">
      <header class="page-head">
        <div>
          <StatusPill :label="incident.severity" :tone="incident.severity" />
          <h1>{{ incident.title }}</h1>
          <p class="lede">{{ incident.description }}</p>
        </div>
        <span class="state">{{ incident.state }}</span>
      </header>

      <section class="facts">
        <div>
          <span>Started</span><strong>{{ new Date(incident.startedAt).toLocaleString() }}</strong>
        </div>
        <div>
          <span>Duration</span><strong>{{ duration }}</strong>
        </div>
        <div>
          <span>Latest observation</span
          ><strong>{{ observed(incident.latestObservedValue) }}</strong>
        </div>
      </section>

      <section class="explanation">
        <h2>What Mission Control observed</h2>
        <p>
          This incident was created from a local collector observation. Its state and duration
          reflect the recorded condition; they do not identify an external root cause.
        </p>
        <dl v-if="Object.keys(incident.thresholdMetadata).length">
          <div v-for="(value, key) in incident.thresholdMetadata" :key="key">
            <dt>{{ key }}</dt>
            <dd>{{ String(value) }}</dd>
          </div>
        </dl>
      </section>

      <section class="occurrences">
        <div class="section-title">
          <h2>Related alert activity</h2>
          <span>{{ occurrences.length }} record{{ occurrences.length === 1 ? '' : 's' }}</span>
        </div>
        <div v-if="!occurrences.length" class="empty-state">
          No alert occurrences were stored for this incident.
        </div>
        <article v-for="occurrence in occurrences" :key="occurrence.id">
          <StatusPill
            :label="occurrence.type"
            :tone="occurrence.severity as 'info' | 'warning' | 'critical'"
          />
          <div>
            <strong>{{ occurrence.message }}</strong
            ><small
              >{{ new Date(occurrence.occurredAt).toLocaleString() }} ·
              {{ occurrence.acknowledged ? 'Acknowledged' : 'Unacknowledged' }}</small
            >
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  width: min(900px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
  min-width: 0;
}
.back-link {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  color: var(--accent);
  font-size: 12px;
  text-decoration: none;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-top: 22px;
}
h1 {
  max-width: 18ch;
  margin: 14px 0 7px;
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.lede {
  max-width: 65ch;
  margin: 0;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.5;
}
.state {
  color: var(--ink-muted);
  font-size: 11px;
  text-transform: capitalize;
}
.facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-top: 32px;
  background: var(--line-soft);
}
.facts div {
  display: grid;
  gap: 9px;
  min-height: 112px;
  padding: 17px;
  background: var(--panel);
}
.facts span,
.section-title span,
dt {
  color: var(--ink-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.facts strong {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.explanation,
.occurrences {
  margin-top: 32px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}
h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.explanation p {
  max-width: 68ch;
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.55;
}
dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1px;
  background: var(--line-soft);
}
dl div {
  display: grid;
  gap: 8px;
  padding: 14px;
  background: var(--panel);
}
dd {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.section-title {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: baseline;
}
.occurrences article {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 0;
  border-bottom: 1px solid var(--line-soft);
}
.occurrences article div {
  display: grid;
  gap: 5px;
}
.occurrences strong {
  font-size: 12px;
}
.occurrences small,
.empty-state {
  color: var(--ink-muted);
  font-size: 11px;
}
.empty-state {
  padding: 20px 0;
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
  .page-head {
    display: grid;
  }
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
