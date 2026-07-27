<script setup lang="ts">
import { onMounted, ref } from 'vue';
const { request } = useMissionApi();
const alerts = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
async function load() {
  loading.value = true;
  try {
    const response = await request('/alerts?limit=50');
    if (!response.ok) throw new Error('Alerts are temporarily unavailable.');
    alerts.value = (await response.json()) as Record<string, unknown>[];
    error.value = null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Alerts are temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
async function acknowledge(id: string) {
  await request(`/alerts/${id}/acknowledge`, { method: 'POST' });
  await load();
}
function tone(value: unknown): 'warning' | 'critical' | 'info' {
  return value === 'critical' ? 'critical' : value === 'info' ? 'info' : 'warning';
}
onMounted(() => void load());
</script>
<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">MISSION / ALERTS</div>
        <h1>Alerts</h1>
        <p class="lede">Local alert occurrences that still need a look.</p>
      </div>
      <StatusPill
        :label="alerts.length ? `${alerts.length} open` : 'Quiet'"
        :tone="alerts.length ? 'warning' : 'success'"
      />
    </header>
    <div v-if="error" class="error-banner">
      {{ error }} <button @click="load">Try again</button>
    </div>
    <section class="list">
      <PageSkeleton v-if="loading" />
      <div v-else-if="!alerts.length" class="empty-state">
        <span class="empty-icon">✓</span><strong>No alerts need attention.</strong
        ><span
          >When a rule opens an occurrence, it will appear here. Acknowledgement does not resolve
          the underlying incident.</span
        >
      </div>
      <article v-for="alert in alerts" v-else :key="String(alert.id)" class="alert-row">
        <StatusPill :label="String(alert.severity)" :tone="tone(alert.severity)" />
        <div class="alert-body">
          <strong>{{ alert.message }}</strong
          ><small
            >{{ alert.type ?? 'Incident occurrence' }} ·
            {{ new Date(String(alert.occurredAt)).toLocaleString() }}</small
          >
        </div>
        <button class="ack" @click="acknowledge(String(alert.id))">Acknowledge</button>
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
.list {
  margin-top: 38px;
  border-top: 1px solid var(--line);
}
.alert-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line-soft);
}
.alert-body {
  display: grid;
  flex: 1;
  gap: 5px;
}
.alert-body strong {
  font-size: 13px;
}
.alert-body small {
  color: var(--ink-muted);
  font-size: 11px;
}
.ack {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
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
  border-radius: var(--radius-sm);
  color: var(--success);
}
@media (max-width: 600px) {
  .page-head {
    display: block;
  }
  .page-head > :last-child {
    margin-top: 16px;
  }
  .alert-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .ack {
    margin-left: 38px;
  }
}
</style>
