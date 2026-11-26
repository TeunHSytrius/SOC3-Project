import type { State } from '../../types/soc';
import { Button, Field, Select } from '../../components/Ui';
import { priorities, states, caseStates, caseMatchesView } from '../../types/domain';
import type { UpdateState } from '../../types/workspace';

interface QueueFiltersProps {
  type: 'alerts' | 'cases';
  state: State;
  canReadInternal: boolean;
  isAnalyst: boolean;
  update: UpdateState;
}

export default function QueueFilters({
  type,
  state,
  canReadInternal,
  isAnalyst,
  update,
}: QueueFiltersProps) {
  const filters = state;
  const isAlerts = type === 'alerts';
  const items = (isAlerts ? filters.alerts : filters.cases).filter(
    (item) => !filters.org || item.organizationId === filters.org,
  );
  const visibleStatuses = isAlerts
    ? states.filter(
        (status) =>
          filters.archiveFilter === 'all' ||
          (filters.archiveFilter === 'open'
            ? ['New', 'PendingReview', 'UnderReview'].includes(status)
            : filters.archiveFilter === 'linked'
              ? status === 'Escalated'
              : ['Dismissed', 'Resolved'].includes(status)),
      )
    : caseStates.filter((status) => caseMatchesView({ status }, filters.archiveFilter));
  const alerts = filters.alerts.filter((alert) => !filters.org || alert.organizationId === filters.org);
  const categories = [
    ...new Set(alerts.map((alert) => alert.security?.category || 'Niet geclassificeerd')),
  ].sort();
  const sources = [...new Set(alerts.map((alert) => alert.source))].sort();
  const owners = [...new Set(items.map((item) => item.owner).filter(Boolean))].sort();
  const advancedActive = !!(
    filters.filter ||
    filters.ownerFilter ||
    filters.slaFilter ||
    filters.category ||
    filters.sourceFilter ||
    filters.fromDate ||
    filters.toDate
  );
  return (
    <div className="queue-filters compact-filters">
      <div className="compact-filter-main">
        <Field label="Zoeken">
          <input
            placeholder={
              isAlerts
                ? 'Alertnummer, titel, IP of hostname'
                : 'Ticketnummer, titel, notitie of observable'
            }
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </Field>
        <Field label="Prioriteit">
          <Select
            options={priorities}
            value={filters.priority}
            placeholder="Alle prioriteiten"
            onChange={(event) => update({ priority: event.target.value })}
          />
        </Field>
        <Field label="Sorteren">
          <Select
            options={[
              {
                id: 'default',
                name:
                  isAlerts && filters.archiveFilter === 'open'
                    ? 'Oudste eerst (FIFO)'
                    : filters.archiveFilter === 'closed' && !isAlerts
                      ? 'Laatst afgesloten eerst'
                      : 'Nieuwste eerst',
              },
              { id: 'oldest', name: 'Oudste aangemaakt eerst' },
              { id: 'newest', name: 'Nieuwste aangemaakt eerst' },
              { id: 'priority', name: 'Hoogste prioriteit eerst' },
            ]}
            value={filters.listSort}
            onChange={(event) => update({ listSort: event.target.value as State['listSort'] })}
          />
        </Field>
        <Button
          onClick={() =>
            update({
              search: '',
              filter: '',
              priority: '',
              category: '',
              fromDate: '',
              toDate: '',
              mine: false,
              listSort: 'default',
              ownerFilter: '',
              slaFilter: '',
              sourceFilter: '',
            })
          }
        >
          Filters wissen
        </Button>
      </div>
      {isAnalyst && (
        <label className="check">
          <input
            type="checkbox"
            checked={filters.mine}
            onChange={(event) => update({ mine: event.target.checked })}
          />{' '}
          Alleen mijn {isAlerts ? 'alerts' : 'tickets'}
        </label>
      )}
      <details className="advanced-filters" key={type}>
        <summary>Meer filters{advancedActive ? ' (actief)' : ''}</summary>
        <div className="queue-filter-grid">
          <Field label="Klantorganisatie">
            <Select
              options={filters.orgs.map((organization) => ({
                id: organization.id,
                name: organization.name + (organization.isActive ? '' : ' (inactief)'),
              }))}
              value={filters.org}
              placeholder="Alle klanten"
              onChange={(event) =>
                update({ org: event.target.value, ownerFilter: '', sourceFilter: '', category: '' })
              }
            />
          </Field>
          <Field label="Status">
            <Select
              options={visibleStatuses}
              value={filters.filter}
              placeholder="Alle statussen in deze selectie"
              onChange={(event) => update({ filter: event.target.value })}
            />
          </Field>
          {canReadInternal && (
            <Field label="Eigenaar">
              <Select
                options={[
                  { id: 'unassigned', name: 'Niet toegewezen' },
                  ...owners.map((owner) => ({ id: owner, name: owner })),
                ]}
                value={filters.ownerFilter}
                placeholder="Alle eigenaren"
                onChange={(event) => update({ ownerFilter: event.target.value })}
              />
            </Field>
          )}
          {isAlerts && (
            <>
              <Field label="SLA">
                <Select
                  options={[
                    { id: 'neutral', name: 'Nog niet behandeld' },
                    { id: 'warn', name: 'Bijna overschreden' },
                    { id: 'danger', name: 'Overschreden' },
                    { id: 'good', name: 'Binnen SLA' },
                  ]}
                  value={filters.slaFilter}
                  placeholder="Alle SLA-statussen"
                  onChange={(event) => update({ slaFilter: event.target.value })}
                />
              </Field>
              <Field label="Categorie">
                <Select
                  options={categories}
                  value={filters.category}
                  placeholder="Alle categorieën"
                  onChange={(event) => update({ category: event.target.value })}
                />
              </Field>
              <Field label="Securitytool">
                <Select
                  options={sources}
                  value={filters.sourceFilter}
                  placeholder="Alle bronnen"
                  onChange={(event) => update({ sourceFilter: event.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Aangemaakt vanaf">
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => update({ fromDate: event.target.value })}
            />
          </Field>
          <Field label="Aangemaakt t/m">
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => update({ toDate: event.target.value })}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
