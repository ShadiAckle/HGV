-- Seed: industry benchmarks, marketing rep comp, rep market positions
-- File: 06a_seed_marketing_benchmark.sql
-- Period: 2026-Q2
-- Scoped deletes — do not wipe MKT-REP-* roster rows seeded by marketingTeamSeed.

DELETE FROM workspace.hgv_comp.industry_comp_benchmark WHERE effective_period = '2026-Q2';
DELETE FROM workspace.hgv_comp.fact_marketing_rep_period WHERE period_id = '2026-Q2' AND rep_id = 'PERSONA-MKT-REP';
DELETE FROM workspace.hgv_comp.fact_marketing_rep_metric WHERE period_id = '2026-Q2' AND rep_id = 'PERSONA-MKT-REP';
DELETE FROM workspace.hgv_comp.fact_marketing_tour_payout WHERE period_id = '2026-Q2' AND rep_id = 'PERSONA-MKT-REP';
DELETE FROM workspace.hgv_comp.fact_marketing_chargeback WHERE period_id = '2026-Q2' AND rep_id = 'PERSONA-MKT-REP';
DELETE FROM workspace.hgv_comp.fact_marketing_arrival WHERE period_id = '2026-Q2' AND rep_id = 'PERSONA-MKT-REP';
DELETE FROM workspace.hgv_comp.fact_rep_market_position WHERE period_id = '2026-Q2';

INSERT INTO workspace.hgv_comp.dim_rep
  (rep_id, rep_name, level_code, team_id, manager_rep_id, region, is_active)
SELECT 'PERSONA-MKT-REP', 'T. Brooks', 'C2a', 'TEAM-MKT-LAS', 'PERSONA-MKT-MGR', 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'PERSONA-MKT-REP');

INSERT INTO workspace.hgv_comp.dim_rep
  (rep_id, rep_name, level_code, team_id, manager_rep_id, region, is_active)
SELECT 'PERSONA-MKT-MGR', 'R. Castillo', 'C2b', 'TEAM-MKT-LAS', NULL, 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'PERSONA-MKT-MGR');

INSERT INTO workspace.hgv_comp.dim_rep
  (rep_id, rep_name, level_code, team_id, manager_rep_id, region, is_active)
SELECT 'PERSONA-MKT-DIR', 'D. Whitfield', 'C2c', 'TEAM-MKT-REG', NULL, 'West', TRUE
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'PERSONA-MKT-DIR');

