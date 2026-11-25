import {useState} from 'react';
import type {Alert,Priority} from '../../types/soc';
import {Panel} from '../../components/Ui';
import {labels,priorities} from '../../types/domain';

type Period='24h'|'7d';
type Bucket={start:number;end:number;label:string;counts:Record<Priority,number>};
function makeBuckets(period:Period,alerts:Alert[]):Bucket[]{
  const now=new Date(), number=period==='24h'?12:7;
  const buckets:Bucket[]=[];
  for(let i=0;i<number;i++){
    const start=period==='24h'?new Date(now.getTime()-(number-i)*7200000):new Date(now.getFullYear(),now.getMonth(),now.getDate()-(number-1-i));
    const end=period==='24h'?new Date(start.getTime()+7200000):new Date(start.getFullYear(),start.getMonth(),start.getDate()+1);
    buckets.push({start:start.getTime(),end:i===number-1?now.getTime()+1:end.getTime(),label:period==='24h'?start.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):start.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}),counts:{Low:0,Moderate:0,High:0,Urgent:0,Immediate:0}});
  }
  for(const alert of alerts){
    const time=Date.parse(alert.createdAt);
    const bucket=buckets.find(b=>time>=b.start&&time<b.end);
    if(bucket)bucket.counts[alert.priority]++;
  }
  return buckets;
}
const total=(b:Bucket)=>Object.values(b.counts).reduce((sum,n)=>sum+n,0);
export default function AlertTrend({alerts}:{alerts:Alert[]}){
  const [period,setPeriod]=useState<Period>('7d');
  const buckets=makeBuckets(period,alerts);
  const count=buckets.reduce((sum,b)=>sum+total(b),0),peak=Math.max(0,...buckets.map(total));
  const step=Math.max(1,Math.ceil(peak/4)),maximum=step*4;
  const simulated=alerts.filter(a=>a.security?.simulated&&buckets.some(b=>Date.parse(a.createdAt)>=b.start&&Date.parse(a.createdAt)<b.end)).length;
  return <Panel title="Alertvolume in de tijd" sub="Ontvangen meldingen per prioriteit, alle statussen en geselecteerde klantcontext." action={<div className="trend-period"><button aria-pressed={period==='24h'} onClick={()=>setPeriod('24h')}>24 uur</button><button aria-pressed={period==='7d'} onClick={()=>setPeriod('7d')}>7 dagen</button></div>}>
    <div className="trend-body">
      <div className="trend-summary"><div><small>Ontvangen alerts</small><strong>{count}</strong></div><div><small>Piek per {period==='24h'?'2 uur':'dag'}</small><strong>{peak}</strong></div><div><small>Waarvan simulaties</small><strong>{simulated}</strong></div></div>
      <div className="trend-scroll"><div className="trend-chart" role="img" aria-label={count+' ontvangen alerts; piek '+peak}>
        <div className="trend-y">{[4,3,2,1,0].map(n=><span key={n}>{n*step}</span>)}</div>
        <div className="trend-plot"><div className="trend-lines">{[4,3,2,1,0].map(n=><span key={n}/>)}</div>
        <div className="trend-columns" style={{gridTemplateColumns:'repeat('+buckets.length+',minmax(0,1fr))'}}>{buckets.map(b=><div key={b.start} className="trend-column" title={b.label+' — '+priorities.map(p=>labels[p]+': '+b.counts[p]).join(', ')}><div className="trend-stack" style={{height:(total(b)/maximum*100)+'%'}}>{priorities.map(p=>b.counts[p]>0&&<div key={p} className={'trend-segment trend-'+p} style={{flex:b.counts[p]}}/>)}</div></div>)}</div></div>
        <div className="trend-x" style={{gridTemplateColumns:'repeat('+buckets.length+',minmax(0,1fr))'}}>{buckets.map(b=><span key={b.start}>{b.label}</span>)}</div>
      </div></div>
      {!count&&<p>Geen alerts ontvangen in deze periode.</p>}
      <div className="trend-legend">{priorities.map(p=><span key={p}><i className={'trend-'+p}/>{labels[p]}</span>)}</div>
      <details><summary>Exacte aantallen per periode</summary><div className="tablewrap"><table><thead><tr><th>Vanaf</th>{priorities.map(p=><th key={p}>{labels[p]}</th>)}<th>Totaal</th></tr></thead><tbody>{buckets.map(b=><tr key={b.start}><td>{b.label}</td>{priorities.map(p=><td key={p}>{b.counts[p]}</td>)}<td>{total(b)}</td></tr>)}</tbody></table></div></details>
    </div>
  </Panel>;
}
