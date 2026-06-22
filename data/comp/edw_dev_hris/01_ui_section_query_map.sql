-- =============================================================================
-- UI SECTION → QUERY MAP (Marketing Rep — My Compensation)
-- =============================================================================
-- Companion to: 01_MATERIALIZE_ALL_TABLES.sql  (run AFTER 00_CLEAN_AND_REBUILD.sql)
--
-- Each block maps a UI section to:
--   (A) Script 01 step — what BUILDS the warehouse object + source columns
--   (B) App runtime query — what the Node server SELECTs at page load
--
-- Page:  client/src/pages/comp/MarketingCompensationView.tsx
-- API:   GET /api/comp/marketing/workspace  (most sections)
--        GET /api/comp/metadata             (rep + period picker)
--        GET /api/comp/manager/workspace     (manager/director tabs)
--
-- Replace :rep_id and :period_id when running smoke queries.
-- =============================================================================
--
-- ┌─────────────────────────────────────┬──────────┬────────────────────────────────────────┐
-- │ UI section                          │ Script 01│ Warehouse object                       │
-- ├─────────────────────────────────────┼──────────┼────────────────────────────────────────┤
-- │ Rep dropdown (header)               │ Step 5   │ dim_marketing_rep (+ C2b/C2c leaders)  │
-- │ Period dropdown (header)            │ Step 3   │ dim_period                             │
-- │ Hero — What I earned                │ Step 8   │ fact_marketing_rep_period.qtd_earnings │
-- │ Hero — Am I on track?               │ Step 8   │ penetration_pct / penetration_target   │
-- │ Hero — What's next                  │ Step 8   │ next_tier_label / next_tier_gap_tours  │
-- │ Rule of Three / Money Map           │ Step 8,9 │ fact_marketing_rep_period + _metric    │
-- │ Plan progress bars                  │ Step 9   │ fact_marketing_rep_metric (TABLE)      │
-- │ Desk rank card                      │ Step 6,8 │ fact_marketing_rep_period + dim_rep    │
-- │ KPI cards (advanced)                │ Step 8   │ fact_marketing_rep_period              │
-- │ Earnings breakdown                  │ Step 8   │ fact_marketing_rep_period              │
-- │ Pay mix / market position           │ Step 8   │ base_pct, variable_pct, tcc_gap        │
-- │ Earnings by Plan Metric table       │ Step 9   │ fact_marketing_rep_metric              │
-- │ Tour Activity & Credits             │ Step 7   │ fact_marketing_tour_payout             │
-- │ Chargebacks panel                   │ Step 10  │ fact_marketing_chargeback (TABLE)      │
-- │ Upcoming Arrivals panel             │ Step 11  │ fact_marketing_arrival (TABLE)         │
-- │ Page header name / area             │ Step 4,8 │ dim_location + assigned_area           │
-- │ Manager direct reports              │ Step 5,6 │ dim_rep.manager_rep_id + rep_period    │
-- └─────────────────────────────────────┴──────────┴────────────────────────────────────────┘
--
-- NOT in script 01 (separate scripts):
--   Prerequisite config  → 00_CLEAN_AND_REBUILD.sql (dim_tour_status_config payout seeds)
--   Manager analytics stubs → 03_manager_view_stubs.sql
--   Hierarchy-only rebuild  → 02_rebuild_rep_hierarchy.sql
--   Tour Intervene drawer   → dim_guest, dim_household, fact_tour_quality (00 stubs / 09a)
--   Plan rules panel        → plan_assessment_* (10 / 10a)
--   AI insights             → LLM only (no extra SQL)
--
-- DEPRECATED companion: 16_ui_section_query_map.sql (references superseded script 16)
-- =============================================================================


