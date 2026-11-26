import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Region = { region_id: number; region_name: string; psgc_code: string };
export type Comparison = Region & { contract_count: number; reported_value_php: number | null };
export const counts = new Intl.NumberFormat('en-PH');
export const pesos = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
});
export const compactPesos = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });
export const formatPercent = (value: number | null) => value === null ? 'N/A' : `${percent.format(value)}%`;

type Result<T> = { data: T } | { error: string };

export function useApi<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${path}`;
  const [result, setResult] = useState<{ key: string; response: Result<T> }>();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(path, { signal: controller.signal });
        if (!response.ok) {
          const data = response.status === 404 || response.status === 422 ? await response.json() : null;
          const message = typeof data?.detail === 'string' ? data.detail
            : response.status === 422 ? 'Some filters are invalid. Check your selections and try again.'
              : 'Dashboard data is currently unavailable.';
          if (!controller.signal.aborted) setResult({ key, response: { error: message } });
          return;
        }
        const data: T = await response.json();
        if (!controller.signal.aborted) setResult({ key, response: { data } });
      } catch {
        if (!controller.signal.aborted) setResult({ key, response: { error: 'Dashboard data is currently unavailable.' } });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, path]);

  return { result: result?.key === key ? result.response : undefined, retry: () => setAttempt(n => n + 1) };
}

export function ApiContent<T>({ request, children }: {
  request: ReturnType<typeof useApi<T>>;
  children: (data: T) => ReactNode;
}) {
  const { result, retry } = request;
  if (!result) return <p className="muted" role="status">Loading dashboard data…</p>;
  if ('error' in result) return (
    <div className="notice" role="alert">
      <p>{result.error}</p>
      <button type="button" onClick={retry}>Try again</button>
    </div>
  );
  return children(result.data);
}

export function RegionalChart({ rows, region, select }: {
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


export const params = new URLSearchParams(location.search);

export function url(path: string, changes: Record<string, string | number | null>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(changes)) {
    if (value !== '' && value !== null) next.set(key, String(value));
  }
  return next.size ? `${path}?${next}` : path;
}

export function filtersFromForm(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  location.assign(url(event.currentTarget.action, Object.fromEntries(
    [...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value)]),
  )));
}

export type Page<T> = { total: number; page: number; page_size: number; items: T[] };

export function Pagination({ page, page_size, total }: Page<unknown>) {
  const pages = Math.ceil(total / page_size);
  const pageLink = (target: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(target));
    return `?${next}`;
  };
  return (
    <div className="pagination" aria-label="Pagination">
      <span>{counts.format(total)} matches{pages > 0 && ` · Page ${counts.format(page)} of ${counts.format(pages)}`}</span>
      <div>
        {page > 1 && <a className="secondary" href={pageLink(Math.min(page - 1, Math.max(1, pages)))}>Previous</a>}
        {page < pages && <a className="secondary" href={pageLink(page + 1)}>Next</a>}
      </div>
    </div>
  );
}

export function RegionSelect({ regions }: { regions: Pick<Region, 'region_id' | 'region_name'>[] }) {
  return <label>Region<select name="region_id" defaultValue={params.get('region_id') ?? ''}>
    <option value="">All Records</option>
    {regions.map(region => <option key={region.region_id} value={region.region_id}>{region.region_name}</option>)}
  </select></label>;
}

export function formatMoney(value: number | null) {
  return value === null ? 'N/A' : pesos.format(value);
}
