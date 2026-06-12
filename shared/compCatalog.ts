/** Unity Catalog location for comp star schema (override via COMP_CATALOG + COMP_SCHEMA). */
export function getCompCatalog(): string {
  return (process.env.COMP_CATALOG ?? 'workspace').trim();
}

export function getCompSchema(): string {
  return (process.env.COMP_SCHEMA ?? 'hgv_comp').trim();
}

/** Fully qualified schema, e.g. edw_dev_hris.hgv_comp */
export function getCompUc(): string {
  return `${getCompCatalog()}.${getCompSchema()}`;
}

/** Rewrite legacy SQL literals to the configured catalog.schema. */
export function rewriteCompCatalogSql(sql: string): string {
  const target = getCompUc();
  if (target === 'workspace.hgv_comp') return sql;
  return sql.split('workspace.hgv_comp').join(target);
}

/** Live Cognos/PwC views — skip demo DDL/seeds that INSERT into hgv_comp facts/dims. */
export function isProductionCompDataMode(): boolean {
  const mode = (process.env.COMP_DATA_MODE ?? '').trim().toLowerCase();
  if (mode === 'demo' || mode === 'synthetic') return false;
  if (mode === 'production' || mode === 'live') return true;
  const skip = (process.env.COMP_SKIP_BOOTSTRAP ?? '').trim().toLowerCase();
  if (skip === '1' || skip === 'true' || skip === 'yes') return true;
  // VDI deploy always sets COMP_CATALOG=edw_dev_hris — views are read-only; never demo-seed.
  return getCompCatalog().toLowerCase() === 'edw_dev_hris';
}

/** Startup log line — explains why bootstrap runs or is skipped. */
export function describeCompDataMode(): string {
  const catalog = getCompCatalog();
  const schema = getCompSchema();
  const mode = (process.env.COMP_DATA_MODE ?? '').trim();
  if (!isProductionCompDataMode()) {
    return `demo bootstrap enabled (COMP_DATA_MODE=${mode || '(unset)'}, catalog=${catalog}.${schema})`;
  }
  if (mode) return `live data — skipping demo bootstrap (COMP_DATA_MODE=${mode}, ${catalog}.${schema})`;
  if (catalog.toLowerCase() === 'edw_dev_hris') {
    return `live data — skipping demo bootstrap (auto: catalog=${catalog}.${schema})`;
  }
  return `live data — skipping demo bootstrap (${catalog}.${schema})`;
}
