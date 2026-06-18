-- =============================================================================
-- MATERIALIZE ALL TABLES  (run AFTER 00_CLEAN_AND_REBUILD.sql)
--
-- Schema matches EXACTLY what the app server code expects.
-- Source of truth for expected columns: server/compSchemaBootstrap.ts
--
-- SOURCE TABLES (Cognos FM):
--   it_smt_marketing  — tour booking grain (office, channel, dates, status)
--   it_smt_personnel  — rep credit grain  (opc_person_1_* = marketing rep)
--   it_smt_detail     — transaction grain (showed, qualified, sales, cancels,
--                       lead_name, ownership_status, tour_score, fico)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1) Staging: marketing spine (2026) with aggregated detail
-- ONE row per tour_key_hash, detail pre-aggregated to prevent duplication.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_marketing_tour_detail
USING DELTA AS
WITH tours_2026 AS (
  SELECT
    m.tour_key_hash,
    m.tour_id,
    m.tour_status_desc,
    m.tour_booked_date,
    TO_DATE(m.tour_date) AS tour_date,                                  -- actual tour/arrival date
    CAST(m.office_code AS STRING)                            AS office_code,
    COALESCE(NULLIF(TRIM(m.office_description), ''), 'Sales Center') AS office_description,
    COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other')     AS office_region,
    COALESCE(NULLIF(TRIM(m.office_site), ''), '')            AS office_site,
    COALESCE(NULLIF(TRIM(m.office_brand), ''), '')           AS office_brand,
    COALESCE(m.channel, 'MKT')                              AS channel,
    NULLIF(TRIM(m.marketing_program_desc), '')              AS marketing_program_desc,
    NULLIF(TRIM(m.marketing_package_type_desc), '')         AS package_type,
    ROW_NUMBER() OVER (PARTITION BY m.tour_key_hash ORDER BY m.tour_booked_date) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
  WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
),
tour_detail_agg AS (
  SELECT
    d.tour_key_hash,
    -- Owner / New Buyer quality signal (the "qualified" dimension).
    -- A tour is QUALIFIED when an Owner or New Buyer toured (vs courtesy/non-owner).
    MAX(CASE
          WHEN CAST(d.qualified AS STRING) IN ('1','true','TRUE','Y') THEN 1
          WHEN TRY_CAST(d.gross_qualified AS DOUBLE) > 0 THEN 1
          WHEN TRY_CAST(d.owners      AS DOUBLE) > 0 THEN 1
          WHEN TRY_CAST(d.new_buyers  AS DOUBLE) > 0 THEN 1
          WHEN UPPER(TRIM(d.ownership_status)) IN ('OWNER','NEW BUYER') THEN 1
          ELSE 0
        END) AS qualified_signal,
    -- sales / cancels (transaction counts) for guest-buy-rate and chargebacks
    SUM(COALESCE(TRY_CAST(d.net_transactions    AS DOUBLE), 0)) AS sales_count,
    SUM(COALESCE(TRY_CAST(d.cancel_transactions AS DOUBLE), 0)) AS cancel_count,
    SUM(COALESCE(TRY_CAST(d.net_volume          AS DOUBLE), 0)) AS net_volume_sum,
    -- lead_name = guest name (sparse); ownership_status = guest type
    FIRST(NULLIF(TRIM(d.lead_name), ''))        AS lead_name,
    FIRST(NULLIF(TRIM(d.ownership_status), '')) AS ownership_status,
    -- quality signals for ABC grade & lead source
    MAX(TRY_CAST(d.tour_score AS DOUBLE))       AS tour_score,
    FIRST(NULLIF(TRIM(d.fico_color), ''))       AS fico_color,
    FIRST(NULLIF(TRIM(d.lead_source_desc), '')) AS lead_source_desc
  FROM edw_dev_cognos.cognos_fm.it_smt_detail d
  WHERE d.tour_key_hash IN (SELECT tour_key_hash FROM tours_2026)
    AND TO_DATE(d.transaction_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  GROUP BY d.tour_key_hash
)
SELECT
  t.tour_key_hash,
  t.tour_id,
  t.tour_status_desc,
  t.tour_booked_date,
  t.tour_date,
  t.office_code,
  t.office_description,
  t.office_region,
  t.office_site,
  t.office_brand,
  t.channel,
  t.marketing_program_desc,
  t.package_type,
  -- SHOWED is authoritative from tour_status_desc (Slide 40/48: pay on shown tours).
  -- 'TOUR' (52.6% of volume) and 'SHOW' both mean the tour presentation happened.
  (UPPER(TRIM(t.tour_status_desc)) IN ('TOUR','SHOW','SHOWN','PRESENTED')) AS showed_flag,
  -- QUALIFIED = showed AND Owner/New-Buyer quality signal
  (UPPER(TRIM(t.tour_status_desc)) IN ('TOUR','SHOW','SHOWN','PRESENTED')
     AND COALESCE(d.qualified_signal, 0) = 1) AS qualified_flag,
  COALESCE(d.sales_count, 0)         AS sales_count,
  COALESCE(d.cancel_count, 0)        AS cancel_count,
  COALESCE(d.net_volume_sum, 0)      AS net_volume_sum,
  d.lead_name                         AS guest_name,
  d.ownership_status                  AS guest_type,
  d.tour_score,
  d.fico_color,
  d.lead_source_desc
FROM tours_2026 t
LEFT JOIN tour_detail_agg d ON t.tour_key_hash = d.tour_key_hash
WHERE t.rn = 1;

-- ---------------------------------------------------------------------------
-- Step 2) Staging: enrich with OPC rep (one rep per tour) + derived period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_tour_enriched
USING DELTA AS
WITH personnel_ranked AS (
  SELECT
    p.tour_key_hash,
    CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
    p.opc_person_1_name                         AS rep_name,
    CAST(p.opc_team_code AS STRING)             AS team_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.tour_key_hash
      ORDER BY
        CASE WHEN p.opc_person_1_employee_id IS NOT NULL
              AND CAST(p.opc_person_1_employee_id AS STRING) NOT IN ('0','')
             THEN 0 ELSE 1 END,
        p.opc_person_1_employee_id DESC
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
  WHERE p.tour_key_hash IN (SELECT tour_key_hash FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail)
)
SELECT
  d.*,
  -- period_id format '2026-Q2' from actual tour date (fallback to booking date)
  CONCAT(
    YEAR(COALESCE(d.tour_date, TO_DATE(d.tour_booked_date))),
    '-Q',
    QUARTER(COALESCE(d.tour_date, TO_DATE(d.tour_booked_date)))
  ) AS period_id,
  -- comp status key drives payout lookup (QUALIFIED / COURTESY / NO SHOW)
  CASE
    WHEN NOT d.showed_flag                       THEN 'NO SHOW'
    WHEN d.qualified_flag                        THEN 'QUALIFIED'
    ELSE 'COURTESY'
  END AS comp_status_key,
  p.rep_id,
  COALESCE(p.rep_name, 'UNASSIGNED') AS rep_name,
  p.team_id
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN personnel_ranked p
  ON d.tour_key_hash = p.tour_key_hash AND p.rn = 1
