import type { State, Alert, ResearchCase } from '../../types/soc';
import { Icon, Badge, Button, Field, Select, Table, Panel, PageHeader } from '../../components/Ui';
import {
  labels,
  priorities,
  states,
  caseStates,
  active,
  isClosed,
  fmt,
  sla,
  caseMatchesView,
  sortRecords,
  nextCaseStates,
  roles,
} from '../../types/domain';
import { priorityColor } from '../alerts/AlertCards';
import CaseWorkflow from './CaseWorkflow';
import type { Navigate, UpdateState, RunAction } from '../../types/workspace';
interface CaseDetailProps {
  ticket: ResearchCase;
  state: Pick<State, 'user' | 'alerts'>;
  isAdmin: boolean;
  isAnalyst: boolean;
  canReadInternal: boolean;
  customerName: (id: string) => string;
  navigate: Navigate;
  run: RunAction;
  update: UpdateState;
}

// Keep user identifiers in the saved audit history, but omit them from the readable handover.
function formatTransfer(text: string): string {
  const userId = '\\([0-9a-f-]{36}\\)';
  const handover = new RegExp('^(Van .+?) ' + userId + ' (naar .+?) ' + userId, 'i');
  return text.replace(handover, '$1 $2');
}

export default function CaseDetailPage({
  ticket,
  state,
  isAdmin,
  isAnalyst,
  canReadInternal,
  customerName,
  navigate,
  run,
  update,
}: CaseDetailProps) {
  const senior = state.user.role === 'Senior analist';
  const canEdit = isAnalyst && (senior || ticket.ownerId === state.user.id);
  return (
    <div className="fragment">
      <button className="back" onClick={() => navigate('cases')}>
        ← Terug naar tickets
      </button>
      <PageHeader
        title="Ticketdetails"
        sub={
          isAdmin
            ? 'Beheerder · volledig dossier, alleen lezen'
            : 'Ticketgegevens en onderzoekstijdlijn'
        }
      />
      <div className={'wire-banner case-banner ' + priorityColor(ticket.priority)}>
        <div>
          <small>
            {ticket.number} · {customerName(ticket.organizationId)}
          </small>
          <h2>{ticket.title}</h2>
        </div>
        <div>
          <Badge value={ticket.status} />
          <p>Eigenaar: {ticket.owner}</p>
        </div>
      </div>
      {canReadInternal && <CaseWorkflow research={ticket} />}
      <div className="detailgrid">
        <Panel title="Ticketgegevens">
          <div className="bodypad">
            <dl>
              <dt>Prioriteit</dt>
              <dd>
                <Badge value={ticket.priority} />
              </dd>
              <dt>Eigenaar</dt>
              <dd>{ticket.owner}</dd>
              <dt>Aangemaakt</dt>
              <dd>{fmt(ticket.createdAt)}</dd>
              <dt>Afgesloten</dt>
              <dd>{fmt(ticket.closedAt)}</dd>
              {canReadInternal && (
                <div className="fragment">
                  <dt>Klantzichtbaar</dt>
                  <dd>{ticket.customerVisible ? 'Ja' : 'Nee'}</dd>
                  <dt>Gekoppelde alerts</dt>
                  <dd>
                    {ticket.alertIds.map((id) => {
                      const linkedAlert = state.alerts.find((alert) => alert.id === id);
                      return (
                        <div key={id}>
                          <button className="rowlink" onClick={() => navigate('alerts', id)}>
                            {linkedAlert?.number} · {linkedAlert?.title}
                          </button>
                        </div>
                      );
                    })}
                  </dd>
                  <dt>Observables</dt>
                  <dd>
                    {ticket.entries
                      .filter((entry) => entry.kind === 'Observable')
                      .map((entry) => (
                        <div className="wire-observable" key={entry.id}>
                          {entry.text}
                        </div>
                      ))}
                    {!ticket.entries.some((entry) => entry.kind === 'Observable') && '—'}
                  </dd>
                  <dt>Samenvatting</dt>
                  <dd>{ticket.summary || '—'}</dd>
                  <dt>Conclusie</dt>
                  <dd>{ticket.conclusion || '—'}</dd>
                </div>
              )}
            </dl>
            {state.user.role === 'Senior analist' && isClosed(ticket) && (
              <Button onClick={() => update({ modal: 'caseReopen' })}>Case heropenen</Button>
            )}
            {canEdit && !isClosed(ticket) && (
              <div className="actions">
                {ticket.status !== 'Open' && (
                  <Button primary onClick={() => update({ modal: 'caseStatus' })}>
                    Status wijzigen
                  </Button>
                )}
                {(ticket.status !== 'Open' || senior) && (
                  <Button onClick={() => update({ modal: 'owner' })}>
                    {ticket.status === 'Open' ? 'Prioriteren en toewijzen' : 'Overdragen'}
                  </Button>
                )}
                {ticket.status === 'Open' && !senior && (
                  <small>Wacht op prioritering en toewijzing door senior.</small>
                )}
                <Button
                  onClick={() =>
                    run(
                      `cases/${ticket.id}/visibility`,
                      { visible: !ticket.customerVisible },
                      'Zichtbaarheid aangepast.',
                    )
                  }
                >
                  {ticket.customerVisible ? 'Verbergen voor klant' : 'Vrijgeven aan klant'}
                </Button>
              </div>
            )}
          </div>
        </Panel>
        <Panel
          title="Onderzoekstijdlijn"
          sub={ticket.number + ' · Notities, observables, acties en bewijsreferenties'}
          action={
            !isClosed(ticket) &&
            state.user.role === 'Klant' && (
              <Button primary onClick={() => update({ modal: 'entry', error: '' })}>
                Reageren
              </Button>
            )
          }
        >
          {canEdit && !isClosed(ticket) && (
            <div className="case-entry-actions">
              <Button primary onClick={() => update({ modal: 'note', error: '' })}>
                + Notitie
              </Button>
              <Button onClick={() => update({ modal: 'observable', error: '' })}>
                + Observable
              </Button>
              <Button onClick={() => update({ modal: 'actionEntry', error: '' })}>+ Actie</Button>
              <Button onClick={() => update({ modal: 'evidenceRef', error: '' })}>
                + Bewijsreferentie
              </Button>
            </div>
          )}
          <div className="timeline">
            {!ticket.entries.length && <p>Geen onderzoeksinformatie beschikbaar.</p>}
            {ticket.entries
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.id}>
                  <span className="timeline-dot" />
                  <strong>
                    {entry.kind}{' '}
                    {canReadInternal && (
                      <Badge
                        value={entry.visible ? 'Klantzichtbaar' : 'Intern'}
                        kind={entry.visible ? 'good' : 'neutral'}
                      />
                    )}
                  </strong>
                  <p>{entry.kind === 'Overdracht' ? formatTransfer(entry.text) : entry.text}</p>
                  <small>
                    {entry.actor} · {fmt(entry.at)}
                  </small>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
