<script setup lang="ts">
import type { SpeedTestVibe } from './speed-test/types';
import { speedTestVibes } from './speed-test/types';
defineProps<{ modelValue: SpeedTestVibe }>();
const emit = defineEmits<{ 'update:modelValue': [value: SpeedTestVibe] }>();
</script>
<template>
  <section class="picker" aria-label="Choose a speed-test vibe">
    <div class="picker-heading">
      <span>Choose your lens</span><small>Same signal. Five ways to feel it.</small>
    </div>
    <div class="vibe-grid">
      <button
        v-for="item in speedTestVibes"
        :key="item.id"
        class="vibe"
        :class="[`vibe-${item.id}`, { selected: modelValue === item.id }]"
        type="button"
        @click="emit('update:modelValue', item.id)"
      >
        <b>{{ item.glyph }}</b
        ><strong>{{ item.name }}</strong
        ><span>{{ item.hook }}</span>
      </button>
    </div>
  </section>
</template>
<style scoped>
.picker {
  margin: 26px 0 18px;
}
.picker-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--ink);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.picker-heading small {
  color: var(--ink-muted);
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
}
.vibe-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}
.vibe {
  min-height: 91px;
  padding: 12px 10px;
  border: 1px solid var(--line-soft);
  color: var(--ink-muted);
  background: var(--panel);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;
}
.vibe:hover {
  transform: translateY(-3px);
  border-color: var(--ink-muted);
  color: var(--ink);
}
.vibe.selected {
  border-color: var(--accent);
  color: var(--ink);
  background: var(--selected);
  box-shadow: 0 5px 20px color-mix(in srgb, var(--accent) 9%, transparent);
}
.vibe b {
  display: block;
  margin-bottom: 8px;
  color: var(--accent);
  font-size: 22px;
  font-weight: 400;
}
.vibe strong {
  display: block;
  font-size: 12px;
}
.vibe span {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  line-height: 1.25;
}
@media (max-width: 700px) {
  .vibe-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .vibe:last-child {
    grid-column: span 2;
  }
}
@media (max-width: 450px) {
  .picker-heading {
    display: grid;
    gap: 4px;
  }
  .vibe-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .vibe:last-child {
    grid-column: auto;
  }
}
</style>
