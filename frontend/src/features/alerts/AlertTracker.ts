import type { Alert } from '../../types/soc';
import { active, sortRecords } from '../../types/domain';

export class AlertTracker {
  private knownIds = new Set<string>();
  private initialized = false;

  reset(): void {
    this.knownIds.clear();
    this.initialized = false;
  }

  findNewAlerts(alerts: Alert[]): Alert[] {
    // The first load is a baseline, not a batch of new notifications.
    const newAlerts = this.initialized
      ? alerts.filter((alert) => !this.knownIds.has(alert.id) && active(alert))
      : [];

    for (const alert of alerts) {
      this.knownIds.add(alert.id);
    }

    this.initialized = true;
    return sortRecords(newAlerts, 'newest', false);
  }
}

export function mergeNotifications(newAlerts: Alert[], existingAlerts: Alert[]): Alert[] {
  return [...newAlerts, ...existingAlerts].slice(0, 3);
}