WHERE p.rep_id IS NOT NULL
  AND p.rep_id NOT IN ('0', '');

-- ---------------------------------------------------------------------------
-- Step 3) dim_period  (period_id, period_label, period_start, period_end, is_current)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA AS
SELECT
  CONCAT(YEAR(period_start), '-Q', QUARTER(period_start))       AS period_id,
  CONCAT('Q', QUARTER(period_start), ' ', YEAR(period_start))   AS period_label,
  period_start,
  LAST_DAY(ADD_MONTHS(period_start, 2))                         AS period_end,
  CONCAT(YEAR(period_start), '-Q', QUARTER(period_start)) = '2026-Q2' AS is_current
FROM (
  SELECT DISTINCT DATE_TRUNC('quarter', COALESCE(TO_DATE(tour_date), TO_DATE(tour_booked_date))) AS period_start
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing
  WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
    AND COALESCE(TO_DATE(tour_date), TO_DATE(tour_booked_date)) IS NOT NULL
)
ORDER BY period_start;

-- ---------------------------------------------------------------------------
-- Step 4) dim_location  (planned tour location names from office data)
-- Populated so tour enrichment surfaces real location names (not office codes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_location
USING DELTA AS
SELECT
  office_code                          AS location_id,
  MAX(office_description)              AS location_name,
  'Sales Center'                       AS location_type,
  MAX(office_region)                  AS market,
  MAX(NULLIF(office_brand, ''))       AS brand,
  MAX(NULLIF(office_site, ''))        AS desk_label
FROM edw_dev_hris.hgv_comp._stg_tour_enriched
WHERE office_code IS NOT NULL
GROUP BY office_code;

-- ---------------------------------------------------------------------------
-- Step 5) dim_marketing_rep  (rep picker + management hierarchy)
--   C2a = Marketing Representative | C2b = Manager | C2c = Director
--
--   The Cognos tour feed has NO org-hierarchy column — opc_person_1 is always
--   the rep who worked the tour, and opc_team_description names the OPC team
--   (e.g. "IN-HOUSE", "OAHU IPC"), never a manager/director. So we SYNTHESIZE
--   the management tier from the real groupings that DO exist in the data:
--     • one Manager (C2b) per OPC team  (rep_id = 'MGR-<team_code>')
--     • one Director (C2c) per region   (rep_id = 'DIR-<region>')
--   Reps roll up to their team manager; managers roll up to their region
--   director (wired via dim_rep.manager_rep_id in Step 6). When a real HR
--   hierarchy feed arrives, replace this synthesis — UI/API need no changes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA AS
WITH rep_team AS (
  -- assign each rep to their dominant (most-toured) team + region
  SELECT
    rep_id,
    COALESCE(NULLIF(team_id, ''), 'UNASSIGNED') AS team_id,
    COALESCE(NULLIF(TRIM(office_region), ''), 'Other') AS region,
    ROW_NUMBER() OVER (
      PARTITION BY rep_id
      ORDER BY COUNT(*) DESC, COALESCE(NULLIF(team_id, ''), 'UNASSIGNED')
    ) AS rn
  FROM edw_dev_hris.hgv_comp._stg_tour_enriched
  WHERE rep_id IS NOT NULL
  GROUP BY rep_id, COALESCE(NULLIF(team_id, ''), 'UNASSIGNED'),
           COALESCE(NULLIF(TRIM(office_region), ''), 'Other')
),
rep_names AS (
  SELECT rep_id, MAX(rep_name) AS rep_name
  FROM edw_dev_hris.hgv_comp._stg_tour_enriched
  WHERE rep_id IS NOT NULL
  GROUP BY rep_id
),
reps AS (
  SELECT
    rt.rep_id,
    rn.rep_name,
    'C2a'      AS level_code,
    rt.team_id,
    rt.region,
    TRUE       AS is_active
  FROM rep_team rt
  JOIN rep_names rn ON rn.rep_id = rt.rep_id
  WHERE rt.rn = 1
),
-- friendly team name from the OPC team description in personnel
team_lookup AS (
  SELECT CAST(opc_team_code AS STRING) AS team_id, MAX(opc_team_description) AS team_desc
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_team_code IS NOT NULL
  GROUP BY CAST(opc_team_code AS STRING)
),
teams_with_reps AS (
  SELECT team_id, MAX(region) AS region
  FROM reps
  WHERE team_id NOT IN ('UNASSIGNED', '0', '')
  GROUP BY team_id
),
managers AS (
  SELECT
    CONCAT('MGR-', t.team_id) AS rep_id,
    CONCAT('Manager — ', COALESCE(NULLIF(TRIM(tl.team_desc), ''), CONCAT('Team ', t.team_id))) AS rep_name,
    'C2b'        AS level_code,
    t.team_id,
    t.region,
    (COALESCE(tl.team_desc, '') NOT LIKE '[DNU]%') AS is_active
  FROM teams_with_reps t
  LEFT JOIN team_lookup tl ON tl.team_id = t.team_id
),
regions AS (
  SELECT DISTINCT region
  FROM reps
  WHERE region IS NOT NULL AND TRIM(region) <> '' AND region <> 'Other'
),
directors AS (
  SELECT
    CONCAT('DIR-', region)       AS rep_id,
    CONCAT('Director — ', region) AS rep_name,
    'C2c'                        AS level_code,
    CONCAT('REGION-', region)    AS team_id,
    region,
    TRUE                         AS is_active
  FROM regions
)
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM reps
UNION ALL
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM managers
UNION ALL
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM directors;

