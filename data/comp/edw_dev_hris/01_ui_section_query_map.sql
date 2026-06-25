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
-- │ Rep dropdown (header)               │ Step 8.5 │ dim_marketing_rep (C2a: qtd_earnings > 0) │
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
-- │ Tour Intervene drawer (Guest 360)   │ Step 7+  │ tour_payout + guest registry (09/09a)  │
-- │ Plan Rules / Assessment panel       │ 10/10a   │ plan_assessment_profile + _segment     │
-- └─────────────────────────────────────┴──────────┴────────────────────────────────────────┘
--
-- NOT in script 01 (separate scripts / sources):
--   Prerequisite config     → 00_CLEAN_AND_REBUILD.sql (dim_tour_status_config payout seeds)
--   Manager analytics stubs → 03_manager_view_stubs.sql
--   Hierarchy-only rebuild  → 02_rebuild_rep_hierarchy.sql
--   Guest 360 enrichment    → 09_create_guest_registry.sql + 09a_seed (or future uni_lead ETL)
--   Plan Assessment panel   → 10_create_plan_assessment.sql + 10a_seed_plan_assessment.sql
--   Field sales commissions → edw_dev_hris.pwcmodels.commissions (script 12 — NOT marketing)
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
-- ├─────────────────────┼──────────────────────────────────────────────────────────┤
-- │ pwcmodels.commissions │ FIELD SALES / Varicent comp — NOT used in script 01.     │
-- │                     │ participant, commissionAmount, orderId (closed deals).   │
-- │                     │ Used by deprecated script 12 for sales My Comp only.     │
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
-- Step 8.5 dim_marketing_rep filter   ← C2a only if qtd_earnings > 0 (rep dropdown)
-- Step 8.6 dim_rep refresh            ← re-sync hierarchy after Step 8.5
-- Step 9  fact_marketing_rep_metric   ← 3 plan metrics (Delta TABLE)
-- Step 10 fact_marketing_chargeback   ← cancel_count from staging
-- Step 11 fact_marketing_arrival      ← future-dated tours
-- Step 12 MERGE                       ← refresh chargeback columns on rep_period
-- =============================================================================


-- =============================================================================
-- HEADER — Rep picker
-- UI: AppContext rep dropdown
-- API: GET /api/comp/metadata
-- Script 01: Step 8.5 — dim_marketing_rep (earners only for C2a)
--   Built in Step 5, filtered after Step 8 where qtd_earnings > 0
--   C2b/C2c leaders always kept

-- (B) RUNTIME — server/compMetadata.ts reads dim_marketing_rep (no app change)
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

-- (3) What's next — tier ladder from fact_plan (TIER rows) via fact_payee_plan.plan_id
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
-- TOUR INTERVENE DRAWER — Guest 360
-- UI: MarketingTourInterveneDrawer (click tour row in Tour Activity)
-- API: GET /api/comp/marketing/tour/:tour_id/context?rep_id=&period_id=
-- Code: server/marketingTourContext.ts → buildMarketingTourContext()
-- =============================================================================
--
-- PREREQUISITES (run order):
--   00_CLEAN_AND_REBUILD.sql     — empty stub tables (dim_guest, fact_tour_quality, …)
--   01_MATERIALIZE_ALL_TABLES.sql — Step 7 tour ledger + Step 4 dim_location
--   09_create_guest_registry.sql — full guest-registry DDL (if not already present)
--   09a_seed_guest_registry.sql  — demo guest 360 rows (optional; production ETL TBD)
--
-- WHAT WORKS TODAY (after 00 + 01 only):
--   ✓ Tour ledger fields from fact_marketing_tour_payout (guest, payout, ABC, lead source)
--   ✓ Planned location name via dim_location (office_code from Step 4)
--   ✓ Chargebacks for this tour from fact_marketing_chargeback (Step 10)
--   ✗ guest_id / household_id are NULL in 01 — guest registry joins return empty
--   ✗ fact_tour_quality, rental stays, tour history, ownership — stubs only
--
-- FUTURE ETL (not built): it_uni_lead, it_uni_contract → dim_guest / fact_guest_*

-- (B) RUNTIME — core enrichment query (server/marketingTourContext.ts TOUR_ENRICHMENT_SELECT)
-- Replace :tour_id, :rep_id, :period_id
SELECT
  tp.tour_id, tp.rep_id, tp.period_id, tp.guest_name, tp.guest_type,
  tp.arrival_date, tp.tour_status, tp.code, tp.payout, tp.fps_eligible, tp.fps_potential, tp.notes,
  tp.guest_id, tp.household_id, tp.lead_source, tp.abc_score, tp.package_type, tp.xref_tour_id,
  tp.tour_booked_date,
  g.email AS guest_email, g.phone_token, g.qualification_code, g.owner_flag,
  hh.hh_size_band, hh.income_band, hh.home_msa,
  pl.location_id AS planned_location_id, pl.location_name AS planned_location_name,
  pl.location_type AS planned_location_type, pl.market AS planned_market, pl.brand AS planned_brand,
  pl.desk_label AS planned_desk_label,
  cs.location_id AS stay_location_id, cs.location_name AS stay_location_name,
  cs.location_type AS stay_location_type, cs.market AS stay_market, cs.brand AS stay_brand,
  cs.desk_label AS stay_desk_label,
  tq.lead_source AS tq_lead_source, tq.abc_score AS tq_abc_score, tq.package_type AS tq_package_type,
  tq.showed_flag, tq.closed_flag, tq.contract_status, tq.rescission_flag,
  tq.net_sales_volume, tq.vpg,
  COALESCE(stay.nights, 0) AS stay_duration_nights,
  COALESCE(hist.prior_tour_count, 0) AS prior_tour_count,
  COALESCE(rent.rental_stay_count, 0) AS rental_stay_count
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
LEFT JOIN edw_dev_hris.hgv_comp.dim_guest g ON g.guest_id = tp.guest_id
LEFT JOIN edw_dev_hris.hgv_comp.dim_household hh ON hh.household_id = tp.household_id
LEFT JOIN edw_dev_hris.hgv_comp.dim_location pl ON pl.location_id = tp.planned_tour_location_id
LEFT JOIN edw_dev_hris.hgv_comp.dim_location cs ON cs.location_id = tp.current_stay_location_id
LEFT JOIN edw_dev_hris.hgv_comp.fact_tour_quality tq
  ON tq.tour_id = COALESCE(tp.xref_tour_id, tp.tour_id)
