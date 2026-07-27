<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const route = useRoute();
const { request } = useMissionApi();
const sidebarOpen = ref(false);
const sidebarExpanded = ref(false);
const signingOut = ref(false);
const nav = [
  { to: '/', label: 'Mission', icon: '◎' },
  { to: '/analytics', label: 'Analytics', icon: '⌁' },
  { to: '/incidents', label: 'Incidents', icon: '!' },
  { to: '/alerts', label: 'Alerts', icon: '◌' },
  { to: '/daily-log', label: 'Daily log', icon: '▤' },
];
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to));
function closeSidebar() {
  sidebarOpen.value = false;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeSidebar();
}
async function signOut(): Promise<void> {
  signingOut.value = true;
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    await navigateTo('/login');
    signingOut.value = false;
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>
<template>
  <div class="app-frame">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="closeSidebar" />
    <aside
      class="sidebar"
      :class="{ open: sidebarOpen, expanded: sidebarExpanded }"
      aria-label="Primary navigation"
    >
      <NuxtLink class="brand" to="/" aria-label="ABD Mission Control home"
        ><span class="brand-mark">A</span
        ><span><strong>ABD</strong><small>MISSION CONTROL</small></span></NuxtLink
      >
      <button
        class="rail-toggle"
        type="button"
        :aria-expanded="sidebarExpanded"
        aria-label="Toggle navigation labels"
        @click="sidebarExpanded = !sidebarExpanded"
      >
        <span aria-hidden="true">{{ sidebarExpanded ? '‹' : '›' }}</span>
      </button>
      <div class="nav-group">
        <p class="nav-label">Workspace</p>
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          ><span class="nav-icon" aria-hidden="true">{{ item.icon }}</span
          ><span>{{ item.label }}</span></NuxtLink
        >
      </div>
      <div class="sidebar-bottom">
        <div class="link-muted">
          <span class="status-dot" /> Starlink Mini <small>LOCAL LINK</small>
        </div>
        <NuxtLink class="nav-item" to="/settings" :class="{ active: isActive('/settings') }"
          ><span class="nav-icon">⚙</span><span>Settings</span></NuxtLink
        >
        <button class="nav-item sign-out" type="button" :disabled="signingOut" @click="signOut">
          <span class="nav-icon" aria-hidden="true">↗</span
          ><span>{{ signingOut ? 'Signing out…' : 'Sign out' }}</span>
        </button>
        <p class="version">MISSION CONTROL · PHASE 4</p>
      </div>
    </aside>
    <main class="main-column">
      <header class="mobile-header">
        <NuxtLink class="brand" to="/"
          ><span class="brand-mark">A</span><strong>MISSION CONTROL</strong></NuxtLink
        ><button
          class="menu-button"
          type="button"
          aria-label="Open navigation"
          @click="sidebarOpen = true"
        >
          ☰
        </button>
      </header>
      <slot />
    </main>
  </div>
</template>
<style scoped>
.app-frame {
  min-height: 100vh;
  display: flex;
}
.sidebar {
  position: sticky;
  top: 0;
  width: 228px;
  height: 100vh;
  flex: 0 0 228px;
  padding: 26px 14px 18px;
  border-right: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  background: var(--sidebar);
  transition:
    width 0.2s ease,
    transform 0.2s ease;
  z-index: 30;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  padding: 0 10px;
  margin-bottom: 48px;
}
.brand-mark {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border: 1px solid var(--accent);
  color: var(--accent);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 13px;
}
.brand strong {
  display: block;
  font-size: 13px;
  letter-spacing: 0.08em;
}
.brand small {
  display: block;
  color: var(--ink-muted);
  font-size: 8px;
  letter-spacing: 0.12em;
  margin-top: 3px;
}
.nav-group {
  flex: 1;
}
.nav-label {
  color: #607878;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0 11px;
  margin: 0 0 10px;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 11px;
  margin: 3px 0;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--ink-muted);
  font-size: 13px;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}
