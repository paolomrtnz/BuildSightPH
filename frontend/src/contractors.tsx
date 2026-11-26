import {
  ApiContent, Pagination, RegionSelect, compactPesos, counts, filtersFromForm,
  formatMoney, params, url, useApi,
} from './shared';
import type { Page, Region } from './shared';
import { ProjectTable } from './projects';
import type { Project } from './projects';

type Portfolio = {
  contractor_key: number;
  contractor_name: string;
  contract_count: number;
  linked_value_php: number | null;
};
type Coverage = { contracts: number; linked_contracts: number };

function contractorUrl(id: number) {
  return url(`/contractors/${id}`, { region_id: params.get('region_id') });
}

function PortfolioChart({ rows, byValue }: { rows: Portfolio[]; byValue: boolean }) {
  const items = rows.slice(0, 10);
  if (!items.length) return null;
  const values = items.map(row => byValue ? row.linked_value_php : row.contract_count);
  const max = Math.max(1, ...values.map(value => value ?? 0));
  return (
    <ul className="bars region-bars" aria-label="Portfolios displayed on this page">
      {items.map((row, index) => {
        const value = values[index];
        return (
          <li key={row.contractor_key}>
            <a className="bar-row" href={contractorUrl(row.contractor_key)}>
              <span>{row.contractor_name}</span>
              <span className="track" aria-hidden="true"><span style={{ width: `${Math.max(0, value ?? 0) / max * 100}%` }} /></span>
              <strong>{value === null ? 'N/A' : byValue ? compactPesos.format(value) : counts.format(value)}</strong>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Contractors() {
  const results = useApi<Page<Portfolio>>(`/api/contractors?${params}`);
  const regions = useApi<Region[]>('/api/regions');
  const coverage = useApi<Coverage>('/api/methodology/coverage');
  const byValue = params.get('sort') === 'value';
  return (
    <>
      <div><h1>Contractor portfolios</h1><p className="intro">Distinct contracts linked through the selected DPWH CSV observations.</p></div>
      <section className="panel">
        <h2>Find a portfolio</h2>
        <form className="filters" action="/contractors" onSubmit={filtersFromForm}>
          <label>Contractor name<input type="search" name="q" maxLength={120} defaultValue={params.get('q') ?? ''} /></label>
          <ApiContent request={regions}>{items => <RegionSelect regions={items} />}</ApiContent>
          <label>Sort by<select name="sort" defaultValue={params.get('sort') ?? 'count'}>
            <option value="count">Linked contract count</option><option value="value">Linked reported value</option><option value="name">Contractor name</option>
          </select></label>
          <label>Order<select name="direction" defaultValue={params.get('direction') ?? 'desc'}>
            <option value="desc">Descending</option><option value="asc">Ascending</option>
          </select></label>
          <div className="filter-actions"><button type="submit">Apply filters</button> <a href="/contractors">Clear filters</a></div>
        </form>
      </section>
      <section className="panel">
        <h2>Linked portfolios</h2>
        <ApiContent request={coverage}>{data => (
          <p className="muted">National linkage coverage: {counts.format(data.linked_contracts)} of {counts.format(data.contracts)} canonical contracts.</p>
        )}</ApiContent>
        <p className="muted">A joint contract can appear in multiple portfolios. Values are the full reported values of linked contracts and cannot be added across contractors or attributed to individual payments.</p>
        <ApiContent request={results}>{data => (
          <>
            <Pagination {...data} />
            {data.items.length === 0 ? <p className="muted">No linked contractors match these filters.</p> : (
              <>
                <PortfolioChart rows={data.items} byValue={byValue} />
                <div className="table-wrap" tabIndex={0} role="region" aria-label="Portfolio results">
                  <table className="compact-table">
                    <thead><tr><th>Contractor</th><th>Distinct linked contracts</th><th>Linked reported value</th></tr></thead>
                    <tbody>{data.items.map(row => (
                      <tr key={row.contractor_key}>
                        <th scope="row"><a href={contractorUrl(row.contractor_key)}>{row.contractor_name}</a></th>
                        <td>{counts.format(row.contract_count)}</td><td>{formatMoney(row.linked_value_php)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}</ApiContent>
      </section>
    </>
  );
}

export function ContractorDetail({ id }: { id: string }) {
  const region = params.get('region_id');
  const detail = useApi<Portfolio>(url(`/api/contractors/${encodeURIComponent(id)}`, { region_id: region }));
  const projects = useApi<Page<Project>>(url('/api/projects', {
    contractor_id: id, region_id: region, page: params.get('page'),
  }));
  const regions = useApi<Region[]>('/api/regions');
  return (
    <>
      <a href={url('/contractors', { region_id: region })}>Back to contractors</a>
      <ApiContent request={detail}>{portfolio => (
        <>
          <div><h1>{portfolio.contractor_name}</h1><p className="intro">Canonical contractor portfolio</p></div>
          <section className="panel">
            <h2>Portfolio summary</h2>
            <form className="filters" action={`/contractors/${id}`} onSubmit={filtersFromForm}>
              <ApiContent request={regions}>{items => <RegionSelect regions={items} />}</ApiContent>
              <div className="filter-actions"><button type="submit">Apply region</button></div>
            </form>
            <dl className="facts">
              <div><dt>Distinct linked contracts</dt><dd>{counts.format(portfolio.contract_count)}</dd></div>
              <div><dt>Linked reported value</dt><dd>{formatMoney(portfolio.linked_value_php)}</dd></div>
            </dl>
            <p className="muted">Coverage is incomplete. Joint contracts contribute their full recorded value to each linked contractor.</p>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Linked project records</h2>
              <a className="secondary" href={url('/projects', { contractor_id: id, region_id: region })}>Filter in Project Explorer</a>
            </div>
            <ApiContent request={projects}>{data => <><Pagination {...data} /><ProjectTable items={data.items} back={location.pathname + location.search} /></>}</ApiContent>
          </section>
        </>
      )}</ApiContent>
    </>
  );
}
