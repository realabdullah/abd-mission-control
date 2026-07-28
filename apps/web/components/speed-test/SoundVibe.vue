<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { withAlpha, type SpeedTestSceneProps } from './types';
const props = defineProps<SpeedTestSceneProps>();
const energy = computed(() => Math.min(1, props.mbps / 180));
let audio: AudioContext | null = null;
let voices: OscillatorNode[] = [];
function silence() {
  for (const voice of voices) {
    try {
      voice.stop();
    } catch {}
  }
  voices = [];
  void audio?.close();
  audio = null;
}
function chord(resolved = false) {
  if (!props.soundEnabled || typeof window === 'undefined') return;
  silence();
  audio = new AudioContext();
  const root = 150 + energy.value * 220;
  const ratios = resolved ? [1, 1.25, 1.5] : energy.value > 0.45 ? [1, 1.2, 1.49] : [1, 1.12, 1.41];
  ratios.forEach((ratio, index) => {
    const oscillator = audio!.createOscillator(),
      gain = audio!.createGain();
    oscillator.type = index ? 'sine' : 'triangle';
    oscillator.frequency.value = root * ratio;
    gain.gain.value = 0.012;
    oscillator.connect(gain).connect(audio!.destination);
    oscillator.start();
    voices.push(oscillator);
  });
  void audio.resume();
}
watch(
  () => [props.phase, props.soundEnabled],
  ([phase, enabled]) => {
    if (!enabled) {
      silence();
      return;
    }
    if (phase === 'running') chord();
    else if (phase === 'complete') {
      chord(true);
      window.setTimeout(silence, 1300);
    } else silence();
  },
);
watch(
  () => props.mbps,
  (value) => {
    voices.forEach((voice, index) =>
      voice.frequency.setTargetAtTime(
        (150 + Math.min(value, 180) * 1.22) * (1 + index * 0.24),
        audio?.currentTime ?? 0,
        0.18,
      ),
    );
  },
);
onBeforeUnmount(silence);
const canvas = useVibeCanvas(({ context: c, width: w, height: h, time }) => {
  c.clearRect(0, 0, w, h);
  const e = energy.value;
  c.fillStyle = props.theme.canvas;
  c.fillRect(0, 0, w, h);
  const samples = props.samples.slice(-70);
  for (let layer = 0; layer < 3; layer++) {
    c.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const source = samples[Math.floor((x / w) * Math.max(samples.length - 1, 0))]?.bps ?? 0;
      const amp = (8 + (Math.min(source / 1e6, 180) / 180) * 54) * (1 - layer * 0.22);
      const y =
        h * 0.48 +
        Math.sin(x * 0.025 + time * (0.7 + e * 1.4) + layer) * amp * Math.sin((x / w) * Math.PI);
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle =
      layer === 0
        ? withAlpha(props.theme.accent, 0.45 + e * 0.4)
        : withAlpha(props.theme.telemetry, 0.12 + layer * 0.08);
    c.lineWidth = layer === 0 ? 2 : 1;
    c.shadowColor = props.theme.accentStrong;
    c.shadowBlur = layer === 0 ? 18 : 0;
    c.stroke();
  }
  const bars = 28;
  for (let i = 0; i < bars; i++) {
    const value = samples[Math.max(0, samples.length - 1 - i)]?.bps ?? 0;
    const bh = 10 + (Math.min(value / 1e6, 180) / 180) * h * 0.25;
    c.fillStyle = withAlpha(props.theme.accentStrong, 0.15 + (i / bars) * 0.45);
    c.fillRect(w - i * (w / bars), h * 0.7 - bh, 2, bh);
  }
  if (props.phase === 'complete') {
    const pulse = (time % 1.4) / 1.4;
    c.beginPath();
    c.arc(w * 0.5, h * 0.48, pulse * w * 0.35, 0, Math.PI * 2);
    c.strokeStyle = withAlpha(props.theme.accent, 1 - pulse);
    c.stroke();
  }
});
</script>
<template>
  <div class="vibe-canvas">
    <canvas ref="canvas" />
    <div class="sound-copy">
      <b>{{
        phase === 'running'
          ? 'The route is writing its melody'
          : phase === 'complete'
            ? 'The chord resolves'
            : 'Silence, with potential'
      }}</b
      ><span>{{
        phase === 'running'
          ? `${mbps.toFixed(1)} Mbps is bending the pitch.`
          : phase === 'complete'
            ? 'A tiny composition made from one honest transfer.'
            : 'Enable sound if you want to hear the signal.'
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
.sound-copy {
  position: absolute;
  left: 28px;
  bottom: 92px;
}
.sound-copy b,
.sound-copy span {
  display: block;
}
.sound-copy b {
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: 400;
}
.sound-copy span {
  margin-top: 6px;
  color: var(--ink-muted);
  font-size: 11px;
}
</style>