-- =============================================================================
-- SOURCE → STAGING → SEMANTIC LAYER (Script 01 build chain)
-- =============================================================================
--
-- COGNOS SOURCES (edw_dev_cognos.cognos_fm.*)
-- ┌─────────────────────┬──────────────────────────────────────────────────────────┐
-- │ it_smt_marketing    │ Tour booking grain: tour_key_hash, tour_id,              │
-- │                     │ tour_status_desc, tour_booked_date, tour_date,           │
-- │                     │ office_code/description/region/site/brand, channel       │
-- ├─────────────────────┼──────────────────────────────────────────────────────────┤
-- │ it_smt_detail       │ Transaction grain (pre-aggregated per tour_key_hash):      │
-- │                     │ qualified_signal, sales_count, cancel_count,             │
-- │                     │ lead_name, lead_id_formatted, ownership_status,          │
-- │                     │ tour_score, fico_color, lead_source_desc                 │
-- ├─────────────────────┼──────────────────────────────────────────────────────────┤
-- │ it_smt_personnel    │ Marketing rep credit (NOT salesperson_*):                │
-- │                     │ opc_person_1_employee_id → rep_id                        │
-- │                     │ opc_person_1_name → rep_name                           │
-- │                     │ opc_team_code (often empty — office_code used for team)  │
-- └─────────────────────┴──────────────────────────────────────────────────────────┘
--
-- Step 1  _stg_marketing_tour_detail
--   marketing (2026 tours) LEFT JOIN detail agg ON tour_key_hash
--   showed_flag  ← tour_status_desc IN ('TOUR','SHOW','SHOWN','PRESENTED')
--   qualified_flag ← showed AND owner/new-buyer signal from detail
--
-- Step 2  _stg_tour_enriched
--   staging INNER JOIN personnel (opc_person_1, rn=1 per tour)
--   period_id ← YYYY-Qn from tour_date (fallback tour_booked_date)
--   comp_status_key ← QUALIFIED | COURTESY | NO SHOW
--
-- Step 3  dim_period          ← distinct quarters from marketing tour dates
-- Step 4  dim_location        ← office_code → location_name (planned tour desk)
-- Step 5  dim_marketing_rep   ← C2a reps + synthesized MGR-<office>, DIR-<region>
-- Step 6  dim_rep             ← manager_rep_id reporting lines
-- Step 7  fact_marketing_tour_payout
--           payout ← dim_tour_status_config (seeded in 00) via comp_status_key
-- Step 8  fact_marketing_rep_period  ← tour ledger + staging counts + chargebacks
-- Step 9  fact_marketing_rep_metric   ← 3 plan metrics (Delta TABLE)
-- Step 10 fact_marketing_chargeback   ← cancel_count from staging
-- Step 11 fact_marketing_arrival      ← future-dated tours
-- Step 12 MERGE                       ← refresh chargeback columns on rep_period
-- =============================================================================


-- =============================================================================
-- HEADER — Rep picker
-- UI: AppContext rep dropdown
-- API: GET /api/comp/metadata
-- Script 01: Step 5 — dim_marketing_rep
-- =============================================================================

-- (A) BUILD — Step 5 (summary)
--   C2a: DISTINCT rep_id from _stg_tour_enriched; team_id = dominant office_code
--   C2b: one Manager per office_code  (rep_id = 'MGR-' || office_code)
--   C2c: one Director per region      (rep_id = 'DIR-' || region)

-- (B) RUNTIME — server/compMetadata.ts (leaders always shown + top 500 C2a)
WITH leaders AS (
  SELECT rep_id, COALESCE(rep_name, rep_id) AS rep_name, level_code, team_id, region, is_active
  FROM edw_dev_hris.hgv_comp.dim_marketing_rep
  WHERE rep_id IS NOT NULL
    AND NOT rep_id LIKE 'PERSONA-MKT-%'
    AND level_code IN ('C2b', 'C2c')
),
reps AS (
  SELECT rep_id, COALESCE(rep_name, rep_id) AS rep_name, level_code, team_id, region, is_active
  FROM edw_dev_hris.hgv_comp.dim_marketing_rep
  WHERE rep_id IS NOT NULL
    AND NOT rep_id LIKE 'PERSONA-MKT-%'
    AND (level_code = 'C2a' OR level_code IS NULL)
  ORDER BY rep_name
  LIMIT 500
)
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM leaders
UNION ALL
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM reps
ORDER BY CASE level_code WHEN 'C2c' THEN 0 WHEN 'C2b' THEN 1 ELSE 2 END, rep_name;


-- =============================================================================
-- HEADER — Period picker
-- UI: AppContext period dropdown
-- API: GET /api/comp/metadata
-- Script 01: Step 3 — dim_period
-- =============================================================================

