import type { User } from '../types/soc';
import type { NavigationItem } from '../components/AppMenu';
import { canViewDemoAlerts } from '../features/demo/demoAlerts';

const account: NavigationItem = { label: 'Account', href: '/account' };
const dashboard: NavigationItem = { label: 'Dashboard', href: '/' };
const alerts: NavigationItem = { label: 'Alerts', href: '/alerts' };

export function getNavigation(user: User): NavigationItem[] {
  if (user.requiresTwoFactorSetup) {
    return [account];
  }

  if (user.role === 'Beheerder') {
    return [
      dashboard,
      alerts,
      { label: 'Klanten', href: '/customers' },
      { label: 'Gebruikers & rollen', href: '/users' },
      { label: 'Auditlog', href: '/audit' },
      { label: 'Foutenlog', href: '/errors' },
      account,
    ];
  }

  if (canViewDemoAlerts(user)) {
    return [dashboard, alerts, account];
  }

  return [dashboard, account];
}
