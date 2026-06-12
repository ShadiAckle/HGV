-- =============================================================================
-- HGV Compensation Hub — live source views (production read path)
-- Catalog: edw_dev_hris | Schema: hgv_comp
-- =============================================================================
-- Replaces synthetic Delta TABLES with VIEWS over governed ETL sources:
--   edw_dev_cognos.cognos_fm.it_smt_detail
--   edw_dev_cognos.cognos_fm.it_smt_marketing
--   edw_dev_cognos.cognos_fm.it_smt_personnel
--   edw_dev_cognos.cognos_fm.it_smt_contract
--   edw_dev_cognos.cognos_fm.it_uni_contract
--   edw_dev_cognos.cognos_fm.it_uni_lead
--   edw_dev_hris.pwcmodels.commissions
--
-- Prerequisites:
--   1. Run 00_bootstrap_all_ddl.sql once (creates schema + writable tables).
--   2. SKIP demo seed scripts (02*, 04*, 05a*, 06a*, 07a*, 09a*, 10a*).
--   3. Principal needs USE CATALOG on edw_dev_hris AND edw_dev_cognos.
--   4. Optional reference seeds still recommended:
--        06a_seed_marketing_benchmark.sql (industry_comp_benchmark)
--        10a_seed_plan_assessment.sql (plan_assessment_*)
--        07a_seed_regional_bonus.sql (regional bonus tables)
--        05b seed / dim_finance_period if finance agent is in scope
--
-- Writable objects (NOT replaced — app INSERT/UPDATE still uses Delta tables):
--   scenario_run, scenario_result, scenario_payout_series
--   semantic_definitions, fact_comp_admin_log, fact_manager_intervention
--   industry_comp_benchmark, plan_assessment_*, fact_regional_bonus_*
--   dim_finance_period, dim_plan_component, fact_call_center_credit
--
-- After running: set COMP_DATA_MODE=production (or disable bootstrap seeds) on the app.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS edw_dev_hris.hgv_comp
COMMENT 'HGV comp semantic layer — live views over Cognos / PwC ETL';

-- ---------------------------------------------------------------------------
-- Internal staging views (join spine + helpers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp._src_tour_spine AS
SELECT
  d.tour_key_hash,
  d.tour_id,
  d.tour_key,
  d.contr_num,
  d.enterprise_lead_id,
  d.lead_id,
  COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date)) AS tour_date,
  COALESCE(CAST(d.showed AS INT), 0) = 1 AS showed_flag,
  COALESCE(CAST(d.qualified AS INT), 0) = 1 AS qualified_flag,
  COALESCE(CAST(d.booked AS INT), 0) = 1 AS booked_flag,
  CAST(COALESCE(d.gross_transactions, 0) AS INT) AS gross_transactions,
  CAST(COALESCE(d.net_transactions, 0) AS INT) AS net_transactions,
  CAST(COALESCE(d.net_volume, 0) AS DECIMAL(14, 2)) AS net_volume,
  CAST(COALESCE(d.gross_volume, 0) AS DECIMAL(14, 2)) AS gross_volume,
  COALESCE(d.product_code, 'UNK') AS product_code,
  COALESCE(d.product_desc, 'Unknown') AS product_desc,
  COALESCE(d.ops_contract_status_desc, d.acct_contract_status_desc, 'UNKNOWN') AS contract_status,
  COALESCE(d.lead_source_desc, 'Unknown') AS lead_source,
  COALESCE(d.purchase_type_desc, 'Unknown') AS purchase_type,
  COALESCE(d.lead_prequal_fico_tier, 'U') AS abc_score,
  m.tour_status_desc,
  m.tour_booked_date,
  m.tour_arrival_time,
  m.office_code,
  m.office_description,
  COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other') AS office_region,
  COALESCE(m.channel, 'Unknown') AS channel,
  COALESCE(m.marketing_program_desc, 'Unknown') AS marketing_program,
  COALESCE(m.marketing_package_type_desc, 'Unknown') AS package_type,
  p.salesperson_1_employee_id,
  p.salesperson_1_name,
  COALESCE(NULLIF(TRIM(p.sales_team_code), ''), CONCAT('TEAM-', COALESCE(m.office_code, 'UNK'))) AS sales_team_code,
  p.salesperson_2_employee_id,
  p.salesperson_3_employee_id
FROM edw_dev_cognos.cognos_fm.it_smt_detail d
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON d.tour_key_hash = m.tour_key_hash
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON d.tour_key_hash = p.tour_key_hash;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp._src_rep_directory AS
SELECT DISTINCT
  CAST(p.salesperson_1_employee_id AS STRING) AS rep_id,
  COALESCE(NULLIF(TRIM(p.salesperson_1_name), ''), 'Unknown Rep') AS rep_name,
  'MKT' AS level_code,
  COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT') AS team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other') AS region,
  TRUE AS is_active,
  'marketing' AS source_domain
FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON p.tour_key_hash = m.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL

UNION

SELECT DISTINCT
  c.participant AS rep_id,
  c.participant AS rep_name,
  CASE
    WHEN LOWER(c.title) LIKE '%manager%' THEN 'L8'
    WHEN LOWER(c.title) LIKE '%train%' THEN 'L5'
    ELSE 'L6'
  END AS level_code,
  COALESCE(NULLIF(TRIM(c.businessUnit), ''), 'TEAM-FIELD') AS team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  'Field' AS region,
  TRUE AS is_active,
  'field' AS source_domain
FROM edw_dev_hris.pwcmodels.commissions c
WHERE c.participant IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp._src_period_calendar AS
SELECT DISTINCT
  CONCAT(
    CAST(YEAR(TO_DATE(payDate)) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CONCAT(
    'Q',
    CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) AS STRING),
    ' ',
    CAST(YEAR(TO_DATE(payDate)) AS STRING)
  ) AS period_label,
  MAKE_DATE(
    YEAR(TO_DATE(payDate)),
    CAST((CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) - 1) * 3 + 1 AS INT),
    1
  ) AS period_start,
  LAST_DAY(
    MAKE_DATE(
      YEAR(TO_DATE(payDate)),
      CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) * 3 AS INT),
      1
    )
  ) AS period_end
FROM edw_dev_hris.pwcmodels.commissions
WHERE payDate IS NOT NULL

UNION

SELECT DISTINCT
  CONCAT(
    CAST(YEAR(t.tour_date) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CONCAT(
    'Q',
    CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) AS STRING),
    ' ',
    CAST(YEAR(t.tour_date) AS STRING)
  ) AS period_label,
  MAKE_DATE(
    YEAR(t.tour_date),
    CAST((CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) - 1) * 3 + 1 AS INT),
    1
  ) AS period_start,
  LAST_DAY(
    MAKE_DATE(
      YEAR(t.tour_date),
      CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) * 3 AS INT),
      1
    )
  ) AS period_end
FROM edw_dev_hris.hgv_comp._src_tour_spine t
WHERE t.tour_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Drop synthetic tables that will become views (views cannot replace tables in-place)
-- ---------------------------------------------------------------------------

--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_team;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_team;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_rep;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_period;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_plan_version;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_plan_version;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_product_line;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_product_line;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_location;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_location;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_guest;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_guest;
--drop view IF EXISTS edw_dev_hris.hgv_comp.dim_household;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_household;
--drop view IF EXISTS edw_dev_hris.hgv_comp.bridge_tour_guest;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.bridge_tour_guest;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_guest_ownership;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_guest_ownership;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_guest_tour_history;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_guest_tour_history;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_guest_rental_stay;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_guest_rental_stay;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_payout;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_payout;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_quota_attainment;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_quota_attainment;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_deal_credit;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_deal_credit;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_tour_quality;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_tour_quality;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_team_snapshot;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_team_snapshot;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_rep_product_mix;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_rep_product_mix;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_plan_eligibility;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_plan_eligibility;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_chargeback;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_chargeback;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
--drop view IF EXISTS edw_dev_hris.hgv_comp.fact_rep_market_position;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_rep_market_position;

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_rep AS
SELECT
  rep_id,
  rep_name,
  level_code,
  team_id,
  manager_rep_id,
  region,
  is_active
FROM edw_dev_hris.hgv_comp._src_rep_directory;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_team AS
SELECT DISTINCT
  team_id,
  COALESCE(NULLIF(TRIM(team_id), ''), 'TEAM-UNK') AS team_name,
  region
FROM edw_dev_hris.hgv_comp._src_rep_directory
WHERE team_id IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_period AS
WITH ranked AS (
  SELECT
    period_id,
    period_label,
    period_start,
    period_end,
    ROW_NUMBER() OVER (ORDER BY period_start DESC) AS rn
  FROM edw_dev_hris.hgv_comp._src_period_calendar
)
SELECT
  period_id,
  period_label,
  period_start,
  period_end,
  (rn = 1) AS is_current
FROM ranked;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_plan_version AS
SELECT
  'PLAN-FT-2026' AS plan_version_id,
  'HGV Field & Marketing Comp FY2026' AS plan_name,
  DATE '2026-01-01' AS effective_start,
  CAST(NULL AS DATE) AS effective_end;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_product_line AS
SELECT DISTINCT
  CASE WHEN COALESCE(CAST(uc.project_ffs AS INT), 0) = 1 THEN 'PROD-FFS' ELSE 'PROD-NONFFS' END AS product_line_id,
  CASE WHEN COALESCE(CAST(uc.project_ffs AS INT), 0) = 1 THEN 'Full Fee Service (FFS)' ELSE 'Non-FFS / Mixed' END AS product_line_name,
  COALESCE(CAST(uc.project_ffs AS INT), 0) = 1 AS is_ffs
