<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const { request } = useMissionApi();
const { setAuthenticated } = useAuthState();
const email = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

async function signIn(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    const response = await request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    });
    if (!response.ok) throw new Error('That email or password is not recognized.');
    setAuthenticated(true);
    await navigateTo('/');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to sign in right now.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="login-card" aria-labelledby="login-title">
    <div class="signal-mark">A</div>
    <p class="eyebrow">ABD / PRIVATE TINKERING LAB</p>
    <h1 id="login-title">Mission Control</h1>
    <p class="intro">Your private workbench for observing, testing, and tuning the local link.</p>
    <form @submit.prevent="signIn">
      <label>Email<input v-model="email" type="email" autocomplete="username" required /></label>
      <label
        >Password<input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button :disabled="submitting" type="submit">
        {{ submitting ? 'Verifying access…' : 'Enter Mission Control' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.login-card {
  width: min(100%, 420px);
  padding: clamp(28px, 7vw, 48px);
  border: 1px solid var(--line);
  background: linear-gradient(145deg, #17282a 0%, var(--panel) 62%);
  box-shadow: 0 28px 80px #0008;
}
.signal-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--accent);
  color: var(--accent);
  font-weight: 700;
}
.eyebrow {
  margin: 28px 0 8px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}
h1 {
  margin: 0;
  font-size: 2rem;
  letter-spacing: -0.04em;
}
.intro {
  margin: 10px 0 28px;
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.5;
}
form {
  display: grid;
  gap: 16px;
}
label {
  display: grid;
  gap: 7px;
  color: var(--ink-soft);
  font-size: 12px;
}
input {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 9px 11px;
  background: var(--control);
  color: var(--ink);
}
button {
  min-height: 43px;
  margin-top: 6px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  color: #10201e;
  background: var(--accent);
  font-size: 12px;
  font-weight: 700;
}
button:disabled {
  cursor: wait;
  opacity: 0.7;
}
.error {
  margin: 0;
  color: var(--critical);
  font-size: 12px;
}
</style>
