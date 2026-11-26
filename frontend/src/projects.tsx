import {
  ApiContent, Pagination, RegionSelect, filtersFromForm, formatMoney, formatPercent, params, useApi,
} from './shared';
import type { Page, Region } from './shared';

type Project = {
  contract_id: string;
  contract_description: string | null;
  region_name: string | null;
  category_name: string | null;
  reported_value_php: number | null;
  reported_status: string | null;
  reported_progress_pct: number | null;
};

type Options = {
  regions: Region[];
  statuses: string[];
  categories: { category_id: number; category_name: string }[];
};

type Detail = Project & {
  preferred_contract_cost_php: number | null;
  valid_reported_progress_pct: number | null;
  location_raw: string | null;
  province_raw: string | null;
  infrastructure_year: number | null;
  office_name: string | null;
  program_name: string | null;
  funding_name: string | null;
  funding_source_raw: string | null;
  reported_contractor: string | null;
  csv_status: string | null;
  parquet_status: string | null;
  csv_contract_cost_php: number | null;
  parquet_budget_php: number | null;
  csv_accomplishment_pct: number | null;
  parquet_progress_pct: number | null;
  contract_effectivity_date: string | null;
  contract_expiry_date: string | null;
  parquet_reported_start_date: string | null;
  parquet_reported_completion_date: string | null;
  progress_disagreement_flag: number;
  cost_disagreement_flag: number;
  different_end_date_flag: number;
  contractors: { contractor_key: number; contractor_name: string }[];
};

