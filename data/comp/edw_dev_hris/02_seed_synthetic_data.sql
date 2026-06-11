DELETE FROM edw_dev_hris.hgv_comp.scenario_payout_series;
DELETE FROM edw_dev_hris.hgv_comp.scenario_result;
DELETE FROM edw_dev_hris.hgv_comp.scenario_run;
DELETE FROM edw_dev_hris.hgv_comp.fact_rep_product_mix;
DELETE FROM edw_dev_hris.hgv_comp.fact_team_snapshot;
DELETE FROM edw_dev_hris.hgv_comp.fact_deal_credit;
DELETE FROM edw_dev_hris.hgv_comp.fact_payout;
DELETE FROM edw_dev_hris.hgv_comp.fact_quota_attainment;
DELETE FROM edw_dev_hris.hgv_comp.dim_product_line;
DELETE FROM edw_dev_hris.hgv_comp.dim_plan_version;
DELETE FROM edw_dev_hris.hgv_comp.dim_period;
DELETE FROM edw_dev_hris.hgv_comp.dim_rep;
DELETE FROM edw_dev_hris.hgv_comp.dim_team;

INSERT INTO edw_dev_hris.hgv_comp.dim_team VALUES
  ('TEAM-WEST', 'West Coast Sales', 'West'),
  ('TEAM-EAST', 'East Coast Sales', 'East');

INSERT INTO edw_dev_hris.hgv_comp.dim_period VALUES
  ('2026-Q2', 'Q2 2026', DATE '2026-04-01', DATE '2026-06-30', TRUE),
  ('2025-Q4', 'Q4 2025', DATE '2025-10-01', DATE '2025-12-31', FALSE);

INSERT INTO edw_dev_hris.hgv_comp.dim_plan_version VALUES
  ('PLAN-2026-V1', '2025 Core Sales Plan', DATE '2026-04-01', NULL),
  ('PLAN-2024-V2', '2024 Core Sales Plan', DATE '2024-07-01', DATE '2025-12-31');

INSERT INTO edw_dev_hris.hgv_comp.dim_product_line VALUES
  ('PROD-FFS', 'Fee-for-Service (FFS)', TRUE),
  ('PROD-CLUB', 'Club Membership', FALSE),
  ('PROD-UPSELL', 'Premium Upsell Package', FALSE),
  ('PROD-GWK', 'Grand Waikikian 3PH', FALSE);

INSERT INTO edw_dev_hris.hgv_comp.dim_rep VALUES
  ('REP-JASON', 'Jason', 'L6', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE),
  ('REP-RSMITH', 'R. Smith', 'L8', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE),
  ('REP-ECARTER', 'E. Carter', 'L5', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE),
  ('REP-DLEE', 'D. Lee', 'L4', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE),
  ('REP-KNGUYEN', 'K. Nguyen', 'L7', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE),
  ('REP-MGR-01', 'M. Vance', 'L9', 'TEAM-WEST', NULL, 'West', TRUE);

INSERT INTO edw_dev_hris.hgv_comp.fact_payout VALUES
  ('REP-JASON', '2026-Q2', 5000.00, 10500.00, 3250.00, 18750.00, 18200.00),
  ('REP-RSMITH', '2026-Q2', 5200.00, 14200.00, 4100.00, 23500.00, 23000.00),
  ('REP-ECARTER', '2026-Q2', 4800.00, 8900.00, 1200.00, 14900.00, 14500.00),
  ('REP-DLEE', '2026-Q2', 4500.00, 6200.00, 0.00, 10700.00, 10700.00),
  ('REP-KNGUYEN', '2026-Q2', 5100.00, 11800.00, 2800.00, 19700.00, 19200.00);

INSERT INTO edw_dev_hris.hgv_comp.fact_quota_attainment VALUES
  ('REP-JASON', '2026-Q2', 'PLAN-2026-V1', 250000.00, 230000.00, 92.00, 18, 100.00, 20000.00),
  ('REP-RSMITH', '2026-Q2', 'PLAN-2026-V1', 300000.00, 315000.00, 105.00, 24, 110.00, 15000.00),
  ('REP-ECARTER', '2026-Q2', 'PLAN-2026-V1', 220000.00, 171600.00, 78.00, 14, 85.00, 15400.00),
  ('REP-DLEE', '2026-Q2', 'PLAN-2026-V1', 200000.00, 124000.00, 62.00, 9, 75.00, 26000.00),
  ('REP-KNGUYEN', '2026-Q2', 'PLAN-2026-V1', 260000.00, 249600.00, 96.00, 20, 100.00, 10400.00);

INSERT INTO edw_dev_hris.hgv_comp.fact_team_snapshot VALUES
  ('TEAM-WEST', '2026-Q2', 87.00, 3, 2, 15.00, 20.00);

