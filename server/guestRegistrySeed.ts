import { CURRENT_PERIOD_ID } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

async function tableCount(runSql: RunSql, table: string, where = '1=1'): Promise<number> {
  try {
    const rows = await runSql(`SELECT COUNT(*) AS cnt FROM workspace.hgv_comp.${table} WHERE ${where}`);
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

async function runOptional(runSql: RunSql, stmt: string, label: string): Promise<void> {
  try {
    await runSql(stmt);
  } catch (err) {
    console.warn(`${label} skipped:`, err instanceof Error ? err.message : err);
  }
}

/** Idempotent DDL for guest registry tables + tour payout column extensions. */
export async function ensureGuestRegistryTables(runSql: RunSql): Promise<void> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_household (
      household_id STRING NOT NULL, hh_size_band STRING NOT NULL, income_band STRING NOT NULL,
      home_msa STRING, enrichment_source STRING, enrichment_as_of DATE
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_location (
      location_id STRING NOT NULL, location_name STRING NOT NULL, location_type STRING NOT NULL,
      market STRING NOT NULL, brand STRING NOT NULL, desk_label STRING
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_guest (
      guest_id STRING NOT NULL, guest_name STRING NOT NULL, email STRING, phone_token STRING,
      guest_type STRING NOT NULL, owner_flag BOOLEAN NOT NULL, household_id STRING,
      qualification_code STRING, tour_booked_date DATE
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.bridge_tour_guest (
      tour_id STRING NOT NULL, guest_id STRING NOT NULL, is_primary BOOLEAN NOT NULL
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_guest_ownership (
      ownership_id STRING NOT NULL, guest_id STRING NOT NULL, property_name STRING NOT NULL,
      location_id STRING, contract_status STRING NOT NULL, points_balance INT, brand STRING
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_guest_rental_stay (
      stay_id STRING NOT NULL, guest_id STRING NOT NULL, location_id STRING NOT NULL,
      stay_type STRING NOT NULL, check_in DATE NOT NULL, check_out DATE NOT NULL, nights INT NOT NULL
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_guest_tour_history (
      history_id STRING NOT NULL, guest_id STRING NOT NULL, tour_id STRING NOT NULL,
      rep_id STRING, tour_date DATE NOT NULL, tour_status STRING NOT NULL, outcome_summary STRING
    ) USING DELTA`,
  ];

  for (const stmt of ddl) {
    await runOptional(runSql, stmt, 'guest registry DDL');
  }

  const alters = [
    'guest_id STRING',
    'household_id STRING',
    'planned_tour_location_id STRING',
    'current_stay_location_id STRING',
    'lead_source STRING',
    'abc_score STRING',
    'package_type STRING',
    'xref_tour_id STRING',
    'tour_booked_date DATE',
  ];
  for (const col of alters) {
    const colName = col.split(' ')[0];
    await runOptional(
      runSql,
      `ALTER TABLE workspace.hgv_comp.fact_marketing_tour_payout ADD COLUMN ${col}`,
      `tour payout column ${colName}`,
    );
  }
}

/** Seed guest spine + link demo marketing tours when registry is empty. */
export async function ensureGuestRegistrySeed(
  runSql: RunSql,
  options?: { skipDdl?: boolean },
): Promise<void> {
  if (!options?.skipDdl) {
    await ensureGuestRegistryTables(runSql);
  }

  const guestCnt = await tableCount(runSql, 'dim_guest');
  if (guestCnt === 0) {
    console.info('Seeding guest registry spine...');
    await seedGuestRegistryData(runSql);
  } else {
    await linkMarketingToursToGuests(runSql);
  }
}

async function seedGuestRegistryData(runSql: RunSql): Promise<void> {
  const statements = [
    `INSERT INTO workspace.hgv_comp.dim_household VALUES
      ('HH-001', '2 adults', 'Qualified Tier 2 ($75K–$99K)', 'Las Vegas-Henderson, NV', 'Internal CRM', DATE '2026-05-01'),
      ('HH-002', '2 adults + 1 child', 'Below qualification threshold', 'Phoenix-Mesa, AZ', 'Internal CRM', DATE '2026-05-01'),
      ('HH-003', '2 adults', 'Qualified Tier 3 ($100K–$149K)', 'Metropolis, KS', 'Internal CRM + licensed append', DATE '2026-05-01')`,

    `INSERT INTO workspace.hgv_comp.dim_location VALUES
      ('LOC-LV-STRIP', 'Hilton Grand Vacations Club on the Las Vegas Strip', 'property', 'Las Vegas', 'HGV', NULL),
      ('LOC-LV-ELARA', 'Elara by Hilton Grand Vacations', 'property', 'Las Vegas', 'HGV', NULL),
      ('LOC-SC-STRIP-SOUTH', 'Las Vegas Strip South Sales Center', 'sales_center', 'Las Vegas', 'HGV', 'Strip South'),
      ('LOC-ORL-W57', 'Orlando Collection — West 57th', 'property', 'Orlando', 'HGV', NULL),
      ('LOC-LV-DESK-SOUTH', 'Las Vegas Strip South Desk', 'desk', 'Las Vegas', 'HGV', 'Strip South')`,

    `INSERT INTO workspace.hgv_comp.dim_guest VALUES
      ('GUEST-001', 'Bruce Wayne', 'bruce.wayne@example.com', 'tok_***4521', 'New Buyer', FALSE, 'HH-001', 'NB-QUAL-2', DATE '2026-05-08'),
      ('GUEST-002', 'Peter Parker', 'peter.parker@example.com', 'tok_***8834', 'Non-Owner', FALSE, 'HH-002', 'COURTESY-NQ', DATE '2026-05-13'),
      ('GUEST-003', 'Clark Kent', 'clark.kent@example.com', 'tok_***2210', 'Owner', TRUE, 'HH-003', 'OWNER-ACTIVE', DATE '2026-05-10')`,

    `INSERT INTO workspace.hgv_comp.bridge_tour_guest VALUES
      ('T-55122', 'GUEST-001', TRUE),
      ('T-55204', 'GUEST-002', TRUE),
      ('T-55180', 'GUEST-003', TRUE)`,

    `INSERT INTO workspace.hgv_comp.fact_guest_ownership VALUES
      ('OWN-003-01', 'GUEST-003', 'Orlando Collection — West 57th', 'LOC-ORL-W57', 'ACTIVE', 12400, 'HGV')`,

    `INSERT INTO workspace.hgv_comp.fact_guest_rental_stay VALUES
      ('STAY-001-CUR', 'GUEST-001', 'LOC-LV-STRIP', 'rental_package', DATE '2026-05-08', DATE '2026-05-12', 4),
      ('STAY-002-CUR', 'GUEST-002', 'LOC-LV-ELARA', 'rental_package', DATE '2026-05-12', DATE '2026-05-15', 3),
      ('STAY-003-CUR', 'GUEST-003', 'LOC-LV-DESK-SOUTH', 'owner_stay', DATE '2026-05-07', DATE '2026-05-12', 5),
      ('STAY-002-PRIOR', 'GUEST-002', 'LOC-ORL-W57', 'exchange', DATE '2025-11-20', DATE '2025-11-27', 7),
      ('STAY-003-PRIOR', 'GUEST-003', 'LOC-LV-STRIP', 'owner_stay', DATE '2025-08-14', DATE '2025-08-18', 4)`,

    `INSERT INTO workspace.hgv_comp.fact_guest_tour_history VALUES
      ('HIST-001-A', 'GUEST-001', 'T-54801', 'MKT-REP-004', DATE '2025-12-02', 'NO_SHOW', 'Package buyer no-show — rebooked as T-55122'),
      ('HIST-002-A', 'GUEST-002', 'T-54910', 'MKT-REP-002', DATE '2026-02-18', 'SHOWN', 'Courtesy tour — income below threshold'),
      ('HIST-003-A', 'GUEST-003', 'T-55044', 'MKT-REP-001', DATE '2026-03-22', 'SHOWN', 'Owner upgrade tour — no close'),
      ('HIST-003-B', 'GUEST-003', 'T-55180', 'PERSONA-MKT-REP', DATE '2026-05-12', 'NO_SHOW', 'Current period no-show — FPS opportunity open')`,
  ];

  for (const stmt of statements) {
    await runOptional(runSql, stmt, 'guest registry seed');
  }

  await seedMarketingTourQuality(runSql);
  await linkMarketingToursToGuests(runSql);
}

async function seedMarketingTourQuality(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const tours: Array<[string, string, string, string, boolean, boolean]> = [
    ['T-55122', 'OPC', 'A', 'Flex', true, false],
    ['T-55204', 'OPC', 'C', 'Discovery', true, false],
    ['T-55180', 'Owner', 'B', 'Preview', false, false],
  ];
  for (const [tid, lead, abc, pkg, showed, closed] of tours) {
    await runOptional(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_tour_quality
        (tour_id, rep_id, period_id, lead_source, abc_score, package_type, showed_flag, closed_flag,
         contract_status, rescission_flag, net_sales_volume, vpg, ebitda_estimate)
       SELECT '${tid}', 'PERSONA-MKT-REP', '${periodId}', '${lead}', '${abc}', '${pkg}',
              ${showed}, ${closed}, 'NONE', FALSE, 0, 0, 0
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = '${tid}')`,
      `tour quality ${tid}`,
    );
  }
}

async function linkMarketingToursToGuests(runSql: RunSql): Promise<void> {
  const links: Array<[string, string, string, string, string, string, string, string, string, string]> = [
    ['T-55122', 'GUEST-001', 'HH-001', 'LOC-SC-STRIP-SOUTH', 'LOC-LV-STRIP', 'OPC', 'A', 'Flex', 'T-55122', '2026-05-08'],
    ['T-55204', 'GUEST-002', 'HH-002', 'LOC-SC-STRIP-SOUTH', 'LOC-LV-ELARA', 'OPC', 'C', 'Discovery', 'T-55204', '2026-05-13'],
    ['T-55180', 'GUEST-003', 'HH-003', 'LOC-SC-STRIP-SOUTH', 'LOC-LV-DESK-SOUTH', 'Owner', 'B', 'Preview', 'T-55180', '2026-05-10'],
  ];
  for (const [tid, gid, hid, planned, stay, lead, abc, pkg, xref, booked] of links) {
    await runOptional(
      runSql,
      `UPDATE workspace.hgv_comp.fact_marketing_tour_payout SET
         guest_id = '${gid}', household_id = '${hid}',
         planned_tour_location_id = '${planned}', current_stay_location_id = '${stay}',
         lead_source = '${lead}', abc_score = '${abc}', package_type = '${pkg}',
         xref_tour_id = '${xref}', tour_booked_date = DATE '${booked}'
       WHERE tour_id = '${tid}' AND (guest_id IS NULL OR guest_id = '${gid}')`,
      `link tour ${tid}`,
    );
  }
}
