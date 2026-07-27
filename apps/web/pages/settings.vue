<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { applyMissionTheme, missionThemes, type MissionTheme } from '~/composables/useMissionTheme';

const theme = ref<MissionTheme>('mint');
const refresh = ref('30');
const timezone = ref('local');
const chartRange = ref('1h');
const saved = ref(false);
onMounted(() => {
  try {
    const value = JSON.parse(localStorage.getItem('mission-control-settings') ?? '{}') as Record<
      string,
      string
    >;
    theme.value = (value.theme as MissionTheme) ?? 'mint';
    refresh.value = value.refresh ?? '30';
    timezone.value = value.timezone ?? 'local';
    chartRange.value = value.chartRange ?? '1h';
  } catch {
    /* use defaults */
  }
  applyMissionTheme(theme.value);
});
function updateTheme() {
  applyMissionTheme(theme.value);
}
function save() {
  localStorage.setItem(
    'mission-control-settings',
    JSON.stringify({
      theme: theme.value,
      refresh: refresh.value,
      timezone: timezone.value,
      chartRange: chartRange.value,
    }),
  );
  saved.value = true;
  window.setTimeout(() => {
    saved.value = false;
  }, 2200);
}
</script>
<template>
  <div class="page">
    <header class="page-head">
      <div>
        <div class="crumb">MISSION / SETTINGS</div>
        <h1>Settings</h1>
        <p class="lede">Small preferences for how Mission Control reads to you.</p>
      </div>
      <StatusPill label="Stored locally" tone="info" />
    </header>
    <form class="settings" @submit.prevent="save">
      <section>
        <div class="section-kicker">DISPLAY</div>
        <label
          >Color theme <small>Choose the signal color used across the dashboard.</small
          ><select v-model="theme" @change="updateTheme">
            <option v-for="(option, value) in missionThemes" :key="value" :value="value">
              {{ option.label }}
            </option>
          </select></label
        ><label
          >Timezone display <small>Transport timestamps remain UTC.</small
          ><select v-model="timezone">
            <option value="local">Local timezone</option>
            <option value="utc">UTC</option>
          </select></label
        >
      </section>
      <section>
        <div class="section-kicker">TELEMETRY</div>
        <label
          >Refresh interval <small>Used for manual page refresh preferences.</small
          ><select v-model="refresh">
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
          </select></label
        ><label
          >Default chart range <small>Applied when opening Mission.</small
          ><select v-model="chartRange">
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
          </select></label
        >
      </section>
      <button class="save" type="submit">{{ saved ? 'Saved' : 'Save preferences' }}</button>
    </form>
  </div>
</template>
<style scoped>
.page {
  width: min(900px, 100%);
  margin: 0 auto;
  padding: 34px clamp(18px, 4vw, 48px) 38px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.crumb,
.section-kicker {
  color: #78908f;
  font-size: 10px;
  letter-spacing: 0.13em;
  font-weight: 700;
}
.page h1 {
  margin: 9px 0 4px;
  font-size: clamp(1.9rem, 3.2vw, 2.8rem);
  line-height: 1;
  letter-spacing: -0.035em;
}
.lede {
  color: var(--ink-muted);
  font-size: 13px;
  margin: 0;
}
.settings {
  margin-top: 42px;
  display: grid;
  gap: 16px;
}
.settings section {
  display: grid;
  gap: 18px;
  padding: 23px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}
.settings label {
  display: grid;
  grid-template-columns: 1fr 220px;
  align-items: center;
  gap: 15px;
  color: var(--ink-soft);
  font-size: 13px;
}
.settings label small {
  grid-column: 1;
  margin-top: -11px;
  color: var(--ink-muted);
  font-size: 10px;
}
.settings select {
  grid-column: 2;
  grid-row: 1 / span 2;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  appearance: none;
  padding: 9px 38px 9px 11px;
  background-color: var(--control);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%),
    linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) 17px,
    calc(100% - 11px) 17px;
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
  color: var(--ink);
}
.save {
  justify-self: start;
  margin-top: 0;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 9px 14px;
  color: #10201e;
  background: var(--accent);
  font-size: 12px;
}
@media (max-width: 600px) {
  .page-head {
    display: block;
  }
  .page-head > :last-child {
    margin-top: 16px;
  }
  .settings label {
    grid-template-columns: 1fr;
    gap: 7px;
  }
  .settings label small {
    grid-column: 1;
    margin: 0;
  }
  .settings select {
    grid-column: 1;
    grid-row: auto;
    width: 100%;
  }
}
</style>
