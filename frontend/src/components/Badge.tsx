import { labels } from '../types/domain';

const badgeKinds: Record<string, string> = {
  Immediate: 'critical',
  Urgent: 'danger',
  High: 'warn',
  Moderate: 'neutral',
  Low: 'neutral',
  New: 'blue',
  Open: 'blue',
  PendingReview: 'blue',
  UnderReview: 'warn',
  UnderInvestigation: 'blue',
  WaitingForCustomer: 'warn',
  Escalated: 'blue',
  Resolved: 'good',
  Closed: 'good',
  Dismissed: 'neutral',
};

export function Badge({ value, kind }: { value: string; kind?: string }) {
  return (
    <span className={'badge ' + (kind || badgeKinds[value] || 'neutral')}>
      {labels[value] || value}
    </span>
  );
}
