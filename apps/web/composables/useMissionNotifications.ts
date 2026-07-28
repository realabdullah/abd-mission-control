export function useMissionNotifications() {
  const enabled = () => localStorage.getItem('mission-control-alert-notifications') === 'true';
  const notify = (title: string, body: string): void => {
    if (!enabled() || typeof Notification === 'undefined' || Notification.permission !== 'granted')
      return;
    new Notification(title, { body, tag: 'mission-control-alert' });
  };
  const requestPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.requestPermission();
  };
  return { enabled, notify, requestPermission };
}
