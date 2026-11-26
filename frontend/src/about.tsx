import { ApiContent, counts, formatPercent, useApi } from './shared';

type Coverage = {
  contracts: number;
  central_office: number;
  geographic_regions: number;
  linked_contracts: number;
  comparable_progress: number;
  flagged_progress: number;
};

export function About() {
  const coverage = useApi<Coverage>('/api/methodology/coverage');
  return (
    <>
      <div><h1>About BuildSight PH</h1><p className="intro">A UST capstone for descriptive and diagnostic analysis of Philippine infrastructure records.</p></div>
      <section className="panel methodology">
        <h2>Sources and historical coverage</h2>
        <ul>
          <li><a href="https://github.com/csiiiv/dpwh-infra-data-scraper">DPWH infrastructure contracts</a> · historical CSV, 2016–2025.</li>
          <li><a href="https://data.bettergov.ph/datasets/19">DPWH Transparency via BetterGov</a> · project details from the supplied Parquet-derived snapshot.</li>
          <li><a href="https://psa.gov.ph/classification/psgc">PSA Philippine Standard Geographic Code</a> · third quarter of 2026.</li>
          <li><a href="https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__PI__RPI/0062M4ACMR1.px/">PSA Construction Materials Retail Price Index</a> · NCR, January 2012–September 2026, 2012 = 100.</li>
        </ul>
        <p>The team normalized DPWH contract identifiers, retained source observations, and selected one record per canonical contract for reporting. The 23-table SQLite snapshot holds contract facts, source observations, reference data, linkage, and audit information. The website reads that historical snapshot.</p>
        <ApiContent request={coverage}>{data => (
          <p>{counts.format(data.contracts)} canonical contracts include {counts.format(data.central_office)} administrative Central Office records. Geographic comparisons cover {counts.format(data.geographic_regions)} mapped regions. Canonical contractor links cover {counts.format(data.linked_contracts)} contracts.</p>
        )}</ApiContent>
      </section>
      <section className="panel methodology" id="kpis">
        <h2>Approved KPI definitions</h2>
        <ol className="definitions">
          <li><strong>Regional contract value share</strong><p>Divide the selected reported value in each geographic region by the total across all mapped regions. Central Office is excluded from both.</p></li>
          <li><strong>Average reported physical progress</strong><p>Average the selected reported progress for Transparency status <code>On-Going</code> with progress from 0% through 100%. Each eligible contract has equal weight.</p></li>
          <li><strong>Low-progress ongoing rate</strong><p>Divide eligible ongoing contracts with progress strictly below 50% by all eligible ongoing contracts. The 50% cutoff is a study-defined screening threshold.</p></li>
          <li><strong>Contractor portfolio size</strong><p>Count distinct contract identifiers per contractor through the canonical contractor view. The study proposed 66 linked contracts as a screening threshold. Joint projects can appear in multiple portfolios.</p></li>
          <li><strong>NCR CMRPI change</strong><p>Subtract the same-month prior-year index, divide by that prior index, and multiply by 100. The study proposed a 2.40% screening threshold from the historical All Items 75th percentile.</p></li>
          <li><strong>Progress data disagreement rate</strong><p>Divide comparable contracts flagged with the stored progress disagreement indicator by contracts with both DPWH progress values available.</p>
            <ApiContent request={coverage}>{data => <p>Snapshot result: {counts.format(data.flagged_progress)} of {counts.format(data.comparable_progress)} comparable contracts ({formatPercent(data.comparable_progress ? 100 * data.flagged_progress / data.comparable_progress : null)}).</p>}</ApiContent>
          </li>
        </ol>
      </section>
      <section className="panel methodology">
        <h2>Interpretation and limitations</h2>
        <ul>
          <li>Reported contract values describe the source records. Verified spending, payments, utilization, and cost overruns require other data. The all-zero payment field supplies no usable payment evidence.</li>
          <li>Reported physical progress does not establish schedule performance. Source dates and statuses can use different definitions and reporting periods.</li>
          <li>Contractor links cover part of the snapshot. Portfolio figures describe recorded linkage and do not establish capacity, workload, licensing, or spending.</li>
          <li>2026 PSGC region mappings can differ from historical administrative boundaries. Source province and location text remain unverified at project level.</li>
          <li>The price index covers NCR and represents group-level price movements. It does not measure a project's purchases.</li>
        </ul>
        <p>Source agencies: DPWH and PSA. BetterGov and the public DPWH CSV scraper provided copies of source records. Regional geodata credits appear on the Regions page.</p>
      </section>
    </>
  );
}
