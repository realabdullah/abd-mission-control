<script setup lang="ts">
import { computed, ref } from 'vue';

export type ChartPoint = { timestamp: string; value: number };
const props = withDefaults(
  defineProps<{
    title: string;
    unit: string;
    points: ChartPoint[];
    color?: string;
    rangeLabel?: string;
    cursorTime?: number | null;
  }>(),
  { color: '#8fcfc0', rangeLabel: '24 hours', cursorTime: null },
);
const emit = defineEmits<{ 'update:cursorTime': [value: number | null] }>();
const view = ref<[number, number] | null>(null);
const drag = ref<{ x: number; range: [number, number] } | null>(null);
const hover = ref<{ x: number; y: number; point: ChartPoint } | null>(null);
const ordered = computed(() =>
  [...props.points]
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
);
const bounds = computed(() => {
  const first = Date.parse(ordered.value[0]?.timestamp ?? new Date().toISOString());
  const last = Date.parse(ordered.value.at(-1)?.timestamp ?? new Date().toISOString());
  return [first, Math.max(last, first + 1)] as [number, number];
});
const domain = computed(() => view.value ?? bounds.value);
const values = computed(() => ordered.value.map((p) => p.value));
const min = computed(() => Math.min(...values.value, 0));
const max = computed(() => Math.max(...values.value, 1));
const yFor = (value: number) => 190 - ((value - min.value) / (max.value - min.value || 1)) * 150;
const xFor = (timestamp: string) =>
  ((Date.parse(timestamp) - domain.value[0]) / (domain.value[1] - domain.value[0])) * 760;
const segments = computed(() => {
  const result: ChartPoint[][] = [];
  let segment: ChartPoint[] = [];
  const gap = Math.max((bounds.value[1] - bounds.value[0]) / 80, 90000);
  for (const point of ordered.value) {
    if (
      segment.length &&
      Date.parse(point.timestamp) - Date.parse(segment.at(-1)!.timestamp) > gap
    ) {
      result.push(segment);
      segment = [];
    }
    segment.push(point);
  }
  if (segment.length) result.push(segment);
  return result;
});
const paths = computed(() =>
  segments.value.map((segment) =>
    segment
      .map(
        (p, index) =>
          `${index ? 'L' : 'M'}${xFor(p.timestamp).toFixed(1)} ${yFor(p.value).toFixed(1)}`,
      )
      .join(' '),
  ),
);
const formatValue = (value: number) =>
  props.unit === 'Mbps'
    ? `${(value / 1e6).toFixed(value > 1e6 ? 1 : 2)} Mbps`
    : `${value.toFixed(value > 100 ? 0 : 1)} ${props.unit}`;
