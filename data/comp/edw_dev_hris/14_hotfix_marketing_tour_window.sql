-- =============================================================================
-- Hotfix: fact_marketing_rep_period hangs — full tour history aggregation
-- Run after 13_hotfix_view_performance.sql
-- =============================================================================
-- Root cause: fact_marketing_tour_payout scanned ALL it_smt_detail tours (no date
-- window). COUNT on fact_marketing_rep_period forces a full rep×period rollup.
--
-- Fix:
--   1. dim_marketing_rep — fast rep picker (36-month tour window, GROUP BY rep)
--   2. fact_marketing_tour_payout — only last 36 months of tours
-- =============================================================================

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_marketing_rep AS
SELECT
  CAST(p.salesperson_1_employee_id AS STRING) AS rep_id,
  MAX(
    COALESCE(NULLIF(TRIM(p.salesperson_1_name), ''), CAST(p.salesperson_1_employee_id AS STRING))
  ) AS rep_name,
  'MKT' AS level_code,
  MAX(COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT')) AS team_id,
  MAX(COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other')) AS region,
  TRUE AS is_active
FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d
  ON d.tour_key_hash = p.tour_key_hash
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON p.tour_key_hash = m.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL
  AND COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date))
    >= ADD_MONTHS(CURRENT_DATE(), -36)
GROUP BY CAST(p.salesperson_1_employee_id AS STRING);

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
  TO_DATE(t.tour_booked_date) AS tour_booked_date,
  COALESCE(NULLIF(TRIM(t.salesperson_1_name), ''), CAST(t.salesperson_1_employee_id AS STRING)) AS rep_name,
  COALESCE(NULLIF(TRIM(t.office_region), ''), 'Other') AS rep_region,
  COALESCE(NULLIF(TRIM(t.sales_team_code), ''), 'TEAM-MKT') AS rep_team_id
FROM edw_dev_hris.hgv_comp._src_tour_spine t
WHERE t.tour_id IS NOT NULL
  AND t.salesperson_1_employee_id IS NOT NULL
  AND t.tour_date IS NOT NULL
  AND t.tour_date >= ADD_MONTHS(CURRENT_DATE(), -36);

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_period AS
WITH tour_agg AS (
  SELECT
    tp.rep_id,
    tp.period_id,
    MAX(tp.rep_name) AS rep_name,
    MAX(tp.rep_region) AS region,
    MAX(tp.rep_team_id) AS team_id,
    COUNT(*) AS tours_total,
    SUM(CASE WHEN tp.guest_type = 'Qualified' THEN 1 ELSE 0 END) AS qualified_tours,
    SUM(CASE WHEN tp.guest_type IN ('Qualified', 'Showed') THEN 1 ELSE 0 END) AS tours_shown,
    SUM(tp.payout) AS tour_payout,
    SUM(CASE WHEN tp.payout < 0 THEN ABS(tp.payout) ELSE 0 END) AS chargebacks,
    SUM(CASE WHEN tp.guest_type = 'Qualified' THEN tp.payout ELSE 0 END) AS qualified_tour_pay,
    SUM(CASE WHEN tp.guest_type = 'Courtesy' THEN tp.payout ELSE 0 END) AS courtesy_tour_pay
  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
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

-- Smoke (run in this order):
-- SELECT COUNT(*) FROM edw_dev_hris.hgv_comp.dim_marketing_rep;
-- SELECT COUNT(DISTINCT rep_id) FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period;
-- SELECT * FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period WHERE rep_id = '<pick one>' AND period_id = '2026-Q1' LIMIT 1;
