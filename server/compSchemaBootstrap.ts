import { BONUS_LEVELS_JAN_2025 } from '../shared/bonusLevelsJan2025.js';
import { MARKETING_PLAN_ASSESSMENTS, SALES_MANAGER_ASSESSMENT } from '../shared/planAssessmentCatalog.js';
import {
  CURRENT_PERIOD_ID,
  CURRENT_PERIOD_LABEL,
  LEGACY_PERIOD_ID,
  LEGACY_PRIOR_PERIOD_ID,
  PRIOR_PERIOD_ID,
  PRIOR_PERIOD_LABEL,
} from '../shared/compPeriods.js';
import { ensureAdminFinanceTables } from './adminFinanceSeed.js';
import { ensureManagerInterventionTable } from './managerInterventions.js';
import { ensureFinanceReferenceTables } from './financeReferenceSeed.js';
import { ensureMarketingTeamRoster, refreshMarketingMarketPositions, ensureSalesDiversitySeed, dedupeRepMarketPositions } from './marketingTeamSeed.js';
import { ensureQuestionCatalogSeed } from './compCatalogSeed.js';
import { ensureGuestRegistrySeed, ensureGuestRegistryTables } from './guestRegistrySeed.js';
import { describeCompDataMode, isProductionCompDataMode } from '../shared/compCatalog.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

let bootstrapPromise: Promise<void> | null = null;

