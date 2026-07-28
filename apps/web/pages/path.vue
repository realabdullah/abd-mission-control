<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
type Snapshot = { reachable: boolean; lastSuccessfulSampleAt: string | null };
type Probe = {
  target: string;
  status: 'success' | 'failure' | 'timeout';
  latencyMs: number | null;
  observedAt: string;
  detail: string | null;
};
const id = '00000000-0000-0000-0000-000000000001';
const { request } = useMissionApi();
const snapshot = ref<Snapshot | null>(null);
const probes = ref<Probe[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const latest = computed(() => {
  const result = new Map<string, Probe>();
  for (const probe of probes.value) if (!result.has(probe.target)) result.set(probe.target, probe);
  return result;
});
const hop = (target: string) => latest.value.get(target) ?? null;
const label = (probe: Probe | null) =>
  !probe
    ? 'No observation'
    : probe.status === 'success'
      ? 'Reachable'
      : probe.status === 'timeout'
        ? 'Timed out'
        : 'Unreachable';
const tone = (probe: Probe | null): 'success' | 'warning' | 'critical' | 'muted' =>
  !probe
    ? 'muted'
    : probe.status === 'success'
      ? 'success'
      : probe.status === 'timeout'
        ? 'warning'
        : 'critical';
const latency = (probe: Probe | null) =>
  probe?.latencyMs == null ? '—' : `${Math.round(probe.latencyMs)} ms`;
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [s, p] = await Promise.all([
      request(`/integrations/${id}/snapshot`),
      request(`/integrations/${id}/path-probes?limit=60`),
    ]);
    if (!s.ok || !p.ok)
      throw new Error('Connection-path observations are temporarily unavailable.');
    snapshot.value = (await s.json()) as Snapshot;
    probes.value = (await p.json()) as Probe[];
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'Connection-path observations are temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
onMounted(() => void load());
</script>
<template>
  <div class="page">
    <header>
      <div>
        <div class="crumb">MISSION / CONNECTION PATH</div>
        <h1>Where the path stops</h1>
        <p>
          Rate-limited observations from the collector show what it can reach from this network.
        </p>
      </div>
      <div class="head-actions">
        <DataFreshness :at="snapshot?.lastSuccessfulSampleAt ?? null" /><NuxtLink to="/connection"
          >← Connection</NuxtLink
        >
      </div>
    </header>
    <div v-if="error" class="error">{{ error }} <button @click="load">Try again</button></div>
    <PageSkeleton v-else-if="loading" variant="path" /><template v-else
      ><section class="path">
        <article>
          <StatusPill
            :label="snapshot?.reachable ? 'Reachable' : 'Unreachable'"
            :tone="snapshot?.reachable ? 'success' : 'critical'"
          />
          <h2>Starlink device</h2>
          <strong>{{
            snapshot?.lastSuccessfulSampleAt
              ? new Date(snapshot.lastSuccessfulSampleAt).toLocaleTimeString()
              : 'No sample'
          }}</strong>
          <p>Local device response.</p>
        </article>
        <article
          v-for="item in [
            { target: 'cloudflare.com', title: 'DNS resolution' },
            { target: 'cloudflare:443', title: 'Cloudflare TCP' },
            { target: 'google:443', title: 'Google TCP' },
          ]"
          :key="item.target"
        >
          <StatusPill :label="label(hop(item.target))" :tone="tone(hop(item.target))" />
          <h2>{{ item.title }}</h2>
          <strong>{{ latency(hop(item.target)) }}</strong>
          <p>{{ hop(item.target)?.detail ?? 'Awaiting a probe result.' }}</p>
        </article>
      </section>
      <aside>
        <h2>How to read this</h2>
        <p>
          These are DNS/TCP reachability checks, not full application-health tests. They do not
          inspect your router or Wi-Fi clients, and they cannot establish a root cause.
        </p>
      </aside></template
    >
  </div>
</template>
<style scoped>
.page {
  width: min(1100px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}
header a {
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
.crumb {
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
}
p {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.55;
}
.path {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin-top: 32px;
  background: var(--line-soft);
}
article {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 220px;
  padding: 20px;
  background: var(--panel);
}
h2 {
  margin: 0;
  font-size: 17px;
}
strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
article p {
  margin: 0;
  font-size: 11px;
}
aside {
  max-width: 68ch;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--line-soft);
}
.error {
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
.error button {
  border: 0;
  color: var(--accent);
  background: transparent;
}
@media (max-width: 800px) {
  .path {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 520px) {
  header {
    display: grid;
  }
  .head-actions {
    justify-items: start;
  }
  .path {
    grid-template-columns: 1fr;
  }
}
</style>
