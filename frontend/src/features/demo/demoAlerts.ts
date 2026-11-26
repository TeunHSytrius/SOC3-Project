import type { Organization, User } from '../../types/soc';

export interface DemoAlert {
  id: string;
  number: string;
  organizationId: string;
  organizationName: string;
  title: string;
  description: string;
  source: string;
  priority: 'Kritiek' | 'Hoog' | 'Gemiddeld' | 'Laag';
  status: 'Nieuw' | 'In beoordeling';
  receivedAt: string;
  sourceIp: string;
}

const alertExamples = [
  {
    title: 'Verdachte VPN-aanmelding',
    description: 'Een fictieve aanmelding vanaf een onbekende locatie.',
    source: 'Microsoft Sentinel',
    priority: 'Hoog',
    status: 'Nieuw',
    sourceIp: '192.0.2.45',
  },
  {
    title: 'Malware gedetecteerd',
    description: 'Een fictief endpoint heeft een verdacht bestand geblokkeerd.',
    source: 'Microsoft Defender',
    priority: 'Kritiek',
    status: 'Nieuw',
    sourceIp: '198.51.100.22',
  },
  {
    title: 'Ongebruikelijk netwerkverkeer',
    description: 'Een fictieve afwijking in uitgaand netwerkverkeer.',
    source: 'Suricata',
    priority: 'Gemiddeld',
    status: 'In beoordeling',
    sourceIp: '203.0.113.18',
  },
  {
    title: 'Herhaalde mislukte aanmeldingen',
    description: 'Een fictief serviceaccount heeft meerdere mislukte aanmeldingen.',
    source: 'Microsoft Sentinel',
    priority: 'Hoog',
    status: 'Nieuw',
    sourceIp: '192.0.2.10',
  },
  {
    title: 'Geblokkeerde verbinding',
    description: 'Een fictieve firewall heeft een verbinding geweigerd.',
    source: 'Firewall',
    priority: 'Laag',
    status: 'In beoordeling',
    sourceIp: '198.51.100.40',
  },
  {
    title: 'Verdacht PowerShell-proces',
    description: 'Een fictief endpoint meldt ongebruikelijke scriptuitvoering.',
    source: 'Microsoft Defender',
    priority: 'Hoog',
    status: 'Nieuw',
    sourceIp: '203.0.113.32',
  },
] as const;

// Presentation fixtures only: no API request, database write or incident detection.
export function canViewDemoAlerts(user: User | null): boolean {
  if (!user || user.requiresTwoFactorSetup) {
    return false;
  }

  return ['Beheerder', 'Analist', 'Senior analist'].includes(user.role);
}

export function getDemoAlerts(
  organizations: Organization[],
  selectedOrganizationId: string,
): DemoAlert[] {
  const activeOrganizations = organizations.filter((organization) => organization.isActive);
  const alerts: DemoAlert[] = activeOrganizations.flatMap((organization, organizationIndex) =>
    alertExamples.map((example, exampleIndex) => ({
      ...example,
      id: 'demo-' + organization.id + '-' + exampleIndex,
      number: 'DEMO-' + (1001 + organizationIndex * alertExamples.length + exampleIndex),
      organizationName: organization.name,
      organizationId: organization.id,
      receivedAt: new Date(Date.UTC(2026, 10, 25, 9, exampleIndex * 8)).toISOString(),
    })),
  );

  return alerts.filter(
    (alert) => !selectedOrganizationId || alert.organizationId === selectedOrganizationId,
  );
}
