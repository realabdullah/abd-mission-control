<template>
  <div class="skeleton" aria-busy="true" aria-label="Loading mission overview">
    <section class="summary-block">
      <i class="shimmer mark" />
      <div class="summary-copy">
        <i class="shimmer pill" /><i class="shimmer headline" /><i class="shimmer line" />
      </div>
      <div class="summary-meta">
        <i class="shimmer label" /><i class="shimmer value" /><i class="shimmer link" />
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><i class="shimmer label" /><i class="shimmer title" /></div>
        <i class="shimmer note" />
      </div>
      <div class="diagnostics">
        <article v-for="item in 2" :key="item">
          <i class="shimmer label" /><i class="shimmer reading" /><i class="shimmer line wide" /><i
            class="shimmer spark"
          />
        </article>
      </div>
    </section>

    <section class="split">
      <div v-for="item in 2" :key="item" class="feed">
        <div class="section-heading">
          <div><i class="shimmer label" /><i class="shimmer title" /></div>
          <i class="shimmer link" />
        </div>
        <div class="feed-rows">
          <div v-for="row in 3" :key="row" class="feed-row">
            <i class="shimmer dot" />
            <div><i class="shimmer row-title" /><i class="shimmer line" /></div>
          </div>
        </div>
      </div>
    </section>

    <section class="split insights">
      <article v-for="item in 2" :key="item">
        <div class="section-heading">
          <div><i class="shimmer label" /><i class="shimmer title" /></div>
          <i class="shimmer link" />
        </div>
        <div class="insight-values">
          <i v-for="value in 4" :key="value" class="shimmer insight" />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><i class="shimmer label" /><i class="shimmer title" /></div>
        <i class="shimmer link" />
      </div>
      <div class="metrics"><i v-for="item in 4" :key="item" class="shimmer metric" /></div>
    </section>
    <div class="technical"><i v-for="item in 4" :key="item" class="shimmer technical-line" /></div>
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
  border-radius: var(--radius);
  background: var(--summary);
}
.summary-copy,
.summary-meta,
.section-heading > div,
.feed-row > div {
  display: grid;
  align-content: start;
  gap: 9px;
}
.summary-meta {
  justify-items: end;
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  min-height: 40px;
  margin-bottom: 14px;
}
.diagnostics,
.metrics {
  display: grid;
  gap: 1px;
  border: 1px solid var(--line-soft);
  background: var(--line-soft);
}
.diagnostics {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.diagnostics article {
  display: grid;
  gap: 10px;
  min-height: 176px;
  padding: 19px;
  background: var(--panel);
}
.split {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 26px;
}
.feed-rows {
  border-top: 1px solid var(--line-soft);
}
.feed-row {
  display: grid;
  grid-template-columns: 12px 1fr;
  align-items: center;
  gap: 13px;
  min-height: 70px;
  border-bottom: 1px solid var(--line-soft);
}
.insights article {
  min-height: 166px;
  padding: 19px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.insight-values {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 25px;
}
.metrics {
  grid-template-columns: repeat(4, 1fr);
}
.metric {
  min-height: 115px;
}
.technical {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--line-soft);
}
.shimmer {
  display: block;
  overflow: hidden;
  background: linear-gradient(105deg, var(--panel) 25%, var(--panel-strong) 42%, var(--panel) 59%);
  background-size: 200% 100%;
  animation: sweep 1.5s ease-in-out infinite;
}
.mark,
.dot {
  border-radius: 50%;
}
.mark {
  width: 31px;
  height: 31px;
}
.dot {
  width: 12px;
  height: 12px;
}
.pill {
  width: 96px;
  height: 20px;
}
.headline {
  width: min(430px, 90%);
  height: 29px;
  margin-top: 4px;
}
.label {
  width: 78px;
  height: 10px;
}
.value {
  width: 65px;
  height: 16px;
}
.link {
  width: 90px;
  height: 11px;
}
.title {
  width: 150px;
  height: 19px;
}
.note {
  width: 180px;
  height: 11px;
}
.line {
  width: 160px;
  height: 10px;
}
.wide {
  width: min(290px, 80%);
}
.reading {
  width: 120px;
  height: 27px;
}
.spark {
  align-self: end;
  width: 100%;
  height: 38px;
}
.row-title {
  width: min(250px, 80%);
  height: 13px;
}
.insight {
  height: 45px;
}
.technical-line {
  width: 92px;
  height: 10px;
}
@keyframes sweep {
  to {
    background-position: -200% 0;
  }
}
@media (max-width: 980px) {
  .split {
    grid-template-columns: 1fr;
  }
  .summary-block {
    grid-template-columns: 40px 1fr;
  }
  .summary-meta {
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
  .diagnostics,
  .metrics {
    grid-template-columns: 1fr;
  }
  .section-heading .note {
    display: none;
  }
  .insight-values {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