-- ---------------------------------------------------------------------------
-- Step 6) dim_rep  (unified rep dimension + management reporting lines)
--   manager_rep_id wires the org tree the manager workspace reads:
--     rep (C2a)     -> team manager   'MGR-<team_code>'
--     manager (C2b) -> region director 'DIR-<region>'
--     director (C2c)-> NULL (top of marketing tree)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA AS
SELECT
  rep_id, rep_name, level_code, team_id,
  CASE
    WHEN level_code = 'C2a' AND team_id NOT IN ('UNASSIGNED', '0', '')
         THEN CONCAT('MGR-', team_id)
    WHEN level_code = 'C2b' AND region IS NOT NULL AND TRIM(region) <> '' AND region <> 'Other'
         THEN CONCAT('DIR-', region)
    ELSE CAST(NULL AS STRING)
  END AS manager_rep_id,
  region, is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep;

-- ---------------------------------------------------------------------------
-- Step 7) fact_marketing_tour_payout  (tour ledger)
-- Payout looked up from admin config by comp_status_key (QUALIFIED/COURTESY/NO SHOW)
-- using a CASE-INSENSITIVE match — this is the fix for the all-$0 bug.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA AS
SELECT
  t.tour_id,
  t.rep_id,
  t.period_id,

  t.guest_name,
  t.guest_type,

  COALESCE(t.tour_date, TO_DATE(t.tour_booked_date)) AS arrival_date,

  -- normalized display status
  CASE
    WHEN UPPER(TRIM(t.tour_status_desc)) IN ('SHOW','SHOWN','TOUR','PRESENTED') THEN 'SHOWN'
    WHEN UPPER(TRIM(t.tour_status_desc)) IN ('NO SHOW','NO-SHOW','NOSHOW')      THEN 'NO_SHOW'
    WHEN UPPER(TRIM(t.tour_status_desc)) IN ('CANCEL','CANCELED','CANCELLED')   THEN 'CANCELED'
    WHEN UPPER(TRIM(t.tour_status_desc)) IN ('BOOK','BOOKED')                   THEN 'BOOKED'
    WHEN t.tour_date > CURRENT_DATE()                                          THEN 'BOOKED'
    ELSE UPPER(TRIM(COALESCE(t.tour_status_desc, 'UNKNOWN')))
  END AS tour_status,

  CASE WHEN t.qualified_flag THEN 'Q' ELSE 'NQ' END AS code,

  -- payout by comp status key (admin-configurable, case-insensitive lookup)
  COALESCE(cfg.payout_amount, 0.00) AS payout,

  t.qualified_flag AS fps_eligible,

  -- FPS opportunity only on qualified tours that actually showed
  CASE WHEN t.qualified_flag AND t.showed_flag
       THEN CAST(250.00 AS DECIMAL(14,2)) ELSE CAST(0.00 AS DECIMAL(14,2)) END AS fps_potential,

  -- notes carry the marketing program for context (used by AI insights)
  t.marketing_program_desc AS notes,
  CAST(NULL AS STRING) AS guest_id,
  CAST(NULL AS STRING) AS household_id,
  t.office_code        AS planned_tour_location_id,
  CAST(NULL AS STRING) AS current_stay_location_id,
  COALESCE(t.lead_source_desc, t.channel) AS lead_source,

  -- ABC grade derived from tour_score (propensity), fallback to qualified status
  CASE
    WHEN t.tour_score IS NULL THEN CASE WHEN t.qualified_flag THEN 'B' ELSE 'C' END
    WHEN t.tour_score >= 7 THEN 'A'
    WHEN t.tour_score >= 4 THEN 'B'
    ELSE 'C'
  END AS abc_score,

  t.package_type,
  CAST(NULL AS STRING) AS xref_tour_id,
  TO_DATE(t.tour_booked_date) AS tour_booked_date