export function ProjectTable({ items, back }: { items: Project[]; back?: string }) {
  if (!items.length) return <p className="muted">No contracts match these filters.</p>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Contract results">
      <table>
        <thead><tr><th>Contract ID</th><th>Project description</th><th>Reported value</th>
          <th>Region</th><th>Category</th><th>Reported status</th><th>Reported progress</th></tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.contract_id}>
            <th scope="row"><a href={`/projects/${encodeURIComponent(item.contract_id)}${back ? `?back=${encodeURIComponent(back)}` : ''}`}>{item.contract_id}</a></th>
            <td>{item.contract_description || 'Unavailable'}</td>
            <td>{formatMoney(item.reported_value_php)}</td>
            <td>{item.region_name ?? 'Unassigned'}</td>
            <td>{item.category_name ?? 'N/A'}</td>
            <td>{item.reported_status ?? 'N/A'}</td>
            <td>{formatPercent(item.reported_progress_pct)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function Projects() {
  const projectOptions = useApi<Options>('/api/projects/options');
  const results = useApi<Page<Project>>(`/api/projects?${params}`);
  const contractor = params.get('contractor_id');
  return (
    <>
      <div><h1>Project Explorer</h1><p className="intro">Browse canonical records from the historical DPWH snapshot.</p></div>
      <section className="panel">
        <h2>Filter contracts</h2>
        <ApiContent request={projectOptions}>{options => (
          <form className="filters" action="/projects" onSubmit={filtersFromForm}>
            {contractor && <input type="hidden" name="contractor_id" value={contractor} />}
            <label>Contract ID or description<input name="q" type="search" maxLength={120} defaultValue={params.get('q') ?? ''} /></label>
            <RegionSelect regions={options.regions} />
            <label>Reported status<select name="status" defaultValue={params.get('status') ?? ''}>
              <option value="">Any status</option>{options.statuses.map(status => <option key={status}>{status}</option>)}
            </select></label>
            <label>Category<select name="category_id" defaultValue={params.get('category_id') ?? ''}>
              <option value="">Any category</option>
              {options.categories.map(category => <option value={category.category_id} key={category.category_id}>{category.category_name}</option>)}
            </select></label>
            {[
              ['min_value', 'Minimum value (₱)'], ['max_value', 'Maximum value (₱)'],
              ['min_progress', 'Minimum reported progress (%)'], ['max_progress', 'Maximum reported progress (%)'],
            ].map(([name, label]) => (
              <label key={name}>{label}<input name={name} type="number" min={0} max={name.endsWith('progress') ? 100 : undefined}
                step="any" defaultValue={params.get(name) ?? ''} /></label>
            ))}
            <label>Sort by<select name="sort" defaultValue={params.get('sort') ?? 'id'}>
              <option value="id">Contract ID</option><option value="value">Reported value</option>
              <option value="progress">Reported progress</option><option value="status">Reported status</option>
            </select></label>
            <label>Order<select name="direction" defaultValue={params.get('direction') ?? 'asc'}>
              <option value="asc">Ascending</option><option value="desc">Descending</option>
            </select></label>
            <div className="filter-actions"><button type="submit">Apply filters</button> <a href="/projects">Clear filters</a></div>
          </form>
        )}</ApiContent>
        {contractor && <p>Showing projects linked to <a href={`/contractors/${encodeURIComponent(contractor)}`}>this contractor</a>.</p>}
      </section>
      <section className="panel">
        <h2>Contract records</h2>
        <p className="muted">Status uses DPWH Transparency when available, then the contract CSV. Progress outside 0–100% is unavailable.</p>
        <ApiContent request={results}>{data => <><Pagination {...data} /><ProjectTable items={data.items} back={location.pathname + location.search} /></>}</ApiContent>
      </section>
    </>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const request = useApi<Detail>(`/api/projects/${encodeURIComponent(id)}`);
  const back = params.get('back');
  return (
    <>
      <a href={back && /^\/(projects|contractors)(\/[0-9]+)?(\?[^#]*)?$/.test(back) ? back : '/projects'}>Back to project records</a>
      <ApiContent request={request}>{project => (
        <>
          <div><h1>{project.contract_id}</h1><p className="intro">{project.contract_description || 'Project description unavailable'}</p></div>
          <section className="panel">
            <h2>Contract details</h2>
            <dl className="facts">
              {[
                ['Region', project.region_name], ['Source location', project.location_raw], ['Source province', project.province_raw],
                ['Category', project.category_name], ['Program', project.program_name], ['Infrastructure year', project.infrastructure_year],
                ['Implementing office', project.office_name], ['Funding source', project.funding_name ?? project.funding_source_raw],
                ['Reported contract value', formatMoney(project.preferred_contract_cost_php)],
                ['Reported status', project.reported_status], ['Reported progress', formatPercent(project.valid_reported_progress_pct)],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'N/A'}</dd></div>)}
            </dl>
            <p className="muted">Source location and province are supplied labels. Geographic analytics use the verified region mapping.</p>
          </section>
          <section className="panel">
            <h2>Contractor information</h2>
            {project.contractors.length > 0
              ? <ul>{project.contractors.map(row => <li key={row.contractor_key}><a href={`/contractors/${row.contractor_key}`}>{row.contractor_name}</a></li>)}</ul>
              : <p className="muted">No canonical contractor links for this contract.</p>}
            <p>DPWH Transparency contractor text: {project.reported_contractor || 'Unavailable'}</p>
          </section>
          <section className="panel">
            <h2>Source comparison</h2>
            <p className="muted">The two sources can differ in reporting dates and methods. Date differences alone do not establish delays.</p>
            <p>Stored discrepancy flags: {[
              project.cost_disagreement_flag && 'reported value',
              project.progress_disagreement_flag && 'progress',
              project.different_end_date_flag && 'end date',
            ].filter(Boolean).join(', ') || 'None flagged'}</p>
            <div className="table-wrap">
              <table className="source-table"><thead><tr><th>Field</th><th>DPWH CSV</th><th>DPWH Transparency</th></tr></thead>
                <tbody>{[
                  ['Status', project.csv_status, project.parquet_status],
                  ['Reported value / budget field', formatMoney(project.csv_contract_cost_php), formatMoney(project.parquet_budget_php)],
                  ['Progress as reported', formatPercent(project.csv_accomplishment_pct), formatPercent(project.parquet_progress_pct)],
                  ['Effectivity / reported start', project.contract_effectivity_date, project.parquet_reported_start_date],
                  ['Expiry / reported completion', project.contract_expiry_date, project.parquet_reported_completion_date],
                ].map(([field, csv, parquet]) => <tr key={field}><th scope="row">{field}</th><td>{csv ?? 'N/A'}</td><td>{parquet ?? 'N/A'}</td></tr>)}</tbody></table>
            </div>
          </section>
        </>
      )}</ApiContent>
    </>
  );
}

export type { Project };
