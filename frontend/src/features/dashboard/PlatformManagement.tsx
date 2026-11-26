import { Button, Icon } from '../../components/Ui';
import type { State } from '../../types/soc';
import type { Navigate } from '../../types/workspace';

interface PlatformManagementProps {
  state: Pick<State, 'orgs' | 'users' | 'keys' | 'errors'>;
  navigate: Navigate;
}

export default function PlatformManagement({ state, navigate }: PlatformManagementProps) {
  const { orgs, users, keys, errors } = state;
  return (
    <section className="dashboard-management" aria-label="Platformbeheer">
      <h2>Platformbeheer</h2>
      <div className="dashboard-management-grid">
        {[
          {
            page: 'customers',
            label: 'Klanten',
            value: orgs.filter((item) => item.isActive).length,
            detail: 'Actieve organisaties',
            icon: 'customers',
          },
          {
            page: 'users',
            label: 'Gebruikers',
            value: users.filter((item) => item.isActive).length,
            detail: 'Actieve accounts',
            icon: 'users',
          },
          {
            page: 'keys',
            label: 'API-sleutels',
            value: keys.filter((item) => item.isActive).length,
            detail: 'Actieve integraties',
            icon: 'keys',
          },
          {
            page: 'errors',
            label: 'Foutenlog',
            value: errors.length,
            detail: 'Sinds backendstart',
            icon: 'alerts',
          },
        ].map((item) => (
          <button
            type="button"
            className="dashboard-management-item"
            key={item.page}
            onClick={() => navigate(item.page)}
          >
            <Icon name={item.icon} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
            <b>{item.value}</b>
          </button>
        ))}
      </div>
      <Button onClick={() => navigate('audit')}>
        Auditlog bekijken <Icon name="arrow" size={16} />
      </Button>
    </section>
  );
}
