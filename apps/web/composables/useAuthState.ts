export function useAuthState() {
  const authenticated = useState<boolean | null>('mission-authenticated', () => null);
  return {
    authenticated,
    setAuthenticated(value: boolean) {
      authenticated.value = value;
    },
  };
}
