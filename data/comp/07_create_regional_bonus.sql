-- Regional bonus levels by area (Jan 2025 PDF) — seeded from shared/bonusLevelsJan2025.ts
CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_regional_bonus_area (
  area_id STRING NOT NULL,
  period_id STRING NOT NULL,
  site_line STRING,
  smt_volume DECIMAL(16, 2),
  budget_volume DECIMAL(16, 2),
  volume_var_pct DECIMAL(6, 2)
) USING DELTA;

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_regional_bonus_tier (
  area_id STRING NOT NULL,
  period_id STRING NOT NULL,
  level INT,
  salespeople_count INT,
  avg_tier_volume DECIMAL(16, 2),
  total_tier_volume DECIMAL(16, 2),
  total_cmi DECIMAL(16, 2),
  cost_pct DECIMAL(6, 2)
) USING DELTA;
