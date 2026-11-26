import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Overview = {
  total_contracts: number;
  total_reported_contract_value_php: number | null;
  valid_ongoing_contracts: number;
  average_reported_ongoing_progress_pct: number | null;
  low_progress_contracts: number;
  low_progress_ongoing_rate_pct: number | null;
};
type Region = { region_id: number; region_name: string };
type Comparison = Region & { contract_count: number; reported_value_php: number | null };
type Progress = { label: string; contract_count: number };
type Contract = {
  contract_id: string;
  contract_description: string | null;
  reported_value_php: number | null;
  region_name: string | null;
  reported_status: string | null;
  reported_progress_pct: number | null;
};

const counts = new Intl.NumberFormat('en-PH');
const pesos = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
});
const compactPesos = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });
const formatPercent = (value: number | null) => value === null ? 'N/A' : `${percent.format(value)}%`;

type Result<T> = { data: T } | { error: true };

function useApi<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${path}`;
  const [result, setResult] = useState<{ key: string; response: Result<T> }>();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(path, { signal: controller.signal });
        if (!response.ok) throw new Error('Dashboard API unavailable');
        const data: T = await response.json();
        if (!controller.signal.aborted) setResult({ key, response: { data } });
      } catch {
        if (!controller.signal.aborted) setResult({ key, response: { error: true } });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, path]);

  return { result: result?.key === key ? result.response : undefined, retry: () => setAttempt(n => n + 1) };
}

function ApiContent<T>({ request, children }: {
  request: ReturnType<typeof useApi<T>>;
  children: (data: T) => ReactNode;
}) {
  const { result, retry } = request;
  if (!result) return <p className="muted" role="status">Loading dashboard data…</p>;
  if ('error' in result) return (
    <div className="notice" role="alert">
      <p>Dashboard data is currently unavailable.</p>
      <button type="button" onClick={retry}>Try again</button>
    </div>
  );
  return children(result.data);
}

function Header({ projects, query, onSearch }: {
  projects: boolean; query: string; onSearch?: (value: string) => void;
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
          <a href="/" aria-current={projects ? undefined : 'page'}>Overview</a>
          <a href="/projects" aria-current={projects ? 'page' : undefined}>Projects <small>Coming soon</small></a>
          <a href="/#methodology">About</a>
        </nav>
        <form className="search" role="search" action="/" onSubmit={submit}>
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

function RegionalChart({ rows, region, select }: {
  rows: Comparison[]; region: string; select: (id: string) => void;
}) {
  const [byCount, setByCount] = useState(false);
  const value = (row: Comparison) => byCount ? row.contract_count : row.reported_value_php;
  const sorted = [...rows].sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity)
    || a.region_name.localeCompare(b.region_name));
  const max = Math.max(1, ...sorted.map(row => value(row) ?? 0));
  return (
    <>
      <div className="chart-actions">
        <div className="segmented" aria-label="Comparison metric" role="group">
          <button type="button" aria-pressed={!byCount} onClick={() => setByCount(false)}>Reported value</button>
          <button type="button" aria-pressed={byCount} onClick={() => setByCount(true)}>Contract count</button>
        </div>
        {region && <button type="button" className="secondary" onClick={() => select('')}>Reset to All Records</button>}
      </div>
      <ul className="bars region-bars" aria-label="Geographic region rankings">
        {sorted.map(row => {
          const amount = value(row);
          const id = String(row.region_id);
          return (
            <li key={id}>
              <button type="button" className="bar-row" aria-pressed={region === id}
                onClick={() => select(id)}>
                <span>{row.region_name}</span>
                <span className="track" aria-hidden="true"><span style={{ width: `${(amount ?? 0) / max * 100}%` }} /></span>
                <strong title={amount !== null && !byCount ? pesos.format(amount) : undefined}>
                  {amount === null ? 'N/A' : byCount ? counts.format(amount) : compactPesos.format(amount)}
                </strong>
              </button>
            </li>
          );
        })}
      </ul>
    </>
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
            <th scope="row">{row.contract_id}</th>
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
  const [region, setRegion] = useState('');
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
  const explorer = `/projects${query ? `?q=${encodeURIComponent(query)}` : ''}`;

  return (
    <>
      <Header projects={false} query={query} onSearch={setQuery} />
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

function ProjectsPlaceholder({ query }: { query: string }) {
  const preview = query ? `/?q=${encodeURIComponent(query)}#project-preview` : '/#project-preview';
  return (
    <>
      <Header projects query={query} />
      <main className="shell">
        <section className="panel">
          <h1>Project Explorer</h1>
          <p className="muted">The full Project Explorer is in development. The Overview has a searchable contract preview.</p>
          {query && <p>Your search was “{query}”.</p>}
          <a href={preview}>Open contract preview</a>
        </section>
      </main>
    </>
  );
}

const query = (new URLSearchParams(location.search).get('q') ?? '').trim().slice(0, 120);
createRoot(document.getElementById('root')!).render(
  location.pathname === '/projects' ? <ProjectsPlaceholder query={query} /> : <Dashboard initialQuery={query} />,
);
