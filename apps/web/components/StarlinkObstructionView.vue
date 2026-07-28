<script setup lang="ts">
import { computed } from 'vue';

type TerminalKind =
  | 'mini'
  | 'standard'
  | 'actuated'
  | 'circular'
  | 'performance'
  | 'flat-performance'
  | 'high-performance'
  | 'enterprise'
  | 'unknown';
type TerminalPresentation = {
  kind: TerminalKind;
  label: string;
  image: string | null;
};

const props = defineProps<{
  fraction: number | null;
  hardwareVersion: string | null;
  observedAt: string | null;
}>();

const terminal = computed<TerminalPresentation>(() => {
  const hardware = props.hardwareVersion?.toLowerCase() ?? '';
  if (hardware.includes('mini'))
    return {
      kind: 'mini',
      label: 'Starlink Mini',
      image: '/images/starlink/mini.png',
    };
  if (/enterprise/.test(hardware))
    return {
      kind: 'enterprise',
      label: 'Starlink Enterprise',
      image: '/images/starlink/enterprise.png',
    };
  if (/flat[_ -]?(high[_ -]?)?perf|mobile[_ -]?premium/.test(hardware))
    return {
      kind: 'flat-performance',
      label: 'Starlink Performance (Gen 2)',
      image: '/images/starlink/flat-high-performance.png',
    };
  if (/high[_ -]?perf|\bhp\d/.test(hardware))
    return {
      kind: 'high-performance',
      label: 'Starlink Performance (Gen 1)',
      image: '/images/starlink/high-performance.png',
    };
  if (/performance/.test(hardware))
    return {
      kind: 'performance',
      label: 'Starlink Performance',
      image: '/images/starlink/performance.png',
    };
  if (/circular|round/.test(hardware))
    return {
      kind: 'circular',
      label: 'Starlink Standard (Circular)',
      image: '/images/starlink/standard-circular.png',
    };
  if (/actuat|motor|rectangular/.test(hardware))
    return {
      kind: 'actuated',
      label: 'Starlink Standard Actuated',
      image: '/images/starlink/standard-actuated.png',
    };
  if (/standard|standard4|std4/.test(hardware))
    return {
      kind: 'standard',
      label: 'Starlink Standard',
      image: '/images/starlink/standard.png',
    };
  return {
    kind: 'unknown',
    label: 'Unclassified Starlink terminal',
    image: null,
  };
});

const boundedFraction = computed(() =>
  props.fraction == null ? null : Math.min(1, Math.max(0, props.fraction)),
);
const obstructionPercent = computed(() =>
  boundedFraction.value == null ? null : boundedFraction.value * 100,
);
const displayPercent = computed(() => {
  const value = obstructionPercent.value;
  if (value == null) return 'Unavailable';
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
});
const clearPercent = computed(() => {
  const value = obstructionPercent.value;
  if (value == null) return null;
  return Math.max(0, 100 - value);
});
const condition = computed(() => {
  const value = obstructionPercent.value;
  if (value == null) return { label: 'Waiting for sky data', tone: 'unavailable' };
  if (value < 1) return { label: 'Sky field nearly clear', tone: 'clear' };
  if (value < 5) return { label: 'Low obstruction', tone: 'clear' };
  if (value < 10) return { label: 'Elevated obstruction', tone: 'warning' };
  return { label: 'High obstruction', tone: 'critical' };
});
const sceneStyle = computed(() => {
  const fraction = boundedFraction.value ?? 0;
  const haze = Math.min(0.88, Math.sqrt(fraction) * 1.7);
  return {
    '--obstruction-opacity': String(haze),
    '--obstruction-far': String(haze * 0.52),
    '--obstruction-near': String(Math.min(0.94, haze * 1.18)),
    '--field-opacity': String(Math.max(0.18, 0.74 * (1 - fraction * 1.8))),
    '--clear-width': `${clearPercent.value ?? 0}%`,
    '--legend-opacity': String(Math.max(0.3, haze)),
  };
});
const observedLabel = computed(() =>
  props.observedAt
    ? `Sampled ${new Date(props.observedAt).toLocaleTimeString()}`
    : 'No successful observation',
);
const accessibleDescription = computed(
  () =>
    `${terminal.value.label}. ${displayPercent.value} aggregate sky obstruction. ${condition.value.label}. Directional obstruction data is unavailable.`,
);
</script>

