<script setup lang="ts">
import { computed } from 'vue';
import type { SpeedTestVibe } from './speed-test/types';
const props = defineProps<{ bps: number | null; vibe: SpeedTestVibe }>();
const mbps = computed(() => (props.bps ?? 0) / 1_000_000);
const verdict = computed(() => {
  if (mbps.value >= 150)
    return {
      rank: 'Escape velocity',
      detail: 'Plenty of headroom for a busy orbit.',
      score: 'Top tier',
    };
  if (mbps.value >= 75)
    return {
      rank: 'Clear skies',
      detail: 'A strong, comfortable connection for a full crew.',
      score: 'Strong',
    };
  if (mbps.value >= 25)
    return {
      rank: 'Steady flight',
      detail: 'Solid for everyday work, calls, and streaming.',
      score: 'Good',
    };
  if (mbps.value > 0)
    return {
      rank: 'Still climbing',
      detail: 'Usable, but the connection has more atmosphere to cross.',
      score: 'Growing',
    };
  return { rank: 'Signal lost', detail: 'No usable download was recorded.', score: 'Retry' };
});
const voice: Record<SpeedTestVibe, string> = {
  organism: 'The creature is fed.',
  race: 'The packets crossed the line.',
  storm: 'The pressure has settled.',
  sound: 'The chord resolves.',
  launch: 'The mission report is in.',
};
</script>
<template>
  <section class="verdict">
    <div class="stamp">{{ verdict.score }} / {{ vibe }}</div>
    <h2>{{ verdict.rank }}</h2>
    <p>{{ voice[vibe] }} {{ verdict.detail }}</p>
    <span>Calibrated to measured download speed, not a plan promise.</span>
  </section>
</template>
<style scoped>
.verdict {
  position: relative;
  margin: 18px 0 30px;
  padding: 22px 26px;
  background: linear-gradient(
    105deg,
    color-mix(in srgb, var(--accent) 12%, transparent),
    transparent 70%
  );
  box-shadow: inset 3px 0 var(--accent);
  animation: reveal 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.stamp {
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.verdict h2 {
  margin: 8px 0 5px;
  color: var(--ink);
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  letter-spacing: -0.04em;
}
.verdict p {
  margin: 0;
  color: var(--ink);
  font-size: 13px;
}
.verdict > span {
  display: block;
  margin-top: 12px;
  color: var(--ink-muted);
  font-size: 10px;
}
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
