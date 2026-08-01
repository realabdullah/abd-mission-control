<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { SpeedTestLive, SpeedTestPhase, SpeedTestVibe } from '~/components/speed-test/types';
type SpeedTest = {
  id: string;
  state: 'completed' | 'failed';
  bytesTransferred: number;
  downloadBps: number | null;
  startedAt: string;
  completedAt: string;
  error: string | null;
};
const id = '00000000-0000-0000-0000-000000000001';
const { request } = useMissionApi();
const tests = ref<SpeedTest[]>([]);
const loading = ref(true);
const running = ref(false);
const justCompleted = ref(false);
const error = ref<string | null>(null);
const live = ref<SpeedTestLive>({
  state: 'idle',
  bytesTransferred: 0,
  downloadBps: null,
  samples: [],
});
const vibe = ref<SpeedTestVibe>('launch');
const latest = computed(() => tests.value[0] ?? null);
const phase = computed<SpeedTestPhase>(() =>
  running.value ? 'running' : justCompleted.value ? 'complete' : 'idle',
);
const resultElapsedMs = computed(() =>
  latest.value
    ? Math.max(0, Date.parse(latest.value.completedAt) - Date.parse(latest.value.startedAt))
    : 0,
);
const rate = (bps: number | null) =>
  bps == null
    ? '—'
    : `${(bps / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Mbps`;
