<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  context: string;
  tone?: 'normal' | 'warning' | 'muted';
  help?: { title: string; text: string };
}>();
</script>
<template>
  <article class="metric" :class="tone ?? 'normal'">
    <div class="metric-label">
      <span>{{ label }}</span
      ><InfoTip v-if="help" v-bind="help" />
    </div>
    <strong>{{ value }}</strong
    ><small>{{ context }}</small>
  </article>
</template>
<style scoped>
.metric {
  min-width: 0;
  padding: 17px 16px 15px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line-soft);
  background: var(--panel);
}
.metric.warning {
  border-top-color: var(--warning);
}
.metric-label {
  display: flex;
  align-items: center;
  color: var(--ink-muted);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.metric strong {
  display: block;
  margin: 10px 0 5px;
  color: var(--ink);
  font-size: clamp(1.25rem, 2vw, 1.7rem);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metric small {
  color: var(--ink-muted);
  font-size: 11px;
}
</style>
