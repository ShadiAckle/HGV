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
  if (mode === 'production' || mode === 'live') return true;
  const skip = (process.env.COMP_SKIP_BOOTSTRAP ?? '').trim().toLowerCase();
  return skip === '1' || skip === 'true' || skip === 'yes';
}
