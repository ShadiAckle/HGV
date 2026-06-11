-- Seed: guest registry spine for marketing tour enrichment
-- File: 09a_seed_guest_registry.sql
-- Scoped to PERSONA-MKT-REP demo tours T-55122, T-55204, T-55180

-- Households
INSERT INTO workspace.hgv_comp.dim_household VALUES
  ('HH-001', '2 adults', 'Qualified Tier 2 ($75K–$99K)', 'Las Vegas-Henderson, NV', 'Internal CRM', DATE '2026-05-01'),
  ('HH-002', '2 adults + 1 child', 'Below qualification threshold', 'Phoenix-Mesa, AZ', 'Internal CRM', DATE '2026-05-01'),
  ('HH-003', '2 adults', 'Qualified Tier 3 ($100K–$149K)', 'Metropolis, KS', 'Internal CRM + licensed append', DATE '2026-05-01');

-- Locations
INSERT INTO workspace.hgv_comp.dim_location VALUES
  ('LOC-LV-STRIP', 'Hilton Grand Vacations Club on the Las Vegas Strip', 'property', 'Las Vegas', 'HGV', NULL),
  ('LOC-LV-ELARA', 'Elara by Hilton Grand Vacations', 'property', 'Las Vegas', 'HGV', NULL),
  ('LOC-SC-STRIP-SOUTH', 'Las Vegas Strip South Sales Center', 'sales_center', 'Las Vegas', 'HGV', 'Strip South'),
  ('LOC-ORL-W57', 'Orlando Collection — West 57th', 'property', 'Orlando', 'HGV', NULL),
  ('LOC-LV-DESK-SOUTH', 'Las Vegas Strip South Desk', 'desk', 'Las Vegas', 'HGV', 'Strip South');

-- Guests
INSERT INTO workspace.hgv_comp.dim_guest VALUES
  ('GUEST-001', 'Bruce Wayne', 'bruce.wayne@example.com', 'tok_***4521', 'New Buyer', FALSE, 'HH-001', 'NB-QUAL-2', DATE '2026-05-08'),
  ('GUEST-002', 'Peter Parker', 'peter.parker@example.com', 'tok_***8834', 'Non-Owner', FALSE, 'HH-002', 'COURTESY-NQ', DATE '2026-05-13'),
  ('GUEST-003', 'Clark Kent', 'clark.kent@example.com', 'tok_***2210', 'Owner', TRUE, 'HH-003', 'OWNER-ACTIVE', DATE '2026-05-10');

-- Tour-guest bridge
INSERT INTO workspace.hgv_comp.bridge_tour_guest VALUES
  ('T-55122', 'GUEST-001', TRUE),
  ('T-55204', 'GUEST-002', TRUE),
  ('T-55180', 'GUEST-003', TRUE);

-- Ownership
INSERT INTO workspace.hgv_comp.fact_guest_ownership VALUES
  ('OWN-003-01', 'GUEST-003', 'Orlando Collection — West 57th', 'LOC-ORL-W57', 'ACTIVE', 12400, 'HGV');

-- Rental / exchange stays
INSERT INTO workspace.hgv_comp.fact_guest_rental_stay VALUES
  ('STAY-001-CUR', 'GUEST-001', 'LOC-LV-STRIP', 'rental_package', DATE '2026-05-08', DATE '2026-05-12', 4),
  ('STAY-002-CUR', 'GUEST-002', 'LOC-LV-ELARA', 'rental_package', DATE '2026-05-12', DATE '2026-05-15', 3),
  ('STAY-003-CUR', 'GUEST-003', 'LOC-LV-DESK-SOUTH', 'owner_stay', DATE '2026-05-07', DATE '2026-05-12', 5),
  ('STAY-002-PRIOR', 'GUEST-002', 'LOC-ORL-W57', 'exchange', DATE '2025-11-20', DATE '2025-11-27', 7),
  ('STAY-003-PRIOR', 'GUEST-003', 'LOC-LV-STRIP', 'owner_stay', DATE '2025-08-14', DATE '2025-08-18', 4);

