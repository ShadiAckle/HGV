-- =============================================================================
-- UI SECTION → QUERY MAP (Marketing Rep — My Compensation)
-- =============================================================================
-- Companion to: 16_materialize_marketing_core.sql
--
-- Each block below maps a UI section to:
--   (A) Script 16 step — what BUILDs the warehouse object
--   (B) App runtime query — what the Node server SELECTs at page load
--
-- Page: client/src/pages/comp/MarketingCompensationView.tsx
-- API:  GET /api/comp/marketing/workspace  (most sections)
--        GET /api/comp/metadata             (rep + period picker)
--
-- Replace :rep_id and :period_id when running smoke queries.
-- Example: SET VAR rep_id = '12345'; SET VAR period_id = '2026-Q3';
-- =============================================================================
--
-- ┌─────────────────────────────────────┬──────────┬────────────────────────────────────────┐
-- │ UI section                          │ Script 16│ Warehouse object                       │
-- ├─────────────────────────────────────┼──────────┼────────────────────────────────────────┤
-- │ Rep dropdown (header)               │ Step 4   │ dim_marketing_rep                      │
-- │ Period dropdown (header)            │ Step 6   │ dim_period                             │
-- │ Hero — What I earned                │ Step 5   │ fact_marketing_rep_period.qtd_earnings │
-- │ Hero — Am I on track?               │ Step 5   │ penetration_pct / penetration_target   │
-- │ Hero — What's next                  │ Step 5   │ next_tier_label / next_tier_gap_tours  │
-- │ Rule of Three / Money Map           │ Step 5,8 │ fact_marketing_rep_period + _metric    │
-- │ Plan progress bars                  │ Step 8   │ fact_marketing_rep_metric              │
-- │ Desk rank card                      │ Step 5,7 │ fact_marketing_rep_period + dim_rep    │
-- │ KPI cards (advanced)                │ Step 5   │ fact_marketing_rep_period              │
-- │ Earnings breakdown                  │ Step 5   │ fact_marketing_rep_period              │
-- │ Pay mix / market position           │ Step 5   │ base_pct, variable_pct, tcc_gap        │
-- │ Earnings by Plan Metric table       │ Step 8   │ fact_marketing_rep_metric (view)       │
-- │ Tour Activity & Credits             │ Step 3   │ fact_marketing_tour_payout             │
-- │ Chargebacks panel                   │ Step 8   │ fact_marketing_chargeback (view)       │
-- │ Upcoming Arrivals panel             │ Step 8   │ fact_marketing_arrival (view)          │
-- │ Page header name / area             │ Step 5   │ rep_name, assigned_area, plan_id       │
-- └─────────────────────────────────────┴──────────┴────────────────────────────────────────┘
--
-- NOT in script 16 (optional / separate scripts):
--   Tour Intervene drawer  → dim_guest, dim_household, fact_tour_quality (script 12 or 09a)
--   Plan rules panel       → plan_assessment_* (script 10 / 10a)
--   AI insights            → LLM only (no extra SQL)
-- =============================================================================


-- =============================================================================
-- HEADER — Rep picker
-- UI: AppContext rep dropdown
-- API: GET /api/comp/metadata
-- Script 16: Step 4 — dim_marketing_rep (lines 200–216 in 16_materialize_marketing_core.sql)
-- =============================================================================

-- (A) BUILD — Step 4
-- CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep AS
--   SELECT tp.rep_id, MAX(tp.rep_name), 'MKT', MAX(tp.rep_team_id), MAX(tp.rep_region), TRUE
--   FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
--   WHERE tp.rep_id IS NOT NULL AND tp.rep_id <> 'UNASSIGNED'
--   GROUP BY tp.rep_id;

-- (B) RUNTIME — server/compMetadata.ts
SELECT
  rep_id,
  COALESCE(rep_name, rep_id) AS rep_name,
  level_code,
  team_id,
  region,
  is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE rep_id IS NOT NULL
  AND NOT rep_id LIKE 'PERSONA-MKT-%'
ORDER BY rep_name
LIMIT 500;


-- =============================================================================
-- HEADER — Period picker
-- UI: AppContext period dropdown
-- API: GET /api/comp/metadata
-- Script 16: Step 6 — dim_period (lines 277–294)
-- =============================================================================

-- (B) RUNTIME
SELECT period_id, period_label, is_current
FROM edw_dev_hris.hgv_comp.dim_period
ORDER BY period_start DESC
LIMIT 24;


-- =============================================================================
-- PAGE HEADER — "Hey {rep_name}" / plan / assigned area
-- UI: MarketingCompensationView title strip
-- API: GET /api/comp/marketing/workspace
-- Script 16: Step 5 — fact_marketing_rep_period (lines 218–275)
-- =============================================================================