const amount = (bytes: number) =>
  `${(bytes / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
async function load() {
  loading.value = true;
  try {
    const response = await request(`/integrations/${id}/speed-tests`);
    if (!response.ok) throw new Error('Speed-test history is temporarily unavailable.');
    tests.value = (await response.json()) as SpeedTest[];
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Speed-test history is temporarily unavailable.';
  } finally {
    loading.value = false;
  }
}
async function run() {
  justCompleted.value = false;
  running.value = true;
  error.value = null;
  const startedAt = new Date().toISOString();
  let bytesTransferred = 0;
  try {
    const configuration = await request(`/integrations/${id}/speed-tests/config`);
    if (!configuration.ok) throw new Error('Speed testing is not configured right now.');
    const { url, maxBytes, timeoutMs } = (await configuration.json()) as {
      url: string;
      maxBytes: number;
      timeoutMs: number;
    };
    const started = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const samples: SpeedTestLive['samples'] = [];
    live.value = {
      state: 'running',
      bytesTransferred: 0,
      downloadBps: 0,
      startedAt,
      updatedAt: startedAt,
      samples,
    };
    try {
      const download = await fetch(url, {
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!download.ok || !download.body)
        throw new Error('The speed-test download is unavailable.');
      const reader = download.body.getReader();
      let lastPublishedAt = started;
      while (bytesTransferred < maxBytes) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytesTransferred += Math.min(chunk.value.byteLength, maxBytes - bytesTransferred);
        const now = Date.now();
        if (now - lastPublishedAt >= 250 || bytesTransferred >= maxBytes) {
          const bps = (bytesTransferred * 8000) / Math.max(now - started, 1);
          samples.push({ at: new Date(now).toISOString(), bps });
          while (samples.length > 120) samples.shift();
          live.value = {
            state: 'running',
            bytesTransferred,
            downloadBps: bps,
            startedAt,
            updatedAt: new Date(now).toISOString(),
            samples: [...samples],
          };
          lastPublishedAt = now;
        }
        if (bytesTransferred >= maxBytes) await reader.cancel();
      }
    } finally {
      window.clearTimeout(timeout);
    }
    const completedAt = new Date().toISOString();
    const completedAtMs = Date.parse(completedAt);
    const result = {
      state: 'completed' as const,
      bytesTransferred,
      downloadBps: (bytesTransferred * 8000) / Math.max(completedAtMs - started, 1),
      startedAt,
      completedAt,
      error: null,
    };
    const response = await request(`/integrations/${id}/speed-tests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!response.ok) throw new Error('The speed-test result could not be saved.');
    const saved = (await response.json()) as SpeedTest;
    tests.value = [saved, ...tests.value];
    live.value = {
      ...live.value,
      state: 'completed',
      downloadBps: saved.downloadBps,
      updatedAt: completedAt,
    };
    await load();
    justCompleted.value = true;
  } catch (cause) {
    const completedAt = new Date().toISOString();
    if (bytesTransferred > 0) {
      await request(`/integrations/${id}/speed-tests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          state: 'failed',
          bytesTransferred,
          downloadBps: null,
          startedAt,
          completedAt,
          error: cause instanceof Error ? cause.message : 'Speed test failed',
        }),
      }).catch(() => undefined);
    }
    live.value = {
      ...live.value,
      state: 'failed',
      bytesTransferred,
      downloadBps: null,
      updatedAt: completedAt,
    };
    error.value = cause instanceof Error ? cause.message : 'The speed test could not be completed.';
  } finally {
    running.value = false;
  }
}
onMounted(() => {
  const saved = window.localStorage.getItem('mission-control-speed-vibe') as SpeedTestVibe | null;
  if (saved && ['organism', 'race', 'storm', 'sound', 'launch'].includes(saved)) vibe.value = saved;
  void load();
});
function selectVibe(value: SpeedTestVibe) {
  vibe.value = value;
  window.localStorage.setItem('mission-control-speed-vibe', value);
}
</script>
<template>
  <div class="page">
    <header>
      <div>
        <div class="crumb">MISSION / DIAGNOSTICS</div>
        <h1>Speed test</h1>
        <p>
          Measure this device's dedicated download path. This is not the live throughput shown
          elsewhere.
        </p>
      </div>
      <NuxtLink to="/connection">← Connection</NuxtLink>
    </header>
    <SpeedTestVibePicker
      v-if="phase !== 'running'"
      :model-value="vibe"
      @update:model-value="selectVibe"
    />
    <SpeedTestStage
      :vibe="vibe"
      :phase="phase"
      :live="live"
      :result-bps="latest?.downloadBps ?? null"
      :result-bytes="latest?.bytesTransferred ?? 0"
      :result-elapsed-ms="resultElapsedMs"
      :disabled="loading"
      @run="run"
    />
    <SpeedTestVerdict
      v-if="phase === 'complete' && latest"
      :bps="latest.downloadBps"
      :vibe="vibe"
    />
    <div v-if="error" class="error">{{ error }} <button @click="load">Refresh history</button></div>
    <section class="history">
      <div class="section-title">
        <h2>Recent controlled tests</h2>
        <button class="text" :disabled="loading" @click="load">Refresh</button>
      </div>
      <PageSkeleton v-if="loading" variant="speed-history" />
      <p v-else-if="!tests.length">No controlled speed tests have been run.</p>
      <div v-else class="rows">
        <article v-for="test in tests" :key="test.id">
          <StatusPill
            :label="test.state === 'completed' ? 'Completed' : 'Failed'"
            :tone="test.state === 'completed' ? 'success' : 'critical'"
          /><strong>{{ rate(test.downloadBps) }}</strong
          ><span
            >{{ amount(test.bytesTransferred) }} ·
            {{ new Date(test.completedAt).toLocaleString() }}</span
          ><small v-if="test.error">{{ test.error }}</small>
        </article>
      </div>
    </section>
    <aside>
      <h2>How to use this</h2>
      <p>
        Use a few runs at different times to establish a baseline. A result reflects this device,
        its current network, and the download endpoint—it does not prove a Starlink plan speed.
      </p>
    </aside>
  </div>
</template>
<style scoped>
.page {
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 48px;
}
.crumb {
  color: #78908f;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}
header a {
  color: var(--accent);
  font-size: 12px;
  text-decoration: none;
}
h1 {
  margin: 9px 0 5px;
  font-size: clamp(1.9rem, 3.2vw, 2.8rem);
  line-height: 1;
  letter-spacing: -0.035em;
}
p {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.55;
}
.reading {
  min-height: 292px;
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-top: 30px;
  padding: 24px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  overflow: hidden;
  position: relative;
}
.space-illustration {
  position: absolute;
  right: -22px;
  bottom: -30px;
  width: min(58%, 520px);
  opacity: 0.13;
  color: var(--accent);
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transform: rotate(-7deg);
  pointer-events: none;
}
.space-illustration .stars {
  fill: currentColor;
  stroke: none;
}
.space-illustration .signal {
  stroke-dasharray: 8 10;
  animation: signal-drift 4s linear infinite;
}
.dial-wrap {
  position: relative;
  z-index: 2;
}
.orbit {
  position: relative;
  width: 220px;
  height: 220px;
  flex: 0 0 220px;
  border: 1px solid rgba(125, 244, 215, 0.18);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(125, 244, 215, 0.12), transparent 58%);
}
.orbit::before,
.orbit::after {
  position: absolute;
  inset: 15px;
  border: 1px dashed rgba(125, 244, 215, 0.22);
  border-radius: 50%;
  content: '';
  animation: spin 14s linear infinite;
}
.orbit::after {
  inset: 37px;
  border-style: solid;
  border-color: rgba(125, 244, 215, 0.12) transparent;
  animation-direction: reverse;
  animation-duration: 9s;
}
.orbit-track {
  position: absolute;
  inset: 27px;
  border: 1px solid rgba(125, 244, 215, 0.16);
  border-radius: 50%;
}
.orbit-track-two {
  inset: 60px;
  border-color: rgba(125, 244, 215, 0.28);
}
.orbit-satellite {
  position: absolute;
  top: 18px;
  left: 50%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 18px 5px rgba(125, 244, 215, 0.55);
  transform: translateX(-50%);
  animation: satellite 5s linear infinite;
  transform-origin: 0 92px;
}
.orbit-core {
  position: absolute;
  inset: 76px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(125, 244, 215, 0.42);
  border-radius: 50%;
  background: #102224;
  box-shadow:
    inset 0 0 26px rgba(125, 244, 215, 0.12),
    0 0 25px rgba(125, 244, 215, 0.1);
}
.orbit-core span {
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.reading:not(.racing) .orbit::before,
.reading:not(.racing) .orbit::after,
.reading:not(.racing) .orbit-satellite,
.reading:not(.racing) .signal {
  animation: none;
}
.dial {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-top: 8px;
  color: var(--accent);
  font-family: 'Courier New', monospace;
  font-size: clamp(3.2rem, 9vw, 6rem);
  font-weight: 700;
  letter-spacing: -0.1em;
  line-height: 0.9;
  text-shadow: 0 0 28px color-mix(in srgb, var(--accent) 28%, transparent);
}
.digit {
  display: inline-block;
  min-width: 0.58em;
  animation: odometer-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.digit:nth-child(2) {
  animation-delay: 0.04s;
}
.digit:nth-child(3) {
  animation-delay: 0.08s;
}
.digit:nth-child(4) {
  animation-delay: 0.12s;
}
.digit:nth-child(5) {
  animation-delay: 0.16s;
}
.dial-wrap b {
  color: var(--ink-muted);
  font-size: 10px;
  letter-spacing: 0.16em;
}
.racing-line {
  display: block;
  margin-top: 14px;
  color: var(--accent);
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.17em;
  animation: ticker 2.5s linear infinite;
  white-space: nowrap;
}
.trend {
  display: flex;
  align-items: end;
  gap: 2px;
  width: min(320px, 42vw);
  height: 48px;
  margin-top: 20px;
  padding: 5px 0 0;
  border-bottom: 1px solid rgba(125, 244, 215, 0.35);
  opacity: 0.9;
}
.trend span {
  flex: 1;
  min-width: 2px;
  background: linear-gradient(to top, var(--accent), rgba(125, 244, 215, 0.18));
  animation: trend-in 0.25s ease-out both;
  transform-origin: bottom;
}
.racing::after {
  position: absolute;
  inset: auto -12% 0;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 22px 5px color-mix(in srgb, var(--accent) 45%, transparent);
  content: '';
  animation: scan 1.2s ease-in-out infinite;
}
.reading span,
dt {
  display: block;
  color: var(--ink-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.reading strong {
  display: block;
  margin-top: 7px;
  font-size: clamp(2rem, 5vw, 3.4rem);
  letter-spacing: -0.06em;
  font-variant-numeric: tabular-nums;
}
.reading dl {
  display: flex;
  gap: 28px;
  margin: 0;
}
.reading dd {
  margin: 6px 0 0;
  font-size: 13px;
}
.failed {
  border-color: #68423b;
}
.action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 1px;
  padding: 17px 20px;
  background: #172326;
}
.action p {
  margin: 0;
}
.action button {
  border: 1px solid var(--accent);
  padding: 10px 14px;
  background: var(--accent);
  color: #08201f;
  font-weight: 700;
}
.action .secondary {
  background: transparent;
  color: var(--ink);
}
button:disabled {
  opacity: 0.55;
}
.error {
  margin-top: 18px;
  padding: 12px;
  border: 1px solid #68423b;
  color: #e5b4a6;
  font-size: 12px;
}
.error button,
.text {
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
}
.history {
  margin-top: 34px;
}
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--line-soft);
}
h2 {
  font-size: 16px;
}
.rows article {
  display: grid;
  grid-template-columns: 100px 1fr 1.6fr;
  gap: 15px;
  align-items: center;
  padding: 14px 4px;
  border-bottom: 1px solid var(--line-soft);
}
.rows strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.rows span,
.rows small {
  color: var(--ink-muted);
  font-size: 12px;
}
.rows small {
  grid-column: 2/-1;
  color: #e5b4a6;
}
aside {
  max-width: 68ch;
  margin-top: 34px;
  padding-top: 20px;
  border-top: 1px solid var(--line-soft);
}
@media (max-width: 620px) {
  header,
  .reading,
  .action {
    display: grid;
  }
  .reading dl {
    gap: 18px;
  }
  .orbit {
    width: 150px;
    height: 150px;
    flex-basis: 150px;
  }
  .orbit-core {
    inset: 51px;
  }
  .orbit-satellite {
    transform-origin: 0 62px;
  }
  .rows article {
    grid-template-columns: 100px 1fr;
  }
  .rows span {
    grid-column: 2;
  }
  .rows small {
    grid-column: 1/-1;
  }
}
@keyframes odometer-in {
  from {
    opacity: 0;
    transform: translateY(-18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes ticker {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-18px);
  }
}
@keyframes scan {
  0%,
  100% {
    transform: translateX(-35%);
  }
  50% {
    transform: translateX(35%);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes satellite {
  to {
    transform: translateX(-50%) rotate(360deg);
  }
}
@keyframes signal-drift {
  to {
    stroke-dashoffset: -36;
  }
}
@keyframes trend-in {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}
</style>
