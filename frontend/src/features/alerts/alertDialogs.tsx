import { Field, Select } from '../../components/Ui';
import { isClosed, priorities } from '../../types/domain';
import { text, area, choose } from '../shared/dialogFields';
import type { DialogDefinition, DialogProps } from '../shared/dialogTypes';

export function getAlertDialog({ state: currentState, run, navigate }: DialogProps): DialogDefinition | null {
  const alert = currentState.alerts.find((item) => item.id === currentState.selected);
  if (currentState.modal !== 'newAlert' && !alert) return null;
  let title: string;
  let fields: DialogDefinition['fields'];
  let submit: DialogDefinition['submit'];

  switch (currentState.modal) {
    case 'newAlert':
      title = 'Nieuwe alert';
      fields = (
        <div className="fragment">
          {choose(
            'organizationId',
            'Klant',
            currentState.orgs.filter((organization) => organization.isActive),
          )}
          {text('title', 'Titel')}
          {text('source', 'Bron / securitytool')}
          {choose('priority', 'Prioriteit', priorities)}
          {area('description', 'Beschrijving')}
        </div>
      );
      submit = (values) => run('alerts', values, 'Alert ontvangen.', (result) => navigate('alerts', result.id));
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
      title = 'Ticket maken of koppelen';
      fields = (
        <div className="fragment">
          {text('title', 'Titel voor een nieuw ticket', false, alert.title)}
          <Field label="Of koppel aan een bestaand ticket">
            <Select
              name="caseId"
              options={currentState.cases
                .filter(
                  (researchCase) =>
                    researchCase.organizationId === alert.organizationId &&
                    researchCase.scopeId === alert.scopeId &&
                    !isClosed(researchCase),
                )
                .map((researchCase) => ({ id: researchCase.id, name: researchCase.number + ' · ' + researchCase.title }))}
              placeholder="Nieuw ticket maken"
            />
          </Field>
        </div>
      );
      submit = (values) =>
        run(`alerts/${alert.id}/case`, values, 'Alert gekoppeld.', (result) => navigate('cases', result.caseId));
      break;
    case 'reopen':
      title = 'Alert heropenen';
      fields = area('reason', 'Reden');
      submit = (values) => run(`alerts/${alert.id}/reopen`, values, 'Alert heropend.');
      break;
    default:
      return null;
  }

  return { title, fields, submit };
}
