<script setup lang="ts">
import { computed, watch } from 'vue';
import { withAlpha, type SpeedTestSceneProps } from './types';
const props = defineProps<SpeedTestSceneProps>();
const thrust = computed(() => Math.min(1, props.mbps / 180));
let revealAt = 0;
watch(
  () => props.phase,
  (p) => {
    if (p === 'complete') revealAt = performance.now() / 1000;
  },
);
const canvas = useVibeCanvas(({ context: c, width: w, height: h, time }) => {
  c.clearRect(0, 0, w, h);
  const e = thrust.value,
    running = props.phase === 'running';
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, props.theme.canvas);
  sky.addColorStop(1, props.theme.panelStrong);
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = (i * 137) % w,
      y = ((i * 73) % h) * 0.75;
    c.fillStyle = withAlpha(props.theme.ink, 0.15 + (i % 5) / 12);
    c.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }
  c.beginPath();
  c.arc(w * 0.5, h * 1.72, h * 1.05, Math.PI, Math.PI * 2);
  c.fillStyle = props.theme.selected;
  c.fill();
  c.strokeStyle = withAlpha(props.theme.telemetry, 0.25);
  c.lineWidth = 8;
  c.stroke();
  const altitude = running
    ? Math.min(h * 0.55, e * h * 0.52)
    : props.phase === 'complete'
      ? e * h * 0.5
      : 0;
  const rx = w * 0.42,
    ry = h * 0.68 - altitude + (running ? Math.sin(time * 7) * (1 - e) * 3 : 0);
  c.save();
  c.translate(rx, ry);
  c.rotate(0.12);
  c.shadowColor = props.theme.warning;
  c.shadowBlur = running ? 20 + e * 25 : 3;
  c.fillStyle = props.theme.ink;
  c.beginPath();
  c.moveTo(0, -42);
  c.bezierCurveTo(18, -25, 18, 15, 12, 27);
  c.lineTo(-12, 27);
  c.bezierCurveTo(-18, 15, -18, -25, 0, -42);
  c.fill();
  c.fillStyle = props.theme.inkMuted;
  c.beginPath();
  c.moveTo(-12, 12);
  c.lineTo(-28, 31);
  c.lineTo(-10, 25);
  c.fill();
  c.beginPath();
  c.moveTo(12, 12);
  c.lineTo(28, 31);
  c.lineTo(10, 25);
  c.fill();
  c.fillStyle = props.theme.telemetry;
  c.beginPath();
  c.arc(0, -13, 6, 0, Math.PI * 2);
  c.fill();
  if (running) {
    const flame = 10 + e * 72 + Math.sin(time * 12) * (2 + e * 5);
    c.globalAlpha = 0.12 + e * 0.88;
    const g = c.createLinearGradient(0, 27, 0, 27 + flame);
    g.addColorStop(0, props.theme.ink);
    g.addColorStop(0.35, props.theme.warning);
    g.addColorStop(1, withAlpha(props.theme.critical, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-8, 25);
    c.quadraticCurveTo(0, 25 + flame, 8, 25);
    c.fill();
  }
  c.restore();
  const reveal = props.phase === 'complete' ? Math.min(1, (time - revealAt) / 1) : 0;
  if (reveal) {
    c.strokeStyle = withAlpha(props.theme.warning, 1 - reveal);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      c.beginPath();
      c.moveTo(rx + Math.cos(a) * 30, ry + Math.sin(a) * 30);
      c.lineTo(rx + Math.cos(a) * (30 + reveal * 130), ry + Math.sin(a) * (30 + reveal * 130));
      c.stroke();
    }
  }
});
</script>
<template>
  <div class="vibe-canvas">
    <canvas ref="canvas" />
    <div class="telemetry">
      <b>{{
        phase === 'running'
          ? `${Math.round(thrust * 100)}% atmospheric climb`
          : phase === 'complete'
            ? thrust > 0.7
              ? 'Orbit secured'
              : 'Flight path logged'
            : 'On the pad, lights low'
      }}</b
      ><span>{{
        phase === 'running'
          ? `${mbps.toFixed(1)} Mbps of measured thrust.`
          : phase === 'complete'
            ? 'The engines cut. The number remains.'
            : 'One real transfer away from ignition.'
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
.telemetry {
  position: absolute;
  left: 28px;
  bottom: 92px;
}
.telemetry b,
.telemetry span {
  display: block;
}
.telemetry b {
  color: var(--ink);
  font-family: 'Courier New', monospace;
  font-size: 17px;
  letter-spacing: 0.04em;
}
.telemetry span {
  margin-top: 7px;
  color: var(--ink-muted);
  font-size: 11px;
}
</style>
