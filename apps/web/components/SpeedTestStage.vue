<script setup lang="ts">
import { computed, markRaw, onMounted, ref } from 'vue';
import LaunchVibe from './speed-test/LaunchVibe.vue';
import OrganismVibe from './speed-test/OrganismVibe.vue';
import RaceVibe from './speed-test/RaceVibe.vue';
import SoundVibe from './speed-test/SoundVibe.vue';
import StormVibe from './speed-test/StormVibe.vue';
import type { SpeedTestLive, SpeedTestPhase, SpeedTestVibe } from './speed-test/types';
import type { SpeedTestTheme } from './speed-test/types';
import { missionThemes, useActiveMissionTheme } from '~/composables/useMissionTheme';

const props = defineProps<{
  vibe: SpeedTestVibe;
  phase: SpeedTestPhase;
  live: SpeedTestLive;
  resultBps: number | null;
  resultBytes: number;
  resultElapsedMs: number;
  disabled: boolean;
}>();
const emit = defineEmits<{ run: [] }>();
const soundEnabled = ref(false);
const activeTheme = useActiveMissionTheme();
const scenes = {
  organism: markRaw(OrganismVibe),
  race: markRaw(RaceVibe),
  storm: markRaw(StormVibe),
  sound: markRaw(SoundVibe),
  launch: markRaw(LaunchVibe),
};
const scene = computed(() => scenes[props.vibe]);
const theme = computed<SpeedTestTheme>(() => {
  const colors = missionThemes[activeTheme.value].colors;
  return {
    canvas: colors.canvas!,
    canvasRaised: colors['canvas-raised']!,
    panel: colors.panel!,
    panelStrong: colors['panel-strong']!,
    control: colors.control!,
    selected: colors.selected!,
    ink: colors.ink!,
    inkMuted: colors['ink-muted']!,
    accent: colors.accent!,
    accentStrong: colors['accent-strong']!,
    telemetry: colors.telemetry!,
    warning: colors.warning!,
    critical: colors.critical!,
  };
});
const measuredMbps = computed(
  () =>
    (props.phase === 'running' ? (props.live.downloadBps ?? 0) : (props.resultBps ?? 0)) /
    1_000_000,
);
const mbps = useSpringNumber(measuredMbps, { stiffness: 38, damping: 10, precision: 0.005 });
const bytes = computed(() =>
  props.phase === 'running' ? props.live.bytesTransferred : props.resultBytes,
);
const elapsedMs = computed(() => {
  if (props.phase !== 'running') return props.resultElapsedMs;
  const started = props.live.startedAt ? Date.parse(props.live.startedAt) : Date.now();
  return Math.max(0, Date.now() - started);
});
const amount = computed(() => `${(bytes.value / 1_000_000).toFixed(1)} MB`);
const elapsed = computed(() => `${(elapsedMs.value / 1000).toFixed(1)} s`);
function toggleSound() {
  soundEnabled.value = !soundEnabled.value;
  window.localStorage.setItem('mission-control-speed-sound', String(soundEnabled.value));
}
onMounted(() => {
  soundEnabled.value = window.localStorage.getItem('mission-control-speed-sound') === 'true';
});
</script>
<template>
  <section class="stage" :class="[`phase-${phase}`, `vibe-${vibe}`]">
    <component
      :is="scene"
      :phase="phase"
      :mbps="mbps"
      :bytes-transferred="bytes"
      :elapsed-ms="elapsedMs"
      :samples="live.samples"
      :sound-enabled="soundEnabled"
      :theme="theme"
    />
    <div v-if="phase !== 'idle'" class="readout" aria-live="polite">
      <span>{{ phase === 'running' ? 'Live download · 2s rolling' : 'Measured download' }}</span>
      <strong>{{ mbps.toFixed(1) }}</strong
      ><small>Mbps</small>
      <dl>
        <div>
          <dt>Transfer</dt>
          <dd>{{ amount }}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{{ elapsed }}</dd>
        </div>
      </dl>
    </div>
    <div class="controls">
      <button class="sound-toggle" type="button" :aria-pressed="soundEnabled" @click="toggleSound">
        {{ soundEnabled ? 'Sound on' : 'Sound off' }}
      </button>
      <button
        class="launch-button"
        type="button"
        :disabled="disabled || phase === 'running'"
        @click="emit('run')"
      >
        <span>{{
          phase === 'running'
            ? 'Reading the signal'
            : phase === 'complete'
              ? 'Run it again'
              : 'Begin the experience'
        }}</span>
        <i aria-hidden="true">→</i>
      </button>
    </div>
  </section>
</template>
<style scoped>
.stage {
  position: relative;
  min-height: 420px;
  overflow: hidden;
  background: var(--canvas-raised);
  isolation: isolate;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.22);
}
.stage::after {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0.09;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E");
  content: '';
  mix-blend-mode: soft-light;
}
.readout {
  position: absolute;
  top: 25px;
  right: 28px;
  z-index: 6;
  text-align: right;
}
.readout > span {
  display: block;
  color: var(--ink-muted);
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.readout > strong {
  display: inline-block;
  margin-top: 4px;
  color: var(--ink);
  font-family: 'Courier New', monospace;
  font-size: clamp(2.6rem, 6vw, 4.8rem);
  letter-spacing: -0.1em;
  line-height: 0.9;
}
.readout > small {
  margin-left: 7px;
  color: var(--ink-muted);
  font-size: 9px;
  letter-spacing: 0.12em;
}
.readout dl {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  margin: 12px 0 0;
}
.readout dt {
  color: var(--ink-muted);
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.readout dd {
  margin: 3px 0 0;
  color: var(--ink-soft);
  font:
    11px 'Courier New',
    monospace;
}
.controls {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--canvas) 88%, transparent) 48%
  );
}
button {
  cursor: pointer;
}
.sound-toggle {
  border: 0;
  color: var(--ink-muted);
  background: transparent;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.sound-toggle:hover {
  color: var(--ink);
}
.launch-button {
  display: flex;
  align-items: center;
  gap: 18px;
  border: 0;
  padding: 12px 15px 12px 18px;
  color: var(--canvas);
  background: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition:
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.18s;
}
.launch-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.015);
  box-shadow: 0 8px 30px color-mix(in srgb, var(--accent) 25%, transparent);
}
.launch-button:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}
.launch-button i {
  font-size: 18px;
  font-style: normal;
}
.launch-button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.phase-complete {
  animation: result-beat 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes result-beat {
  0% {
    filter: brightness(0.7);
    transform: scale(0.995);
  }
  38% {
    filter: brightness(1.28);
  }
  100% {
    filter: brightness(1);
    transform: scale(1);
  }
}
@media (max-width: 600px) {
  .stage {
    min-height: 460px;
  }
  .readout {
    top: 20px;
    right: 18px;
  }
  .readout > strong {
    font-size: 2.9rem;
  }
  .readout dl {
    gap: 12px;
  }
  .controls {
    padding: 14px;
  }
  .launch-button {
    padding: 11px 12px;
    font-size: 9px;
  }
  .sound-toggle {
    font-size: 9px;
  }
}
</style>
