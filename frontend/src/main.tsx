import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { ApiContent, RegionalChart, compactPesos, counts, formatPercent, pesos, useApi } from './shared';
import type { Comparison, Region } from './shared';
import { Projects, ProjectDetail } from './projects';
import { Contractors, ContractorDetail } from './contractors';
import { Regions } from './regions';
import { MaterialPrices } from './prices';
import { About } from './about';

type Overview = {
  total_contracts: number;
  total_reported_contract_value_php: number | null;
  valid_ongoing_contracts: number;
  average_reported_ongoing_progress_pct: number | null;
  low_progress_contracts: number;
  low_progress_ongoing_rate_pct: number | null;
};
type Progress = { label: string; contract_count: number };
type Contract = {
  contract_id: string;
  contract_description: string | null;
  reported_value_php: number | null;
  region_name: string | null;
  reported_status: string | null;
  reported_progress_pct: number | null;
};

function Header({ query, onSearch }: {
  query: string; onSearch?: (value: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!onSearch) return;
    event.preventDefault();
    onSearch(String(new FormData(event.currentTarget).get('q') ?? '').trim());
    document.getElementById('project-preview')?.focus();
  }
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>BuildSight <strong>PH</strong></span>
        </a>
        <nav aria-label="Main navigation">
          {[
            ['/', 'Overview'], ['/projects', 'Projects'], ['/regions', 'Regions'],
            ['/contractors', 'Contractors'], ['/material-prices', 'Material Prices'], ['/about', 'About'],
          ].map(([href, label]) => (
            <a key={href} href={href} aria-current={(href === '/' ? location.pathname === '/' :
              location.pathname === href || location.pathname.startsWith(href + '/')) ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <form className="search" role="search" action="/projects" onSubmit={submit}>
          <input name="q" type="search" maxLength={120} defaultValue={query}
            aria-label="Search by contract ID or project description" placeholder="Search contract ID or description" />
          <button type="submit">Search</button>
        </form>
      </div>
    </header>
  );
}

function Metric({ label, value, detail, children, accent, exactValue }: {
  label: string; value: string; detail: string; children: ReactNode; accent?: 'gold' | 'cyan'; exactValue?: string;
}) {
  return (
    <article className={accent ? `metric ${accent}` : 'metric'}>
      <div className="metric-heading">
        <h2>{label}</h2>
        <details className="metric-info">
          <summary aria-label={`About ${label}`}>i</summary>
          <p>{detail}</p>
        </details>
      </div>
      <p className="value" title={exactValue}>{value}</p>
      <p className="context">{children}</p>
    </article>
  );
}

function Metrics({ data }: { data: Overview }) {
  return (
    <section className="metrics" aria-label="Executive indicators">
      <Metric label="Recorded Contracts" value={counts.format(data.total_contracts)}
        detail="Counts each normalized canonical contract identifier once.">
        Unique canonical contracts
      </Metric>
      <Metric label="Total Reported Contract Value" accent="gold"
        value={data.total_reported_contract_value_php === null ? 'N/A' : compactPesos.format(data.total_reported_contract_value_php)}
        exactValue={data.total_reported_contract_value_php === null ? undefined : pesos.format(data.total_reported_contract_value_php)}
        detail="Sums the selected reported contract value for each contract. Actual government expenditure is outside the dataset.">
        Selected reported contract values
      </Metric>
      <Metric label="Average Ongoing Progress" accent="cyan" value={formatPercent(data.average_reported_ongoing_progress_pct)}
        detail="Unweighted mean of valid reported progress from 0% through 100% for contracts with Transparency status On-Going.">
        {counts.format(data.valid_ongoing_contracts)} eligible ongoing contracts
      </Metric>
      <Metric label="Low-Progress Ongoing Rate" value={formatPercent(data.low_progress_ongoing_rate_pct)}
        detail="Share of eligible ongoing contracts below 50% reported progress. This study cutoff screens for low progress only.">
        {counts.format(data.low_progress_contracts)} contracts below 50%
      </Metric>
    </section>
  );
}

function ProgressChart({ rows }: { rows: Progress[] }) {
  const max = Math.max(1, ...rows.map(row => row.contract_count));
  if (!rows.some(row => row.contract_count > 0)) return <p className="muted">No eligible ongoing contracts for this selection.</p>;
  return (
    <ul className="bars progress-bars" aria-label="Contract counts by progress range">
      {rows.map(row => (
        <li className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <span className="track" aria-hidden="true"><span style={{ width: `${row.contract_count / max * 100}%` }} /></span>
          <strong>{counts.format(row.contract_count)}</strong>
        </li>
      ))}
    </ul>
  );
}

function ContractTable({ rows, query }: { rows: Contract[]; query: string }) {
  if (!rows.length) return <p role="status" className="muted">No matching contracts.</p>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Contract preview table">
      <table>
        <caption>{rows.length} recorded contracts{query && ` matching “${query}”`}, ordered by contract key</caption>
        <thead><tr>
          <th scope="col">Contract ID</th><th scope="col">Project description</th><th scope="col">Reported value</th>
          <th scope="col">Region</th><th scope="col">Reported status</th><th scope="col">Reported progress</th>
        </tr></thead>
        <tbody>{rows.map(row => (
          <tr key={row.contract_id}>
            <th scope="row"><a href={`/projects/${encodeURIComponent(row.contract_id)}`}>{row.contract_id}</a></th>
            <td>{row.contract_description || 'Unavailable'}</td>
            <td>{row.reported_value_php === null ? 'N/A' : pesos.format(row.reported_value_php)}</td>
            <td>{row.region_name || 'Unassigned'}</td>
            <td>{row.reported_status || 'Unavailable'}</td>
            <td>{formatPercent(row.reported_progress_pct)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Methodology() {
  return (
    <footer id="methodology" className="panel methodology">
      <h2>Data sources, methodology and limitations</h2>
      <p>BuildSight PH integrates the <a href="https://github.com/csiiiv/dpwh-infra-data-scraper">DPWH infrastructure CSV</a>,
        the <a href="https://data.bettergov.ph/datasets/19">DPWH Transparency dataset</a>,
        the <a href="https://psa.gov.ph/classification/psgc">PSA Philippine Standard Geographic Code</a>,
        and the <a href="https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__PI__RPI/0062M4ACMR1.px/">PSA NCR construction materials retail price index</a>.
        The Overview uses contract and geographic data from the historical snapshot.</p>
      <p>Contract counts use one canonical record per normalized ID. Reported values describe recorded contracts.
        Verified spending and payment transactions are outside the dataset.</p>
      <p>Progress indicators use an inclusive 0–100% validity range and Transparency status <code>On-Going</code>.
        Each eligible contract has equal weight. Below 50% is a study screening threshold. Schedule performance
        requires approved planned progress. The preview uses Transparency status when available and CSV status otherwise.</p>
      <p>All Records includes DPWH Central Office. National regional comparisons use the geographic PSGC mapping and
        exclude Central Office. PSGC mappings apply at region level.</p>
    </footer>
  );
}

function Dashboard({ initialQuery }: { initialQuery: string }) {
  const initialRegion = new URLSearchParams(location.search).get('region_id') ?? '';
  const [region, setRegion] = useState(/^\d+$/.test(initialRegion) ? initialRegion : '');
  const [query, setQuery] = useState(initialQuery);
  const scope = region ? `?region_id=${region}` : '';
  const previewParams = new URLSearchParams();
  if (region) previewParams.set('region_id', region);
  if (query) previewParams.set('q', query);
  const overview = useApi<Overview>(`/api/overview${scope}`);
  const regions = useApi<Region[]>('/api/regions');
  const comparison = useApi<Comparison[]>('/api/overview/regional-comparison');
  const progress = useApi<Progress[]>(`/api/overview/progress-distribution${scope}`);
  const preview = useApi<Contract[]>(`/api/overview/contracts?${previewParams}`);
  const searchParams = previewParams.toString();
  useEffect(() => {
    history.replaceState(null, '', `/${searchParams ? `?${searchParams}` : ''}${location.hash}`);
  }, [searchParams]);
  const explorer = `/projects${previewParams.size ? `?${previewParams}` : ''}`;

  return (
    <>
      <Header query={query} onSearch={setQuery} />
      <main className="shell dashboard">
        <div className="page-heading">
          <div>
            <h1>Infrastructure overview</h1>
            <p className="intro">Historical snapshot of Philippine infrastructure contracts</p>
          </div>
          <ApiContent request={regions}>{rows => (
            <label className="filter">Region
              <select value={region} onChange={event => setRegion(event.target.value)}>
                <option value="">All Records</option>
                {rows.map(row => <option key={row.region_id} value={row.region_id}>{row.region_name}</option>)}
              </select>
            </label>
          )}</ApiContent>
        </div>
        <ApiContent request={overview}>{data => <Metrics data={data} />}</ApiContent>
        <section className="panel" aria-labelledby="regional-heading">
          <h2 id="regional-heading">Regional comparison</h2>
          <p className="muted">National comparison of mapped regions. All Records totals also include DPWH Central Office.</p>
          <ApiContent request={comparison}>{rows => <RegionalChart rows={rows} region={region} select={setRegion} />}</ApiContent>
        </section>
        <section className="panel" aria-labelledby="progress-heading">
          <h2 id="progress-heading">Ongoing progress distribution</h2>
          <p className="muted">Valid reported physical progress among ongoing contracts in the selected scope.</p>
          <ApiContent request={progress}>{rows => <ProgressChart rows={rows} />}</ApiContent>
        </section>
        <section className="panel" id="project-preview" tabIndex={-1} aria-labelledby="project-heading">
          <div className="section-heading">
            <h2 id="project-heading">Infrastructure project preview</h2>
            <a className="secondary" href={explorer}>View All Projects</a>
          </div>
          <ApiContent request={preview}>{rows => <ContractTable rows={rows} query={query} />}</ApiContent>
        </section>
        <Methodology />
      </main>
    </>
  );
}

const query = (new URLSearchParams(location.search).get('q') ?? '').trim().slice(0, 120);
const [route, id] = location.pathname.split('/').filter(Boolean);
let idValue = id ?? '';
try { idValue = decodeURIComponent(idValue); } catch { /* Preserve malformed text for the API error state. */ }
const pages: Record<string, ReactNode> = {
  projects: id ? <ProjectDetail id={idValue} /> : <Projects />,
  regions: <Regions />,
  contractors: id ? <ContractorDetail id={idValue} /> : <Contractors />,
  'material-prices': <MaterialPrices />,
  about: <About />,
};
createRoot(document.getElementById('root')!).render(
  route ? <><Header query={query} /><main className="shell dashboard">{pages[route]}</main></>
    : <Dashboard initialQuery={query} />,
);