FROM edw_dev_hris.hgv_comp._stg_tour_enriched t
LEFT JOIN edw_dev_hris.hgv_comp.dim_tour_status_config cfg
  ON UPPER(TRIM(t.comp_status_key)) = UPPER(TRIM(cfg.tour_status_desc))
 AND cfg.is_active = TRUE
 AND CURRENT_DATE() BETWEEN cfg.effective_start_date
                        AND COALESCE(cfg.effective_end_date, DATE '2099-12-31');

-- ---------------------------------------------------------------------------
-- Step 8) fact_marketing_rep_period  (period KPI spine)
--   qualified rate  = qualified_tours / tours_shown   (tour quality)
--   guest buy rate  = buy_tours       / tours_shown   (penetration_pct — DISTINCT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA AS
WITH pay AS (
  -- Dollar sums from the tour ledger, grouped (no staging join → no fan-out)
  SELECT
    tp.rep_id,
    tp.period_id,
    MAX(dr.rep_name) AS rep_name,
    MAX(dr.team_id)  AS team_id,
    COUNT(DISTINCT tp.tour_id) AS total_tours,
    CAST(SUM(CASE WHEN tp.code = 'Q'  THEN tp.payout ELSE 0 END) AS DECIMAL(14,2)) AS qualified_tour_pay,
    CAST(SUM(CASE WHEN tp.code = 'NQ' AND tp.tour_status = 'SHOWN' THEN tp.payout ELSE 0 END) AS DECIMAL(14,2)) AS courtesy_tour_pay,
    CAST(SUM(CASE WHEN tp.tour_status = 'SHOWN' THEN tp.fps_potential ELSE 0 END) AS DECIMAL(14,2)) AS fps_open,
    FIRST(tp.planned_tour_location_id) AS assigned_area
  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
  JOIN (
    -- dedup rep dimension (a rep_id can appear as both C2a and a manager level)
    SELECT rep_id, MAX(rep_name) AS rep_name, MAX(team_id) AS team_id
    FROM edw_dev_hris.hgv_comp.dim_marketing_rep
    GROUP BY rep_id
  ) dr ON dr.rep_id = tp.rep_id
  GROUP BY tp.rep_id, tp.period_id
),
cnt AS (
  -- Tour counts from staging, grouped (one row per tour_id → no fan-out)
  SELECT
    rep_id,
    period_id,
    COUNT(DISTINCT CASE WHEN qualified_flag THEN tour_id END)  AS qualified_tours,
    COUNT(DISTINCT CASE WHEN showed_flag    THEN tour_id END)  AS tours_shown,
    COUNT(DISTINCT CASE WHEN sales_count > 0 THEN tour_id END) AS buy_tours
  FROM edw_dev_hris.hgv_comp._stg_tour_enriched
  GROUP BY rep_id, period_id
),
agg AS (
  SELECT
    p.rep_id, p.period_id, p.rep_name, p.team_id, p.total_tours,
    p.qualified_tour_pay, p.courtesy_tour_pay, p.fps_open, p.assigned_area,
    c.qualified_tours, c.tours_shown, c.buy_tours
  FROM pay p
  JOIN cnt c ON c.rep_id = p.rep_id AND c.period_id = p.period_id
),
cb AS (
  SELECT rep_id, period_id, CAST(SUM(chargeback_amount) AS DECIMAL(14,2)) AS cb_total
  FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
  GROUP BY rep_id, period_id
)
SELECT
  a.rep_id,
  a.period_id,
  a.rep_name,
  'PLAN-MKT-REP-2026'                          AS plan_id,
  COALESCE(loc.location_name, a.assigned_area, 'Unknown') AS assigned_area,
  COALESCE(a.assigned_area, 'Unknown')         AS bonus_area_id,

  -- guest buy rate spiff: $25 per buy when buy rate hits target
  CAST(a.qualified_tour_pay + a.courtesy_tour_pay
       + CASE WHEN a.tours_shown > 0 AND (a.buy_tours * 100.0 / a.tours_shown) >= 20.0
              THEN a.buy_tours * 25.0 ELSE 0 END
       - COALESCE(cb.cb_total, 0) AS DECIMAL(14,2))            AS qtd_earnings,
  CAST(a.qualified_tour_pay + a.courtesy_tour_pay AS DECIMAL(14,2)) AS paid_to_date,

  a.qualified_tours,
  a.tours_shown,

  -- show rate = shown / booked
  CAST(CASE WHEN a.total_tours > 0 THEN ROUND(a.tours_shown * 100.0 / a.total_tours, 2) ELSE 0.0 END AS DECIMAL(6,2)) AS show_rate_pct,

  -- penetration = GUEST BUY RATE = sales / shown  (distinct from qualified rate)
  CAST(CASE WHEN a.tours_shown > 0 THEN ROUND(a.buy_tours * 100.0 / a.tours_shown, 2) ELSE 0.0 END AS DECIMAL(6,2)) AS penetration_pct,

  CAST(20.0 AS DECIMAL(6,2)) AS penetration_target_pct,

  (CASE WHEN a.tours_shown > 0 THEN (a.buy_tours * 100.0 / a.tours_shown) >= 20.0 ELSE FALSE END) AS spiff_active,

  CASE
    WHEN a.qualified_tours < 3  THEN 'Tier 1 — $50 per qualified tour'
    WHEN a.qualified_tours < 6  THEN 'Tier 2 — $75 per qualified tour'
    WHEN a.qualified_tours < 10 THEN 'Tier 3 — $100 per qualified tour'
    ELSE 'Top Tier — max rate achieved'
  END AS next_tier_label,

  CAST(CASE
      WHEN a.qualified_tours < 3  THEN 3  - a.qualified_tours
      WHEN a.qualified_tours < 6  THEN 6  - a.qualified_tours
      WHEN a.qualified_tours < 10 THEN 10 - a.qualified_tours
      ELSE 0
    END AS INT) AS next_tier_gap_tours,

  a.qualified_tour_pay,
  a.courtesy_tour_pay,

  CAST(CASE WHEN a.tours_shown > 0 AND (a.buy_tours * 100.0 / a.tours_shown) >= 20.0
            THEN a.buy_tours * 25.0 ELSE 0 END AS DECIMAL(14,2)) AS penetration_spiff,

  CAST(-COALESCE(cb.cb_total, 0) AS DECIMAL(14,2)) AS chargebacks,

  CAST(a.qualified_tour_pay + a.courtesy_tour_pay
       + CASE WHEN a.tours_shown > 0 AND (a.buy_tours * 100.0 / a.tours_shown) >= 20.0
              THEN a.buy_tours * 25.0 ELSE 0 END
       - COALESCE(cb.cb_total, 0) AS DECIMAL(14,2)) AS total_payout,

  CAST(40.0 AS DECIMAL(6,2)) AS base_pct,
  CAST(60.0 AS DECIMAL(6,2)) AS variable_pct,
  CAST(0.0  AS DECIMAL(6,2)) AS tcc_gap_vs_market_pct
FROM agg a
LEFT JOIN edw_dev_hris.hgv_comp.dim_location loc ON loc.location_id = a.assigned_area
LEFT JOIN cb ON cb.rep_id = a.rep_id AND cb.period_id = a.period_id;

-- ---------------------------------------------------------------------------
-- Step 9) fact_marketing_rep_metric  (3 metrics per rep×period)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_metric
USING DELTA AS
WITH base AS (
  SELECT
    p.rep_id, p.period_id, p.qualified_tours, p.tours_shown, p.penetration_pct,
    p.qualified_tour_pay, p.courtesy_tour_pay, p.total_payout,
    COALESCE(fps.fps_open, 0.0) AS fps_open,
    COALESCE(buy.buy_tours, 0)  AS buy_tours
  FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
  LEFT JOIN (
    SELECT tp.rep_id, tp.period_id,
           CAST(SUM(CASE WHEN tp.tour_status = 'SHOWN' THEN tp.fps_potential ELSE 0 END) AS DECIMAL(14,2)) AS fps_open
    FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
    GROUP BY tp.rep_id, tp.period_id
  ) fps ON fps.rep_id = p.rep_id AND fps.period_id = p.period_id
  LEFT JOIN (
    SELECT rep_id, period_id, COUNT(DISTINCT CASE WHEN sales_count > 0 THEN tour_id END) AS buy_tours
    FROM edw_dev_hris.hgv_comp._stg_tour_enriched
    GROUP BY rep_id, period_id
  ) buy ON buy.rep_id = p.rep_id AND buy.period_id = p.period_id
)
SELECT rep_id, period_id,
  'Qualified Tours (Owner, New Buyer)'      AS metric_name,
  CAST(45 AS DECIMAL(6,2))                  AS weight_pct,
  qualified_tour_pay                         AS earnings,
  CAST(ROUND(qualified_tours * 100.0 / GREATEST(3, 1), 2) AS DECIMAL(6,2)) AS attainment_pct,
  '3 qualified tours target'                AS target_label,
  CAST(CASE WHEN qualified_tours < 3 THEN (3 - qualified_tours) * 75.0 ELSE 0 END AS DECIMAL(14,2)) AS opportunity_usd
