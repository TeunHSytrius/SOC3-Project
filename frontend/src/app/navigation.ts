import type { User } from '../types/soc';
import type { NavigationItem } from '../components/AppMenu';

const account: NavigationItem = { label: 'Account', href: '/account' };
const dashboard: NavigationItem = { label: 'Dashboard', href: '/' };
const reports: NavigationItem = { label: 'Rapportages', href: '/reports' };
const alerts: NavigationItem = { label: 'Alerts', href: '/alerts' };

export function getNavigation(user: User): NavigationItem[] {
  if (user.requiresTwoFactorSetup) return [account];

  if (user.role === 'Beheerder') {
    return [
      dashboard,
      alerts,
      { label: 'Tickets', href: '/cases' },
      { label: 'Klanten', href: '/customers' },
      { label: 'Gebruikers & rollen', href: '/users' },
      { label: 'API-sleutels', href: '/keys' },
      { label: 'Auditlog', href: '/audit' },
      { label: 'Foutenlog', href: '/errors' },
      reports,
      account,
    ];
  }

  const cases = { label: 'Tickets', href: '/cases' };
  if (user.role === 'Analist' || user.role === 'Senior analist') {
    return [dashboard, alerts, cases, reports, account];
  }

  return [cases, account];
}