SELECT period_id, period_label, is_current
FROM edw_dev_hris.hgv_comp.dim_period
ORDER BY period_start DESC
LIMIT 24;


-- =============================================================================
-- PAGE HEADER — rep_name / plan / assigned area
-- API: GET /api/comp/marketing/workspace
-- Script 01: Step 8 — fact_marketing_rep_period; assigned_area from dim_location (Step 4)
-- =============================================================================

SELECT
  p.rep_id,
  p.period_id,
  p.rep_name,
  p.plan_id,
  p.assigned_area,
  p.bonus_area_id,
  d.period_label
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
LEFT JOIN edw_dev_hris.hgv_comp.dim_period d ON d.period_id = p.period_id
WHERE p.rep_id = :rep_id
  AND p.period_id = :period_id;


-- =============================================================================
-- HERO STRIP — Simple View "Your 3 numbers that matter"
-- Script 01: Step 8
-- =============================================================================

-- (1) What I earned
SELECT qtd_earnings, paid_to_date, total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;

-- (2) Am I on track? — guest buy rate (penetration_pct) vs 20% target
SELECT penetration_pct, penetration_target_pct, qualified_tours, tours_shown, show_rate_pct
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;

-- (3) What's next — tier ladder at 3/6/10 qualified tours ($50/$75/$100)
SELECT next_tier_label, next_tier_gap_tours, spiff_active
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- KPI CARDS (advanced view)
-- Script 01: Step 8
-- =============================================================================

SELECT
  qtd_earnings,
  paid_to_date,
  qualified_tours,
  tours_shown,
  show_rate_pct,
  penetration_pct,
  penetration_target_pct,
  next_tier_label,
  next_tier_gap_tours,
  spiff_active
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- EARNINGS BREAKDOWN + PAY MIX + MARKET POSITION
-- Script 01: Step 8 (+ Step 12 MERGE for chargeback-adjusted qtd_earnings)
-- =============================================================================

SELECT
  qualified_tour_pay,
  courtesy_tour_pay,
  penetration_spiff,
  chargebacks,
  total_payout,
  base_pct,
  variable_pct,
  tcc_gap_vs_market_pct
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- EARNINGS BY PLAN METRIC
-- Script 01: Step 9 — fact_marketing_rep_metric (Delta TABLE, not a view)
-- =============================================================================

SELECT
  metric_name,
  weight_pct,
  earnings,
  attainment_pct,
  target_label,
  opportunity_usd
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY weight_pct DESC;


-- =============================================================================
-- RULE OF THREE / MONEY MAP / PLAN PROGRESS BARS
-- Warehouse inputs; money map built in shared/marketingMoneyMap.ts
-- Script 01: Steps 8 + 9
-- =============================================================================

SELECT
  p.qtd_earnings,
  p.qualified_tours,
  p.tours_shown,
  p.show_rate_pct,
  p.penetration_pct,
  p.penetration_target_pct,
  p.next_tier_gap_tours,
  p.total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
WHERE p.rep_id = :rep_id AND p.period_id = :period_id;

SELECT metric_name, weight_pct, earnings, attainment_pct, opportunity_usd
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- DESK RANK CARD
-- Script 01: Steps 6 + 8 — peers on same team_id (office_code), C2a only
-- Runtime: server/marketingMoneyMap.ts
-- =============================================================================

SELECT
  p.rep_id,
  p.qualified_tours,
  p.tours_shown,
  p.penetration_pct
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
JOIN edw_dev_hris.hgv_comp.dim_rep r ON r.rep_id = p.rep_id
WHERE p.period_id = :period_id
  AND r.team_id = (
    SELECT team_id FROM edw_dev_hris.hgv_comp.dim_rep WHERE rep_id = :rep_id
  )
  AND r.level_code = 'C2a'
  AND r.is_active = TRUE;


-- =============================================================================
-- TOUR ACTIVITY & CREDITS
-- Script 01: Step 7 — fact_marketing_tour_payout
--   payout from dim_tour_status_config (00) via comp_status_key
--   guest_name from lead_id_formatted when lead_name is PII-masked
-- =============================================================================

