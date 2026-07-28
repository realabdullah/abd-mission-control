<script setup lang="ts">
export type SparkPoint = { timestamp: string; value: number };

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    context: string;
    points?: SparkPoint[];
    to: string;
    tone?: 'normal' | 'warning' | 'critical';
  }>(),
  { points: () => [], tone: 'normal' },
);

const path = computed(() => {
  const points = props.points.filter((point) => Number.isFinite(point.value));
  if (points.length < 2) return '';
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 30 - ((point.value - minimum) / span) * 24;
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
});
</script>

<template>
  <NuxtLink :to="to" class="summary" :class="tone">
    <span class="summary-label">{{ label }}</span>
    <span class="summary-value">{{ value }}</span>
    <span class="summary-context">{{ context }}</span>
    <svg v-if="path" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path :d="path" pathLength="1" />
    </svg>
    <span v-else class="summary-empty">Awaiting enough observations to show a trend.</span>
    <span class="summary-link">Inspect <span aria-hidden="true">→</span></span>
  </NuxtLink>
</template>

<style scoped>
.summary {
  position: relative;
  display: grid;
  min-height: 202px;
  padding: 20px;
  overflow: hidden;
  color: var(--ink);
  text-decoration: none;
  background: var(--panel);
  outline: 1px solid var(--line-soft);
  transition:
    background-color 180ms ease-out,
    outline-color 180ms ease-out;
}
.summary:hover {
  background: var(--panel-strong);
  outline-color: var(--summary-line);
}
.summary:active {
  scale: 0.96;
}
.summary.warning {
  box-shadow: inset 0 2px 0 var(--warning);
}
.summary.critical {
  box-shadow: inset 0 2px 0 var(--critical);
}
.summary-label,
.summary-context,
.summary-link,
.summary-empty {
  position: relative;
  z-index: 1;
}
.summary-label {
  color: var(--ink-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.summary-value {
  margin-top: 18px;
  font-size: clamp(1.7rem, 3vw, 2.45rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.summary-context {
  margin-top: 7px;
  color: var(--ink-soft);
  font-size: 12px;
}
svg {
  position: absolute;
  right: 14px;
  bottom: 40px;
  left: 14px;
  width: calc(100% - 28px);
  height: 48px;
  overflow: visible;
}
path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.warning path {
  stroke: var(--warning);
}
.critical path {
  stroke: var(--critical);
}
.summary-empty {
  align-self: end;
  margin-bottom: 26px;
  color: var(--ink-muted);
  font-size: 11px;
  line-height: 1.45;
}
.summary-link {
  align-self: end;
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
}
@media (prefers-reduced-motion: reduce) {
  .summary {
    transition: none;
  }
}
</style>
