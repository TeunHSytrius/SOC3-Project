import type { DemoAlert } from './demoAlerts';

export function priorityKind(priority: DemoAlert['priority']): string {
  switch (priority) {
    case 'Kritiek':
      return 'critical';
    case 'Hoog':
      return 'danger';
    case 'Gemiddeld':
      return 'warn';
    case 'Laag':
      return 'neutral';
  }
}

export function statusKind(status: DemoAlert['status']): string {
  if (status === 'Nieuw') {
    return 'blue';
  }

  return 'warn';
}
