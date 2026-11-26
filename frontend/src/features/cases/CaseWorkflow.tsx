import type { ResearchCase, CaseStatus } from '../../types/soc';
import { Icon, Panel } from '../../components/Ui';
import './CaseWorkflow.css';

const workflowSteps = [
  { title: 'Ontvangst', role: 'Externe securitytool / intake' },
  { title: 'Analyse', role: 'Analist' },
  { title: 'Toewijzing', role: 'Senior analist' },
  { title: 'Uitvoering', role: 'Toegewezen analist' },
  { title: 'Validatie en afsluiting', role: 'Analist / senior' },
];

function getActiveStep(status: CaseStatus): number {
  switch (status) {
    case 'Open':
      return 2;
    case 'Resolved':
    case 'UnderReview':
      return 4;
    case 'Closed':
      return workflowSteps.length;
    default:
      return 3;
  }
}

export default function CaseWorkflow({ research }: { research: ResearchCase }) {
  const activeStep = getActiveStep(research.status);
  const description = activeStep === workflowSteps.length
    ? 'Alle processtappen afgerond'
    : `Stap ${activeStep + 1} van ${workflowSteps.length}`;

  return (
    <Panel title="Incidentworkflow" sub={description}>
      <div className="workflow-owner">
        <span>Huidige verantwoordelijke</span>
        <strong>{research.owner || 'Niet toegewezen'}</strong>
      </div>
      <ol className="case-workflow" aria-label="Voortgang incidentworkflow">
        {workflowSteps.map((step, index) => {
          const completed = index < activeStep;
          const current = index === activeStep;
          const status = completed ? 'completed' : current ? 'current' : 'planned';

          return (
            <li key={step.title} className={'workflow-step ' + status} aria-current={current ? 'step' : undefined}>
              <span className="workflow-number" aria-hidden="true">
                {completed ? <Icon name="check" size={16} /> : index + 1}
              </span>
              <strong>{step.title}</strong>
              <span className="workflow-state">{completed ? 'Afgerond' : current ? 'Actief' : 'Gepland'}</span>
              {current && <small>{step.role}</small>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
