-- =============================================================================
-- ONE-SHOT performance governance patch (supersedes 13 + 14)
-- Catalog: edw_dev_hris.hgv_comp | Run in SQL Editor once
-- TOUR_LOOKBACK=36mo | FIELD_LOOKBACK=60mo | dim_period capped at 24 quarters
-- =============================================================================

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
  ON d.tour_key_hash = p.tour_key_hash
WHERE COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date))
  >= ADD_MONTHS(CURRENT_DATE(), -36);

-- Rep directory: GROUP BY rep keys (never DISTINCT-scan full commissions at tour/payment grain).

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp._src_rep_directory AS
SELECT
  CAST(p.salesperson_1_employee_id AS STRING) AS rep_id,
  MAX(COALESCE(NULLIF(TRIM(p.salesperson_1_name), ''), 'Unknown Rep')) AS rep_name,
  'MKT' AS level_code,
  MAX(COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT')) AS team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  MAX(COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other')) AS region,
  TRUE AS is_active,
  'marketing' AS source_domain
FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d
  ON d.tour_key_hash = p.tour_key_hash
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON p.tour_key_hash = m.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL
  AND COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date))
    >= ADD_MONTHS(CURRENT_DATE(), -36)
GROUP BY CAST(p.salesperson_1_employee_id AS STRING)

UNION ALL

SELECT
  c.participant AS rep_id,
  MAX(c.participant) AS rep_name,
  MAX(
    CASE
      WHEN LOWER(c.title) LIKE '%manager%' THEN 'L8'
      WHEN LOWER(c.title) LIKE '%train%' THEN 'L5'
      ELSE 'L6'
    END
  ) AS level_code,
  MAX(COALESCE(NULLIF(TRIM(c.businessUnit), ''), 'TEAM-FIELD')) AS team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  'Field' AS region,
  TRUE AS is_active,
  'field' AS source_domain
FROM edw_dev_hris.pwcmodels.commissions c
WHERE c.participant IS NOT NULL
  AND c.payDate IS NOT NULL
  AND TO_DATE(c.payDate) >= ADD_MONTHS(CURRENT_DATE(), -60)
GROUP BY c.participant;

-- Period calendar: aggregate to quarter grain (avoid DISTINCT over full commissions history).

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp._src_period_calendar AS
WITH commission_quarters AS (
  SELECT
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
    AND TO_DATE(payDate) >= ADD_MONTHS(CURRENT_DATE(), -60)
  GROUP BY 1, 2, 3, 4
),
tour_quarters AS (
  SELECT
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
  WHERE t.tour_date IS NOT NULL
    AND t.tour_date >= ADD_MONTHS(CURRENT_DATE(), -60)
  GROUP BY 1, 2, 3, 4
)
SELECT period_id, period_label, period_start, period_end FROM commission_quarters
UNION
SELECT period_id, period_label, period_start, period_end FROM tour_quarters;

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
SELECT
  team_id,
  MAX(COALESCE(NULLIF(TRIM(team_id), ''), 'TEAM-UNK')) AS team_name,
  MAX(region) AS region
FROM edw_dev_hris.hgv_comp._src_rep_directory
WHERE team_id IS NOT NULL
GROUP BY team_id;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.dim_period AS
WITH ranked AS (
  SELECT
    period_id,
    period_label,
    period_start,
    period_end,
    ROW_NUMBER() OVER (ORDER BY period_start DESC) AS rn
  FROM edw_dev_hris.hgv_comp._src_period_calendar
  WHERE period_start >= ADD_MONTHS(CURRENT_DATE(), -60)
)
SELECT
  period_id,
  period_label,
  period_start,
  period_end,
  (rn = 1) AS is_current