-- (B) RUNTIME — spine query (server/marketingRepWorkspace.ts)
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
-- =============================================================================

-- (1) What I earned — Net take home
-- Script 16 Step 5 → qtd_earnings (= SUM(payout) per rep×period)
SELECT qtd_earnings, paid_to_date, total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;

-- (2) Am I on track? — Penetration vs target
SELECT penetration_pct, penetration_target_pct, qualified_tours, tours_shown
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;

-- (3) What's next — Tier / gap
SELECT next_tier_label, next_tier_gap_tours, spiff_active
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- KPI CARDS (advanced view)
-- UI: KpiCard × 4
-- Script 16: Step 5
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
-- UI: earnings breakdown panel, pay mix bar, market gap
-- Script 16: Step 5 (qualified_tour_pay, courtesy_tour_pay, chargebacks, base_pct, …)
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
-- UI: EarningsByPlanMetricTable
-- Script 16: Step 8 — fact_marketing_rep_metric VIEW (lines 316–339)
--   Built from fact_marketing_rep_period rollups
-- =============================================================================

-- (A) BUILD — Step 8 view unions 3 metrics @ 40/35/25 weights from period rollup

-- (B) RUNTIME
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
-- UI: MarketingRuleOfThreeBars, MarketingMoneyMapSummary, MarketingPlanProgressBars
-- Script 16: Steps 5 + 8 (inputs); money map computed in app (shared/marketingMoneyMap.ts)
-- =============================================================================

-- Warehouse inputs consumed by money map builder:
SELECT
  p.qtd_earnings,
  p.qualified_tours,
  p.tours_shown,
  p.show_rate_pct,
  p.penetration_pct,
  p.total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
WHERE p.rep_id = :rep_id AND p.period_id = :period_id;

SELECT metric_name, weight_pct, earnings, attainment_pct
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
WHERE rep_id = :rep_id AND period_id = :period_id;


-- =============================================================================
-- DESK RANK CARD
-- UI: MarketingDeskRankCard
-- Script 16: Step 5 (peer KPIs) + Step 7 dim_rep (team_id for peer group)
-- Runtime: server/marketingMoneyMap.ts — NOT in script 16
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
-- UI: MarketingTourActivitySection (tour ledger rows)
-- Script 16: Step 3 — fact_marketing_tour_payout (lines 146–197)
--   Fed by Step 2 _stg_tour_enriched (OPC rep) ← Step 1 _stg_marketing_tour_detail
-- =============================================================================

-- (A) BUILD chain:
--   Step 1: it_smt_marketing (2026) JOIN it_smt_detail ON tour_key_hash → tour grain
--   Step 2: JOIN it_smt_personnel opc_person_1_* (deduped per tour_key_hash)
--   Step 3: tour ledger with rep_id, period_id, guest_type, payout ($75/$35/$20)

-- (B) RUNTIME — base tour query (enrichment may add guest dims — not in script 16)
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
  package_type
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY arrival_date DESC;


-- =============================================================================
-- CHARGEBACKS
-- UI: ChargebacksAndArrivals (chargeback table)
-- Script 16: Step 8 — fact_marketing_chargeback VIEW (lines 341–349)
--   Source: fact_marketing_tour_payout WHERE payout < 0
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
-- UI: ChargebacksAndArrivals (arrivals table)
-- Script 16: Step 8 — fact_marketing_arrival VIEW (lines 351–362)
--   Source: fact_marketing_tour_payout future/scheduled tours
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
-- SCRIPT 16 BUILD REFERENCE — upstream staging (not queried by app directly)
-- =============================================================================

-- Step 1 — _stg_marketing_tour_detail
-- Sources: edw_dev_cognos.cognos_fm.it_smt_marketing + it_smt_detail
-- UI impact: showed/qualified flags, net_volume, tour_date → guest_type & payout in Step 3

-- Step 2 — _stg_tour_enriched
-- Sources: _stg_marketing_tour_detail + it_smt_personnel (opc_person_1_*)
-- UI impact: rep_id, rep_name, rep_team_id in tour ledger & rep picker

-- Smoke: row counts after materialization
SELECT 'dim_marketing_rep' AS obj, COUNT(*) AS rows
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
UNION ALL
SELECT 'fact_marketing_tour_payout', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
UNION ALL
SELECT 'fact_marketing_rep_period', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
UNION ALL
SELECT 'fact_marketing_rep_metric', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric;


-- =============================================================================
-- PER-REP SMOKE (replace literals)
-- =============================================================================

-- SET rep_id = '<employee_id>';
-- SET period_id = '2026-Q3';

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
WHERE rep_id = :rep_id AND period_id = :period_id;
