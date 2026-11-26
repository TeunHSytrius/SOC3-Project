import type { Priority } from '../../types/soc';

export function priorityColor(priority: Priority): string {
  return 'severity-' + priority.toLowerCase();
}