<template>
  <section class="obstruction-view" :style="sceneStyle">
    <header>
      <div>
        <h2>Sky visibility</h2>
        <p>
          <span>{{ terminal.label }}</span>
          <code v-if="hardwareVersion">{{ hardwareVersion }}</code>
        </p>
      </div>
      <span class="condition" :class="condition.tone">{{ condition.label }}</span>
    </header>

    <div class="sky-scene" role="img" :aria-label="accessibleDescription">
      <div class="atmosphere" aria-hidden="true">
        <div class="star-plane star-plane-far" />
        <div class="star-plane star-plane-near" />
        <div class="horizon-glow" />

        <div class="field-shell">
          <i class="field-ring ring-outer" />
          <i class="field-ring ring-middle" />
          <i class="field-ring ring-inner" />
          <i class="field-axis axis-one" />
          <i class="field-axis axis-two" />
          <i class="field-axis axis-three" />
          <i class="scan-sweep" />
        </div>

        <div class="obstruction-volume volume-far" />
        <div class="obstruction-volume volume-middle" />
        <div class="obstruction-volume volume-near" />
        <div class="ground-plane" />
      </div>

      <div class="device-stage" :class="`device-${terminal.kind}`">
        <div class="device-aura" aria-hidden="true" />
        <img v-if="terminal.image" :src="terminal.image" :alt="terminal.label" />
        <span v-else class="device-unavailable">Hardware render unavailable</span>
        <div class="device-shadow" aria-hidden="true" />
      </div>

      <div class="scene-reading">
        <span>Observed sky obstruction</span>
        <strong>{{ displayPercent }}</strong>
        <small>{{ observedLabel }}</small>
      </div>

      <div class="clarity" aria-hidden="true">
        <span>Clear field</span>
        <div><i /></div>
        <strong>{{ clearPercent == null ? '—' : `${clearPercent.toFixed(2)}%` }}</strong>
      </div>

      <div class="depth-key" aria-hidden="true">
        <span>Near field</span><i /><span>Full observed field</span>
      </div>
    </div>

    <footer>
      <span class="legend-orb" aria-hidden="true" />
      <p>
        The atmospheric density represents the measured obstructed fraction across the full observed
        sky. It is deliberately non-directional because this terminal does not expose a validated
        obstruction map.
      </p>
    </footer>
  </section>
</template>

