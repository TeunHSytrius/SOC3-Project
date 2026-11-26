import type { User } from '../../types/soc';
import { Badge, Panel, PageHeader } from '../../components/Ui';
import TwoFactorSetup from './TwoFactorSetup';

interface AccountPageProps {
  user: User;
  onTwoFactorEnabled: () => Promise<void>;
  onSessionExpired: (error: unknown) => void;
}

export default function AccountPage({
  user,
  onTwoFactorEnabled,
  onSessionExpired,
}: AccountPageProps) {
  return (
    <div className="fragment">
      <PageHeader title="Mijn account" sub="Accountgegevens en tweestapsverificatie." />
      <Panel title="Profiel">
        <div className="bodypad">
          {user.requiresTwoFactorSetup && (
            <p role="status">Deze rol vereist 2FA voordat klantgegevens toegankelijk zijn.</p>
          )}
          <dl>
            <dt>Naam</dt>
            <dd>{user.name}</dd>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Rol</dt>
            <dd>{user.role}</dd>
            <dt>2FA</dt>
            <dd>
              <Badge
                value={user.twoFactorEnabled ? 'Actief' : 'Niet actief'}
                kind={user.twoFactorEnabled ? 'good' : 'neutral'}
              />
            </dd>
          </dl>
          <TwoFactorSetup
            key={user.id}
            email={user.email}
            initiallyEnabled={user.twoFactorEnabled}
            onEnabled={onTwoFactorEnabled}
            onSessionExpired={onSessionExpired}
          />
        </div>
      </Panel>
    </div>
  );
}
