import { lazy, Suspense, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { ApiContent, RegionalChart, counts, formatMoney, formatPercent, params, url, useApi } from './shared';
import { ProjectTable } from './projects';
import type { Project } from './projects';
import type { Comparison, Page } from './shared';

const RegionMap = lazy(() => import('./region-map').then(module => ({ default: module.RegionMap })));
type BoundarySet = FeatureCollection<Geometry, { adm1_psgc: number; adm1_en: string }>;

function RegionProjects({ id }: { id: number }) {
  const request = useApi<Page<Project>>(url('/api/projects', { region_id: id, page_size: 5 }));
  return <ApiContent request={request}>{data => <ProjectTable items={data.items} />}</ApiContent>;
}

export function Regions() {
  const results = useApi<Comparison[]>('/api/overview/regional-comparison');
  const boundaries = useApi<BoundarySet>('/maps/philippines-regions.json');
  const [region, select] = useState(params.get('region_id') ?? '');

  return (
    <>
      <div><h1>Philippine regions</h1><p className="intro">Explore recorded infrastructure contracts by PSGC-mapped region.</p></div>
      <ApiContent request={results}>{rows => {
        const selected = rows.find(row => String(row.region_id) === region);
        const geographicTotal = rows.reduce((sum, row) => sum + (row.reported_value_php ?? 0), 0);
        return (
          <>
            <section className="panel">
              <div className="section-heading">
                <h2>Regional map</h2>
                <label className="filter">Select region
                  <select value={selected ? region : ''} onChange={event => select(event.target.value)}>
                    <option value="">All mapped regions</option>
                    {[...rows].sort((a, b) => a.region_name.localeCompare(b.region_name)).map(row => (
                      <option key={row.region_id} value={row.region_id}>{row.region_name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <ApiContent request={boundaries}>{data => (
                <Suspense fallback={<p role="status">Loading regional map…</p>}>
                  <RegionMap boundaries={data} rows={rows} region={region} onSelect={select} />
                </Suspense>
              )}</ApiContent>
              <p className="muted">Gold shows the {rows.length} regions with mapped records. Gray shows BARMM, which has no mapped canonical records in this snapshot. Shapes show regional boundaries; individual project coordinates are unverified.</p>
              <div className="section-heading">
                <h3>{selected?.region_name ?? 'All mapped regions'}</h3>
                {selected && <a className="secondary" href={url('/projects', { region_id: selected.region_id })}>View projects in this region</a>}
              </div>
              <dl className="facts">
                <div><dt>Recorded contracts</dt><dd>{counts.format(selected?.contract_count ?? rows.reduce((sum, row) => sum + row.contract_count, 0))}</dd></div>
                <div><dt>Total reported contract value</dt><dd>{formatMoney(selected ? selected.reported_value_php : geographicTotal)}</dd></div>
                {selected && <div><dt>Share of geographic reported value</dt><dd>{formatPercent(
                  geographicTotal && selected.reported_value_php !== null ? 100 * selected.reported_value_php / geographicTotal : null
                )}</dd></div>}
              </dl>
              <p className="muted">Boundaries by NAMRIA and PSA via <a href="https://data.humdata.org/dataset/cod-ab-phl">OCHA COD-AB</a> (CC BY-IGO), processed by <a href="https://github.com/faeldon/philippines-json-maps/tree/680e32e62baeccbcd8845d3b1387bc67c1baf78a">philippines-json-maps</a>.</p>
            </section>
            {selected && <section className="panel">
              <h2>Contract preview · {selected.region_name}</h2>
              <RegionProjects id={selected.region_id} />
            </section>}
            <section className="panel">
              <h2>National regional comparison</h2>
              <p className="muted">Central Office is an administrative classification and is excluded from geographic comparisons.</p>
              <RegionalChart rows={rows} region={region} select={select} />
            </section>
          </>
        );
      }}</ApiContent>
    </>
  );
}
