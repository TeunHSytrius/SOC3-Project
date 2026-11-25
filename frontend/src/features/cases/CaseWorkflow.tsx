import type {ResearchCase} from '../../types/soc';
import {Badge,Panel} from '../../components/Ui';

export default function CaseWorkflow({research}:{research:ResearchCase}){
  const stage=research.status==='Open'?2:research.status==='Closed'?5:
    ['Resolved','UnderReview'].includes(research.status)?4:3;
  const steps=[
    ['Ontvangst','Externe securitytool / intake'],
    ['Analyse en classificatie','Analist'],
    ['Prioritering en toewijzing','Senior analist'],
    ['Uitvoering','Toegewezen analist'],
    ['Validatie en afsluiting','Analist / senior']
  ];
  return <Panel title="Incidentworkflow" sub="Demo-indeling op basis van de vijf processtappen">
    <div className="bodypad">
      {steps.map(([name,role],index)=><p key={name}>
        <Badge value={index<stage?'Afgerond':index===stage?'Actief':'Gepland'} kind={index<stage?'good':index===stage?'blue':'neutral'}/>{' '}
        <strong>{index+1}. {name}</strong>{' — '}{role}
      </p>)}
    </div>
  </Panel>;
}
