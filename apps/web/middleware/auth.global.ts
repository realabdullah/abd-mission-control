export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const { request } = useMissionApi();
  const { authenticated, setAuthenticated } = useAuthState();
  if (authenticated.value === null) {
    try {
      const response = await request('/auth/session');
      const session = (await response.json()) as { authenticated?: boolean };
      setAuthenticated(Boolean(session.authenticated));
    } catch {
      setAuthenticated(false);
    }
  }
  if (authenticated.value && to.path === '/login') return navigateTo('/');
  if (!authenticated.value && to.path !== '/login') return navigateTo('/login');
});
