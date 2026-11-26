import type { User } from '../types/soc';
import type { NavigationItem } from '../components/AppMenu';

const account: NavigationItem = { label: 'Account', href: '/account' };
const dashboard: NavigationItem = { label: 'Dashboard', href: '/' };

export function getNavigation(user: User): NavigationItem[] {
  if (user.requiresTwoFactorSetup) return [account];

  if (user.role === 'Beheerder') {
    return [
      dashboard,
      { label: 'Klanten', href: '/customers' },
      { label: 'Gebruikers & rollen', href: '/users' },
      { label: 'Auditlog', href: '/audit' },
      { label: 'Foutenlog', href: '/errors' },
      account,
    ];
  }

  return [dashboard, account];
}
