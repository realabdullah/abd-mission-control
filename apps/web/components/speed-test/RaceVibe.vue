<script setup lang="ts">
import { computed, watch } from 'vue';
import { withAlpha, type SpeedTestSceneProps } from './types';
const props = defineProps<SpeedTestSceneProps>();
const velocity = computed(() => Math.min(1, props.mbps / 180));
let revealAt = 0;
watch(
  () => props.phase,
  (p) => {
    if (p === 'complete') revealAt = performance.now() / 1000;
  },
);
const canvas = useVibeCanvas(({ context: c, width: w, height: h, time }) => {
  c.clearRect(0, 0, w, h);
  const e = velocity.value,
    running = props.phase === 'running';
  const horizon = h * 0.32;
  c.fillStyle = props.theme.canvas;
  c.fillRect(0, 0, w, h);
  const road = c.createLinearGradient(0, horizon, 0, h);
  road.addColorStop(0, props.theme.panelStrong);
  road.addColorStop(1, props.theme.control);
  c.fillStyle = road;
  c.beginPath();
  c.moveTo(w * 0.39, horizon);
  c.lineTo(w * 0.05, h);
  c.lineTo(w * 0.95, h);
  c.lineTo(w * 0.61, horizon);
  c.fill();
  c.strokeStyle = withAlpha(props.theme.accent, 0.22);
  for (let lane = 0; lane < 5; lane++) {
    c.beginPath();
    c.moveTo(w * (0.4 + lane * 0.05), horizon);
    c.lineTo(w * (0.08 + lane * 0.21), h);
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const z = (i / 12 + time * (0.04 + e * 0.24)) % 1;
    const y = horizon + (h - horizon) * z * z;
    const half = 8 + z * w * 0.42;
    c.strokeStyle = withAlpha(props.theme.accent, 0.08 + z * 0.24);
    c.beginPath();
    c.moveTo(w * 0.5 - half, y);
    c.lineTo(w * 0.5 + half, y);
    c.stroke();
  }
  if (running) {
    const count = Math.round(e * 19);
    for (let i = 0; i < count; i++) {
      const lane = i % 4;
      const progress = (time * (0.06 + e * 0.35) + i * 0.173) % 1;
      const y = horizon + (h - horizon) * progress * progress;
      const x = w * 0.5 + (lane - 1.5) * progress * w * 0.16;
      const size = 3 + progress * 12;
      c.save();
      c.shadowColor = i % 3 ? props.theme.accentStrong : props.theme.warning;
      c.shadowBlur = 10 + e * 15;
      c.fillStyle = i % 3 ? props.theme.accent : props.theme.warning;
      c.fillRect(x - size / 2, y - size / 2, size, size * 0.65);
      c.restore();
      if (e < 0.2 && i % 4 === 0) {
        c.strokeStyle = withAlpha(props.theme.critical, 0.5);
        c.beginPath();
        c.arc(x, y, size * 1.5, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
  c.setLineDash([7, 6]);
  c.strokeStyle = props.theme.ink;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(w * 0.2, h * 0.76);
  c.lineTo(w * 0.8, h * 0.76);
  c.stroke();
  c.setLineDash([]);
  const reveal = props.phase === 'complete' ? Math.min(1, (time - revealAt) / 0.75) : 0;
  if (reveal) {
    c.fillStyle = withAlpha(props.theme.warning, (1 - reveal) * 0.55);
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? props.theme.accent : props.theme.warning;
      c.fillRect((i * 83) % w, h * 0.76 - reveal * (40 + (i % 5) * 22), 5, 5);
    }
  }
});
</script>
<template>
  <div class="vibe-canvas">
    <canvas ref="canvas" />
    <div class="race-copy">
      <b>{{
        phase === 'running'
          ? 'Packets are trading paint'
          : phase === 'complete'
            ? 'Across the line'
            : 'Grid is quiet'
      }}</b
      ><span>{{
        phase === 'running'
          ? velocity < 0.2
            ? 'Traffic is bunching under low bandwidth.'
            : `${mbps.toFixed(1)} Mbps — clean air ahead.`
          : phase === 'complete'
            ? 'The timing beam caught every byte.'
            : 'Warm the route. The packets are waiting.'
      }}</span>
    </div>
  </div>
</template>
<style scoped>
.vibe-canvas,
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.race-copy {
  position: absolute;
  left: 28px;
  bottom: 92px;
}
.race-copy b,
.race-copy span {
  display: block;
}
.race-copy b {
  color: var(--ink);
  font-family: 'Courier New', monospace;
  font-size: 17px;
  text-transform: uppercase;
}
.race-copy span {
  margin-top: 6px;
  color: var(--ink-muted);
  font-size: 11px;
}
</style>
