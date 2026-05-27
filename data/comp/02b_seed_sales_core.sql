-- Idempotent sales core facts — restores Jason demo path without wiping marketing tables.
-- Safe to re-run when fact_payout / fact_quota_attainment are empty.

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-JASON', 'Jason', 'L6', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-JASON');

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-RSMITH', 'R. Smith', 'L8', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-RSMITH');

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-ECARTER', 'E. Carter', 'L5', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-ECARTER');

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-DLEE', 'D. Lee', 'L4', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-DLEE');

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-KNGUYEN', 'K. Nguyen', 'L7', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-KNGUYEN');

INSERT INTO workspace.hgv_comp.dim_rep
SELECT 'REP-MGR-01', 'M. Vance', 'L9', 'TEAM-WEST', NULL, 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'REP-MGR-01');

INSERT INTO workspace.hgv_comp.fact_payout
SELECT 'REP-JASON', '2026-Q2', 5000.00, 10500.00, 3250.00, 18750.00, 18200.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = 'REP-JASON' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_payout
SELECT 'REP-RSMITH', '2026-Q2', 5200.00, 14200.00, 4100.00, 23500.00, 23000.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = 'REP-RSMITH' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_payout
SELECT 'REP-ECARTER', '2026-Q2', 4800.00, 8900.00, 1200.00, 14900.00, 14500.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = 'REP-ECARTER' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_payout
SELECT 'REP-DLEE', '2026-Q2', 4500.00, 6200.00, 0.00, 10700.00, 10700.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = 'REP-DLEE' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_payout
SELECT 'REP-KNGUYEN', '2026-Q2', 5100.00, 11800.00, 2800.00, 19700.00, 19200.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = 'REP-KNGUYEN' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_quota_attainment
SELECT 'REP-JASON', '2026-Q2', 'PLAN-2026-V1', 250000.00, 230000.00, 92.00, 18, 100.00, 20000.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = 'REP-JASON' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_quota_attainment
SELECT 'REP-RSMITH', '2026-Q2', 'PLAN-2026-V1', 300000.00, 315000.00, 105.00, 24, 110.00, 15000.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = 'REP-RSMITH' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_quota_attainment
SELECT 'REP-ECARTER', '2026-Q2', 'PLAN-2026-V1', 220000.00, 171600.00, 78.00, 14, 85.00, 15400.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = 'REP-ECARTER' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_quota_attainment
SELECT 'REP-DLEE', '2026-Q2', 'PLAN-2026-V1', 200000.00, 124000.00, 62.00, 9, 75.00, 26000.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = 'REP-DLEE' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_quota_attainment
SELECT 'REP-KNGUYEN', '2026-Q2', 'PLAN-2026-V1', 260000.00, 249600.00, 96.00, 20, 100.00, 10400.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = 'REP-KNGUYEN' AND period_id = '2026-Q2');

INSERT INTO workspace.hgv_comp.fact_team_snapshot
SELECT 'TEAM-WEST', '2026-Q2', 87.00, 3, 2, 15.00, 20.00
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_team_snapshot WHERE team_id = 'TEAM-WEST' AND period_id = '2026-Q2');

UPDATE workspace.hgv_comp.fact_marketing_rep_period
SET next_tier_label = 'Tier 3 - $100 qualified tour rate'
WHERE period_id = '2026-Q2' AND next_tier_label LIKE 'Tier 3%';
