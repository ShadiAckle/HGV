-- Manager agent performance table (quota attainment, level, FFS mix)
-- Effective attainment includes active QUOTA_SHIELD relief from fact_manager_intervention
-- @param team_id STRING
-- @param period_id STRING
WITH rep_ffs AS (
  SELECT
    mix.rep_id,
    mix.period_id,
    MAX(CASE WHEN pl.is_ffs THEN mix.mix_pct END) AS ffs_sales_pct
  FROM workspace.hgv_comp.fact_rep_product_mix mix
  JOIN workspace.hgv_comp.dim_product_line pl
    ON pl.product_line_id = mix.product_line_id
  GROUP BY mix.rep_id, mix.period_id
),
quota_shield AS (
  SELECT target_rep_id, period_id, MAX(quota_relief_pct) AS quota_relief_pct
  FROM workspace.hgv_comp.fact_manager_intervention
  WHERE intervention_type = 'QUOTA_SHIELD' AND status = 'ACTIVE'
  GROUP BY target_rep_id, period_id
)
SELECT
  r.rep_id,
  r.rep_name AS agent_name,
  r.level_code AS level,
  CASE
    WHEN qs.quota_relief_pct IS NOT NULL AND qs.quota_relief_pct > 0 AND qa.quota_amount > 0
      THEN LEAST(
        130,
        ROUND(100.0 * qa.credited_amount / (qa.quota_amount * (1 - qs.quota_relief_pct / 100.0)), 2)
      )
    ELSE qa.attainment_pct
  END AS quota_attainment_pct,
  COALESCE(ffs.ffs_sales_pct, 0.00) AS ffs_sales_pct,
  pay.total_earnings,
  CASE
    WHEN (
      CASE
        WHEN qs.quota_relief_pct IS NOT NULL AND qs.quota_relief_pct > 0 AND qa.quota_amount > 0
          THEN LEAST(
            130,
            ROUND(100.0 * qa.credited_amount / (qa.quota_amount * (1 - qs.quota_relief_pct / 100.0)), 2)
          )
        ELSE qa.attainment_pct
      END
    ) >= 100 THEN 'TOP'
    WHEN (
      CASE
        WHEN qs.quota_relief_pct IS NOT NULL AND qs.quota_relief_pct > 0 AND qa.quota_amount > 0
          THEN LEAST(
            130,
            ROUND(100.0 * qa.credited_amount / (qa.quota_amount * (1 - qs.quota_relief_pct / 100.0)), 2)
          )
        ELSE qa.attainment_pct
      END
    ) < 70 THEN 'AT_RISK'
    ELSE 'ON_TRACK'
  END AS performance_band
FROM workspace.hgv_comp.dim_rep r
JOIN workspace.hgv_comp.fact_quota_attainment qa
  ON qa.rep_id = r.rep_id
JOIN workspace.hgv_comp.fact_payout pay
  ON pay.rep_id = r.rep_id
  AND pay.period_id = qa.period_id
LEFT JOIN rep_ffs ffs
  ON ffs.rep_id = r.rep_id
  AND ffs.period_id = qa.period_id
LEFT JOIN quota_shield qs
  ON qs.target_rep_id = r.rep_id
  AND qs.period_id = qa.period_id
WHERE r.team_id = :team_id
  AND qa.period_id = :period_id
  AND r.manager_rep_id IS NOT NULL
ORDER BY quota_attainment_pct DESC;
