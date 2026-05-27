-- Idempotent sales diversity seed — at-risk mix, FFS variation, new-hire ramp case
-- Period: 2026-Q2

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-VTESTER', 'V. Tester', 'L4', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-VTESTER');

INSERT INTO workspace.hgv_comp.fact_quota_attainment
SELECT 'REP-VTESTER', '2026-Q2', 'PLAN-2026-V1', 50000.00, 20000.00, 40.00, 2, 75.00, 30000.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = 'REP-VTESTER' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_payout
SELECT 'REP-VTESTER', '2026-Q2', 5000.00, 1800.00, 500.00, 7300.00, 7300.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = 'REP-VTESTER' AND period_id = '2026-Q2');

-- FFS product mix — varied profiles across the team
INSERT INTO workspace.hgv_comp.fact_rep_product_mix
SELECT 'REP-RSMITH', '2026-Q2', 'PROD-FFS', 28.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-RSMITH' AND period_id = '2026-Q2' AND product_line_id = 'PROD-FFS');

INSERT INTO workspace.hgv_comp.fact_rep_product_mix
SELECT 'REP-ECARTER', '2026-Q2', 'PROD-FFS', 9.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-ECARTER' AND period_id = '2026-Q2' AND product_line_id = 'PROD-FFS');

INSERT INTO workspace.hgv_comp.fact_rep_product_mix
SELECT 'REP-DLEE', '2026-Q2', 'PROD-FFS', 6.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-DLEE' AND period_id = '2026-Q2' AND product_line_id = 'PROD-FFS');

INSERT INTO workspace.hgv_comp.fact_rep_product_mix
SELECT 'REP-KNGUYEN', '2026-Q2', 'PROD-FFS', 31.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-KNGUYEN' AND period_id = '2026-Q2' AND product_line_id = 'PROD-FFS');

INSERT INTO workspace.hgv_comp.fact_rep_product_mix
SELECT 'REP-VTESTER', '2026-Q2', 'PROD-FFS', 4.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-VTESTER' AND period_id = '2026-Q2' AND product_line_id = 'PROD-FFS');

-- Prorated new-hire quota (D. Lee joined mid-period — 58.33% proration reflected in attainment gap)
UPDATE workspace.hgv_comp.fact_quota_attainment
SET next_tier_gap_amount = 26000.00, next_tier_threshold_pct = 75.00
WHERE rep_id = 'REP-DLEE' AND period_id = '2026-Q2';

-- Team snapshot reflects mixed performance bands
UPDATE workspace.hgv_comp.fact_team_snapshot
SET team_attainment_pct = 82.50, at_risk_count = 2, top_performer_count = 2, ffs_sales_pct = 14.00, ffs_target_pct = 20.00
WHERE team_id = 'TEAM-WEST' AND period_id = '2026-Q2';

-- Tour quality for V. Tester — low show / close rate (at-risk sales path)
INSERT INTO workspace.hgv_comp.fact_tour_quality
  (tour_id, rep_id, period_id, lead_source, abc_score, package_type,
   showed_flag, closed_flag, contract_status, rescission_flag,
   net_sales_volume, vpg, ebitda_estimate)
SELECT 'TOUR-Q1-051', 'REP-VTESTER', '2026-Q2', 'OPC', 'D', 'Discovery', FALSE, FALSE, 'NONE', FALSE, 0.00, 0.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'TOUR-Q1-051');

INSERT INTO workspace.hgv_comp.fact_tour_quality
SELECT 'TOUR-Q1-052', 'REP-VTESTER', '2026-Q2', 'Mail', 'D', 'Discovery', TRUE, FALSE, 'NONE', FALSE, 0.00, 0.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'TOUR-Q1-052');

INSERT INTO workspace.hgv_comp.fact_tour_quality
SELECT 'TOUR-Q1-053', 'REP-VTESTER', '2026-Q2', 'Internet', 'C', 'Preview', TRUE, TRUE, 'ACTIVE', FALSE, 1800.00, 900.00, 360.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'TOUR-Q1-053');

-- Additional open A-lead for Jason — intervention / coaching demo
INSERT INTO workspace.hgv_comp.fact_tour_quality
SELECT 'TOUR-Q1-054', 'REP-JASON', '2026-Q2', 'Referral', 'A', 'Flex', TRUE, FALSE, 'NONE', FALSE, 0.00, 0.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'TOUR-Q1-054');
