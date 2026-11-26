import { Field } from '../../components/Ui';
import { labels, nextCaseStates, priorities } from '../../types/domain';
import { text, area, choose, check } from '../shared/dialogFields';
import type { DialogDefinition, DialogProps } from '../shared/dialogTypes';

export function getCaseDialog({ state: currentState, run }: DialogProps): DialogDefinition | null {
  const ticket = currentState.cases.find((item) => item.id === currentState.selected);
  if (!ticket) return null;
  let title: string;
  let fields: DialogDefinition['fields'];
  let submit: DialogDefinition['submit'];

  switch (currentState.modal) {
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
      title = 'Ticket heropenen';
      fields = area('reason', 'Reden');
      submit = (values) =>
        run(
          `cases/${ticket.id}/status`,
          { ...values, status: 'UnderInvestigation' },
          'Ticket heropend.',
        );
      break;
    case 'caseStatus':
      title = 'Ticketstatus wijzigen';
      fields = (
        <div className="fragment">
          {choose('status', 'Nieuwe status', nextCaseStates(ticket.status))}
          {area('summary', 'Samenvatting (verplicht bij afsluiten)', false)}
          {area('conclusion', 'Conclusie (verplicht bij afsluiten)', false)}
        </div>
      );
      submit = (values) => run(`cases/${ticket.id}/status`, values, 'Ticketstatus gewijzigd.');
      break;
    case 'owner':
      title = ticket.status === 'Open' ? 'Prioriteren en toewijzen' : 'Ticket overdragen';
      fields = (
        <div className="fragment">
          {choose(
            'userId',
            'Nieuwe eigenaar',
            currentState.analysts.filter(
              (analyst) =>
                analyst.organizationIds.includes(ticket.organizationId) &&
                (ticket.status === 'Open' || analyst.id !== ticket.ownerId),
            ),
          )}
          {currentState.user.role === 'Senior analist' && (
            <Field label="Prioriteit">
              <select name="priority" defaultValue={ticket.priority}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {labels[priority]}
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
          ticket.status === 'Open' ? 'Ticket toegewezen.' : 'Ticket overgedragen.',
        );
      break;
    default:
      return null;
  }

  return { title, fields, submit };
}
