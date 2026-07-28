export function useMissionApi() {
  const config = useRuntimeConfig();
  const route = useRoute();
  const { setAuthenticated } = useAuthState();
  const api = (path: string) => `${config.public.apiBase}/api/v1${path}`;

  return {
    api,
    request: async (path: string, init: RequestInit = {}) => {
      const response = await fetch(api(path), { ...init, credentials: 'include' });
      if (response.status === 401 && !path.startsWith('/auth/')) {
        setAuthenticated(false);
        if (route.path !== '/login') void navigateTo('/login');
      }
      return response;
    },
  };
}
