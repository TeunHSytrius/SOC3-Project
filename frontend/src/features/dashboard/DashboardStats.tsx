import { Icon } from '../../components/Ui';

export interface DashboardMetric {
  label: string;
  value: number;
  description: string;
  icon: string;
  tone: 'blue' | 'purple' | 'warn' | 'danger';
}

interface DashboardStatsProps {
  items: DashboardMetric[];
}

export default function DashboardStats({ items }: DashboardStatsProps) {
  return (
    <div className="stats">
      {items.map((metric) => (
        <div className="stat" key={metric.label}>
          <div className="statline">
            <span>{metric.label}</span>
            <span className={'stat-icon ' + metric.tone}>
              <Icon name={metric.icon} />
            </span>
          </div>
          <strong>{metric.value}</strong>
          <small>{metric.description}</small>
        </div>
      ))}
    </div>
  );
}