<style scoped>
.obstruction-view {
  margin-top: 24px;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
}
h2 {
  margin: 0;
  color: var(--ink);
  font-size: 16px;
  letter-spacing: -0.015em;
}
header p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin: 6px 0 0;
  color: var(--ink-muted);
  font-size: 11px;
}
header code {
  color: var(--ink-muted);
  font-family: 'Courier New', monospace;
  font-size: 9px;
  overflow-wrap: anywhere;
}
.condition {
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, var(--control));
  font-size: 10px;
  white-space: nowrap;
}
.condition.warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, var(--control));
}
.condition.critical {
  color: var(--critical);
  background: color-mix(in srgb, var(--critical) 12%, var(--control));
}
.condition.unavailable {
  color: var(--ink-muted);
  background: var(--control);
}
.sky-scene {
  position: relative;
  height: 460px;
  overflow: hidden;
  border-top: 1px solid var(--line-soft);
  border-bottom: 1px solid var(--line-soft);
  background:
    radial-gradient(
      circle at 50% 105%,
      color-mix(in srgb, var(--accent) 21%, transparent),
      transparent 47%
    ),
    radial-gradient(
      circle at 14% 12%,
      color-mix(in srgb, var(--telemetry) 12%, transparent),
      transparent 31%
    ),
    linear-gradient(180deg, var(--canvas) 0%, var(--canvas-raised) 52%, var(--control) 100%);
  perspective: 900px;
  isolation: isolate;
}
.atmosphere {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}
.star-plane {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 12% 18%, var(--accent) 0 1px, transparent 1.5px),
    radial-gradient(circle at 74% 14%, var(--ink-muted) 0 1px, transparent 1.5px),
    radial-gradient(circle at 89% 39%, var(--telemetry) 0 1px, transparent 1.5px),
    radial-gradient(circle at 26% 43%, var(--ink-muted) 0 1px, transparent 1.5px),
    radial-gradient(circle at 61% 31%, var(--accent) 0 1.5px, transparent 2px);
}
.star-plane-far {
  opacity: 0.28;
  transform: translateZ(-120px) scale(1.14);
}
.star-plane-near {
  opacity: 0.52;
  transform: translateZ(24px) scale(0.98);
}
.horizon-glow {
  position: absolute;
  left: 50%;
  bottom: 34px;
  width: min(82%, 700px);
  height: 118px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-strong) 16%, transparent);
  filter: blur(38px);
  transform: translateX(-50%) translateZ(-40px);
}
.field-shell {
  position: absolute;
  top: 42px;
  left: 50%;
  width: min(78vw, 660px);
  height: 330px;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent);
  border-radius: 50%;
  opacity: var(--field-opacity);
  box-shadow:
    inset 0 0 55px color-mix(in srgb, var(--accent-strong) 9%, transparent),
    0 0 42px color-mix(in srgb, var(--telemetry) 7%, transparent);
  transform: translateX(-50%) rotateX(64deg) translateZ(-70px);
  transform-style: preserve-3d;
}
.field-ring,
.field-axis,
.scan-sweep {
  position: absolute;
  display: block;
  border-radius: 50%;
}
.field-ring {
  top: 50%;
  left: 50%;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  transform: translate(-50%, -50%);
}
.ring-outer {
  width: 82%;
  height: 82%;
}
.ring-middle {
  width: 58%;
  height: 58%;
}
.ring-inner {
  width: 31%;
  height: 31%;
}
.field-axis {
  top: 50%;
  left: 50%;
  width: 96%;
  height: 1px;
  background: color-mix(in srgb, var(--telemetry) 32%, transparent);
  transform-origin: left center;
}
.axis-one {
  transform: rotate(0deg) translateX(-50%);
}
.axis-two {
  transform: rotate(60deg) translateX(-50%);
}
.axis-three {
  transform: rotate(120deg) translateX(-50%);
}
.scan-sweep {
  inset: 4%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg 316deg,
    color-mix(in srgb, var(--accent) 4%, transparent) 324deg,
    color-mix(in srgb, var(--accent) 32%, transparent) 354deg,
    transparent 360deg
  );
  animation: scan-field 14s linear infinite;
}
.obstruction-volume {
  position: absolute;
  left: 50%;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--warning) 4%, transparent) 0%,
    color-mix(in srgb, var(--warning) 46%, transparent) 58%,
    color-mix(in srgb, var(--critical) 24%, transparent) 76%,
    transparent 100%
  );
  filter: blur(25px);
  mix-blend-mode: screen;
}
.volume-far {
  top: 55px;
  width: min(72vw, 610px);
  height: 280px;
  opacity: var(--obstruction-far);
  transform: translateX(-50%) translateZ(-110px) scale(1.08);
}
.volume-middle {
  top: 92px;
  width: min(67vw, 560px);
  height: 235px;
  opacity: var(--obstruction-opacity);
  transform: translateX(-50%) translateZ(-10px);
}
.volume-near {
  top: 136px;
  width: min(60vw, 500px);
  height: 186px;
  opacity: var(--obstruction-near);
  filter: blur(32px);
  transform: translateX(-50%) translateZ(72px) scale(0.92);
}
.ground-plane {
  position: absolute;
  left: 50%;
  bottom: -78px;
  width: min(92%, 780px);
  height: 230px;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: 50%;
  background:
    radial-gradient(ellipse, color-mix(in srgb, var(--accent) 10%, transparent), transparent 64%),
    var(--control);
  box-shadow: inset 0 18px 42px color-mix(in srgb, #000 48%, transparent);
  transform: translateX(-50%) rotateX(67deg) translateZ(-12px);
}
.device-stage {
  position: absolute;
  left: 50%;
  bottom: 42px;
  z-index: 3;
  width: min(56%, 440px);
  height: 230px;
  transform: translateX(-50%) translateZ(70px);
  transform-style: preserve-3d;
}
.device-stage img {
  position: absolute;
  left: 50%;
  bottom: 20px;
  z-index: 2;
  display: block;
  width: min(100%, 440px);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 20px 16px rgb(0 0 0 / 0.58))
    drop-shadow(0 0 24px color-mix(in srgb, var(--accent) 13%, transparent));
  transform: translateX(-50%);
}
.device-unavailable {
  position: absolute;
  left: 50%;
  bottom: 90px;
  z-index: 2;
  padding: 8px 10px;
  color: var(--ink-muted);
  background: var(--control);
  font-size: 10px;
  transform: translateX(-50%);
  white-space: nowrap;
}
.device-mini img {
  width: min(78%, 340px);
}
.device-performance img,
.device-flat-performance img {
  width: min(100%, 470px);
}
.device-circular img,
.device-high-performance img {
  width: min(88%, 390px);
}
.device-aura {
  position: absolute;
  left: 50%;
  bottom: 22px;
  z-index: 1;
  width: 82%;
  height: 80px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-strong) 21%, transparent);
  filter: blur(30px);
  transform: translateX(-50%) rotateX(68deg) translateZ(-20px);
}
.device-shadow {
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 68%;
  height: 35px;
  border-radius: 50%;
  background: rgb(0 0 0 / 0.56);
  filter: blur(13px);
  transform: translateX(-50%) rotateX(66deg);
}
.scene-reading {
  position: absolute;
  top: 22px;
  left: 24px;
  z-index: 5;
  display: grid;
  gap: 5px;
}
.scene-reading span,
.scene-reading small,
.clarity span,
.depth-key {
  color: var(--ink-muted);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.scene-reading strong {
  color: var(--ink);
  font-family: 'Courier New', monospace;
  font-size: clamp(2.3rem, 6vw, 4rem);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  line-height: 0.9;
  text-shadow: 0 0 22px color-mix(in srgb, var(--accent) 18%, transparent);
}
.scene-reading small {
  letter-spacing: 0;
  text-transform: none;
}
.clarity {
  position: absolute;
  top: 26px;
  right: 24px;
  z-index: 5;
  display: grid;
  grid-template-columns: auto 94px auto;
  align-items: center;
  gap: 9px;
}
.clarity > div {
  height: 3px;
  overflow: hidden;
  background: var(--line);
}
.clarity i {
  display: block;
  width: var(--clear-width);
  height: 100%;
  background: var(--accent-strong);
  box-shadow: 0 0 10px var(--accent-strong);
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.clarity strong {
  color: var(--ink-soft);
  font-family: 'Courier New', monospace;
  font-size: 10px;
  font-weight: 500;
}
.depth-key {
  position: absolute;
  right: 24px;
  bottom: 18px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0;
  text-transform: none;
}
.depth-key i {
  width: 42px;
  height: 1px;
  background: linear-gradient(90deg, var(--accent), var(--line));
}
footer {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 20px 16px;
}
footer p {
  max-width: 72ch;
  margin: 0;
  color: var(--ink-muted);
  font-size: 11px;
  line-height: 1.5;
}
.legend-orb {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  margin-top: 3px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 10px color-mix(in srgb, var(--warning) 70%, transparent);
  opacity: var(--legend-opacity);
}
@keyframes scan-field {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 640px) {
  header {
    display: grid;
  }
  .condition {
    justify-self: start;
  }
  .sky-scene {
    height: 430px;
  }
  .field-shell {
    top: 92px;
    width: 520px;
    height: 280px;
  }
  .scene-reading {
    top: 17px;
    left: 16px;
  }
  .clarity {
    top: 88px;
    right: 16px;
    grid-template-columns: auto auto;
  }
  .clarity > div {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
  }
  .device-stage {
    bottom: 35px;
    width: 88%;
  }
  .depth-key {
    right: 16px;
    bottom: 13px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scan-sweep {
    animation: none;
    transform: rotate(18deg);
  }
  .clarity i {
    transition: none;
  }
}
</style>
