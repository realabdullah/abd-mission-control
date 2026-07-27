<script setup lang="ts">
defineProps<{ label: string; tone?: 'success' | 'warning' | 'critical' | 'info' | 'muted' }>();
</script>
<template>
  <span class="pill" :class="tone ?? 'muted'"><i />{{ label }}</span>
</template>
<style scoped>
.pill {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 5px;
  width: fit-content;
  min-height: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 4px 7px;
  color: var(--ink-soft);
  font-size: 10px;
  line-height: 1;
}
.pill i {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: currentColor;
}
.success {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 28%, transparent);
  background: color-mix(in srgb, var(--success) 7%, transparent);
}
.warning {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 28%, transparent);
  background: color-mix(in srgb, var(--warning) 7%, transparent);
}
.critical {
  color: var(--critical);
  border-color: color-mix(in srgb, var(--critical) 28%, transparent);
  background: color-mix(in srgb, var(--critical) 7%, transparent);
}
.info {
  color: var(--info);
  border-color: color-mix(in srgb, var(--info) 28%, transparent);
  background: color-mix(in srgb, var(--info) 7%, transparent);
}
.muted {
  color: var(--ink-muted);
}
</style>