INSERT INTO edw_dev_hris.hgv_comp.fact_rep_product_mix VALUES
  ('REP-JASON', '2026-Q2', 'PROD-FFS', 12.00),
  ('REP-JASON', '2026-Q2', 'PROD-CLUB', 38.00),
  ('REP-JASON', '2026-Q2', 'PROD-UPSELL', 28.00),
  ('REP-JASON', '2026-Q2', 'PROD-GWK', 22.00);

INSERT INTO edw_dev_hris.hgv_comp.fact_deal_credit VALUES
  ('DEAL-1001', 'REP-JASON', '2026-Q2', 'PROD-GWK', 'GWK-3PH', 'Grand Waikikian 3PH', 85000.00, 'CREDITED', DATE '2026-04-12'),
  ('DEAL-1002', 'REP-JASON', '2026-Q2', 'PROD-UPSELL', 'ORL-DLX', 'Orlando Deluxe Package', 72000.00, 'CREDITED', DATE '2026-05-08'),
  ('DEAL-1003', 'REP-JASON', '2026-Q2', 'PROD-CLUB', 'WC-CLUB', 'West Coast Club Sale', 73000.00, 'CREDITED', DATE '2026-06-18'),
  ('DEAL-1004', 'REP-JASON', '2026-Q2', 'PROD-FFS', 'FFS-002', 'FFS Contract Bundle', 45000.00, 'PENDING', DATE '2026-06-22'),
  ('DEAL-1005', 'REP-DLEE', '2026-Q2', 'PROD-FFS', 'FFS-001', 'FFS Contract Bundle', 31000.00, 'CREDITED', DATE '2026-04-22');

INSERT INTO edw_dev_hris.hgv_comp.scenario_run VALUES
  ('SCN-BASELINE', 'Q1 Baseline', '2026-Q2', 0.00, 6.00, 0.00, 0.00, 0.00, 'comp_ops'),
  ('SCN-SIM-01', 'Q2 Incentive Plan - Simulated', '2026-Q2', 5.00, 6.50, -5.00, 20.00, 10.00, 'comp_ops'),
  ('SCN-PLAN-A', 'Scenario A - Plan Designer', '2026-Q2', 15.00, 6.50, -5.00, 20.00, 15.00, 'comp_design'),
  ('SCN-SPIFF-Q1', 'Ocean Breeze Q2 SPIFF', '2026-Q2', 0.00, 6.00, 0.00, 0.00, 0.00, 'comp_ops'),
  ('SCN-LOA-ADJ', 'LOA Compensation Shield', '2026-Q2', 0.00, 6.00, 0.00, 0.00, 0.00, 'comp_ops'),
  ('SCN-HIGH-RAMP', 'New Hire Action Line Ramp', '2026-Q2', -10.00, 6.00, 5.00, 15.00, -5.00, 'comp_design'),
  ('SCN-NOI-PROT', 'Margin Protection Plan', '2026-Q2', 5.00, 6.00, 10.00, 25.00, 0.00, 'comp_design');

INSERT INTO edw_dev_hris.hgv_comp.scenario_result VALUES
  ('SCN-BASELINE', 14200000.00, 0.00, 14200000.00, 82.00),
  ('SCN-SIM-01', 14800000.00, 600000.00, 14800000.00, 87.00),
  ('SCN-PLAN-A', 15200000.00, 1000000.00, 15000000.00, 90.00),
  ('SCN-SPIFF-Q1', 14215000.00, 15000.00, 14215000.00, 84.50),
  ('SCN-LOA-ADJ', 14202000.00, 2000.00, 14202000.00, 82.20),
  ('SCN-HIGH-RAMP', 13800000.00, -400000.00, 13800000.00, 89.00),
  ('SCN-NOI-PROT', 15600000.00, 1400000.00, 15300000.00, 93.50);

INSERT INTO edw_dev_hris.hgv_comp.scenario_payout_series VALUES
  ('SCN-SIM-01', 'Current', 1, 'Jan', 1180000.00),
  ('SCN-SIM-01', 'Current', 2, 'Feb', 1210000.00),
  ('SCN-SIM-01', 'Current', 3, 'Mar', 1190000.00),
  ('SCN-SIM-01', 'Simulated', 1, 'Jan', 1230000.00),
  ('SCN-SIM-01', 'Simulated', 2, 'Feb', 1265000.00),
  ('SCN-SIM-01', 'Simulated', 3, 'Mar', 1245000.00),
  ('SCN-SIM-01', 'Budget', 1, 'Jan', 1200000.00),
  ('SCN-SIM-01', 'Budget', 2, 'Feb', 1200000.00),
  ('SCN-SIM-01', 'Budget', 3, 'Mar', 1200000.00);