FROM edw_dev_cognos.cognos_fm.it_uni_contract uc
WHERE uc.project_ffs IS NOT NULL

UNION ALL

SELECT 'PROD-FFS', 'Full Fee Service (FFS)', TRUE
UNION ALL
SELECT 'PROD-NONFFS', 'Non-FFS / Mixed', FALSE;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_location AS
SELECT DISTINCT
  CONCAT('LOC-', office_code) AS location_id,
  COALESCE(NULLIF(TRIM(office_description), ''), CONCAT('Office ', office_code)) AS location_name,
  'sales_center' AS location_type,
  office_region AS market,
  COALESCE(NULLIF(TRIM(office_brand), ''), 'HGV') AS brand,
  office_code AS desk_label
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE office_code IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_household AS
SELECT DISTINCT
  CONCAT('HH-', l.enterprise_lead_id) AS household_id,
  CASE
    WHEN COALESCE(CAST(l.lead_num_of_dependants AS INT), 0) <= 0 THEN '1-2'
    WHEN COALESCE(CAST(l.lead_num_of_dependants AS INT), 0) <= 2 THEN '3-4'
    ELSE '5+'
  END AS hh_size_band,
  'Not disclosed' AS income_band,
  COALESCE(NULLIF(TRIM(l.lead_city), ''), 'Unknown') AS home_msa,
  'uni_lead' AS enrichment_source,
  TO_DATE(l.date_lead_created) AS enrichment_as_of
FROM edw_dev_cognos.cognos_fm.it_uni_lead l
WHERE l.enterprise_lead_id IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_guest AS
SELECT DISTINCT
  CAST(l.enterprise_lead_id AS STRING) AS guest_id,
  CONCAT(
    COALESCE(NULLIF(TRIM(l.lead_first_name_1), ''), 'Guest'),
    ' ',
    COALESCE(NULLIF(TRIM(l.lead_last_name_1), ''), CAST(l.enterprise_lead_id AS STRING))
  ) AS guest_name,
  CAST(NULL AS STRING) AS email,
  CAST(NULL AS STRING) AS phone_token,
  CASE
    WHEN COALESCE(CAST(sc.number_of_developed_contracts_owned AS INT), 0)
       + COALESCE(CAST(sc.number_of_managed_contracts_owned AS INT), 0) > 0 THEN 'Owner'
    ELSE 'Prospect'
  END AS guest_type,
  COALESCE(CAST(sc.number_of_developed_contracts_owned AS INT), 0)
    + COALESCE(CAST(sc.number_of_managed_contracts_owned AS INT), 0) > 0 AS owner_flag,
  CONCAT('HH-', l.enterprise_lead_id) AS household_id,
  COALESCE(NULLIF(TRIM(l.lead_hhn_tier_code), ''), 'UNK') AS qualification_code,
  TO_DATE(l.date_lead_created) AS tour_booked_date
FROM edw_dev_cognos.cognos_fm.it_uni_lead l
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_contract sc
  ON CAST(sc.enterprise_lead_id AS STRING) = CAST(l.enterprise_lead_id AS STRING)
WHERE l.enterprise_lead_id IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.bridge_tour_guest AS
SELECT DISTINCT
  CAST(t.tour_id AS STRING) AS tour_id,
  CAST(t.enterprise_lead_id AS STRING) AS guest_id,
  TRUE AS is_primary
FROM edw_dev_hris.hgv_comp._src_tour_spine t
WHERE t.tour_id IS NOT NULL
  AND t.enterprise_lead_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Field sales facts (pwcmodels.commissions + uni_contract)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_payout AS