const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function nearest(clientX: number): ChartPoint | null {
  if (!ordered.value.length) return null;
  const box = (document.activeElement as SVGElement | null)?.getBoundingClientRect();
  void box;
  const target =
    domain.value[0] +
    (Math.max(0, Math.min(760, clientX)) / 760) * (domain.value[1] - domain.value[0]);
  return ordered.value.reduce(
    (best, point) =>
      Math.abs(Date.parse(point.timestamp) - target) < Math.abs(Date.parse(best.timestamp) - target)
        ? point
        : best,
    ordered.value[0],
  );
}
function move(event: MouseEvent) {
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const localX = ((event.clientX - rect.left) / rect.width) * 760;
  const point = nearest(localX);
  if (!point) return;
  hover.value = { x: xFor(point.timestamp), y: yFor(point.value), point };
  emit('update:cursorTime', Date.parse(point.timestamp));
  if (drag.value) {
    const delta =
      ((event.clientX - drag.value.x) / rect.width) * (drag.value.range[1] - drag.value.range[0]);
    view.value = [drag.value.range[0] - delta, drag.value.range[1] - delta];
  }
}
function leave() {
  if (!drag.value) {
    hover.value = null;
    emit('update:cursorTime', null);
  }
}
function zoom(event: WheelEvent) {
  if (ordered.value.length < 2) return;
  const [start, end] = domain.value;
  const factor = event.deltaY > 0 ? 1.16 : 0.86;
  const center = (start + end) / 2;
  const half = Math.max((bounds.value[1] - bounds.value[0]) / 40, ((end - start) * factor) / 2);
  view.value = [Math.max(bounds.value[0], center - half), Math.min(bounds.value[1], center + half)];
}
function startDrag(event: MouseEvent) {
  drag.value = { x: event.clientX, range: domain.value };
}
function endDrag() {
  drag.value = null;
}
function reset() {
  view.value = null;
}
</script>
<template>
  <article class="chart-panel">
    <header>
      <div>
        <h3>
          {{ title }}
          <InfoTip
            :title="title"
            :text="`Measured from the Starlink Mini at the collector. Values are shown in ${unit}; gaps mean no observation was stored.`"
          />
        </h3>
        <small>{{ rangeLabel }} · {{ points.length }} observations</small>
      </div>
      <button v-if="view" class="reset" @click="reset">Reset view</button>
    </header>
    <div class="chart-wrap">
      <svg
        viewBox="0 0 760 220"
        role="img"
        :aria-label="`${title} chart for ${rangeLabel}`"
        @mousemove="move"
        @mouseleave="leave"
        @wheel="zoom"
        @mousedown="startDrag"
        @mouseup="endDrag"
        @mouseleave.capture="endDrag"
      >
        <line
          v-for="y in [40, 90, 140, 190]"
          :key="y"
          x1="0"
          :y1="y"
          x2="760"
          :y2="y"
          stroke="var(--line-soft)"
          stroke-width="1"
        />
        <path
          v-for="(path, index) in paths"
          :key="index"
          :d="path"
          fill="none"
          :stroke="color"
          stroke-width="2"
          stroke-linecap="square"
          stroke-linejoin="round"
        />
        <line
          v-if="cursorTime"
          :x1="xFor(new Date(cursorTime).toISOString())"
          y1="20"
          :x2="xFor(new Date(cursorTime).toISOString())"
          y2="200"
          stroke="var(--accent)"
          stroke-opacity="0.55"
          stroke-dasharray="3 4"
        />
        <line
          v-if="hover"
          :x1="hover.x"
          y1="20"
          :x2="hover.x"
          y2="200"
          stroke="var(--ink-soft)"
          stroke-opacity="0.55"
          stroke-dasharray="3 4"
        />
        <circle
          v-if="hover"
          :cx="hover.x"
          :cy="hover.y"
          r="4"
          :fill="color"
          stroke="var(--canvas)"
          stroke-width="2"
        />
        <text v-if="!points.length" x="18" y="112" fill="#819596">
          No historical observations in this range
        </text>
      </svg>
      <div
        v-if="hover"
        class="tooltip"
        :style="{ left: `${Math.min(76, Math.max(4, hover.x / 7.6 - 8))}%` }"
      >
        <strong>{{ formatValue(hover.point.value) }}</strong
        ><span>{{ formatTime(hover.point.timestamp) }}</span>
      </div>
    </div>
    <footer>
      <span>Drag to pan · scroll to zoom</span
      ><span>{{ points.length ? formatValue(Math.max(...values)) + ' peak' : 'Unavailable' }}</span>
    </footer>
  </article>
</template>
<style scoped>
.chart-panel {
  min-width: 0;
  overflow: hidden;
  padding: 17px 18px 13px;
  border: 1px solid var(--line);
  background: var(--panel);
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
header small,
footer {
  color: var(--ink-muted);
  font-size: 10px;
}
header small {
  display: block;
  margin-top: 5px;
}
.reset {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  padding: 0;
}
.chart-wrap {
  position: relative;
  margin-top: 16px;
}
.chart-wrap svg {
  display: block;
  width: 100%;
  height: auto;
  min-height: 150px;
  cursor: crosshair;
}
.tooltip {
  position: absolute;
  top: 8px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: calc(100% - 16px);
  padding: 6px 8px;
  border: 1px solid var(--line);
  background: var(--popover);
  border-radius: var(--radius-sm);
  font-size: 10px;
  pointer-events: none;
  white-space: nowrap;
}
.tooltip strong {
  color: var(--ink);
}
.tooltip span {
  color: var(--ink-muted);
}
footer {
  display: flex;
  justify-content: space-between;
  padding-top: 6px;
}
</style>
