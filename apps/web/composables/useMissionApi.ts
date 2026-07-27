export function useMissionApi() {
  const config = useRuntimeConfig();
  const api = (path: string) => `${config.public.apiBase}/api/v1${path}`;

  return {
    api,
    request: (path: string, init: RequestInit = {}) =>
      fetch(api(path), { ...init, credentials: 'include' }),
  };
}