INSERT INTO workspace.hgv_comp.industry_comp_benchmark VALUES
  ('BMK-S16-A1-DIR', 'marketing_director', 'Directors / Sr. Directors', 'TCC_GAP_PCT', 17.00, 17.00, '%', 'Slide 16 Area 1', '2026-Q2', 'Directors 10-17% below market target TCC'),
  ('BMK-S16-A1-VP', 'sales_vp', 'Sales VPs', 'TCC_GAP_PCT', 43.00, 43.00, '%', 'Slide 16 Area 1', '2026-Q2', 'Sales VPs 14-43% below market target TCC'),
  ('BMK-PM-MKT-REP-B', 'marketing_rep', 'Marketing Reps', 'PAY_MIX_BASE', 60.00, 40.00, '%', 'Slide 16 Area 2', '2026-Q2', 'Market standard base/variable'),
  ('BMK-PM-MKT-REP-V', 'marketing_rep', 'Marketing Reps', 'PAY_MIX_VAR', 40.00, 60.00, '%', 'Slide 16 Area 2', '2026-Q2', 'Market standard base/variable'),
  ('BMK-PM-SE-B', 'sales_executive', 'Sales Executives', 'PAY_MIX_BASE', 35.00, 20.00, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 30/70 - 40/60'),
  ('BMK-PM-MGR-B', 'marketing_manager', 'Marketing Managers', 'PAY_MIX_BASE', 62.50, 40.00, '%', 'Slide 16 Area 2', '2026-Q2', 'Market 40/60 - 85/15'),
  ('BMK-COMM-OPT', 'all', 'All Sales Roles', 'COMMISSION_RATE', 6.00, 6.00, '%', 'Slide 16 Area 3', '2026-Q2', 'Optimal commission band 4-6%'),
  ('BMK-NOI-W', 'marketing_director', 'Director+', 'NOI_WEIGHT', 65.00, 35.00, '%', 'Slide 16 Area 4', '2026-Q2', 'Market-aligned NOI weight 50-80%');

INSERT INTO workspace.hgv_comp.fact_marketing_rep_period VALUES (
  'PERSONA-MKT-REP', '2026-Q2', 'T. Brooks', 'PLAN-MKT-REP-2026', 'Las Vegas Strip South Desk', 'LV-HGV-AL',
  245.00, 245.00, 2, 2, 66.70, 24.00, 20.00, TRUE,
  'Tier 3 - $100 qualified tour rate', 3,
  75.00, 20.00, 150.00, -50.00, 195.00,
  40.00, 60.00, -14.00
);

INSERT INTO workspace.hgv_comp.fact_marketing_rep_metric VALUES
  ('PERSONA-MKT-REP', '2026-Q2', 'Qualified Tours (Owner, New Buyer)', 45.00, 95.00, 67.00, '3 qualified Owner/NB tours', 225.00),
  ('PERSONA-MKT-REP', '2026-Q2', 'Individual FPS Packages', 35.00, 150.00, 24.00, 'Penetration 24% vs 20% target', 840.00),
  ('PERSONA-MKT-REP', '2026-Q2', 'Individual Sales Transactions', 20.00, 0.00, 0.00, '1 closed transaction', 320.00);

INSERT INTO workspace.hgv_comp.fact_marketing_tour_payout VALUES
  ('T-55122', 'PERSONA-MKT-REP', '2026-Q2', 'Bruce Wayne', 'New Buyer', DATE '2026-05-10', 'SHOWN', 'Q', 75.00, TRUE, 420.00, 'Qualified NB tour — FPS package not yet sold.'),
  ('T-55204', 'PERSONA-MKT-REP', '2026-Q2', 'Peter Parker', 'Non-Owner', DATE '2026-05-15', 'SHOWN', 'NQ', 20.00, FALSE, 0.00, 'Courtesy rate — household income below threshold.'),
  ('T-55180', 'PERSONA-MKT-REP', '2026-Q2', 'Clark Kent', 'Owner', DATE '2026-05-12', 'NO_SHOW', '—', 0.00, TRUE, 380.00, 'Owner no-show — rebook to recover qualified + FPS opportunity.');

INSERT INTO workspace.hgv_comp.fact_marketing_chargeback VALUES
  ('CB-44102', 'PERSONA-MKT-REP', '2026-Q2', 'Lex Luthor', 'T-55219', '2× Vegas Show Tickets', 50.00, 'Premium gift chargeback — guest credit validation failure.');

INSERT INTO workspace.hgv_comp.fact_marketing_arrival VALUES
  ('ARR-90112', 'PERSONA-MKT-REP', '2026-Q2', 'Diana Prince', 'New Buyer', '2026-05-24 09:30', 'Strip South', 100.00, 480.00, 580.00),
  ('ARR-90415', 'PERSONA-MKT-REP', '2026-Q2', 'Steve Rogers', 'New Buyer', '2026-05-24 11:30', 'Strip South', 100.00, 480.00, 580.00),
  ('ARR-90420', 'PERSONA-MKT-REP', '2026-Q2', 'Natasha Romanoff', 'New Buyer', '2026-05-25 13:00', 'Elara', 100.00, 410.00, 510.00);

INSERT INTO workspace.hgv_comp.fact_rep_market_position VALUES
  ('MKT-REP-001', '2026-Q2', 'M. Chen', 'marketing_rep', -12.00, 38.00, 62.00, 112.00),
  ('MKT-REP-002', '2026-Q2', 'J. Rivera', 'marketing_rep', 5.00, 55.00, 45.00, 94.00),
  ('MKT-REP-003', '2026-Q2', 'A. Patel', 'marketing_rep', -18.00, 35.00, 65.00, 58.00),
  ('MKT-REP-004', '2026-Q2', 'K. Nguyen', 'marketing_rep', -8.00, 42.00, 58.00, 71.00),
  ('MKT-REP-005', '2026-Q2', 'S. Okonkwo', 'marketing_rep', 3.00, 58.00, 42.00, 103.00),
  ('MKT-REP-006', '2026-Q2', 'L. Torres', 'marketing_rep', -22.00, 32.00, 68.00, 48.00);
