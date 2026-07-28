<script setup lang="ts">
import { computed } from 'vue';
const props = withDefaults(defineProps<{ at: string | null; thresholdSeconds?: number }>(), {
  thresholdSeconds: 120,
});
const state = computed(() => {
  if (!props.at || Number.isNaN(Date.parse(props.at)))
    return { label: 'No successful sample', tone: 'critical' as const };
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(props.at)) / 1000));
  return seconds > props.thresholdSeconds
    ? { label: `Data delayed · ${Math.floor(seconds / 60)}m old`, tone: 'warning' as const }
    : {
        label: seconds < 60 ? 'Sampled just now' : `Sampled ${Math.floor(seconds / 60)}m ago`,
        tone: 'success' as const,
      };
});
</script>
<template><StatusPill :label="state.label" :tone="state.tone" /></template>
