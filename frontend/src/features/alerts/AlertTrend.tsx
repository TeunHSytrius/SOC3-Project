import { useState } from 'react';
import type { Alert, Priority } from '../../types/soc';
import { Panel } from '../../components/Ui';
import { labels, priorities } from '../../types/domain';

type Period = '24h' | '7d';
type Bucket = { start: number; end: number; label: string; counts: Record<Priority, number> };
function makeBuckets(period: Period, alerts: Alert[]): Bucket[] {
  const now = new Date(),
    bucketCount = period === '24h' ? 12 : 7;
  const buckets: Bucket[] = [];
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start =
      period === '24h'
        ? new Date(now.getTime() - (bucketCount - bucketIndex) * 7200000)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (bucketCount - 1 - bucketIndex));
    const end =
      period === '24h'
        ? new Date(start.getTime() + 7200000)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    buckets.push({
      start: start.getTime(),
      end: bucketIndex === bucketCount - 1 ? now.getTime() + 1 : end.getTime(),
      label:
        period === '24h'
          ? start.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
          : start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      counts: { Low: 0, Moderate: 0, High: 0, Urgent: 0, Immediate: 0 },
    });
  }
  for (const alert of alerts) {
    const time = Date.parse(alert.createdAt);
    const bucket = buckets.find((bucket) => time >= bucket.start && time < bucket.end);
    if (bucket) bucket.counts[alert.priority]++;
  }
  return buckets;
}
const total = (bucket: Bucket) => Object.values(bucket.counts).reduce((sum, alertCount) => sum + alertCount, 0);
export default function AlertTrend({ alerts }: { alerts: Alert[] }) {
  const [period, setPeriod] = useState<Period>('7d');
  const buckets = makeBuckets(period, alerts);
  const count = buckets.reduce((sum, bucket) => sum + total(bucket), 0),
    peak = Math.max(0, ...buckets.map(total));
  const step = Math.max(1, Math.ceil(peak / 4)),
    maximum = step * 4;
  const simulated = alerts.filter(
    (alert) =>
      alert.security?.simulated &&
      buckets.some((bucket) => Date.parse(alert.createdAt) >= bucket.start && Date.parse(alert.createdAt) < bucket.end),
  ).length;
  return (
    <Panel
      title="Alertvolume in de tijd"
      sub="Ontvangen meldingen per prioriteit, alle statussen en geselecteerde klantcontext."
      action={
        <div className="trend-period">
          <button aria-pressed={period === '24h'} onClick={() => setPeriod('24h')}>
            24 uur
          </button>
          <button aria-pressed={period === '7d'} onClick={() => setPeriod('7d')}>
            7 dagen
          </button>
        </div>
      }
    >
      <div className="trend-body">
        <div className="trend-summary">
          <div>
            <small>Ontvangen alerts</small>
            <strong>{count}</strong>
          </div>
          <div>
            <small>Piek per {period === '24h' ? '2 uur' : 'dag'}</small>
            <strong>{peak}</strong>
          </div>
          <div>
            <small>Waarvan simulaties</small>
            <strong>{simulated}</strong>
          </div>
        </div>
        <div className="trend-scroll">
          <div
            className="trend-chart"
            role="img"
            aria-label={count + ' ontvangen alerts; piek ' + peak}
          >
            <div className="trend-y">
              {[4, 3, 2, 1, 0].map((tick) => (
                <span key={tick}>{tick * step}</span>
              ))}
            </div>
            <div className="trend-plot">
              <div className="trend-lines">
                {[4, 3, 2, 1, 0].map((tick) => (
                  <span key={tick} />
                ))}
              </div>
              <div
                className="trend-columns"
                style={{ gridTemplateColumns: 'repeat(' + buckets.length + ',minmax(0,1fr))' }}
              >
                {buckets.map((bucket) => (
                  <div
                    key={bucket.start}
                    className="trend-column"
                    title={
                      bucket.label +
                      ' — ' +
                      priorities.map((priority) => labels[priority] + ': ' + bucket.counts[priority]).join(', ')
                    }
                  >
                    <div
                      className="trend-stack"
                      style={{ height: (total(bucket) / maximum) * 100 + '%' }}
                    >
                      {priorities.map(
                        (priority) =>
                          bucket.counts[priority] > 0 && (
                            <div
                              key={priority}
                              className={'trend-segment trend-' + priority}
                              style={{ flex: bucket.counts[priority] }}
                            />
                          ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="trend-x"
              style={{ gridTemplateColumns: 'repeat(' + buckets.length + ',minmax(0,1fr))' }}
            >
              {buckets.map((bucket) => (
                <span key={bucket.start}>{bucket.label}</span>
              ))}
            </div>
          </div>
        </div>
        {!count && <p>Geen alerts ontvangen in deze periode.</p>}
        <div className="trend-legend">
          {priorities.map((priority) => (
            <span key={priority}>
              <i className={'trend-' + priority} />
              {labels[priority]}
            </span>
          ))}
        </div>
        <details>
          <summary>Exacte aantallen per periode</summary>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Vanaf</th>
                  {priorities.map((priority) => (
                    <th key={priority}>{labels[priority]}</th>
                  ))}
                  <th>Totaal</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.start}>
                    <td>{bucket.label}</td>
                    {priorities.map((priority) => (
                      <td key={priority}>{bucket.counts[priority]}</td>
                    ))}
                    <td>{total(bucket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </Panel>
  );
}
