import type { State } from '../../types/soc';
import type { WorkspaceActions } from '../../types/workspace';

interface PageProps extends WorkspaceActions {
  state: State;
}
import { Badge, Button, Field, Icon, Panel, PageHeader, Select, Table } from '../../components/Ui';
import { active, alertGroup, caseMatchesView, fmt, isClosed, labels, nextCaseStates, priorities, roles, sla, sortRecords } from '../../types/domain';
import type { ReactNode } from 'react';
import { formData } from './formData';

export default function ActionDialog({ state, update, navigate, customerName, run, isAnalyst, canReadInternal, isAdmin }: PageProps) {
    const currentState = state,
      alert = currentState.alerts.find((x) => x.id === currentState.selected),
      ticket = currentState.cases.find((x) => x.id === currentState.selected),
      account = currentState.users.find((x) => x.id === currentState.selected);
    let title: string;
    let fields: ReactNode;
    let submit: (values: Record<string, string>) => void;
    const text = (name: string, label: string, required = true, value?: string) => (
      <Field label={label}>
        <input name={name} required={required} defaultValue={value} />
      </Field>
    );
    const area = (name: string, label: string, required = true) => (
      <Field label={label}>
        <textarea name={name} required={required} rows={4} />
      </Field>
    );
    const choose = (name: string, label: string, options: (string | { id: string; name: string })[], placeholder = 'Maak een keuze') => (
      <Field label={label}>
        <Select name={name} options={options} placeholder={placeholder} required />
      </Field>
    );
    const check = (name: string, label: string) => (
      <label className="check">
        <input name={name} type="checkbox" />
        {label}
      </label>
    );
    switch (currentState.modal) {
      case 'newAlert':
        title = 'Nieuwe alert';
        fields = (
          <div className="fragment">
            {choose(
              'organizationId',
              'Klant',
              currentState.orgs.filter((o) => o.isActive),
            )}
            {text('title', 'Titel')}
            {text('source', 'Bron / securitytool')}
            {choose('priority', 'Prioriteit', priorities)}
            {area('description', 'Beschrijving')}
          </div>
        );
        submit = (values) => run('alerts', values, 'Alert ontvangen.', (x) => navigate('alerts', x.id));
        break;
      case 'triage':
        title = 'Triage vastleggen';
        fields = (
          <div className="fragment">
            {choose('outcome', 'Uitkomst', [
              'False positive',
              'Verwacht gedrag',
              'Nader onderzoek',
              'Bevestigd incident',
            ])}
            {area('reason', 'Motivatie')}
          </div>
        );
        submit = (values) => run(`alerts/${alert.id}/triage`, values, 'Triage opgeslagen.');
        break;
      case 'caseFromAlert':
        title = 'Case maken of koppelen';
        fields = (
          <div className="fragment">
            {text('title', 'Titel voor een nieuwe case', false, alert.title)}
            <Field label="Of koppel aan een bestaande case">
              <Select
                name="caseId"
                options={currentState.cases
                  .filter(
                    (c) =>
                      c.organizationId === alert.organizationId &&
                      c.scopeId === alert.scopeId &&
                      !isClosed(c),
                  )
                  .map((c) => ({ id: c.id, name: c.number + ' · ' + c.title }))}
                placeholder="Nieuwe case maken"
              />
            </Field>
          </div>
        );
        submit = (values) =>
          run(`alerts/${alert.id}/case`, values, 'Alert gekoppeld.', (x) => navigate('cases', x.caseId));
        break;
      case 'reopen':
        title = 'Alert heropenen';
        fields = area('reason', 'Reden');
        submit = (values) => run(`alerts/${alert.id}/reopen`, values, 'Alert heropend.');
        break;
      case 'entry':
        title = 'Klantreactie toevoegen — ' + ticket.number;
        fields = area('text', 'Reactie');
        submit = (values) => run(`cases/${ticket.id}/entry`, values, 'Reactie opgeslagen.');
        break;
      case 'note':
      case 'actionEntry':
      case 'evidenceRef': {
        const kind =
          currentState.modal === 'note' ? 'Notitie' : currentState.modal === 'actionEntry' ? 'Actie' : 'Bewijsreferentie';
        title = kind + ' toevoegen — ' + ticket.number;
        fields = (
          <div className="fragment">
            <Field
              label={
                kind === 'Bewijsreferentie'
                  ? 'Referentie naar logbestand, bewijs-ID of locatie'
                  : 'Inhoud'
              }
            >
              <textarea name="text" rows={5} maxLength={2000} required />
            </Field>
            {kind === 'Bewijsreferentie' ? (
              <p>
                Voeg een referentie toe, geen geheim of bestand. Bestandsupload is nog niet
                geïmplementeerd.
              </p>
            ) : (
              check('visible', 'Vrijgeven aan klant (standaard intern)')
            )}
          </div>
        );
        submit = (values) =>
          run(
            `cases/${ticket.id}/entry`,
            { kind, text: values.text, visible: kind !== 'Bewijsreferentie' && values.visible === 'on' },
            kind + ' opgeslagen.',
          );
        break;
      }
      case 'observable':
        title = 'Observable toevoegen — ' + ticket.number;
        fields = (
          <div className="fragment">
            {choose('type', 'Type', ['IP', 'Domain', 'URL', 'Email', 'Hash'])}
            {text('text', 'Waarde')}
            {choose('assessment', 'Beoordeling', ['Verdacht', 'Kwaadaardig', 'Onschuldig'])}
            <p>Observables zijn altijd intern.</p>
          </div>
        );
        submit = (values) =>
          run(
            `cases/${ticket.id}/entry`,
            { ...values, kind: 'Observable', visible: false },
            'Observable opgeslagen.',
          );
        break;
      case 'caseReopen':
        title = 'Case heropenen';
        fields = area('reason', 'Reden');
        submit = (values) =>
          run(
            `cases/${ticket.id}/status`,
            { ...values, status: 'UnderInvestigation' },
            'Case heropend.',
          );
        break;
      case 'caseStatus':
        title = 'Casestatus wijzigen';
        fields = (
          <div className="fragment">
            {choose('status', 'Nieuwe status', nextCaseStates(ticket.status))}
            {area('summary', 'Samenvatting (verplicht bij afsluiten)', false)}
            {area('conclusion', 'Conclusie (verplicht bij afsluiten)', false)}
          </div>
        );
        submit = (values) => run(`cases/${ticket.id}/status`, values, 'Casestatus gewijzigd.');
        break;
      case 'owner':
        title = ticket.status === 'Open' ? 'Prioriteren en toewijzen' : 'Case overdragen';
        fields = (
          <div className="fragment">
            {choose(
              'userId',
              'Nieuwe eigenaar',
              currentState.analysts.filter(
                (x) =>
                  x.organizationIds.includes(ticket.organizationId) &&
                  (ticket.status === 'Open' || x.id !== ticket.ownerId),
              ),
            )}
            {currentState.user.role === 'Senior analist' && (
              <Field label="Prioriteit">
                <select name="priority" defaultValue={ticket.priority}>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {labels[p]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {area('reason', 'Toelichting en aandachtspunten')}
            {area('nextAction', 'Volgende actie')}
          </div>
        );
        submit = (values) =>
          run(
            `cases/${ticket.id}/owner`,
            values,
            ticket.status === 'Open' ? 'Case toegewezen.' : 'Case overgedragen.',
          );
        break;
      case 'customer':
      case 'customerEdit': {
        const editing = currentState.modal === 'customerEdit';
        const org = currentState.orgs.find((o) => o.id === currentState.selected);
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
                {roles.map((x) => (
                  <option key={x}>{x}</option>
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
              {currentState.orgs.map((o) => (
                <label className="check" key={o.id}>
                  <input
                    type="checkbox"
                    name={'org_' + o.id}
                    defaultChecked={editing && account.organizationIds.includes(o.id)}
                  />
                  {o.name}
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
              .filter((k) => k.startsWith('org_'))
              .map((k) => k.slice(4)),
          };
          Object.keys(payload)
            .filter((k) => k.startsWith('org_'))
            .forEach((k) => delete payload[k]);
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
              currentState.orgs.filter((o) => o.isActive),
            )}
            {text('name', 'Naam van securitytool')}
          </div>
        );
        submit = (values) =>
          run('keys', values, 'API-sleutel aangemaakt.', (x) =>
            update({ secret: x.secret }),
          );
        break;
      default:
        return null;
    }
    return (
      <div
        className="overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && !currentState.busy) update({ modal: null });
        }}
      >
        <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
          <div className="dialoghead">
            <h2>{title}</h2>
            <button aria-label="Sluiten" onClick={() => update({ modal: null })}>
              ×
            </button>
          </div>
          {currentState.error && (
            <div className="error" role="alert">
              {currentState.error}
            </div>
          )}
          <form onSubmit={(e) => submit(formData(e))}>
            {fields}
            <div className="actions">
              <Button onClick={() => update({ modal: null, error: '' })}>Annuleren</Button>
              <Button primary type="submit" disabled={currentState.busy}>
                {currentState.busy ? 'Opslaan…' : 'Opslaan'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    );
  
}
