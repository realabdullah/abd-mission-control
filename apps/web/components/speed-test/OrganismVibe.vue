<script setup lang="ts">
import { computed, watch } from 'vue';
import { withAlpha, type SpeedTestSceneProps } from './types';
const props = defineProps<SpeedTestSceneProps>();
const energy = computed(() => Math.min(1, props.mbps / 180));
let revealAt = 0;
watch(
  () => props.phase,
  (phase) => {
    if (phase === 'complete') revealAt = performance.now() / 1000;
  },
);
const canvas = useVibeCanvas(({ context: c, width: w, height: h, time }) => {
  c.clearRect(0, 0, w, h);
  const e = energy.value;
  const active = props.phase === 'running';
  const cx = w * 0.48,
    cy = h * 0.48;
  const base = Math.min(w, h) * (0.19 + e * 0.035);
  const glow = c.createRadialGradient(cx, cy, 4, cx, cy, base * 2.2);
  glow.addColorStop(0, withAlpha(props.theme.accent, 0.22 + e * 0.3));
  glow.addColorStop(1, withAlpha(props.theme.canvas, 0));
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  c.save();
  c.shadowColor = withAlpha(props.theme.accentStrong, 0.25 + e * 0.55);
  c.shadowBlur = 22 + e * 48;
  c.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const mass = active ? 0.22 + e * 0.78 : 0.22;
    const wobble =
      Math.sin(a * 3 + time * (0.55 + e * 1.1)) * (5 + e * 11) * mass +
      Math.sin(a * 7 - time * 0.8) * (2 + e * 4) * mass;
    const r = base + wobble;
    const x = cx + Math.cos(a) * r * (1.08 + Math.sin(time * 0.43) * 0.025);
    const y = cy + Math.sin(a) * r * (0.86 + Math.cos(time * 0.51) * 0.025);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
  const skin = c.createRadialGradient(cx - base * 0.35, cy - base * 0.4, 5, cx, cy, base * 1.25);
  skin.addColorStop(0, withAlpha(props.theme.ink, 0.82 + e * 0.18));
  skin.addColorStop(0.35, withAlpha(props.theme.accentStrong, 0.88));
  skin.addColorStop(1, withAlpha(props.theme.panelStrong, 0.96));
  c.fillStyle = skin;
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = withAlpha(props.theme.accent, 0.28 + e * 0.4);
  c.lineWidth = 1.5;
  c.stroke();
  c.clip();
  for (let i = 0; i < 24; i++) {
    const a = i * 2.399 + time * (0.025 + e * 0.06);
    const radius = base * (0.15 + ((i * 37) % 80) / 100);
    const x = cx + Math.cos(a) * radius,
      y = cy + Math.sin(a * 1.13) * radius * 0.72;
    c.beginPath();
    c.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2);
    c.fillStyle = withAlpha(props.theme.ink, 0.08 + e * 0.16);
    c.fill();
  }
  c.restore();
  const reveal = props.phase === 'complete' ? Math.min(1, (time - revealAt) / 1.1) : 0;
  if (reveal > 0) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(cx, cy, base * (1.1 + reveal * (i + 1) * 0.8), 0, Math.PI * 2);
      c.strokeStyle = withAlpha(props.theme.accent, (1 - reveal) * 0.5);
      c.lineWidth = 2;
      c.stroke();
    }
  }
});
</script>
<template>
  <div class="vibe-canvas">
    <canvas ref="canvas" />
    <div class="copy">
      <b>{{
        phase === 'running'
          ? 'Membrane online'
          : phase === 'complete'
            ? 'It remembers the rush'
            : 'A signal, sleeping softly'
      }}</b
      ><span>{{
        phase === 'running'
          ? `Energy is tracking ${mbps.toFixed(1)} Mbps.`
          : phase === 'complete'
            ? 'The membrane settles into its final form.'
            : 'Quiet now. Give it something to feed on.'
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
.copy {
  position: absolute;
  left: 28px;
  bottom: 92px;
  z-index: 2;
  max-width: 300px;
}
.copy b,
.copy span {
  display: block;
}
.copy b {
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: 400;
}
.copy span {
  margin-top: 6px;
  color: var(--ink-muted);
  font-size: 11px;
}
</style>
