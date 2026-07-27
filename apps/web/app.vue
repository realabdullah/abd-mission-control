<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { applyMissionTheme, type MissionTheme } from '~/composables/useMissionTheme';

onMounted(() => {
  try {
    const settings = JSON.parse(localStorage.getItem('mission-control-settings') ?? '{}') as {
      theme?: MissionTheme;
    };
    applyMissionTheme(settings.theme ?? 'mint');
  } catch {
    applyMissionTheme('mint');
  }
});
</script>

<style>
:root {
  color-scheme: dark;
  --ink: #e7f0f0;
  --ink-soft: #b5c6c7;
  --ink-muted: #819596;
  --canvas: #0c1315;
  --canvas-raised: #101a1c;
  --sidebar: #0d1719;
  --control: #0d1819;
  --popover: #172728;
  --panel: #132022;
  --panel-strong: #17282a;
  --line: #263b3d;
  --line-soft: #1b2d2f;
  --accent: #a7d8ca;
  --accent-strong: #66c5ad;
  --warning: #e7b875;
  --critical: #eb907d;
  --info: #8fbfd0;
  --success: #70c5a4;
  --mission: #a7d8ca;
  --telemetry: #8fbfd0;
  --reliability: #c6b38a;
  --incident: #e7b875;
  --alert: #eb907d;
  --metadata: #819596;
  --selected: #1b2e2e;
  --summary: #122322;
  --summary-line: #33504c;
  --summary-warning: #211e17;
  --summary-critical: #211918;
  --radius: 4px;
  --radius-sm: 3px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  font-family:
    ui-sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  background: var(--canvas);
  color: var(--ink);
}
* {
  box-sizing: border-box;
}
html {
  background: var(--canvas);
}
body {
  margin: 0;
  min-width: 320px;
  background: var(--canvas);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}
select {
  min-height: 40px;
}
h1,
h2,
h3,
p {
  text-wrap: pretty;
}
button,
a {
  font: inherit;
}
button {
  cursor: pointer;
}
a {
  color: inherit;
}
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