FROM base
UNION ALL
SELECT rep_id, period_id,
  'Individual FPS Packages'                 AS metric_name,
  CAST(35 AS DECIMAL(6,2))                  AS weight_pct,
  CAST(0 AS DECIMAL(14,2))                  AS earnings,
  CAST(penetration_pct AS DECIMAL(6,2))     AS attainment_pct,
  '20% guest buy rate target'               AS target_label,
  -- open FPS = unsold FPS sitting on qualified tours
  CAST(fps_open AS DECIMAL(14,2))           AS opportunity_usd
FROM base
UNION ALL
SELECT rep_id, period_id,
  'Tours Shown'                             AS metric_name,
  CAST(20 AS DECIMAL(6,2))                  AS weight_pct,
  courtesy_tour_pay                          AS earnings,
  CAST(ROUND(tours_shown * 100.0 / GREATEST(10, 1), 2) AS DECIMAL(6,2)) AS attainment_pct,
  '10 tours shown target'                   AS target_label,
  CAST(CASE WHEN tours_shown < 10 THEN (10 - tours_shown) * 20.0 ELSE 0 END AS DECIMAL(14,2)) AS opportunity_usd
FROM base;

-- ---------------------------------------------------------------------------
-- Step 10) fact_marketing_chargeback
-- Derived from cancelled / rescinded contracts tied to a rep's qualified tour.
-- A chargeback = qualified-tour credit reversed when the downstream deal cancels.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_chargeback
USING DELTA AS
SELECT
  CONCAT('CB-', s.tour_id)                       AS chargeback_id,
  s.rep_id,
  s.period_id,
  COALESCE(NULLIF(s.guest_name, ''), s.guest_type, 'Guest') AS guest_name,
  s.tour_id,
  s.package_type                                 AS premium_gift,
  CAST(s.cancel_count * 75.0 AS DECIMAL(14,2))   AS chargeback_amount,
  CONCAT('Contract cancelled/rescinded — ', CAST(CAST(s.cancel_count AS INT) AS STRING),
         ' qualified-tour credit reversed') AS notes
