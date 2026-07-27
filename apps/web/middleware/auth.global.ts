export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const { request } = useMissionApi();
  try {
    const response = await request('/auth/session');
    const session = (await response.json()) as { authenticated?: boolean };
    if (session.authenticated && to.path === '/login') return navigateTo('/');
    if (!session.authenticated && to.path !== '/login') return navigateTo('/login');
  } catch {
    if (to.path !== '/login') return navigateTo('/login');
  }
});