/** Idempotent DDL + seed for marketing/benchmark tables and scenario tour lever. */
export async function ensureCompExtensions(runSql: RunSql): Promise<void> {
  if (isProductionCompDataMode()) {
    console.info(describeCompDataMode());
    return;
  }

  console.info(describeCompDataMode());

  const ddlStatements = [
    `CREATE SCHEMA IF NOT EXISTS workspace.hgv_comp`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.industry_comp_benchmark (
      benchmark_id STRING NOT NULL, role_key STRING NOT NULL, role_label STRING,
      metric_code STRING NOT NULL, market_value DECIMAL(10, 2), hgv_typical_value DECIMAL(10, 2),
      unit STRING, benchmark_source STRING, effective_period STRING, notes STRING
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_regional_bonus_area (
      area_id STRING NOT NULL, period_id STRING NOT NULL, site_line STRING,
      smt_volume DECIMAL(16, 2), budget_volume DECIMAL(16, 2), volume_var_pct DECIMAL(6, 2)
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_regional_bonus_tier (
      area_id STRING NOT NULL, period_id STRING NOT NULL, level INT,
      salespeople_count INT, avg_tier_volume DECIMAL(16, 2), total_tier_volume DECIMAL(16, 2),
      total_cmi DECIMAL(16, 2), cost_pct DECIMAL(6, 2)
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_rep_period (
      rep_id STRING NOT NULL, period_id STRING NOT NULL, rep_name STRING, plan_id STRING,
      assigned_area STRING, bonus_area_id STRING, qtd_earnings DECIMAL(14, 2), paid_to_date DECIMAL(14, 2),
      qualified_tours INT, tours_shown INT, show_rate_pct DECIMAL(6, 2), penetration_pct DECIMAL(6, 2),
      penetration_target_pct DECIMAL(6, 2), spiff_active BOOLEAN, next_tier_label STRING,
      next_tier_gap_tours INT, qualified_tour_pay DECIMAL(14, 2), courtesy_tour_pay DECIMAL(14, 2),
      penetration_spiff DECIMAL(14, 2), chargebacks DECIMAL(14, 2), total_payout DECIMAL(14, 2),
      base_pct DECIMAL(6, 2), variable_pct DECIMAL(6, 2), tcc_gap_vs_market_pct DECIMAL(6, 2)
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_rep_metric (
      rep_id STRING NOT NULL, period_id STRING NOT NULL, metric_name STRING NOT NULL,
      weight_pct DECIMAL(6, 2), earnings DECIMAL(14, 2), attainment_pct DECIMAL(6, 2),
      target_label STRING, opportunity_usd DECIMAL(14, 2)
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_tour_payout (
      tour_id STRING NOT NULL, rep_id STRING NOT NULL, period_id STRING NOT NULL,
      guest_name STRING, guest_type STRING, arrival_date DATE, tour_status STRING, code STRING,
      payout DECIMAL(14, 2), fps_eligible BOOLEAN, fps_potential DECIMAL(14, 2), notes STRING,
      guest_id STRING, household_id STRING, planned_tour_location_id STRING, current_stay_location_id STRING,
      lead_source STRING, abc_score STRING, package_type STRING, xref_tour_id STRING, tour_booked_date DATE
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_chargeback (
      chargeback_id STRING NOT NULL, rep_id STRING NOT NULL, period_id STRING NOT NULL,
      guest_name STRING, tour_id STRING, premium_gift STRING, chargeback_amount DECIMAL(14, 2), notes STRING
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_arrival (
      arrival_id STRING NOT NULL, rep_id STRING NOT NULL, period_id STRING NOT NULL,
      guest_name STRING, guest_type STRING, arrival_datetime STRING, desk STRING,
      potential_qualified_tour DECIMAL(14, 2), potential_fps_payout DECIMAL(14, 2),
      projected_total_payout DECIMAL(14, 2)
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_rep_market_position (
      rep_id STRING NOT NULL, period_id STRING NOT NULL, rep_name STRING, role_key STRING,
      tcc_gap_vs_market_pct DECIMAL(6, 2), base_pct DECIMAL(6, 2), variable_pct DECIMAL(6, 2),
      quota_attainment_pct DECIMAL(6, 2)
    ) USING DELTA`,
  ];

  for (const stmt of ddlStatements) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('ensureCompExtensions DDL skipped:', err instanceof Error ? err.message : err);
    }
  }

  try {
    await runSql(`ALTER TABLE workspace.hgv_comp.scenario_run ADD COLUMN tour_volume_change_pct DECIMAL(6, 2)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|FIELD_ALREADY_EXISTS|DUPLICATE_COLUMN/i.test(msg)) {
      console.warn('scenario_run tour_volume_change_pct migration skipped:', msg);
    }
  }
  try {
    await runSql(`UPDATE workspace.hgv_comp.scenario_run SET tour_volume_change_pct = 0.00 WHERE tour_volume_change_pct IS NULL`);
  } catch (err) {
    console.warn('scenario_run tour_volume backfill skipped:', err instanceof Error ? err.message : err);
  }

  try {
    await runSql(`ALTER TABLE workspace.hgv_comp.scenario_run ADD COLUMN conversion_rate_change_pct DECIMAL(6, 2)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|FIELD_ALREADY_EXISTS|DUPLICATE_COLUMN/i.test(msg)) {
      console.warn('scenario_run conversion_rate_change_pct migration skipped:', msg);
    }
  }
  try {
    await runSql(`UPDATE workspace.hgv_comp.scenario_run SET conversion_rate_change_pct = 0.00 WHERE conversion_rate_change_pct IS NULL`);
  } catch (err) {
    console.warn('scenario_run conversion_rate backfill skipped:', err instanceof Error ? err.message : err);
  }

  await ensureCurrentPeriods(runSql);
  await ensureMarketingTeamRoster(runSql);
  await refreshMarketingMarketPositions(runSql);
  await dedupeRepMarketPositions(runSql, CURRENT_PERIOD_ID);
  await ensureSalesDiversitySeed(runSql);
  await ensureAdminFinanceTables(runSql);
  await ensureManagerInterventionTable(runSql);
  await ensureFinanceReferenceTables(runSql);
  await ensureGuestRegistryTables(runSql);
  void ensureGuestRegistrySeed(runSql, { skipDdl: true }).catch((err) => {
    console.warn('Guest registry background seed:', err instanceof Error ? err.message : err);
  });

  const planAssessmentDdl = [
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.plan_assessment_profile (
      persona_id STRING NOT NULL, plan_id STRING NOT NULL, role_title STRING NOT NULL,
      channel_code STRING NOT NULL, effective_period STRING NOT NULL
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.plan_assessment_segment (
      persona_id STRING NOT NULL, effective_period STRING NOT NULL, attribute STRING NOT NULL,
      attribute_order INT NOT NULL, side STRING NOT NULL, segment_order INT NOT NULL,
      segment_label STRING, segment_value STRING NOT NULL
    ) USING DELTA`,
  ];
  for (const stmt of planAssessmentDdl) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('plan assessment DDL skipped:', err instanceof Error ? err.message : err);
    }
  }

  await seedIfEmpty(runSql, 'industry_comp_benchmark', CURRENT_PERIOD_ID, seedIndustryBenchmarks, 'effective_period');
  await seedIfEmpty(runSql, 'fact_regional_bonus_area', CURRENT_PERIOD_ID, seedRegionalBonusData, 'period_id');
  await ensureRegionalBonusTiers(runSql);
  await seedIfEmpty(runSql, 'fact_marketing_rep_period', 'PERSONA-MKT-REP', seedMarketingBenchmarkData, 'rep_id');
  await seedIfEmpty(runSql, 'plan_assessment_profile', CURRENT_PERIOD_ID, seedPlanAssessmentData, 'effective_period');
  await reconcileTeamSnapshots(runSql);
  await reconcilePlanIdYears(runSql);
  await reconcileMarketingNetPayouts(runSql);
  await reconcileJasonDealCredits(runSql);
  await ensureQuestionCatalogSeed(runSql);
  await ensureCompConfigTables(runSql);
}

async function reconcilePlanIdYears(runSql: RunSql): Promise<void> {
  const migrations = [
    `UPDATE workspace.hgv_comp.plan_assessment_profile SET plan_id = 'PLAN-MKT-MGR-2026' WHERE plan_id = 'PLAN-MKT-MGR-2025'`,
    `UPDATE workspace.hgv_comp.plan_assessment_profile SET plan_id = 'PLAN-MKT-DIR-2026' WHERE plan_id = 'PLAN-MKT-DIR-2025'`,
  ];
  for (const stmt of migrations) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('plan id year migration skipped:', err instanceof Error ? err.message : err);
    }
  }
}

async function reconcileMarketingNetPayouts(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  try {
    await runSql(`
      UPDATE workspace.hgv_comp.fact_marketing_rep_period
      SET total_payout = qtd_earnings + chargebacks
      WHERE period_id = '${periodId}' AND chargebacks != 0
    `);
  } catch (err) {
    console.warn('marketing net payout reconcile skipped:', err instanceof Error ? err.message : err);
  }
}

async function reconcileJasonDealCredits(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  try {
    const rows = await runSql(`
      SELECT COALESCE(SUM(credit_amount), 0) AS credited_total
      FROM workspace.hgv_comp.fact_deal_credit
      WHERE rep_id = 'REP-JASON' AND period_id = '${periodId}' AND credit_status = 'CREDITED'
    `);
    const creditedTotal = Number(rows[0]?.credited_total ?? 0);
    if (Math.abs(creditedTotal - 230000) < 1) return;

    await runSql(`DELETE FROM workspace.hgv_comp.fact_deal_credit WHERE rep_id = 'REP-JASON' AND period_id = '${periodId}'`);
    const dealSeeds = [
      `INSERT INTO workspace.hgv_comp.fact_deal_credit VALUES ('DEAL-1001', 'REP-JASON', '${periodId}', 'PROD-GWK', 'GWK-3PH', 'Grand Waikikian 3PH', 85000.00, 'CREDITED', DATE '2026-04-12')`,
      `INSERT INTO workspace.hgv_comp.fact_deal_credit VALUES ('DEAL-1002', 'REP-JASON', '${periodId}', 'PROD-UPSELL', 'ORL-DLX', 'Orlando Deluxe Package', 72000.00, 'CREDITED', DATE '2026-05-08')`,
      `INSERT INTO workspace.hgv_comp.fact_deal_credit VALUES ('DEAL-1003', 'REP-JASON', '${periodId}', 'PROD-CLUB', 'WC-CLUB', 'West Coast Club Sale', 73000.00, 'CREDITED', DATE '2026-06-18')`,
      `INSERT INTO workspace.hgv_comp.fact_deal_credit VALUES ('DEAL-1004', 'REP-JASON', '${periodId}', 'PROD-FFS', 'FFS-002', 'FFS Contract Bundle', 45000.00, 'PENDING', DATE '2026-06-22')`,
    ];
    for (const stmt of dealSeeds) {
      await runSql(stmt);
    }
  } catch (err) {
    console.warn('Jason deal credit reconcile skipped:', err instanceof Error ? err.message : err);
  }
}

async function reconcileTeamSnapshots(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  try {
    const rows = await runSql(`
      SELECT r.team_id,
             ROUND(AVG(qa.attainment_pct), 1) AS team_attainment_pct,
             SUM(CASE WHEN qa.attainment_pct < 70 THEN 1 ELSE 0 END) AS at_risk_count,
             SUM(CASE WHEN qa.attainment_pct >= 100 THEN 1 ELSE 0 END) AS top_performer_count
      FROM workspace.hgv_comp.dim_rep r
      JOIN workspace.hgv_comp.fact_quota_attainment qa
        ON qa.rep_id = r.rep_id AND qa.period_id = '${periodId}'
      WHERE r.manager_rep_id IS NOT NULL
        AND r.level_code != 'L9'
      GROUP BY r.team_id
    `);
    for (const row of rows) {
      const teamId = String(row.team_id ?? '').replace(/'/g, "''");
      if (!teamId) continue;
      await runSql(`
        UPDATE workspace.hgv_comp.fact_team_snapshot
        SET team_attainment_pct = ${Number(row.team_attainment_pct ?? 0)},
            at_risk_count = ${Number(row.at_risk_count ?? 0)},
            top_performer_count = ${Number(row.top_performer_count ?? 0)}
        WHERE team_id = '${teamId}' AND period_id = '${periodId}'
      `);
    }
  } catch (err) {
    console.warn('team snapshot reconcile skipped:', err instanceof Error ? err.message : err);
  }
}

async function ensureCurrentPeriods(runSql: RunSql): Promise<void> {
  const dimInserts = [
    `INSERT INTO workspace.hgv_comp.dim_period
     SELECT '${CURRENT_PERIOD_ID}', '${CURRENT_PERIOD_LABEL}', DATE '2026-04-01', DATE '2026-06-30', FALSE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_period WHERE period_id = '${CURRENT_PERIOD_ID}')`,
    `INSERT INTO workspace.hgv_comp.dim_period
     SELECT '${PRIOR_PERIOD_ID}', '${PRIOR_PERIOD_LABEL}', DATE '2025-10-01', DATE '2025-12-31', FALSE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_period WHERE period_id = '${PRIOR_PERIOD_ID}')`,
  ];

  for (const stmt of dimInserts) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('dim_period insert skipped:', err instanceof Error ? err.message : err);
    }
  }

  const periodIdTables = [
    'fact_payout',
    'fact_quota_attainment',
    'fact_team_snapshot',
    'fact_deal_credit',
    'fact_marketing_rep_period',
    'fact_marketing_rep_metric',
    'fact_marketing_tour_payout',
    'fact_marketing_chargeback',
    'fact_marketing_arrival',
    'fact_rep_market_position',
    'fact_regional_bonus_area',
    'fact_regional_bonus_tier',
    'scenario_run',
  ];

  for (const table of periodIdTables) {
    try {
      await runSql(`
        UPDATE workspace.hgv_comp.${table}
        SET period_id = '${CURRENT_PERIOD_ID}'
        WHERE period_id = '${LEGACY_PERIOD_ID}'
        AND NOT EXISTS (
          SELECT 1 FROM workspace.hgv_comp.${table} WHERE period_id = '${CURRENT_PERIOD_ID}'
        )
      `);
    } catch (err) {
      console.warn(`period migration skipped for ${table}:`, err instanceof Error ? err.message : err);
    }
  }

  const effectivePeriodTables = ['industry_comp_benchmark', 'plan_assessment_profile', 'plan_assessment_segment'];
  for (const table of effectivePeriodTables) {
    try {
      await runSql(`
        UPDATE workspace.hgv_comp.${table}
        SET effective_period = '${CURRENT_PERIOD_ID}'
        WHERE effective_period = '${LEGACY_PERIOD_ID}'
        AND NOT EXISTS (
          SELECT 1 FROM workspace.hgv_comp.${table} WHERE effective_period = '${CURRENT_PERIOD_ID}'
        )
      `);
    } catch (err) {
      console.warn(`effective_period migration skipped for ${table}:`, err instanceof Error ? err.message : err);
    }
  }

  const priorPeriodTables = [
    'fact_payout',
    'fact_quota_attainment',
    'fact_team_snapshot',
    'fact_marketing_rep_period',
    'fact_regional_bonus_area',
    'fact_regional_bonus_tier',
  ];
  for (const table of priorPeriodTables) {
    try {
      await runSql(`
        UPDATE workspace.hgv_comp.${table}
        SET period_id = '${PRIOR_PERIOD_ID}'
        WHERE period_id = '${LEGACY_PRIOR_PERIOD_ID}'
        AND NOT EXISTS (
          SELECT 1 FROM workspace.hgv_comp.${table} WHERE period_id = '${PRIOR_PERIOD_ID}'
        )
      `);
    } catch (err) {
      console.warn(`prior period migration skipped for ${table}:`, err instanceof Error ? err.message : err);
    }
  }

  const dateShifts = [
    `UPDATE workspace.hgv_comp.fact_marketing_tour_payout
     SET arrival_date = arrival_date + INTERVAL 1 YEAR
     WHERE period_id = '${CURRENT_PERIOD_ID}' AND arrival_date < DATE '2026-01-01'`,
    `UPDATE workspace.hgv_comp.fact_marketing_arrival
     SET arrival_datetime = CAST(CAST(arrival_datetime AS TIMESTAMP) + INTERVAL 1 YEAR AS STRING)
     WHERE period_id = '${CURRENT_PERIOD_ID}' AND arrival_datetime < '2026-01-01'`,
  ];
  for (const stmt of dateShifts) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('marketing date shift skipped:', err instanceof Error ? err.message : err);
    }
  }

  try {
    await runSql(`UPDATE workspace.hgv_comp.dim_period SET is_current = FALSE`);
    await runSql(`UPDATE workspace.hgv_comp.dim_period SET is_current = TRUE WHERE period_id = '${CURRENT_PERIOD_ID}'`);
  } catch (err) {
    console.warn('dim_period is_current update skipped:', err instanceof Error ? err.message : err);
  }
}

async function seedPlanAssessmentData(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const personas = [...Object.values(MARKETING_PLAN_ASSESSMENTS), SALES_MANAGER_ASSESSMENT];
  for (const p of personas) {
    try {
      await runSql(`
        INSERT INTO workspace.hgv_comp.plan_assessment_profile
        VALUES ('${p.personaId}', '${p.planId}', '${p.roleTitle.replace(/'/g, "''")}', '${p.channelCode}', '${periodId}')
      `);
      for (let ai = 0; ai < p.rows.length; ai++) {
        const row = p.rows[ai];
        for (let si = 0; si < row.hgvPlan.length; si++) {
          const seg = row.hgvPlan[si];
          const label = seg.label ? `'${seg.label.replace(/'/g, "''")}'` : 'NULL';
          await runSql(`
            INSERT INTO workspace.hgv_comp.plan_assessment_segment
            VALUES ('${p.personaId}', '${periodId}', '${row.attribute.replace(/'/g, "''")}', ${ai + 1}, 'hgv', ${si + 1}, ${label}, '${seg.value.replace(/'/g, "''")}')
          `);
        }
        for (let si = 0; si < row.marketStandard.length; si++) {
          const seg = row.marketStandard[si];
          const label = seg.label ? `'${seg.label.replace(/'/g, "''")}'` : 'NULL';
          await runSql(`
            INSERT INTO workspace.hgv_comp.plan_assessment_segment
            VALUES ('${p.personaId}', '${periodId}', '${row.attribute.replace(/'/g, "''")}', ${ai + 1}, 'market', ${si + 1}, ${label}, '${seg.value.replace(/'/g, "''")}')
          `);
        }
      }
    } catch (err) {
      console.warn(`plan assessment seed skipped for ${p.personaId}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function tableCount(runSql: RunSql, table: string, where = '1=1'): Promise<number> {
  try {
    const rows = await runSql(`SELECT COUNT(*) AS cnt FROM workspace.hgv_comp.${table} WHERE ${where}`);
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

async function seedIfEmpty(
  runSql: RunSql,
  table: string,
  marker: string,
  seedFn: (runSql: RunSql) => Promise<void>,
  markerColumn: string,
): Promise<void> {
  const cnt = await tableCount(runSql, table, `${markerColumn} = '${marker}'`);
  if (cnt > 0) return;
  console.info(`Seeding workspace.hgv_comp.${table}...`);
  await seedFn(runSql);
}

/** Singleton guard — safe to call from routes; never crashes the process. */
export function ensureCompExtensionsOnce(runSql: RunSql): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureCompExtensions(runSql).catch((err) => {
      bootstrapPromise = null;
      console.warn('Comp schema bootstrap failed (tables must be pre-provisioned):', err instanceof Error ? err.message : err);
    });
  }
  return bootstrapPromise;
}

/** Wait up to maxMs for bootstrap — never block page loads on full seed completion. */
export async function waitForBootstrap(runSql: RunSql, maxMs = 15_000): Promise<void> {
  const boot = ensureCompExtensionsOnce(runSql);
  await Promise.race([
    boot.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}

async function ensureRegionalBonusTiers(runSql: RunSql): Promise<void> {
  const tierCnt = await tableCount(runSql, 'fact_regional_bonus_tier', `period_id = '${CURRENT_PERIOD_ID}'`);
  if (tierCnt > 0) return;
  console.info('Regional bonus tiers missing for current period — re-seeding from PDF catalog...');
  await seedRegionalBonusData(runSql);
}

async function seedIndustryBenchmarks(runSql: RunSql): Promise<void> {
  try {
    await runSql(`INSERT INTO workspace.hgv_comp.industry_comp_benchmark VALUES
    ('BMK-S16-A1-DIR', 'marketing_director', 'Directors / Sr. Directors', 'TCC_GAP_PCT', 17, 17, '%', 'Slide 16 Area 1', '2026-Q2', 'Directors 10-17% below market target TCC'),
    ('BMK-S16-A1-VP', 'sales_vp', 'Sales VPs', 'TCC_GAP_PCT', 43, 43, '%', 'Slide 16 Area 1', '2026-Q2', 'Sales VPs 14-43% below market target TCC'),
    ('BMK-PM-MKT-REP-B', 'marketing_rep', 'Marketing Reps', 'PAY_MIX_BASE', 60, 40, '%', 'Slide 16 Area 2', '2026-Q2', 'Market standard base/variable'),
    ('BMK-PM-MKT-REP-V', 'marketing_rep', 'Marketing Reps', 'PAY_MIX_VAR', 40, 60, '%', 'Slide 16 Area 2', '2026-Q2', 'Market standard base/variable'),
    ('BMK-PM-SE-B', 'sales_executive', 'Sales Executives', 'PAY_MIX_BASE', 35, 20, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 30/70 - 40/60'),
    ('BMK-PM-SE-V', 'sales_executive', 'Sales Executives', 'PAY_MIX_VAR', 65, 80, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 30/70 - 40/60'),
    ('BMK-PM-SM-B', 'sales_manager', 'Sales Managers', 'PAY_MIX_BASE', 50, 30, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 30/70 - 70/30'),
    ('BMK-PM-MGR-B', 'marketing_manager', 'Marketing Managers', 'PAY_MIX_BASE', 62.5, 40, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 40/60 - 85/15'),
    ('BMK-PM-DIR-B', 'marketing_director', 'Director+', 'PAY_MIX_BASE', 65, 35, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 50/40 - 80/20'),
    ('BMK-COMM-OPT', 'all', 'All Sales Roles', 'COMMISSION_RATE', 6, 6, '%', 'Slide 16 Area 3', '2026-Q2', 'Optimal commission band 4-6%'),
    ('BMK-NOI-W', 'marketing_director', 'Director+', 'NOI_WEIGHT', 65, 35, '%', 'Slide 16 Area 4', '2026-Q2', 'Market-aligned NOI weight 50-80%')`);
  } catch (err) {
    console.warn('Industry benchmark seed skipped:', err instanceof Error ? err.message : err);
  }
}

async function seedRegionalBonusData(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  for (const area of BONUS_LEVELS_JAN_2025) {
    try {
      await runSql(`INSERT INTO workspace.hgv_comp.fact_regional_bonus_area VALUES (
        '${area.areaId}', '${periodId}', '${area.siteLine.replace(/'/g, "''")}',
        ${area.smtVolume}, ${area.budgetVolume}, ${area.volumeVarPct})`);
      for (const tier of area.tiers) {
        await runSql(`INSERT INTO workspace.hgv_comp.fact_regional_bonus_tier VALUES (
          '${area.areaId}', '${periodId}', ${tier.level}, ${tier.salespeopleCount},
          ${tier.avgTierVolume}, ${tier.totalTierVolume}, ${tier.totalCmi}, ${tier.costPct})`);
      }
    } catch (err) {
      console.warn(`Regional bonus seed skipped for ${area.areaId}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function seedMarketingBenchmarkData(runSql: RunSql): Promise<void> {
  const seeds = [
    `INSERT INTO workspace.hgv_comp.dim_rep (rep_id, rep_name, level_code, team_id, manager_rep_id, region, is_active)
     SELECT 'PERSONA-MKT-REP', 'T. Brooks', 'C2a', 'TEAM-MKT-LAS', 'PERSONA-MKT-MGR', 'West', TRUE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'PERSONA-MKT-REP')`,

    `INSERT INTO workspace.hgv_comp.fact_marketing_rep_period VALUES (
      'PERSONA-MKT-REP', '2026-Q2', 'T. Brooks', 'PLAN-MKT-REP-2026', 'Las Vegas Strip South Desk', 'LV-HGV-AL',
      245, 245, 2, 2, 66.7, 24, 20, TRUE, 'Tier 3 - $100 qualified tour rate', 3,
      75, 20, 150, -50, 195, 40, 60, -14)`,

    `INSERT INTO workspace.hgv_comp.fact_marketing_rep_metric VALUES
      ('PERSONA-MKT-REP', '2026-Q2', 'Qualified Tours (Owner, New Buyer)', 45, 95, 67, '3 qualified Owner/NB tours', 225),
      ('PERSONA-MKT-REP', '2026-Q2', 'Individual FPS Packages', 35, 150, 24, 'Penetration 24% vs 20% target', 840),
      ('PERSONA-MKT-REP', '2026-Q2', 'Individual Sales Transactions', 20, 0, 0, '1 closed transaction', 320)`,

    `INSERT INTO workspace.hgv_comp.fact_marketing_tour_payout VALUES
      ('T-55122', 'PERSONA-MKT-REP', '2026-Q2', 'Bruce Wayne', 'New Buyer', DATE '2026-05-10', 'SHOWN', 'Q', 75, TRUE, 420, 'Qualified NB — FPS not sold'),
      ('T-55204', 'PERSONA-MKT-REP', '2026-Q2', 'Peter Parker', 'Non-Owner', DATE '2026-05-15', 'SHOWN', 'NQ', 20, FALSE, 0, 'Courtesy tour'),
      ('T-55180', 'PERSONA-MKT-REP', '2026-Q2', 'Clark Kent', 'Owner', DATE '2026-05-12', 'NO_SHOW', '—', 0, TRUE, 380, 'Owner no-show')`,

    `INSERT INTO workspace.hgv_comp.fact_marketing_chargeback VALUES
      ('CB-44102', 'PERSONA-MKT-REP', '2026-Q2', 'Lex Luthor', 'T-55219', '2× Vegas Show Tickets', 50, 'Gift chargeback')`,

    `INSERT INTO workspace.hgv_comp.fact_marketing_arrival VALUES
      ('ARR-90112', 'PERSONA-MKT-REP', '2026-Q2', 'Diana Prince', 'New Buyer', '2026-05-24 09:30', 'Strip South', 100, 480, 580),
      ('ARR-90415', 'PERSONA-MKT-REP', '2026-Q2', 'Steve Rogers', 'New Buyer', '2026-05-24 11:30', 'Strip South', 100, 480, 580),
      ('ARR-90420', 'PERSONA-MKT-REP', '2026-Q2', 'Natasha Romanoff', 'New Buyer', '2026-05-25 13:00', 'Elara', 100, 410, 510)`,

    `INSERT INTO workspace.hgv_comp.fact_rep_market_position
      (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
     SELECT 'MKT-REP-001', '2026-Q2', 'M. Chen', 'marketing_rep', -12, 38, 62, 112
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position WHERE rep_id = 'MKT-REP-001' AND period_id = '2026-Q2')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_market_position
      (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
     SELECT 'MKT-REP-002', '2026-Q2', 'J. Rivera', 'marketing_rep', 5, 55, 45, 94
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position WHERE rep_id = 'MKT-REP-002' AND period_id = '2026-Q2')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_market_position
      (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
     SELECT 'MKT-REP-003', '2026-Q2', 'A. Patel', 'marketing_rep', -18, 35, 65, 58
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position WHERE rep_id = 'MKT-REP-003' AND period_id = '2026-Q2')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_market_position
      (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
     SELECT 'MKT-REP-004', '2026-Q2', 'K. Nguyen', 'marketing_rep', -8, 42, 58, 71
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position WHERE rep_id = 'MKT-REP-004' AND period_id = '2026-Q2')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_market_position
      (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
     SELECT 'MKT-REP-005', '2026-Q2', 'S. Okonkwo', 'marketing_rep', 3, 58, 42, 103
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position WHERE rep_id = 'MKT-REP-005' AND period_id = '2026-Q2')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_market_position
      (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
     SELECT 'MKT-REP-006', '2026-Q2', 'L. Torres', 'marketing_rep', -22, 32, 68, 48
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position WHERE rep_id = 'MKT-REP-006' AND period_id = '2026-Q2')`,
  ];

  for (const stmt of seeds) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('Marketing seed skipped:', err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Ensure compensation config tables exist with default seed values.
 * Idempotent: only inserts if config rows don't already exist.
 */
async function ensureCompConfigTables(runSql: RunSql): Promise<void> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_tour_status_config (
      config_id STRING NOT NULL, tour_status_desc STRING, payout_amount DECIMAL(10, 2) NOT NULL,
      is_active BOOLEAN NOT NULL, effective_start_date DATE NOT NULL, effective_end_date DATE,
      created_at TIMESTAMP NOT NULL, created_by STRING NOT NULL,
      updated_at TIMESTAMP, updated_by STRING
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_comp_rule_config (
      config_id STRING NOT NULL, rule_name STRING NOT NULL, rule_value STRING NOT NULL,
      rule_description STRING, is_active BOOLEAN NOT NULL, effective_start_date DATE NOT NULL,
      effective_end_date DATE, created_at TIMESTAMP NOT NULL, created_by STRING NOT NULL,
      updated_at TIMESTAMP, updated_by STRING
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_rep_filter_config (
      config_id STRING NOT NULL, filter_name STRING NOT NULL, filter_type STRING NOT NULL, 
      filter_value STRING NOT NULL, is_active BOOLEAN NOT NULL, effective_start_date DATE NOT NULL,
      effective_end_date DATE, created_at TIMESTAMP NOT NULL, created_by STRING NOT NULL,
      updated_at TIMESTAMP, updated_by STRING
    ) USING DELTA`,

    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_comp_config_audit_log (
      audit_id STRING NOT NULL, config_table STRING NOT NULL, config_id STRING NOT NULL,
      action STRING NOT NULL, changed_by STRING NOT NULL, changed_at TIMESTAMP NOT NULL,
      old_value STRING, new_value STRING
    ) USING DELTA`,
  ];

  for (const stmt of ddl) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('Comp config DDL skipped:', err instanceof Error ? err.message : err);
    }
  }

  // Default tour status mappings (idempotent)
  const tourStatusSeeds = [
    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-SHOW-001', 'SHOW', 50.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-SHOW-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-TOUR-001', 'TOUR', 50.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-TOUR-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-NOSHOW-001', 'NO SHOW', 25.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-NOSHOW-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-CANCELLED-001', 'CANCELLED', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-CANCELLED-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-CANCELED-001', 'CANCELED', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-CANCELED-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-SHOWNOTOUR-001', 'SHOW - NO TOUR', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-SHOWNOTOUR-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-BOOKED-001', 'BOOKED', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-BOOKED-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-BOOK-001', 'BOOK', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-BOOK-001')`,

    `INSERT INTO workspace.hgv_comp.dim_tour_status_config
      (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
     SELECT 'TS-NULL-001', '__NULL__', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-NULL-001')`,
  ];

  for (const stmt of tourStatusSeeds) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('Tour status seed skipped:', err instanceof Error ? err.message : err);
    }
  }

  // Default compensation rules (idempotent)
  const compRuleSeeds = [
    `INSERT INTO workspace.hgv_comp.dim_comp_rule_config
      (config_id, rule_name, rule_value, rule_description, is_active, effective_start_date, created_at, created_by)
     SELECT 'CR-MULTIREP-001', 'multi_rep_credit_policy', 'first_rep_only',
       'When multiple OPC reps listed, credit 100% to first rep (opc_person_1_name)', TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_comp_rule_config WHERE config_id = 'CR-MULTIREP-001')`,

    `INSERT INTO workspace.hgv_comp.dim_comp_rule_config
      (config_id, rule_name, rule_value, rule_description, is_active, effective_start_date, created_at, created_by)
     SELECT 'CR-MINCOUNT-001', 'min_tour_count_threshold', '0',
       'Minimum tour count for rep to appear in dim_marketing_rep (0 = no filter)', TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_comp_rule_config WHERE config_id = 'CR-MINCOUNT-001')`,
  ];

  for (const stmt of compRuleSeeds) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('Comp rule seed skipped:', err instanceof Error ? err.message : err);
    }
  }

  // Default rep filter rules (idempotent)
  const repFilterSeeds = [
    `INSERT INTO workspace.hgv_comp.dim_rep_filter_config
      (config_id, filter_name, filter_type, filter_value, is_active, effective_start_date, created_at, created_by)
     SELECT 'RF-EXCLUDE-001', 'Exclude UNASSIGNED', 'exclude_pattern', 'UNASSIGNED', FALSE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep_filter_config WHERE config_id = 'RF-EXCLUDE-001')`,

    `INSERT INTO workspace.hgv_comp.dim_rep_filter_config
      (config_id, filter_name, filter_type, filter_value, is_active, effective_start_date, created_at, created_by)
     SELECT 'RF-EXCLUDE-002', 'Exclude TBD', 'exclude_pattern', 'TBD', FALSE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep_filter_config WHERE config_id = 'RF-EXCLUDE-002')`,
  ];

  for (const stmt of repFilterSeeds) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('Rep filter seed skipped:', err instanceof Error ? err.message : err);
    }
  }

  console.info('[Comp Config] Default compensation configuration seeded successfully.');
}
