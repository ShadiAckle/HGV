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
