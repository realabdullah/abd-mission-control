<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { applyMissionTheme, missionThemes, type MissionTheme } from '~/composables/useMissionTheme';

const theme = ref<MissionTheme>('mint');
const saved = ref(false);
const notifications = ref(false);
const notificationStatus = ref('');
const { requestPermission } = useMissionNotifications();
onMounted(() => {
  try {
    const value = JSON.parse(localStorage.getItem('mission-control-settings') ?? '{}') as Record<
      string,
      string
    >;
    theme.value = (value.theme as MissionTheme) ?? 'mint';
    notifications.value = value.notifications === 'true';
  } catch {
    /* use defaults */
  }
  applyMissionTheme(theme.value);
});
function updateTheme() {
  applyMissionTheme(theme.value);
}
async function updateNotifications() {
  if (!notifications.value) {
    notificationStatus.value = '';
    return;
  }
  const permission = await requestPermission();
  if (permission !== 'granted') {
    notifications.value = false;
    notificationStatus.value =
      permission === 'unsupported'
        ? 'Browser notifications are not supported here.'
        : 'Notification permission was not granted.';
  } else notificationStatus.value = 'Browser notifications enabled.';
}
function save() {
  localStorage.setItem(
    'mission-control-settings',
    JSON.stringify({
      theme: theme.value,
      notifications: String(notifications.value),
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
        >
      </section>
      <section>
        <div class="section-kicker">ALERTS</div>
        <label
          >Browser notifications
          <small>Show a local notification when a new Mission Control alert arrives.</small
          ><input v-model="notifications" type="checkbox" @change="updateNotifications"
        /></label>
        <p v-if="notificationStatus" class="notification-status">{{ notificationStatus }}</p>
      </section>
      <section class="diagnostic-tools">
        <div>
          <div class="section-kicker">DIAGNOSTIC TOOLS</div>
          <p>Focused checks that are configured and ready to use.</p>
        </div>
        <NuxtLink to="/path">
          <span
            ><strong>Connection path</strong
            ><small>Trace DNS and public TCP reachability from the collector.</small></span
          >
          <StatusPill label="Active" tone="success" /><i aria-hidden="true">→</i>
        </NuxtLink>
        <NuxtLink to="/speed-test">
          <span
            ><strong>Speed test</strong
            ><small>Run a controlled R2 download with live and saved results.</small></span
          >
          <StatusPill label="Active" tone="success" /><i aria-hidden="true">→</i>
        </NuxtLink>
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
.diagnostic-tools > div:first-child p {
  margin: 6px 0 0;
  color: var(--ink-muted);
  font-size: 11px;
}
.diagnostic-tools a {
  display: grid;
  grid-template-columns: 1fr auto 18px;
  align-items: center;
  gap: 15px;
  min-height: 64px;
  padding: 13px 14px;
  color: inherit;
  background: var(--canvas-raised);
  text-decoration: none;
  transition:
    background-color 0.18s ease,
    transform 0.18s ease;
}
.diagnostic-tools a:hover {
  background: var(--selected);
  transform: translateX(3px);
}
.diagnostic-tools a:active {
  transform: translateX(1px) scale(0.99);
}
.diagnostic-tools a > span {
  display: grid;
  gap: 5px;
}
.diagnostic-tools strong {
  color: var(--ink-soft);
  font-size: 13px;
}
.diagnostic-tools small {
  color: var(--ink-muted);
  font-size: 11px;
  line-height: 1.5;
}
.diagnostic-tools i {
  color: var(--accent);
  font-size: 17px;
  font-style: normal;
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
.settings input {
  grid-column: 2;
  grid-row: 1 / span 2;
  justify-self: start;
  width: 20px;
  height: 20px;
  accent-color: var(--accent-strong);
}
.notification-status {
  margin: -8px 0 0;
  color: var(--ink-muted);
  font-size: 11px;
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
  .settings input {
    grid-column: 1;
    grid-row: auto;
  }
}
</style>
