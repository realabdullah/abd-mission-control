<script setup lang="ts">
import { computed, watch } from 'vue';
import { withAlpha, type SpeedTestSceneProps } from './types';
const props = defineProps<SpeedTestSceneProps>();
const intensity = computed(() => Math.min(1, props.mbps / 180));
let revealAt = 0;
watch(
  () => props.phase,
  (phase) => {
    if (phase === 'complete') revealAt = performance.now() / 1000;
  },
);
const canvas = useVibeCanvas(({ context: c, width: w, height: h, time }) => {
  c.clearRect(0, 0, w, h);
  const e = intensity.value,
    running = props.phase === 'running';
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, props.theme.panelStrong);
  sky.addColorStop(1, props.theme.canvas);
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  for (let layer = 0; layer < 4; layer++) {
    c.save();
    c.filter = `blur(${8 + layer * 7}px)`;
    c.globalAlpha = 0.2 + e * 0.13;
    const drift = ((time * (2 + e * 9) * (layer + 1)) % (w + 220)) - 110;
    c.fillStyle = layer % 2 ? props.theme.inkMuted : props.theme.panelStrong;
    for (let i = -1; i < 5; i++) {
      c.beginPath();
      c.ellipse(
        i * 220 + drift,
        h * (0.26 + layer * 0.07),
        130 + layer * 25,
        35 + layer * 9,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.restore();
  }
  if (running) {
    const drops = Math.round(e * 120);
    c.lineWidth = 1;
    for (let i = 0; i < drops; i++) {
      const seed = i * 91.73;
      const x = ((seed * 13 + time * (28 + e * 82)) % (w + 80)) - 40;
      const y = (seed * 7 + time * (72 + e * 170)) % h;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 6 - e * 10, y + 10 + e * 15);
      c.strokeStyle = withAlpha(props.theme.telemetry, 0.1 + e * 0.35);
      c.stroke();
    }
  }
  const strikePeriod = 5.2 - e * 1.6;
  const strikePosition = time % strikePeriod;
  const strikeProgress = Math.max(0, (strikePosition - (strikePeriod - 0.55)) / 0.55);
  const flash = running && e > 0.28 ? Math.sin(strikeProgress * Math.PI) : 0;
  if (flash > 0) {
    c.fillStyle = withAlpha(props.theme.ink, flash * 0.1);
    c.fillRect(0, 0, w, h);
    c.save();
    c.shadowColor = props.theme.ink;
    c.shadowBlur = 18 + flash * 30;
    c.strokeStyle = withAlpha(props.theme.ink, 0.2 + flash * 0.8);
    c.lineWidth = 1 + flash * 1.5;
    c.beginPath();
    let x = w * 0.55,
      y = h * 0.12;
    c.moveTo(x, y);
    const strikeSeed = Math.floor(time / strikePeriod) * 13.17;
    for (let i = 0; i < 7; i++) {
      x += Math.sin(strikeSeed + i * 9.71) * 18;
      y += h * 0.1;
      c.lineTo(x, y);
    }
    c.stroke();
    c.restore();
  }
  const reveal = props.phase === 'complete' ? Math.min(1, (time - revealAt) / 1.3) : 0;
  if (reveal) {
    const light = c.createRadialGradient(
      w * 0.52,
      h * 0.05,
      0,
      w * 0.52,
      h * 0.05,
      w * 0.7 * reveal,
    );
    light.addColorStop(0, withAlpha(props.theme.warning, 0.55 * (1 - reveal * 0.4)));
    light.addColorStop(1, withAlpha(props.theme.warning, 0));
    c.fillStyle = light;
    c.fillRect(0, 0, w, h);
  }
});
</script>
<template>
  <div class="vibe-canvas">
    <canvas ref="canvas" />
    <div class="copy">
      <b>{{
        phase === 'running'
          ? 'Weather is forming'
          : phase === 'complete'
            ? 'The front has passed'
            : 'The air is holding its breath'
      }}</b
      ><span>{{
        phase === 'running'
          ? `${mbps.toFixed(1)} Mbps is shaping the pressure system.`
          : phase === 'complete'
            ? 'A last flash, then clear signal.'
            : 'No rain yet. Just charged air.'
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
  max-width: 320px;
}
.copy b,
.copy span {
  display: block;
}
.copy b {
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 21px;
  font-weight: 400;
}
.copy span {
  margin-top: 6px;
  color: var(--ink-muted);
  font-size: 11px;
}
</style>