FROM edw_dev_hris.hgv_comp._stg_tour_enriched s
WHERE s.cancel_count > 0
  AND s.rep_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 11) fact_marketing_arrival
-- Derived from future-dated tours on the rep's calendar (not yet completed).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_arrival
USING DELTA AS
SELECT
  CONCAT('ARR-', tp.tour_id)                     AS arrival_id,
  tp.rep_id,
  tp.period_id,
  COALESCE(NULLIF(tp.guest_name, ''), tp.guest_type, 'Guest') AS guest_name,
  COALESCE(tp.guest_type, 'New Buyer')           AS guest_type,
  CAST(tp.arrival_date AS STRING)                AS arrival_datetime,
  COALESCE(loc.location_name, tp.planned_tour_location_id, 'Sales Center') AS desk,
  CAST(75.00 AS DECIMAL(14,2))                   AS potential_qualified_tour,
  CAST(250.00 AS DECIMAL(14,2))                  AS potential_fps_payout,
  CAST(325.00 AS DECIMAL(14,2))                  AS projected_total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
LEFT JOIN edw_dev_hris.hgv_comp.dim_location loc ON loc.location_id = tp.planned_tour_location_id
WHERE tp.arrival_date >= CURRENT_DATE();

-- ---------------------------------------------------------------------------
-- Step 12) Rebuild rep_period chargeback totals now that chargebacks exist.
-- (Step 8 ran before Step 10; refresh the chargeback-dependent columns.)
-- ---------------------------------------------------------------------------
MERGE INTO edw_dev_hris.hgv_comp.fact_marketing_rep_period p
USING (
  SELECT rep_id, period_id, CAST(SUM(chargeback_amount) AS DECIMAL(14,2)) AS cb_total
  FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
  GROUP BY rep_id, period_id
) c
ON p.rep_id = c.rep_id AND p.period_id = c.period_id
WHEN MATCHED THEN UPDATE SET
  p.chargebacks   = -c.cb_total,
  p.qtd_earnings  = p.paid_to_date + p.penetration_spiff - c.cb_total,
  p.total_payout  = p.paid_to_date + p.penetration_spiff - c.cb_total;

-- =============================================================================
-- END
-- =============================================================================
