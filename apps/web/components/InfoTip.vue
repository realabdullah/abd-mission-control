<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ title: string; text: string }>();
const placement = ref<'right' | 'left'>('right');
function placePopover(event: MouseEvent | FocusEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  placement.value = window.innerWidth - rect.right < 236 ? 'left' : 'right';
}
</script>
<template>
  <span class="tip-wrap"
    ><button
      class="tip"
      :aria-label="`Explain ${title}`"
      @mouseenter="placePopover"
      @focus="placePopover"
    >
      ?</button
    ><span class="tip-popover" :class="placement" role="tooltip"
      ><strong>{{ title }}</strong
      ><span>{{ text }}</span></span
    ></span
  >
</template>
<style scoped>
.tip-wrap {
  position: relative;
  display: inline-flex;
  margin-left: 5px;
  vertical-align: middle;
}
.tip {
  width: 16px;
  height: 16px;
  min-height: 16px;
  flex: 0 0 16px;
  border: 1px solid #557071;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #a4b7b5;
  font-size: 10px;
  line-height: 1;
  padding: 0;
}
.tip-popover {
  position: absolute;
  z-index: 10;
  left: 22px;
  top: -7px;
  width: 220px;
  padding: 11px 12px;
  display: grid;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--popover);
  color: var(--ink-soft);
  box-shadow: 0 6px 18px #0008;
  opacity: 0;
  pointer-events: none;
  transform: translateY(3px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  font-size: 11px;
  line-height: 1.45;
}
.tip-popover.left {
  right: 22px;
  left: auto;
}
.tip-popover strong {
  color: var(--ink);
  font-size: 12px;
}
.tip:hover + .tip-popover,
.tip:focus-visible + .tip-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
</style>