LEFT JOIN (
  SELECT guest_id, MAX(nights) AS nights
  FROM edw_dev_hris.hgv_comp.fact_guest_rental_stay
  GROUP BY guest_id
) stay ON stay.guest_id = tp.guest_id
LEFT JOIN (
  SELECT guest_id, COUNT(*) AS prior_tour_count
  FROM edw_dev_hris.hgv_comp.fact_guest_tour_history
  GROUP BY guest_id
) hist ON hist.guest_id = tp.guest_id
LEFT JOIN (
  SELECT guest_id, COUNT(*) AS rental_stay_count
  FROM edw_dev_hris.hgv_comp.fact_guest_rental_stay
  GROUP BY guest_id
) rent ON rent.guest_id = tp.guest_id
WHERE tp.tour_id = :tour_id
  AND tp.rep_id = :rep_id
  AND tp.period_id = :period_id
LIMIT 1;

-- Chargebacks tied to this tour (also fetched by buildMarketingTourContext)
SELECT chargeback_id, premium_gift, chargeback_amount, notes
FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
WHERE tour_id = :tour_id AND rep_id = :rep_id;

-- SMOKE — guest registry population (expect 0 until 09a or production ETL)
SELECT 'dim_guest' AS tbl, COUNT(*) AS rows FROM edw_dev_hris.hgv_comp.dim_guest
UNION ALL SELECT 'dim_household', COUNT(*) FROM edw_dev_hris.hgv_comp.dim_household
UNION ALL SELECT 'fact_tour_quality', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_tour_quality
UNION ALL SELECT 'fact_guest_ownership', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_guest_ownership
UNION ALL SELECT 'fact_guest_tour_history', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_guest_tour_history
UNION ALL SELECT 'fact_guest_rental_stay', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_guest_rental_stay;

-- SMOKE — tours with NULL guest_id (expected after 01-only deploy)
SELECT COUNT(*) AS tours_with_null_guest_id
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE guest_id IS NULL;


-- =============================================================================
-- PLAN RULES / ASSESSMENT PANEL — HGV vs Market plan design
-- UI: MarketingPlanAssessmentPanel (My Comp + Manager views)
-- API: GET /api/comp/plan-assessment?persona_id=marketing_rep&period_id=2026-Q2
-- Code: server/planAssessment.ts → fetchPlanAssessment()
-- =============================================================================
--
-- PREREQUISITES (NOT in 00 or 01 — run separately):
--   10_create_plan_assessment.sql   — DDL for plan_assessment_profile + _segment
--   10a_seed_plan_assessment.sql    — PPT-aligned seed rows for C2a/C2b/C2c personas
--
-- FALLBACK: If warehouse tables are empty or missing, the app serves static rows from
--   shared/planAssessmentCatalog.ts (client usePlanAssessment.ts also falls back).
--
-- NOT the same as:
--   dim_tour_status_config (00) — tour payout $ amounts (admin-tunable)
--   fact_marketing_rep_metric (01 Step 9) — live rep attainment metrics on My Comp
--
-- persona_id values (must match 10a seeds):
--   marketing_rep      → C2a Marketing Representative
--   marketing_manager  → C2b Marketing Manager
--   marketing_director → C2c Marketing Director

-- (A) BUILD — 10_create_plan_assessment.sql (DDL only)
-- CREATE TABLE plan_assessment_profile (persona_id, plan_id, role_title, channel_code, effective_period)
-- CREATE TABLE plan_assessment_segment (persona_id, effective_period, attribute, attribute_order,
--                                       side, segment_order, segment_label, segment_value)

-- (A) BUILD — 10a_seed_plan_assessment.sql (idempotent DELETE + INSERT for 2026-Q2)

-- (B) RUNTIME — profile header (server/planAssessment.ts)
SELECT persona_id, plan_id, role_title, channel_code, effective_period
FROM edw_dev_hris.hgv_comp.plan_assessment_profile
WHERE persona_id = :persona_id
  AND effective_period = :period_id;

-- (B) RUNTIME — comparison rows (HGV vs market side-by-side)
SELECT attribute, attribute_order, side, segment_order, segment_label, segment_value
FROM edw_dev_hris.hgv_comp.plan_assessment_segment
WHERE persona_id = :persona_id
  AND effective_period = :period_id
ORDER BY attribute_order, side, segment_order;

-- SMOKE — verify plan assessment seeded (expect 3 profiles + many segments after 10a)
SELECT persona_id, plan_id, role_title, channel_code, effective_period
FROM edw_dev_hris.hgv_comp.plan_assessment_profile
ORDER BY persona_id;

SELECT persona_id, attribute, side, COUNT(*) AS segment_rows
FROM edw_dev_hris.hgv_comp.plan_assessment_segment
WHERE effective_period = '2026-Q2'
GROUP BY persona_id, attribute, side
ORDER BY persona_id, attribute, side;


-- =============================================================================
-- PAYOUT CONFIG (admin-tunable — not in script 01, seeded in 00)
-- Distinct from Plan Assessment panel above (design comparison vs live payout rules)
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
