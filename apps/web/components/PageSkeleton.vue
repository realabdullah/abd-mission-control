<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'list' | 'timeline' | 'analytics' | 'log' }>(), {
  variant: 'list',
});
</script>

<template>
  <div class="skeleton" :class="`is-${variant}`" aria-busy="true" aria-label="Loading page content">
    <template v-if="variant === 'analytics'">
      <div class="metrics"><i v-for="item in 6" :key="item" class="shimmer metric" /></div>
      <div class="charts"><i v-for="item in 2" :key="item" class="shimmer chart" /></div>
      <div class="charts"><i class="shimmer chart" /><i class="shimmer note" /></div>
    </template>
    <template v-else>
      <div v-for="item in variant === 'log' ? 4 : 5" :key="item" class="row">
        <i v-if="variant === 'timeline'" class="shimmer rail" />
        <div class="row-copy">
          <i class="shimmer title" /><i class="shimmer line wide" /><i class="shimmer line" />
        </div>
        <i v-if="variant === 'list'" class="shimmer action" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.skeleton {
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
.charts {
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
  margin-top: 38px;
}
.metric {
  min-height: 115px;
}
.chart {
  min-height: 245px;
}
.note {
  min-height: 245px;
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
}
@media (max-width: 640px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts {
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
