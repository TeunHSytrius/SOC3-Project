import { Field, Select } from '../../components/Ui';
import { isClosed, labels, nextCaseStates, priorities, roles } from '../../types/domain';
import { text, area, choose, check } from '../shared/dialogFields';
import type { DialogDefinition, DialogProps } from '../shared/dialogTypes';

export function getAdminDialog({ state: currentState, run, update, navigate }: DialogProps): DialogDefinition | null {
  const account = currentState.users.find((item) => item.id === currentState.selected);
  let title: string;
  let fields: DialogDefinition['fields'];
  let submit: DialogDefinition['submit'];

  switch (currentState.modal) {
    case 'customer':
    case 'customerEdit': {
      const editing = currentState.modal === 'customerEdit';
      const org = currentState.orgs.find((organization) => organization.id === currentState.selected);
      if (editing && !org) return null;
      title = editing ? 'Klant bewerken' : 'Klant toevoegen';
      fields = (
        <div className="fragment">
          {text('name', 'Organisatienaam', true, editing ? org.name : '')}
          <Field label="Reactie-SLA (minuten)">
            <input
              type="number"
              name="responseMinutes"
              min={1}
              max={10080}
              step={1}
              required
              defaultValue={editing ? org.responseMinutes : 60}
            />
          </Field>
          <small>Geldt voor nieuwe alerts. Bestaande deadlines blijven behouden.</small>
        </div>
      );
      submit = (values) =>
        run(
          editing ? `organizations/${org.id}` : 'organizations',
          { ...values, responseMinutes: Number(values.responseMinutes) },
          editing ? 'Klantinstellingen gewijzigd.' : 'Klant aangemaakt.',
        );
      break;
    }
    case 'user':
    case 'userAccess': {
      const editing = currentState.modal === 'userAccess';
      if (editing && !account) return null;
      title = editing ? 'Gebruiker bewerken' : 'Gebruiker toevoegen';
      fields = (
        <div className="fragment">
          {text('name', 'Volledige naam', true, editing ? account.name : '')}
          <Field label="E-mailadres">
            <input name="email" type="email" required defaultValue={editing ? account.email : ''} />
          </Field>
          <Field
            label={editing ? 'Nieuw wachtwoord (optioneel)' : 'Wachtwoord (minimaal 8 tekens)'}
          >
            <input
              name="password"
              type="password"
              minLength={8}
              required={!editing}
              autoComplete="new-password"
            />
          </Field>
          {editing && (
            <small>
              Laat leeg om het bestaande wachtwoord te behouden. Een nieuw wachtwoord vereist
              hoofdletter, kleine letter, cijfer en speciaal teken.
            </small>
          )}
          <Field label="Rol">
            <select name="role" defaultValue={editing ? account.role : 'Analist'}>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </Field>
          {editing && (
            <Field label="Accountstatus">
              <select name="isActive" defaultValue={account.isActive ? 'true' : 'false'}>
                <option value="true">Actief</option>
                <option value="false">Inactief</option>
              </select>
            </Field>
          )}
          <fieldset>
            <legend>Klanttoegang</legend>
            {currentState.orgs.map((organization) => (
              <label className="check" key={organization.id}>
                <input
                  type="checkbox"
                  name={'org_' + organization.id}
                  defaultChecked={editing && account.organizationIds.includes(organization.id)}
                />
                {organization.name}
              </label>
            ))}
          </fieldset>
          {editing && (
            <small>
              Een inactief account kan niet inloggen. Historische gegevens blijven behouden.
            </small>
          )}
        </div>
      );
      submit = (values) => {
        const payload: Record<string, unknown> = {
          ...values,
          organizationIds: Object.keys(values)
            .filter((fieldName) => fieldName.startsWith('org_'))
            .map((fieldName) => fieldName.slice(4)),
        };
        Object.keys(payload)
          .filter((fieldName) => fieldName.startsWith('org_'))
          .forEach((fieldName) => delete payload[fieldName]);
        if (editing) payload.isActive = values.isActive === 'true';
        run(editing ? `users/${account.id}` : 'users', payload, 'Gebruikersgegevens opgeslagen.');
      };
      break;
    }
    case 'key':
      title = 'API-sleutel genereren';
      fields = (
        <div className="fragment">
          {choose(
            'organizationId',
            'Klant',
            currentState.orgs.filter((organization) => organization.isActive),
          )}
          {text('name', 'Naam van securitytool')}
        </div>
      );
      submit = (values) =>
        run('keys', values, 'API-sleutel aangemaakt.', (result) => update({ secret: result.secret }),
        );
      break;
    default:
      return null;
  }

  return { title, fields, submit };
}