SELECT
  tour_id,
  guest_name,
  guest_type,
  arrival_date,
  tour_status,
  code,
  payout,
  fps_eligible,
  fps_potential,
  notes,
  lead_source,
  abc_score,
  package_type,
  planned_tour_location_id
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY arrival_date DESC;


-- =============================================================================
-- CHARGEBACKS
-- Script 01: Step 10 — fact_marketing_chargeback (TABLE)
--   Source: _stg_tour_enriched.cancel_count > 0 (contract rescinds)
-- =============================================================================

SELECT
  chargeback_id,
  guest_name,
  tour_id,
  premium_gift,
  chargeback_amount,
  notes
FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- UPCOMING ARRIVALS
-- Script 01: Step 11 — fact_marketing_arrival (TABLE)
--   Source: fact_marketing_tour_payout WHERE arrival_date >= CURRENT_DATE()
-- =============================================================================

SELECT
  arrival_id,
  guest_name,
  guest_type,
  arrival_datetime,
  desk,
  potential_qualified_tour,
  potential_fps_payout,
  projected_total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_arrival
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY arrival_datetime;


-- =============================================================================
-- MANAGER / DIRECTOR WORKSPACE (extra tabs when MGR-* or DIR-* selected)
-- API: GET /api/comp/manager/workspace
-- Script 01: Steps 5 + 6 (hierarchy), Step 8 (direct-report KPIs)
-- Prerequisite: 03_manager_view_stubs.sql for sales-side analytics tables
-- =============================================================================

-- Direct reports for a sales-center manager (MGR-<office_code>)
SELECT
  r.rep_id,
  r.rep_name,
  r.level_code,
  p.qtd_earnings,
  p.qualified_tours,
  p.tours_shown,
  p.penetration_pct,
  p.show_rate_pct
FROM edw_dev_hris.hgv_comp.dim_rep r
LEFT JOIN edw_dev_hris.hgv_comp.fact_marketing_rep_period p
  ON p.rep_id = r.rep_id AND p.period_id = :period_id
WHERE r.manager_rep_id = :manager_rep_id
  AND r.rep_id NOT LIKE 'PERSONA-%'
ORDER BY p.qtd_earnings DESC NULLS LAST;


-- =============================================================================
-- PAYOUT CONFIG (admin-tunable — not in script 01, seeded in 00)
-- =============================================================================

SELECT tour_status_desc, payout_amount, is_active
FROM edw_dev_hris.hgv_comp.dim_tour_status_config
WHERE is_active = TRUE
  AND tour_status_desc IN ('QUALIFIED', 'COURTESY', 'NO SHOW')
ORDER BY payout_amount DESC;


-- =============================================================================
-- SMOKE — row counts after 00 + 01
-- =============================================================================

SELECT 'dim_marketing_rep' AS obj, COUNT(*) AS rows
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
UNION ALL
SELECT 'dim_marketing_rep C2b managers', COUNT(*)
FROM edw_dev_hris.hgv_comp.dim_marketing_rep WHERE level_code = 'C2b'
UNION ALL
SELECT 'dim_marketing_rep C2c directors', COUNT(*)
FROM edw_dev_hris.hgv_comp.dim_marketing_rep WHERE level_code = 'C2c'
UNION ALL
SELECT 'fact_marketing_tour_payout', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
UNION ALL
SELECT 'fact_marketing_rep_period', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
UNION ALL
SELECT 'fact_marketing_rep_metric', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
UNION ALL
SELECT 'fact_marketing_chargeback', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
UNION ALL
SELECT 'fact_marketing_arrival', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_arrival;


-- =============================================================================
-- PER-REP SMOKE (replace :rep_id / :period_id literals)
-- =============================================================================

SELECT 'period_row' AS check_type, COUNT(*) AS n
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id
UNION ALL
SELECT 'tours', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE rep_id = :rep_id AND period_id = :period_id
UNION ALL
SELECT 'metrics', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
WHERE rep_id = :rep_id AND period_id = :period_id
UNION ALL
SELECT 'chargebacks', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
WHERE rep_id = :rep_id AND period_id = :period_id
UNION ALL
SELECT 'arrivals', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_arrival
WHERE rep_id = :rep_id AND period_id = :period_id;
