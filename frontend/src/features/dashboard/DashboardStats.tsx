import { Icon } from '../../components/Ui';

export default function DashboardStats({
  items,
}: {
  items: [string, number, string, string, string][];
}) {
  return (
    <div className="stats">
      {items.map(([label, value, description, icon, tone]) => (
        <div className="stat" key={label}>
          <div className="statline">
            <span>{label}</span>
            <span className={'stat-icon ' + tone}>
              <Icon name={icon} />
            </span>
          </div>
          <strong>{value}</strong>
          <small>{description}</small>
        </div>
      ))}
    </div>
  );
}