.nav-item:hover,
.nav-item.active {
  background: var(--panel-strong);
  color: var(--ink);
}
.nav-item.active {
  box-shadow: none;
  background: var(--selected);
  border-radius: 0;
}
.nav-item.active::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 4px;
  width: 2px;
  background: var(--accent-strong);
}
.nav-icon {
  width: 18px;
  color: #749190;
  text-align: center;
  font-size: 16px;
}
.nav-item.active .nav-icon {
  color: var(--accent);
}
.sign-out {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
}
.sign-out:hover:not(:disabled) {
  color: var(--critical);
}
.sign-out:hover:not(:disabled) .nav-icon {
  color: var(--critical);
}
.sign-out:disabled {
  cursor: wait;
  opacity: 0.65;
}
.sidebar-bottom {
  margin-top: auto;
}
.rail-toggle {
  position: absolute;
  top: 29px;
  right: -13px;
  display: grid;
  width: 26px;
  height: 26px;
  min-height: 26px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
  background: var(--canvas-raised);
  z-index: 1;
}
.sidebar:not(.expanded) {
  width: 68px;
  flex-basis: 68px;
}
.sidebar:not(.expanded) .brand {
  justify-content: center;
  padding: 0;
}
.sidebar:not(.expanded) .brand > span:last-child,
.sidebar:not(.expanded) .nav-label,
.sidebar:not(.expanded) .nav-item > span:last-child,
.sidebar:not(.expanded) .link-muted small,
.sidebar:not(.expanded) .version {
  display: none;
}
.sidebar:not(.expanded) .nav-item {
  justify-content: center;
  justify-content: flex-start;
  padding-inline: 16px 10px;
}
.sidebar:not(.expanded) .link-muted {
  justify-content: center;
  margin-inline: 0;
}
.link-muted {
  margin: 0 10px 16px;
  color: var(--ink-muted);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 7px;
}
.link-muted small {
  display: block;
  margin-left: auto;
  color: #557070;
  font-size: 8px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 14%, transparent);
}
.version {
  color: #506668;
  font-size: 9px;
  letter-spacing: 0.08em;
  padding: 11px;
  margin: 13px 0 0;
}
.main-column {
  flex: 1;
  min-width: 0;
}
.mobile-header {
  display: none;
}
@media (max-width: 720px) {
  .sidebar {
    position: fixed;
    left: 0;
    width: min(280px, calc(100vw - 44px)) !important;
    flex-basis: auto !important;
    transform: translateX(-105%);
    box-shadow: 14px 0 32px #0007;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .sidebar:not(.expanded) .brand > span:last-child,
  .sidebar:not(.expanded) .nav-label,
  .sidebar:not(.expanded) .nav-item > span:last-child,
  .sidebar:not(.expanded) .link-muted small,
  .sidebar:not(.expanded) .version {
    display: block;
  }
  .sidebar:not(.expanded) .nav-item,
  .sidebar:not(.expanded) .brand,
  .sidebar:not(.expanded) .link-muted {
    justify-content: flex-start;
    padding-inline: 11px;
  }
  .rail-toggle {
    display: none;
  }
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: #0009;
    z-index: 20;
  }
  .sidebar {
    display: flex;
  }
  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid var(--line-soft);
  }
  .mobile-header .brand {
    margin: 0;
    padding: 0;
  }
  .mobile-header .brand strong {
    font-size: 11px;
  }
  .menu-button {
    display: grid;
    width: 40px;
    min-height: 40px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    color: var(--ink-soft);
    background: transparent;
    font-size: 17px;
  }
}
@media (min-width: 1025px) {
  .sidebar:not(.expanded) {
    width: 228px;
    flex-basis: 228px;
  }
  .sidebar:not(.expanded) .brand {
    justify-content: flex-start;
    padding-inline: 10px;
  }
  .sidebar:not(.expanded) .brand > span:last-child,
  .sidebar:not(.expanded) .nav-label,
  .sidebar:not(.expanded) .nav-item > span:last-child,
  .sidebar:not(.expanded) .link-muted small,
  .sidebar:not(.expanded) .version {
    display: block;
  }
  .sidebar:not(.expanded) .nav-item,
  .sidebar:not(.expanded) .link-muted {
    justify-content: flex-start;
  }
  .rail-toggle {
    display: none;
  }
}
@media (min-width: 721px) and (max-width: 1024px) {
  .sidebar:not(.expanded) .nav-item.active::before {
    left: 5px;
  }
}
@media (min-width: 721px) {
  .menu-button,
  .sidebar-backdrop {
    display: none;
  }
}
</style>
