<template>
  <div class="skeleton" aria-busy="true" aria-label="Loading mission overview">
    <section class="summary-block">
      <i class="shimmer mark" />
      <div><i class="shimmer pill" /><i class="shimmer headline" /><i class="shimmer copy" /></div>
      <div><i class="shimmer label" /><i class="shimmer value" /></div>
    </section>
    <section>
      <div class="section-heading">
        <div><i class="shimmer label" /><i class="shimmer title" /></div>
        <i class="shimmer note" />
      </div>
      <div class="metrics"><i v-for="item in 6" :key="item" class="shimmer metric" /></div>
    </section>
    <section>
      <div class="section-heading">
        <div><i class="shimmer label" /><i class="shimmer title" /></div>
        <i class="shimmer switch" />
      </div>
      <div class="charts"><i v-for="item in 4" :key="item" class="shimmer chart" /></div>
    </section>
    <section class="lower"><i class="shimmer list" /><i class="shimmer list" /></section>
  </div>
</template>

<style scoped>
.skeleton {
  display: grid;
  gap: 38px;
  margin-top: 36px;
}
.summary-block {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 17px;
  padding: 25px 26px;
  border: 1px solid var(--summary-line);
  background: var(--summary);
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 14px;
}
.metrics,
.charts,
.lower {
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
.lower {
  grid-template-columns: 1.15fr 0.85fr;
  gap: 26px;
  border: 0;
  background: transparent;
}
.shimmer {
  display: block;
  overflow: hidden;
  background: linear-gradient(105deg, var(--panel) 25%, var(--panel-strong) 42%, var(--panel) 59%);
  background-size: 200% 100%;
  animation: sweep 1.5s ease-in-out infinite;
}
.mark {
  width: 31px;
  height: 31px;
  border-radius: 50%;
}
.pill {
  width: 96px;
  height: 20px;
}
.headline {
  width: min(430px, 90%);
  height: 29px;
  margin-top: 14px;
}
.copy {
  width: 210px;
  height: 12px;
  margin-top: 9px;
}
.label {
  width: 78px;
  height: 10px;
}
.value {
  width: 65px;
  height: 16px;
  margin-top: 9px;
}
.title {
  width: 140px;
  height: 19px;
  margin-top: 9px;
}
.note {
  width: 125px;
  height: 11px;
}
.switch {
  width: 170px;
  height: 34px;
}
.metric {
  min-height: 115px;
}
.chart {
  min-height: 245px;
}
.list {
  min-height: 185px;
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
  .lower {
    grid-template-columns: 1fr;
  }
  .summary-block {
    grid-template-columns: 40px 1fr;
  }
  .summary-block > :last-child {
    display: none;
  }
}
@media (max-width: 640px) {
  .skeleton {
    gap: 30px;
  }
  .summary-block {
    padding: 19px;
  }
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts {
    grid-template-columns: 1fr;
  }
  .section-heading .note {
    display: none;
  }
  .switch {
    width: 150px;
  }
}
</style>