-- Prior tour history
INSERT INTO workspace.hgv_comp.fact_guest_tour_history VALUES
  ('HIST-001-A', 'GUEST-001', 'T-54801', 'MKT-REP-004', DATE '2025-12-02', 'NO_SHOW', 'Package buyer no-show — rebooked as T-55122'),
  ('HIST-002-A', 'GUEST-002', 'T-54910', 'MKT-REP-002', DATE '2026-02-18', 'SHOWN', 'Courtesy tour — income below threshold'),
  ('HIST-003-A', 'GUEST-003', 'T-55044', 'MKT-REP-001', DATE '2026-03-22', 'SHOWN', 'Owner upgrade tour — no close'),
  ('HIST-003-B', 'GUEST-003', 'T-55180', 'PERSONA-MKT-REP', DATE '2026-05-12', 'NO_SHOW', 'Current period no-show — FPS opportunity open');

-- Marketing tour quality (aligned tour IDs for marketing ledger)
INSERT INTO workspace.hgv_comp.fact_tour_quality
  (tour_id, rep_id, period_id, lead_source, abc_score, package_type, showed_flag, closed_flag, contract_status, rescission_flag, net_sales_volume, vpg, ebitda_estimate)
SELECT 'T-55122', 'PERSONA-MKT-REP', '2026-Q2', 'OPC', 'A', 'Flex', TRUE, FALSE, 'NONE', FALSE, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'T-55122');

INSERT INTO workspace.hgv_comp.fact_tour_quality
  (tour_id, rep_id, period_id, lead_source, abc_score, package_type, showed_flag, closed_flag, contract_status, rescission_flag, net_sales_volume, vpg, ebitda_estimate)
SELECT 'T-55204', 'PERSONA-MKT-REP', '2026-Q2', 'OPC', 'C', 'Discovery', TRUE, FALSE, 'NONE', FALSE, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'T-55204');

INSERT INTO workspace.hgv_comp.fact_tour_quality
  (tour_id, rep_id, period_id, lead_source, abc_score, package_type, showed_flag, closed_flag, contract_status, rescission_flag, net_sales_volume, vpg, ebitda_estimate)
SELECT 'T-55180', 'PERSONA-MKT-REP', '2026-Q2', 'Owner', 'B', 'Preview', FALSE, FALSE, 'NONE', FALSE, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_tour_quality WHERE tour_id = 'T-55180');

-- Link marketing tour payout rows to guest spine
UPDATE workspace.hgv_comp.fact_marketing_tour_payout SET
  guest_id = 'GUEST-001',
  household_id = 'HH-001',
  planned_tour_location_id = 'LOC-SC-STRIP-SOUTH',
  current_stay_location_id = 'LOC-LV-STRIP',
  lead_source = 'OPC',
  abc_score = 'A',
  package_type = 'Flex',
  xref_tour_id = 'T-55122',
  tour_booked_date = DATE '2026-05-08'
WHERE tour_id = 'T-55122';

UPDATE workspace.hgv_comp.fact_marketing_tour_payout SET
  guest_id = 'GUEST-002',
  household_id = 'HH-002',
  planned_tour_location_id = 'LOC-SC-STRIP-SOUTH',
  current_stay_location_id = 'LOC-LV-ELARA',
  lead_source = 'OPC',
  abc_score = 'C',
  package_type = 'Discovery',
  xref_tour_id = 'T-55204',
  tour_booked_date = DATE '2026-05-13'
WHERE tour_id = 'T-55204';

UPDATE workspace.hgv_comp.fact_marketing_tour_payout SET
  guest_id = 'GUEST-003',
  household_id = 'HH-003',
  planned_tour_location_id = 'LOC-SC-STRIP-SOUTH',
  current_stay_location_id = 'LOC-LV-DESK-SOUTH',
  lead_source = 'Owner',
  abc_score = 'B',
  package_type = 'Preview',
  xref_tour_id = 'T-55180',
  tour_booked_date = DATE '2026-05-10'
WHERE tour_id = 'T-55180';