SELECT
  c.participant AS rep_id,
  CONCAT(
    CAST(YEAR(TO_DATE(c.payDate)) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(TO_DATE(c.payDate)) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CAST(0 AS DECIMAL(14, 2)) AS base_pay,
  CAST(SUM(CAST(c.commissionAmount AS DECIMAL(14, 2))) AS DECIMAL(14, 2)) AS commission,
  CAST(
    SUM(
      CASE
        WHEN LOWER(COALESCE(c.name, '')) <> 'regular commission'
          THEN CAST(c.commissionAmount AS DECIMAL(14, 2))
        ELSE 0
      END
    ) AS DECIMAL(14, 2)
  ) AS bonus,
  CAST(SUM(CAST(c.commissionAmount AS DECIMAL(14, 2))) AS DECIMAL(14, 2)) AS total_earnings,
  CAST(SUM(CAST(c.commissionAmount AS DECIMAL(14, 2))) AS DECIMAL(14, 2)) AS total_paid
FROM edw_dev_hris.pwcmodels.commissions c
WHERE c.participant IS NOT NULL
  AND c.payDate IS NOT NULL
GROUP BY c.participant, 2;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_deal_credit AS
SELECT
  CONCAT('DEAL-', CAST(uc.contr_num AS STRING)) AS deal_id,
  COALESCE(
    CAST(p.salesperson_1_employee_id AS STRING),
    CONCAT('ORDER-', CAST(uc.contr_num AS STRING))
  ) AS rep_id,
  CONCAT(
    CAST(YEAR(COALESCE(TO_DATE(uc.date_sold), TO_DATE(uc.pender_date))) AS STRING),
    '-Q',
    CAST(
      CAST(CEIL(MONTH(COALESCE(TO_DATE(uc.date_sold), TO_DATE(uc.pender_date))) / 3.0) AS INT) AS STRING
    )
  ) AS period_id,
  CASE WHEN COALESCE(CAST(uc.project_ffs AS INT), 0) = 1 THEN 'PROD-FFS' ELSE 'PROD-NONFFS' END AS product_line_id,
  COALESCE(NULLIF(TRIM(uc.project_bu), ''), COALESCE(NULLIF(TRIM(uc.office_code), ''), 'UNK')) AS property_code,
  COALESCE(NULLIF(TRIM(uc.project_desc), ''), 'HGV Property') AS property_display_name,
  CAST(COALESCE(uc.net_volume, 0) AS DECIMAL(14, 2)) AS credit_amount,
  COALESCE(NULLIF(TRIM(uc.contract_status_desc), ''), 'UNKNOWN') AS credit_status,
  COALESCE(TO_DATE(uc.date_sold), TO_DATE(uc.pender_date), DATE '1970-01-01') AS credit_date
FROM edw_dev_cognos.cognos_fm.it_uni_contract uc
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON CAST(p.tour_id AS STRING) = CAST(uc.tour_id AS STRING)
WHERE uc.contr_num IS NOT NULL
  AND CAST(uc.contr_num AS BIGINT) > 0;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_quota_attainment AS
WITH rep_period AS (
  SELECT
    rep_id,
    period_id,
    SUM(credit_amount) AS credited_amount,
    COUNT(*) AS deals_closed_count
  FROM edw_dev_hris.hgv_comp.fact_deal_credit
  GROUP BY rep_id, period_id
),
field_commission AS (
  SELECT
    participant AS rep_id,
    CONCAT(
      CAST(YEAR(TO_DATE(payDate)) AS STRING),
      '-Q',
      CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) AS STRING)
    ) AS period_id,
    SUM(CAST(value AS DECIMAL(14, 2))) AS order_value
  FROM edw_dev_hris.pwcmodels.commissions
  WHERE participant IS NOT NULL
  GROUP BY participant, 2
)
SELECT
  COALESCE(r.rep_id, f.rep_id) AS rep_id,
  COALESCE(r.period_id, f.period_id) AS period_id,
  'PLAN-FT-2026' AS plan_version_id,
  CAST(
    GREATEST(
      COALESCE(r.credited_amount, 0) * 1.10,
      COALESCE(f.order_value, 0) * 1.05,
      1
    ) AS DECIMAL(14, 2)
  ) AS quota_amount,
  CAST(COALESCE(r.credited_amount, 0) AS DECIMAL(14, 2)) AS credited_amount,
  CAST(
    LEAST(
      999.99,
      CASE
        WHEN GREATEST(
          COALESCE(r.credited_amount, 0) * 1.10,
          COALESCE(f.order_value, 0) * 1.05,
          1
        ) = 0 THEN 0
        ELSE (COALESCE(r.credited_amount, 0) / GREATEST(
          COALESCE(r.credited_amount, 0) * 1.10,
          COALESCE(f.order_value, 0) * 1.05,
          1
        )) * 100
      END
    ) AS DECIMAL(6, 2)
  ) AS attainment_pct,
  CAST(COALESCE(r.deals_closed_count, 0) AS INT) AS deals_closed_count,
  CAST(100.00 AS DECIMAL(6, 2)) AS next_tier_threshold_pct,
  CAST(
    GREATEST(
      0,
      GREATEST(
        COALESCE(r.credited_amount, 0) * 1.10,
        COALESCE(f.order_value, 0) * 1.05,
        1
      ) - COALESCE(r.credited_amount, 0)
    ) AS DECIMAL(14, 2)
  ) AS next_tier_gap_amount
FROM rep_period r
FULL OUTER JOIN field_commission f
  ON r.rep_id = f.rep_id
 AND r.period_id = f.period_id
