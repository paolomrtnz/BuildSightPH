import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Overview = {
  total_contracts: number;
  total_reported_contract_value_php: number | null;
  geographic_regions: number;
  valid_ongoing_contracts: number;
  average_reported_ongoing_progress_pct: number | null;
};

const counts = new Intl.NumberFormat('en-PH');
const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-PH', {
  style: 'percent',
  maximumFractionDigits: 2,
});

function Dashboard() {
  const [overview, setOverview] = useState<Overview>();
  const [failed, setFailed] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      try {
        const response = await fetch('/api/overview', { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Dashboard API unavailable');
        }
        setOverview(await response.json());
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      }
    }

    void loadOverview();
    return () => controller.abort();
  }, [request]);

  function retry() {
    setFailed(false);
    setRequest(request + 1);
  }

  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>BuildSight <strong>PH</strong></span>
        </div>
      </header>
      <main className="shell">
        <h1>Infrastructure overview</h1>
        <p className="intro">Historical snapshot of Philippine infrastructure contracts</p>
        {failed && (
          <div className="notice">
            <p role="alert">Dashboard data is currently unavailable.</p>
            <button onClick={retry}>Try again</button>
          </div>
        )}
        {!failed && !overview && <p role="status">Loading dashboard data…</p>}
        {overview && (
          <section className="metrics" aria-label="Executive indicators">
            <Metric label="Total contracts" value={counts.format(overview.total_contracts)}>
              Unique canonical contracts
            </Metric>
            <Metric
              label="Total reported contract value"
              value={overview.total_reported_contract_value_php === null
                ? 'Unavailable' : money.format(overview.total_reported_contract_value_php)}
              accent="gold"
            >
              Includes Central Office
            </Metric>
            <Metric
              label="Average reported physical progress"
              value={overview.average_reported_ongoing_progress_pct === null
                ? 'Unavailable' : percent.format(overview.average_reported_ongoing_progress_pct / 100)}
              accent="cyan"
            >
              {counts.format(overview.valid_ongoing_contracts)} eligible ongoing contracts
            </Metric>
            <Metric label="Geographic coverage" value={counts.format(overview.geographic_regions)}>
              PSGC-mapped regions
            </Metric>
          </section>
        )}
      </main>
    </>
  );
}

function Metric({ label, value, accent, children }: {
  label: string;
  value: string;
  accent?: 'gold' | 'cyan';
  children: React.ReactNode;
}) {
  return (
    <article className={accent ? `metric ${accent}` : 'metric'}>
      <h2>{label}</h2>
      <p className="value">{value}</p>
      <p className="context">{children}</p>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(<Dashboard />);
