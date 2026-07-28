<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?:
      | 'list'
      | 'timeline'
      | 'analytics'
      | 'log'
      | 'connection'
      | 'path'
      | 'detail'
      | 'speed-history';
  }>(),
  { variant: 'list' },
);
</script>

<template>
  <div class="skeleton" :class="`is-${variant}`" aria-busy="true" aria-label="Loading page content">
    <template v-if="variant === 'analytics'"
      ><div class="metrics"><i v-for="item in 6" :key="item" class="shimmer metric" /></div>
      <div class="charts"><i v-for="item in 2" :key="item" class="shimmer chart" /></div>
      <div class="charts"><i class="shimmer chart" /><i class="shimmer note-card" /></div
    ></template>
    <template v-else-if="variant === 'connection'"
      ><div class="reading"><i v-for="item in 2" :key="item" class="shimmer reading-card" /></div>
      <i class="shimmer range" /><i class="shimmer chart wide-chart" /><i
        class="shimmer definition"
    /></template>
    <template v-else-if="variant === 'path'"
      ><div class="path-cards"><i v-for="item in 4" :key="item" class="shimmer path-card" /></div>
      <i class="shimmer definition"
    /></template>
    <template v-else-if="variant === 'detail'"
      ><div class="detail-head">
        <i class="shimmer pill" /><i class="shimmer detail-title" /><i
          class="shimmer detail-copy"
        />
      </div>
      <div class="facts"><i v-for="item in 3" :key="item" class="shimmer fact" /></div>
      <i class="shimmer explanation" />
      <div class="rows">
        <div v-for="item in 3" :key="item" class="row">
          <i class="shimmer pill" />
          <div class="row-copy"><i class="shimmer title" /><i class="shimmer line wide" /></div>
        </div></div
    ></template>
    <template v-else
      ><div
        v-for="item in variant === 'log' ? 4 : variant === 'speed-history' ? 3 : 5"
        :key="item"
        class="row"
      >
        <i v-if="variant === 'timeline'" class="shimmer rail" />
        <div class="row-copy">
          <i class="shimmer title" /><i class="shimmer line wide" /><i class="shimmer line" />
        </div>
        <i v-if="variant === 'list' || variant === 'speed-history'" class="shimmer action" /></div
    ></template>
  </div>
</template>

<style scoped>
.skeleton {
  display: grid;
  gap: 30px;
  margin-top: 38px;
}
.shimmer {
  display: block;
  background: linear-gradient(105deg, var(--panel) 25%, var(--panel-strong) 42%, var(--panel) 59%);
  background-size: 200% 100%;
  animation: sweep 1.5s ease-in-out infinite;
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 82px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line-soft);
}
.row-copy {
  display: grid;
  flex: 1;
  gap: 9px;
}
.title {
  width: min(260px, 60%);
  height: 14px;
}
.line {
  width: 36%;
  height: 10px;
}
.line.wide {
  width: min(440px, 82%);
}
.action {
  width: 78px;
  height: 29px;
}
.rail {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.metrics,
.charts,
.reading,
.path-cards,
.facts {
  display: grid;
  gap: 1px;
  border: 1px solid var(--line-soft);
  background: var(--line-soft);
}
.metrics {
  grid-template-columns: repeat(6, 1fr);
}
.charts {
  grid-template-columns: repeat(2, 1fr);
}
.metric {
  min-height: 115px;
}
.chart,
.note-card {
  min-height: 245px;
}
.reading {
  grid-template-columns: repeat(2, 1fr);
}
.reading-card {
  min-height: 156px;
}
.range {
  width: 210px;
  height: 34px;
}
.wide-chart {
  min-height: 295px;
}
.definition {
  width: min(580px, 100%);
  height: 112px;
}
.path-cards {
  grid-template-columns: repeat(4, 1fr);
}
.path-card {
  min-height: 220px;
}
.detail-head {
  display: grid;
  gap: 13px;
  max-width: 620px;
}
.pill {
  width: 82px;
  height: 20px;
}
.detail-title {
  width: min(370px, 80%);
  height: 42px;
}
.detail-copy {
  width: 100%;
  height: 34px;
}
.facts {
  grid-template-columns: repeat(3, 1fr);
}
.fact {
  min-height: 112px;
}
.explanation {
  width: min(680px, 100%);
  height: 150px;
}
.rows {
  border-top: 1px solid var(--line-soft);
}
@keyframes sweep {
  to {
    background-position: -200% 0;
  }
}
@media (max-width: 980px) {
  .metrics {
    grid-template-columns: repeat(3, 1fr);
  }
  .path-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .metrics,
  .charts,
  .reading,
  .facts,
  .path-cards {
    grid-template-columns: 1fr;
  }
  .row {
    min-height: 94px;
  }
  .action {
    width: 58px;
  }
}
</style>
