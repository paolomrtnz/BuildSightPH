import { useState } from 'react';
import { ApiContent, filtersFromForm, formatPercent, params, url, useApi } from './shared';

type Group = { material_group_id: number; name: string; first_month: string; last_month: string };
type Metadata = { groups: Group[]; series: { base_year: number; geographical_scope: string } | null };
type Observation = { month: string; index_value: number; yoy_pct: number | null };
type Series = { name: string; observations: Observation[] };

const monthFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const month = (value: string) => monthFormat.format(new Date(value));
const indexFormat = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const groupName = (name: string) => name === 'ALL ITEMS' ? 'All Items' : name;

function PriceChart({ rows }: { rows: Observation[] }) {
  const [cursor, setCursor] = useState(rows.length - 1);
  const [change, setChange] = useState(false);
  const values = rows.map(row => change ? row.yoy_pct : row.index_value);
  const available = values.filter((value): value is number => value !== null);
  const low = Math.min(...available);
  const high = Math.max(...available);
  const span = high - low || 1;
  const x = (i: number) => rows.length === 1 ? 336 : 62 + i * 548 / (rows.length - 1);
  const y = (value: number) => 202 - (value - low) * 162 / span;
  const line = values.map((value, i) => value === null ? ''
    : `${i === 0 || values[i - 1] === null ? 'M' : 'L'} ${x(i)} ${y(value)}`).join(' ');
  const selected = rows[cursor];
  const picked = values[cursor];

  return (
    <>
      <div className="section-heading">
        <div className="segmented" role="group" aria-label="Price chart metric">
          <button type="button" aria-pressed={!change} onClick={() => setChange(false)}>Monthly index</button>
          <button type="button" aria-pressed={change} onClick={() => setChange(true)}>Year-over-year change</button>
        </div>
      </div>
      {available.length === 0 ? <p className="muted">No prior-year observations are available for these months.</p> : (
        <svg className="price-chart" viewBox="0 0 640 245" role="img" aria-label={change ? 'Year-over-year change line chart' : 'Monthly index line chart'}>
          {(high === low ? [low] : [low, low + span / 2, high]).map(value => (
            <g key={value}>
              <line x1="62" x2="610" y1={y(value)} y2={y(value)} />
              <text x="54" y={y(value) + 5} textAnchor="end">{change ? formatPercent(value) : indexFormat.format(value)}</text>
            </g>
          ))}
          <path d={line} />
          {available.length === 1 && <circle cx={x(values.findIndex(value => value !== null))} cy={y(low)} r="5" />}
          {picked !== null && <circle cx={x(cursor)} cy={y(picked)} r="5" />}
          <text x="62" y="231">{month(rows[0].month)}</text>
          {rows.length > 1 && <text x="610" y="231" textAnchor="end">{month(rows.at(-1)!.month)}</text>}
        </svg>
      )}
      <p className="muted chart-period">{month(rows[0].month)} · {month(rows.at(-1)!.month)}</p>
      <label className="month-slider">Inspect month
        <input type="range" min={0} max={rows.length - 1} value={cursor} disabled={rows.length === 1}
          aria-valuetext={month(selected.month)} onChange={event => setCursor(Number(event.target.value))} />
      </label>
      <p className="muted" aria-live="polite">{month(selected.month)} · Index {indexFormat.format(selected.index_value)} · Year-over-year {formatPercent(selected.yoy_pct)}</p>
    </>
  );
}

export function MaterialPrices() {
  const metadata = useApi<Metadata>('/api/material-prices/groups');
  const group = params.get('group_id') ?? '1';
  const start = params.get('start');
  const end = params.get('end');
  const path = url('/api/material-prices', { group_id: group, start, end });
  const data = useApi<Series>(path);
  return (
    <>
      <div><h1>Material prices</h1><p className="intro">PSA Construction Materials Retail Price Index · National Capital Region only</p></div>
      <section className="panel">
        <h2>Choose a series and date range</h2>
        <ApiContent request={metadata}>{result => (
          <>
            <form className="filters" action="/material-prices" onSubmit={filtersFromForm}>
              <label>Material group<select name="group_id" defaultValue={group}>
                {result.groups.map(item => <option key={item.material_group_id} value={item.material_group_id}>{groupName(item.name)}</option>)}
              </select></label>
              <label>From month<input name="start" type="month" defaultValue={start ?? ''} /></label>
              <label>Through month<input name="end" type="month" defaultValue={end ?? ''} /></label>
              <div className="filter-actions"><button type="submit">Apply dates and group</button> <a href="/material-prices">Reset</a></div>
            </form>
            <p className="muted">Base year {result.series?.base_year ?? 'unavailable'}. The index tracks relative changes in NCR retail construction material prices. The data contain no peso prices or project procurement costs.</p>
          </>
        )}</ApiContent>
      </section>
      <section className="panel">
        <h2>Historical monthly observations</h2>
        <ApiContent request={data}>{result => (
          result.observations.length === 0 ? <p className="muted">No observations in this date range.</p> : (
            <>
              <h3>{groupName(result.name)}</h3>
              <PriceChart key={path} rows={result.observations} />
              <details>
                <summary>View {result.observations.length} monthly values</summary>
                <div className="table-wrap" tabIndex={0} role="region" aria-label="Monthly index observations">
                  <table className="compact-table">
                    <thead><tr><th>Month</th><th>Index</th><th>Year-over-year change</th></tr></thead>
                    <tbody>{result.observations.map(row => (
                      <tr key={row.month}><th scope="row">{month(row.month)}</th><td>{indexFormat.format(row.index_value)}</td><td>{formatPercent(row.yoy_pct)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>
            </>
          )
        )}</ApiContent>
      </section>
      <section className="panel">
        <h2>How to read the index</h2>
        <p>Year-over-year change compares a month with the same month one year earlier. N/A means the prior-year observation is unavailable. The NCR series does not describe prices nationwide.</p>
        <a href="/about#kpis">Read the KPI methodology</a>
      </section>
    </>
  );
}