WHERE COALESCE(r.rep_id, f.rep_id) IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_tour_quality AS
SELECT
  CAST(t.tour_id AS STRING) AS tour_id,
  COALESCE(CAST(t.salesperson_1_employee_id AS STRING), 'UNASSIGNED') AS rep_id,
  CONCAT(
    CAST(YEAR(t.tour_date) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  t.lead_source,
  t.abc_score,
  t.package_type,
  t.showed_flag,
  (t.gross_transactions > 0 AND t.net_volume > 0) AS closed_flag,
  t.contract_status AS contract_status,
  (t.net_volume < 0 OR COALESCE(t.net_transactions, 0) < 0) AS rescission_flag,
  CAST(t.net_volume AS DECIMAL(14, 2)) AS net_sales_volume,
  CAST(
    CASE
      WHEN t.gross_transactions > 0 THEN t.net_volume / t.gross_transactions
      ELSE 0
    END AS DECIMAL(10, 2)
  ) AS vpg,
  CAST(t.net_volume * 0.12 AS DECIMAL(14, 2)) AS ebitda_estimate
FROM edw_dev_hris.hgv_comp._src_tour_spine t
WHERE t.tour_id IS NOT NULL
  AND t.tour_date IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_rep_product_mix AS
WITH rep_period_mix AS (
  SELECT
    dc.rep_id,
    dc.period_id,
    dc.product_line_id,
    SUM(ABS(dc.credit_amount)) AS abs_credit
  FROM edw_dev_hris.hgv_comp.fact_deal_credit dc
  GROUP BY dc.rep_id, dc.period_id, dc.product_line_id
),
totals AS (
  SELECT rep_id, period_id, SUM(abs_credit) AS total_credit
  FROM rep_period_mix
  GROUP BY rep_id, period_id
)
SELECT
  m.rep_id,
  m.period_id,
  m.product_line_id,
  CAST(
    CASE
      WHEN t.total_credit = 0 THEN 0
      ELSE (m.abs_credit / t.total_credit) * 100
    END AS DECIMAL(6, 2)
  ) AS mix_pct
FROM rep_period_mix m
JOIN totals t
  ON m.rep_id = t.rep_id
 AND m.period_id = t.period_id;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_team_snapshot AS
WITH rep_period AS (
  SELECT
    r.team_id,
    qa.period_id,
    qa.rep_id,
    qa.attainment_pct,
    qa.attainment_pct >= 100 AS is_top,
    qa.attainment_pct < 80 AS is_at_risk
  FROM edw_dev_hris.hgv_comp.fact_quota_attainment qa
  JOIN edw_dev_hris.hgv_comp.dim_rep r
    ON r.rep_id = qa.rep_id
),
ffs_mix AS (
  SELECT
    r.team_id,
    pm.period_id,
    AVG(CASE WHEN pm.product_line_id = 'PROD-FFS' THEN pm.mix_pct ELSE 0 END) AS ffs_sales_pct
  FROM edw_dev_hris.hgv_comp.fact_rep_product_mix pm
  JOIN edw_dev_hris.hgv_comp.dim_rep r
    ON r.rep_id = pm.rep_id
  GROUP BY r.team_id, pm.period_id
)
SELECT
  rp.team_id,
  rp.period_id,
  CAST(AVG(rp.attainment_pct) AS DECIMAL(6, 2)) AS team_attainment_pct,
  CAST(SUM(CASE WHEN rp.is_top THEN 1 ELSE 0 END) AS INT) AS top_performer_count,
  CAST(SUM(CASE WHEN rp.is_at_risk THEN 1 ELSE 0 END) AS INT) AS at_risk_count,
  CAST(COALESCE(MAX(f.ffs_sales_pct), 0) AS DECIMAL(6, 2)) AS ffs_sales_pct,
  CAST(20.00 AS DECIMAL(6, 2)) AS ffs_target_pct
FROM rep_period rp
LEFT JOIN ffs_mix f
  ON f.team_id = rp.team_id
 AND f.period_id = rp.period_id
GROUP BY rp.team_id, rp.period_id;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_plan_eligibility AS
SELECT DISTINCT
  c.participant AS rep_id,
  CONCAT(
    CAST(YEAR(TO_DATE(c.payDate)) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(TO_DATE(c.payDate)) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  'PLAN-FT-2026' AS plan_version_id,
  COALESCE(NULLIF(TRIM(c.position), ''), 'FIELD-REP') AS job_code,
  COALESCE(NULLIF(TRIM(element_at(split(c.businessUnit, '_'), 1)), ''), 'UNK') AS location_code,
  'HGV' AS brand,
  DATE_TRUNC('QUARTER', TO_DATE(c.payDate)) AS effective_start,
  CAST(NULL AS DATE) AS effective_end,
  CAST(100.00 AS DECIMAL(5, 2)) AS proration_pct,
  TRUE AS eligibility_flag,
  CAST(NULL AS STRING) AS exclusion_reason
FROM edw_dev_hris.pwcmodels.commissions c
WHERE c.participant IS NOT NULL
  AND c.payDate IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_chargeback AS
SELECT
  CONCAT('CB-', CAST(uc.contr_num AS STRING)) AS chargeback_id,
  CONCAT('DEAL-', CAST(uc.contr_num AS STRING)) AS deal_id,
  COALESCE(CAST(p.salesperson_1_employee_id AS STRING), 'UNASSIGNED') AS rep_id,
  CONCAT(
    CAST(YEAR(COALESCE(TO_DATE(uc.cancel_date), TO_DATE(uc.date_sold))) AS STRING),
    '-Q',
    CAST(
      CAST(CEIL(MONTH(COALESCE(TO_DATE(uc.cancel_date), TO_DATE(uc.date_sold))) / 3.0) AS INT) AS STRING
    )
  ) AS period_id,
  CAST(ABS(COALESCE(uc.gross_volume, 0)) * 0.045 AS DECIMAL(14, 2)) AS original_commission,
  CAST(ABS(COALESCE(uc.cancel_volume, 0)) * 0.045 AS DECIMAL(14, 2)) AS chargeback_amount,
  CAST(ABS(COALESCE(uc.cancel_volume, 0)) * 0.01 AS DECIMAL(14, 2)) AS reserve_held,
  CAST(0 AS DECIMAL(14, 2)) AS reserve_released,
  COALESCE(NULLIF(TRIM(uc.pcc_cancel_desc), ''), 'Contract cancellation') AS reason,
  CASE WHEN COALESCE(uc.cancel_sales, 0) <> 0 THEN 'RECOVERED' ELSE 'OPEN' END AS status
FROM edw_dev_cognos.cognos_fm.it_uni_contract uc
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON CAST(p.tour_id AS STRING) = CAST(uc.tour_id AS STRING)
WHERE COALESCE(uc.cancel_volume, 0) <> 0
   OR COALESCE(uc.cancel_sales, 0) <> 0;

-- ---------------------------------------------------------------------------
-- Marketing compensation facts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_tour_payout AS
SELECT
  CAST(t.tour_id AS STRING) AS tour_id,
  COALESCE(CAST(t.salesperson_1_employee_id AS STRING), 'UNASSIGNED') AS rep_id,
  CONCAT(
    CAST(YEAR(t.tour_date) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CONCAT('Lead-', CAST(t.enterprise_lead_id AS STRING)) AS guest_name,
  CASE
    WHEN t.qualified_flag THEN 'Qualified'
    WHEN t.showed_flag THEN 'Showed'
    ELSE 'Courtesy'
  END AS guest_type,
  t.tour_date AS arrival_date,
  COALESCE(t.tour_status_desc, 'Scheduled') AS tour_status,
  COALESCE(t.channel, 'MKT') AS code,
  CAST(
    CASE
      WHEN t.qualified_flag THEN GREATEST(t.net_volume, 0) * 0.0025
      WHEN t.showed_flag THEN 35.00
      ELSE 0
    END AS DECIMAL(14, 2)
  ) AS payout,
  t.qualified_flag AS fps_eligible,
  CAST(GREATEST(t.net_volume, 0) * 0.01 AS DECIMAL(14, 2)) AS fps_potential,
  COALESCE(t.marketing_program, '') AS notes,
  CAST(t.enterprise_lead_id AS STRING) AS guest_id,
  CONCAT('HH-', CAST(t.enterprise_lead_id AS STRING)) AS household_id,
  CONCAT('LOC-', t.office_code) AS planned_tour_location_id,
  CAST(NULL AS STRING) AS current_stay_location_id,
  t.lead_source,
  t.abc_score,
  t.package_type,
  CAST(t.tour_key AS STRING) AS xref_tour_id,
  TO_DATE(t.tour_booked_date) AS tour_booked_date
FROM edw_dev_hris.hgv_comp._src_tour_spine t
WHERE t.tour_id IS NOT NULL
  AND t.salesperson_1_employee_id IS NOT NULL
  AND t.tour_date IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_period AS
WITH tour_agg AS (
  SELECT
    tp.rep_id,
    tp.period_id,
    MAX(r.rep_name) AS rep_name,
    MAX(r.region) AS region,
    MAX(r.team_id) AS team_id,
    COUNT(*) AS tours_total,
    SUM(CASE WHEN tp.guest_type = 'Qualified' THEN 1 ELSE 0 END) AS qualified_tours,
    SUM(CASE WHEN tp.guest_type IN ('Qualified', 'Showed') THEN 1 ELSE 0 END) AS tours_shown,
    SUM(tp.payout) AS tour_payout,
    SUM(CASE WHEN tp.payout < 0 THEN ABS(tp.payout) ELSE 0 END) AS chargebacks,
    SUM(CASE WHEN tp.guest_type = 'Qualified' THEN tp.payout ELSE 0 END) AS qualified_tour_pay,
    SUM(CASE WHEN tp.guest_type = 'Courtesy' THEN tp.payout ELSE 0 END) AS courtesy_tour_pay
  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
  LEFT JOIN edw_dev_hris.hgv_comp.dim_rep r
    ON r.rep_id = tp.rep_id
  GROUP BY tp.rep_id, tp.period_id
)
SELECT
  t.rep_id,
  t.period_id,
  t.rep_name,
  'PLAN-MKT-2026' AS plan_id,
  COALESCE(t.region, 'Regional') AS assigned_area,
  CONCAT('AREA-', COALESCE(t.team_id, 'UNK')) AS bonus_area_id,
  CAST(t.tour_payout AS DECIMAL(14, 2)) AS qtd_earnings,
  CAST(t.tour_payout AS DECIMAL(14, 2)) AS paid_to_date,
  CAST(t.qualified_tours AS INT) AS qualified_tours,
  CAST(t.tours_shown AS INT) AS tours_shown,
  CAST(
    CASE WHEN t.tours_total = 0 THEN 0 ELSE (t.tours_shown / t.tours_total) * 100 END AS DECIMAL(6, 2)
  ) AS show_rate_pct,
  CAST(
    CASE WHEN t.tours_total = 0 THEN 0 ELSE (t.qualified_tours / t.tours_total) * 100 END AS DECIMAL(6, 2)
  ) AS penetration_pct,
  CAST(25.00 AS DECIMAL(6, 2)) AS penetration_target_pct,
  (t.qualified_tours >= 10) AS spiff_active,
  CASE
    WHEN t.qualified_tours < 10 THEN '10 Qualified Tours'
    WHEN t.qualified_tours < 20 THEN '20 Qualified Tours'
    ELSE 'Director Tier'
  END AS next_tier_label,
  CAST(GREATEST(0, 10 - t.qualified_tours) AS INT) AS next_tier_gap_tours,
  CAST(t.qualified_tour_pay AS DECIMAL(14, 2)) AS qualified_tour_pay,
  CAST(t.courtesy_tour_pay AS DECIMAL(14, 2)) AS courtesy_tour_pay,
  CAST(0 AS DECIMAL(14, 2)) AS penetration_spiff,
  CAST(t.chargebacks AS DECIMAL(14, 2)) AS chargebacks,
  CAST(t.tour_payout AS DECIMAL(14, 2)) AS total_payout,
  CAST(30.00 AS DECIMAL(6, 2)) AS base_pct,
  CAST(70.00 AS DECIMAL(6, 2)) AS variable_pct,
  CAST(0 AS DECIMAL(6, 2)) AS tcc_gap_vs_market_pct
FROM tour_agg t;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_metric AS
WITH base AS (
  SELECT
    rep_id,
    period_id,
    qualified_tours,
    tours_shown,
    show_rate_pct,
    penetration_pct,
    total_payout
  FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
)
SELECT rep_id, period_id, 'Qualified Tours' AS metric_name, CAST(40.00 AS DECIMAL(6, 2)) AS weight_pct,
       CAST(total_payout * 0.4 AS DECIMAL(14, 2)) AS earnings,
       CAST(penetration_pct AS DECIMAL(6, 2)) AS attainment_pct,
       'Plan target' AS target_label,
       CAST(GREATEST(0, (25 - penetration_pct) * 50) AS DECIMAL(14, 2)) AS opportunity_usd
FROM base
UNION ALL
SELECT rep_id, period_id, 'Show Rate', CAST(35.00 AS DECIMAL(6, 2)),
       CAST(total_payout * 0.35 AS DECIMAL(14, 2)),
       show_rate_pct, '85% benchmark',
       CAST(GREATEST(0, (85 - show_rate_pct) * 25) AS DECIMAL(14, 2))
FROM base
UNION ALL
SELECT rep_id, period_id, 'Qualified Tour Pay', CAST(25.00 AS DECIMAL(6, 2)),
       CAST(total_payout * 0.25 AS DECIMAL(14, 2)),
       CAST(CASE WHEN qualified_tours = 0 THEN 0 ELSE LEAST(100, qualified_tours * 5) END AS DECIMAL(6, 2)),
       'Tour count tier',
       CAST(GREATEST(0, (10 - qualified_tours) * 100) AS DECIMAL(14, 2))
FROM base;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_chargeback AS
SELECT
  CONCAT('MKT-CB-', t.tour_id) AS chargeback_id,
  t.rep_id,
  t.period_id,
  t.guest_name,
  t.tour_id,
  CAST(NULL AS STRING) AS premium_gift,
  CAST(ABS(LEAST(t.payout, 0)) AS DECIMAL(14, 2)) AS chargeback_amount,
  'Negative tour payout / reversal' AS notes
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout t
WHERE t.payout < 0;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_arrival AS
SELECT
  CONCAT('ARR-', t.tour_id) AS arrival_id,
  t.rep_id,
  t.period_id,
  t.guest_name,
  t.guest_type,
  COALESCE(CAST(t.tour_booked_date AS STRING), CAST(t.arrival_date AS STRING)) AS arrival_datetime,
  COALESCE(t.code, 'Desk') AS desk,
  CAST(CASE WHEN t.guest_type = 'Qualified' THEN 150 ELSE 50 END AS DECIMAL(14, 2)) AS potential_qualified_tour,
  CAST(t.fps_potential AS DECIMAL(14, 2)) AS potential_fps_payout,
  CAST(t.payout + t.fps_potential AS DECIMAL(14, 2)) AS projected_total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout t
WHERE t.tour_status IN ('Scheduled', 'Booked', 'Confirmed')
   OR t.arrival_date >= CURRENT_DATE();

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_rep_market_position AS
SELECT
  qa.rep_id,
  qa.period_id,
  r.rep_name,
  CASE WHEN r.level_code = 'MKT' THEN 'marketing_rep' ELSE 'field_rep' END AS role_key,
  CAST((qa.attainment_pct - 100) AS DECIMAL(6, 2)) AS tcc_gap_vs_market_pct,
  CAST(30.00 AS DECIMAL(6, 2)) AS base_pct,
  CAST(70.00 AS DECIMAL(6, 2)) AS variable_pct,
  qa.attainment_pct AS quota_attainment_pct
FROM edw_dev_hris.hgv_comp.fact_quota_attainment qa
JOIN edw_dev_hris.hgv_comp.dim_rep r
  ON r.rep_id = qa.rep_id;

-- ---------------------------------------------------------------------------
-- Guest registry facts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_guest_ownership AS
SELECT
  CONCAT('OWN-', CAST(uc.contr_num AS STRING)) AS ownership_id,
  CAST(uc.enterprise_lead_id AS STRING) AS guest_id,
  COALESCE(NULLIF(TRIM(uc.project_desc), ''), 'HGV Property') AS property_name,
  CONCAT('LOC-', COALESCE(uc.office_code, 'UNK')) AS location_id,
  COALESCE(NULLIF(TRIM(uc.contract_status_desc), ''), 'UNKNOWN') AS contract_status,
  CAST(COALESCE(uc.net_points, 0) AS INT) AS points_balance,
  'HGV' AS brand
FROM edw_dev_cognos.cognos_fm.it_uni_contract uc
WHERE uc.enterprise_lead_id IS NOT NULL
  AND CAST(uc.contr_num AS BIGINT) > 0

UNION ALL

SELECT
  CONCAT('OWN-SUM-', CAST(sc.enterprise_lead_id AS STRING)) AS ownership_id,
  CAST(sc.enterprise_lead_id AS STRING) AS guest_id,
  'Portfolio Summary' AS property_name,
  CAST(NULL AS STRING) AS location_id,
  'ACTIVE' AS contract_status,
  CAST(COALESCE(sc.total_net_points, 0) AS INT) AS points_balance,
  'HGV' AS brand
FROM edw_dev_cognos.cognos_fm.it_smt_contract sc
WHERE sc.enterprise_lead_id IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_guest_tour_history AS
SELECT
  CONCAT('HIST-', t.tour_id) AS history_id,
  CAST(t.enterprise_lead_id AS STRING) AS guest_id,
  CAST(t.tour_id AS STRING) AS tour_id,
  CAST(t.salesperson_1_employee_id AS STRING) AS rep_id,
  t.tour_date,
  COALESCE(t.tour_status_desc, 'Completed') AS tour_status,
  CONCAT(
    CASE WHEN t.qualified_flag THEN 'Qualified' WHEN t.showed_flag THEN 'Showed' ELSE 'No-show' END,
    ' | Net vol ',
    CAST(t.net_volume AS STRING)
  ) AS outcome_summary
FROM edw_dev_hris.hgv_comp._src_tour_spine t
WHERE t.tour_id IS NOT NULL
  AND t.enterprise_lead_id IS NOT NULL
  AND t.tour_date IS NOT NULL;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_guest_rental_stay AS
SELECT
  CAST(NULL AS STRING) AS stay_id,
  CAST(NULL AS STRING) AS guest_id,
  CAST(NULL AS STRING) AS location_id,
  CAST(NULL AS STRING) AS stay_type,
  CAST(NULL AS DATE) AS check_in,
  CAST(NULL AS DATE) AS check_out,
  CAST(NULL AS INT) AS nights
WHERE 1 = 0;

-- ---------------------------------------------------------------------------
-- Smoke checks (optional — comment out for CI)
-- ---------------------------------------------------------------------------
-- SELECT 'dim_rep' AS obj, COUNT(*) AS cnt FROM edw_dev_hris.hgv_comp.dim_rep
-- UNION ALL SELECT 'fact_payout', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_payout
-- UNION ALL SELECT 'fact_marketing_tour_payout', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
-- UNION ALL SELECT 'fact_deal_credit', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_deal_credit;