FROM ranked
WHERE rn <= 24;

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
  AND TO_DATE(c.payDate) >= ADD_MONTHS(CURRENT_DATE(), -60)
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
  AND CAST(uc.contr_num AS BIGINT) > 0
  AND COALESCE(TO_DATE(uc.date_sold), TO_DATE(uc.pender_date), DATE '1970-01-01')
    >= ADD_MONTHS(CURRENT_DATE(), -60);

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
    AND payDate IS NOT NULL
    AND TO_DATE(payDate) >= ADD_MONTHS(CURRENT_DATE(), -60)
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

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_plan_eligibility AS
SELECT
  c.participant AS rep_id,
  CONCAT(
    CAST(YEAR(TO_DATE(c.payDate)) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(TO_DATE(c.payDate)) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  'PLAN-FT-2026' AS plan_version_id,
  MAX(COALESCE(NULLIF(TRIM(c.position), ''), 'FIELD-REP')) AS job_code,
  MAX(COALESCE(NULLIF(TRIM(element_at(split(c.businessUnit, '_'), 1)), ''), 'UNK')) AS location_code,
  'HGV' AS brand,
  MAX(DATE_TRUNC('QUARTER', TO_DATE(c.payDate))) AS effective_start,
  CAST(NULL AS DATE) AS effective_end,
  CAST(100.00 AS DECIMAL(5, 2)) AS proration_pct,
  TRUE AS eligibility_flag,
  CAST(NULL AS STRING) AS exclusion_reason
FROM edw_dev_hris.pwcmodels.commissions c
WHERE c.participant IS NOT NULL
  AND c.payDate IS NOT NULL
  AND TO_DATE(c.payDate) >= ADD_MONTHS(CURRENT_DATE(), -60)
GROUP BY c.participant, 2;

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
WHERE (COALESCE(uc.cancel_volume, 0) <> 0 OR COALESCE(uc.cancel_sales, 0) <> 0)
  AND COALESCE(TO_DATE(uc.cancel_date), TO_DATE(uc.date_sold), DATE '1970-01-01')
    >= ADD_MONTHS(CURRENT_DATE(), -60);

-- ---------------------------------------------------------------------------
-- Marketing compensation facts
-- LOOKBACK: 36 months — full it_smt_detail history will hang on rep-period rollups.
-- ---------------------------------------------------------------------------

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
  AND t.tour_date IS NOT NULL;

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

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_rep_market_position AS
SELECT
  qa.rep_id,
  qa.period_id,
  COALESCE(mr.rep_name, fr.rep_name, qa.rep_id) AS rep_name,
  CASE WHEN mr.rep_id IS NOT NULL THEN 'marketing_rep' ELSE 'field_rep' END AS role_key,
  CAST((qa.attainment_pct - 100) AS DECIMAL(6, 2)) AS tcc_gap_vs_market_pct,
  CAST(30.00 AS DECIMAL(6, 2)) AS base_pct,
  CAST(70.00 AS DECIMAL(6, 2)) AS variable_pct,
  qa.attainment_pct AS quota_attainment_pct
FROM edw_dev_hris.hgv_comp.fact_quota_attainment qa
LEFT JOIN edw_dev_hris.hgv_comp.dim_marketing_rep mr
  ON mr.rep_id = qa.rep_id
LEFT JOIN edw_dev_hris.hgv_comp._src_rep_directory fr
  ON fr.rep_id = qa.rep_id
  AND fr.source_domain = 'field';

-- ---------------------------------------------------------------------------
-- Guest registry facts
-- ---------------------------------------------------------------------------
-- Smoke (seconds each):
-- SELECT COUNT(*) AS dim_rep FROM edw_dev_hris.hgv_comp.dim_rep;
-- SELECT COUNT(*) AS dim_marketing_rep FROM edw_dev_hris.hgv_comp.dim_marketing_rep;
-- SELECT COUNT(DISTINCT rep_id) AS mkt_rep_period FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period;
-- SELECT COUNT(*) AS dim_period FROM edw_dev_hris.hgv_comp.dim_period;
