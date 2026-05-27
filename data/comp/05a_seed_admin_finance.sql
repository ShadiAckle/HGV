-- =============================================================================
-- HGV Comp — Admin + Finance Seed Data
-- File: 05a_seed_admin_finance.sql
-- Schema: workspace.hgv_comp
-- Purpose: Synthetic seed data for fact_plan_eligibility, fact_comp_admin_log,
--          fact_chargeback, and fact_tour_quality
-- Period: 2026-Q2
-- =============================================================================

-- =============================================================================
-- SECTION 1: fact_plan_eligibility
-- One row per active rep for 2026-Q2
-- =============================================================================

INSERT INTO workspace.hgv_comp.fact_plan_eligibility
  (rep_id, period_id, plan_version_id, job_code, location_code, brand,
   effective_start, effective_end, proration_pct, eligibility_flag, exclusion_reason)
VALUES
  -- REP-JASON: Full-Time Sales L6, Las Vegas, HGV, 100% proration
  ('REP-JASON',   '2026-Q2', 'PLAN-FT-2026',  'FT-SALES-L6', 'LAS', 'HGV',
   DATE '2026-04-01', NULL, 100.00, TRUE, NULL),

  -- REP-RSMITH: Full-Time Sales L6, Orlando, HGV, 100% proration
  ('REP-RSMITH',  '2026-Q2', 'PLAN-FT-2026',  'FT-SALES-L6', 'ORL', 'HGV',
   DATE '2026-04-01', NULL, 100.00, TRUE, NULL),

  -- REP-ECARTER: Full-Time Sales L5, Orlando, Diamond, 100% proration
  ('REP-ECARTER', '2026-Q2', 'PLAN-FT-2026',  'FT-SALES-L5', 'ORL', 'Diamond',
   DATE '2026-04-01', NULL, 100.00, TRUE, NULL),

  -- REP-DLEE: Full-Time Sales L6, San Diego, HGV, 58.33% proration (joined 2025-01-15)
  -- 75 calendar days remaining in Q1 out of 90 total → 75/90 ≈ 83.33%; but new-hire ramp
  -- contract basis: paid days Jan 15 – Mar 31 = 76 days / 90 = ~58.33% (per payroll rules)
  ('REP-DLEE',    '2026-Q2', 'PLAN-FT-2026',  'FT-SALES-L6', 'SDG', 'HGV',
   DATE '2025-01-15', NULL, 58.33, TRUE, NULL),

  -- REP-KNGUYEN: Full-Time Sales L7, Las Vegas, HGV, 100% proration
  ('REP-KNGUYEN', '2026-Q2', 'PLAN-FT-2026',  'FT-SALES-L7', 'LAS', 'HGV',
   DATE '2026-04-01', NULL, 100.00, TRUE, NULL),

  -- REP-MGR-01: Full-Time Manager L9, Las Vegas, HGV, 100% proration (manager plan)
  ('REP-MGR-01',  '2026-Q2', 'PLAN-MGR-2025', 'FT-MGR-L9',   'LAS', 'HGV',
   DATE '2026-04-01', NULL, 100.00, TRUE, NULL);

-- =============================================================================
-- SECTION 2: fact_comp_admin_log
-- ~15 admin events spanning Jan–Mar 2025
-- =============================================================================

INSERT INTO workspace.hgv_comp.fact_comp_admin_log
  (event_id, rep_id, period_id, event_type, amount, reason, approved_by, created_at)
VALUES
  -- Event 01: Deal correction adjustment for REP-JASON
  ('ADMEVT-0001', 'REP-JASON',   '2026-Q2', 'ADJUSTMENT',
   1250.00,
   'Deal correction: unit price recalculated on DEAL-003 after contract amendment',
   'VP Compensation',
   TIMESTAMP '2025-01-22 09:14:00'),

  -- Event 02: LOA start for REP-ECARTER
  ('ADMEVT-0002', 'REP-ECARTER', '2026-Q2', 'LOA_START',
   NULL,
   'Medical leave of absence effective 2025-03-01; quota relief applied per LOA policy',
   NULL,
   TIMESTAMP '2025-03-01 08:00:00'),

  -- Event 03: LOA end — REP-ECARTER returns
  ('ADMEVT-0003', 'REP-ECARTER', '2026-Q2', 'LOA_END',
   NULL,
   'Return from medical leave of absence; active status restored 2025-03-15',
   NULL,
   TIMESTAMP '2025-03-15 08:00:00'),

  -- Event 04: Rescission adjustment for REP-RSMITH
  ('ADMEVT-0004', 'REP-RSMITH',  '2026-Q2', 'RESCISSION',
   -875.00,
   'Commission clawback for DEAL-007 rescission within 10-day cancellation window',
   'VP Compensation',
   TIMESTAMP '2025-01-29 11:45:00'),

  -- Event 05: SPIFF for REP-JASON (FFS product push)
  ('ADMEVT-0005', 'REP-JASON',   '2026-Q2', 'SPIFF',
   500.00,
   'Q1 FFS (Vacation Flex) product push SPIFF — exceeded unit target for Jan',
   'Regional Dir',
   TIMESTAMP '2025-02-05 14:30:00'),

  -- Event 06: SPIFF for REP-KNGUYEN (Discovery tour target)
  ('ADMEVT-0006', 'REP-KNGUYEN', '2026-Q2', 'SPIFF',
   750.00,
   'Exceeded Discovery package tour target by 15 tours in Q1; SPIFF awarded per contest rules',
   'Regional Dir',
   TIMESTAMP '2025-03-28 16:00:00'),

  -- Event 07: Chargeback for REP-DLEE (rescinded deal)
  ('ADMEVT-0007', 'REP-DLEE',    '2026-Q2', 'CHARGEBACK',
   -1100.00,
   'Chargeback applied for DEAL-009 rescission; rep paid advance commission in Jan pay cycle',
   'VP Compensation',
   TIMESTAMP '2025-02-12 10:20:00'),

  -- Event 08: Manual payment for REP-ECARTER (LOA offset)
  ('ADMEVT-0008', 'REP-ECARTER', '2026-Q2', 'MANUAL_PAY',
   2000.00,
   'Guaranteed draw payment during LOA period per company LOA compensation policy',
   'VP Compensation',
   TIMESTAMP '2025-03-07 09:00:00'),

  -- Event 09: Team transfer for REP-RSMITH
  ('ADMEVT-0009', 'REP-RSMITH',  '2026-Q2', 'TRANSFER',
   NULL,
   'Rep transferred from Las Vegas team to Orlando team effective 2025-01-10; quota reallocated',
   NULL,
   TIMESTAMP '2025-01-10 08:30:00'),

  -- Event 10: Retroactive commission correction for REP-ECARTER
  ('ADMEVT-0010', 'REP-ECARTER', '2026-Q2', 'ADJUSTMENT',
   650.00,
   'Retroactive commission correction for DEAL-005; upgrade product classification corrected from L2 to L3',
   'VP Compensation',
   TIMESTAMP '2025-02-18 13:15:00'),

  -- Event 11: Data quality fix for REP-DLEE (missing payee_id on 3 tours)
  ('ADMEVT-0011', 'REP-DLEE',    '2026-Q2', 'DATA_QUALITY_FIX',
   NULL,
   '3 tour records (TOUR-Q1-036, TOUR-Q1-037, TOUR-Q1-038) had missing payee_id; corrected in source system',
   NULL,
   TIMESTAMP '2025-02-03 15:45:00'),

  -- Event 12: SPIFF approval for Q1 Ocean Breeze Contest
  ('ADMEVT-0012', 'REP-MGR-01',  '2026-Q2', 'SPIFF_APPROVAL',
   15000.00,
   'Q1 Ocean Breeze SPIFF contest approved: $15,000 total budget, all LAS reps eligible for Discovery tour volume',
   'EVP Ops',
   TIMESTAMP '2025-01-06 10:00:00'),

  -- Event 13: Chargeback for REP-RSMITH (cancelled contract)
  ('ADMEVT-0013', 'REP-RSMITH',  '2026-Q2', 'CHARGEBACK',
   -2200.00,
   'Chargeback for DEAL-002 cancellation post-rescission window; financed contract defaulted',
   'VP Compensation',
   TIMESTAMP '2025-03-14 11:00:00'),

  -- Event 14: Duplicate payment reversal for REP-KNGUYEN
  ('ADMEVT-0014', 'REP-KNGUYEN', '2026-Q2', 'ADJUSTMENT',
   -400.00,
   'Reversal of duplicate commission payment processed in Feb 28 pay cycle for DEAL-006',
   'VP Compensation',
   TIMESTAMP '2025-03-03 09:30:00'),

  -- Event 15: VIP referral bonus manual payment for REP-JASON
  ('ADMEVT-0015', 'REP-JASON',   '2026-Q2', 'MANUAL_PAY',
   3000.00,
   'VIP owner referral bonus: referred client (OWNER-VIP-4421) purchased Discovery package; bonus per referral program',
   'Regional Dir',
   TIMESTAMP '2025-03-20 14:00:00');

-- =============================================================================
-- SECTION 3: fact_chargeback
-- 8 records: 3 OPEN, 3 CLOSED, 2 PENDING
-- =============================================================================

INSERT INTO workspace.hgv_comp.fact_chargeback
  (chargeback_id, deal_id, rep_id, period_id,
   original_commission, chargeback_amount, reserve_held, reserve_released,
   reason, status)
VALUES
  -- CB-001: REP-RSMITH | DEAL-007 | RESCISSION | CLOSED
  -- Original commission $1,400; 100% chargeback; reserve was $840 (10% of $8,400 deal); released
  ('CB-001', 'DEAL-007', 'REP-RSMITH',  '2026-Q2',
   1400.00,  1400.00,  840.00,   840.00,  'RESCISSION', 'CLOSED'),

  -- CB-002: REP-DLEE | DEAL-009 | RESCISSION | OPEN
  -- Original commission $1,100; 100% chargeback; reserve $660 held; none released yet
  ('CB-002', 'DEAL-009', 'REP-DLEE',    '2026-Q2',
   1100.00,  1100.00,  660.00,     0.00,  'RESCISSION', 'OPEN'),

  -- CB-003: REP-RSMITH | DEAL-002 | CANCEL | CLOSED
  -- Original commission $2,200; 100% chargeback; reserve $1,320 held and released
  ('CB-003', 'DEAL-002', 'REP-RSMITH',  '2026-Q2',
   2200.00,  2200.00, 1320.00,  1320.00,  'CANCEL',     'CLOSED'),

  -- CB-004: REP-ECARTER | DEAL-005 | DATA_ERROR | CLOSED
  -- Original commission $875; 50% chargeback (partial correction); reserve $262.50 released
  ('CB-004', 'DEAL-005', 'REP-ECARTER', '2026-Q2',
    875.00,   437.50,  262.50,   262.50,  'DATA_ERROR', 'CLOSED'),

  -- CB-005: REP-JASON | DEAL-003 | RESCISSION | PENDING
  -- Original commission $1,750; 100% chargeback pending review; reserve $1,050 held
  ('CB-005', 'DEAL-003', 'REP-JASON',   '2026-Q2',
   1750.00,  1750.00, 1050.00,     0.00,  'RESCISSION', 'PENDING'),

  -- CB-006: REP-KNGUYEN | DEAL-006 | CANCEL | OPEN
  -- Original commission $500; 100% chargeback; reserve $300 held
  ('CB-006', 'DEAL-006', 'REP-KNGUYEN', '2026-Q2',
    500.00,   500.00,  300.00,     0.00,  'CANCEL',     'OPEN'),

  -- CB-007: REP-DLEE | DEAL-010 | RESCISSION | PENDING
  -- Original commission $2,800; 75% chargeback (reserve partial release pending audit)
  ('CB-007', 'DEAL-010', 'REP-DLEE',    '2026-Q2',
   2800.00,  2100.00, 1120.00,     0.00,  'RESCISSION', 'PENDING'),

  -- CB-008: REP-ECARTER | DEAL-008 | DATA_ERROR | OPEN
  -- Original commission $650; 100% chargeback; reserve $390 held; pending comp team review
  ('CB-008', 'DEAL-008', 'REP-ECARTER', '2026-Q2',
    650.00,   650.00,  390.00,     0.00,  'DATA_ERROR', 'OPEN');

-- =============================================================================
-- SECTION 4: fact_tour_quality
-- ~50 tour records spread across 5 reps for 2026-Q2
--
-- Conventions:
--   closed_flag = FALSE  → net_sales_volume = 0, vpg = 0, ebitda_estimate = 0
--   rescission_flag = TRUE → contract_status = 'RESCINDED'
--   VPG ranges by ABC: A=$1400-1800, B=$900-1300, C=$500-850, D=$150-450
--   Net sales volume ≈ VPG × 2 (2 guests)
--   EBITDA ≈ 18-22% of net_sales_volume
--   Close rates: A~40%, B~30%, C~20%, D~10%
--   Rescission rate: ~8% overall (higher for D leads)
--   Showed rates: A~95%, B~88%, C~75%, D~60%
-- =============================================================================

INSERT INTO workspace.hgv_comp.fact_tour_quality
  (tour_id, rep_id, period_id, lead_source, abc_score, package_type,
   showed_flag, closed_flag, contract_status, rescission_flag,
   net_sales_volume, vpg, ebitda_estimate)
VALUES

-- ---------------------------------------------------------------------------
-- REP-JASON (10 tours) | LAS | HGV
-- ---------------------------------------------------------------------------

  -- TOUR-Q1-001 | A-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-001', 'REP-JASON', '2026-Q2', 'OPC',      'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3200.00, 1600.00,  640.00),

  -- TOUR-Q1-002 | B-lead | Owner | Closed | ACTIVE
  ('TOUR-Q1-002', 'REP-JASON', '2026-Q2', 'Owner',    'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2400.00, 1200.00,  480.00),

  -- TOUR-Q1-003 | A-lead | Referral | Closed | RESCINDED (rescission)
  ('TOUR-Q1-003', 'REP-JASON', '2026-Q2', 'Referral', 'A', 'Flex',
   TRUE,  TRUE,  'RESCINDED', TRUE,  3500.00, 1750.00,  700.00),

  -- TOUR-Q1-004 | C-lead | OPC | No-sale
  ('TOUR-Q1-004', 'REP-JASON', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-005 | B-lead | Internet | Closed | ACTIVE
  ('TOUR-Q1-005', 'REP-JASON', '2026-Q2', 'Internet', 'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2200.00, 1100.00,  440.00),

  -- TOUR-Q1-006 | B-lead | OPC | No-sale
  ('TOUR-Q1-006', 'REP-JASON', '2026-Q2', 'OPC',      'B', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-007 | D-lead | Mail | No-show
  ('TOUR-Q1-007', 'REP-JASON', '2026-Q2', 'Mail',     'D', 'Discovery',
   FALSE, FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-008 | A-lead | Referral | Closed | ACTIVE
  ('TOUR-Q1-008', 'REP-JASON', '2026-Q2', 'Referral', 'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2800.00, 1400.00,  560.00),

  -- TOUR-Q1-009 | C-lead | OPC | No-sale
  ('TOUR-Q1-009', 'REP-JASON', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-010 | B-lead | Owner | Closed | PENDING
  ('TOUR-Q1-010', 'REP-JASON', '2026-Q2', 'Owner',    'B', 'Preview',
   TRUE,  TRUE,  'PENDING',   FALSE, 2600.00, 1300.00,  520.00),

-- ---------------------------------------------------------------------------
-- REP-RSMITH (10 tours) | ORL | HGV
-- ---------------------------------------------------------------------------

  -- TOUR-Q1-011 | B-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-011', 'REP-RSMITH', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 1800.00,  900.00,  360.00),

  -- TOUR-Q1-012 | A-lead | Referral | Closed | ACTIVE
  ('TOUR-Q1-012', 'REP-RSMITH', '2026-Q2', 'Referral', 'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3200.00, 1600.00,  640.00),

  -- TOUR-Q1-013 | C-lead | OPC | No-sale
  ('TOUR-Q1-013', 'REP-RSMITH', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-014 | B-lead | Mail | Closed | RESCINDED
  ('TOUR-Q1-014', 'REP-RSMITH', '2026-Q2', 'Mail',     'B', 'Discovery',
   TRUE,  TRUE,  'RESCINDED', TRUE,  2000.00, 1000.00,  400.00),

  -- TOUR-Q1-015 | D-lead | OPC | No-show
  ('TOUR-Q1-015', 'REP-RSMITH', '2026-Q2', 'OPC',      'D', 'Discovery',
   FALSE, FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-016 | C-lead | Internet | No-sale (showed)
  ('TOUR-Q1-016', 'REP-RSMITH', '2026-Q2', 'Internet', 'C', 'Preview',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-017 | A-lead | Owner | Closed | ACTIVE
  ('TOUR-Q1-017', 'REP-RSMITH', '2026-Q2', 'Owner',    'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3600.00, 1800.00,  720.00),

  -- TOUR-Q1-018 | B-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-018', 'REP-RSMITH', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2200.00, 1100.00,  440.00),

  -- TOUR-Q1-019 | D-lead | Mail | No-sale
  ('TOUR-Q1-019', 'REP-RSMITH', '2026-Q2', 'Mail',     'D', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-020 | C-lead | OPC | No-sale
  ('TOUR-Q1-020', 'REP-RSMITH', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

-- ---------------------------------------------------------------------------
-- REP-ECARTER (10 tours) | ORL | Diamond | (LOA Mar 1 – Mar 15)
-- ---------------------------------------------------------------------------

  -- TOUR-Q1-021 | B-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-021', 'REP-ECARTER', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2400.00, 1200.00,  480.00),

  -- TOUR-Q1-022 | C-lead | OPC | No-sale
  ('TOUR-Q1-022', 'REP-ECARTER', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-023 | A-lead | Referral | Closed | ACTIVE
  ('TOUR-Q1-023', 'REP-ECARTER', '2026-Q2', 'Referral', 'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2800.00, 1400.00,  560.00),

  -- TOUR-Q1-024 | B-lead | Internet | No-sale
  ('TOUR-Q1-024', 'REP-ECARTER', '2026-Q2', 'Internet', 'B', 'Preview',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-025 | D-lead | OPC | No-show
  ('TOUR-Q1-025', 'REP-ECARTER', '2026-Q2', 'OPC',      'D', 'Discovery',
   FALSE, FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-026 | C-lead | Mail | No-sale
  ('TOUR-Q1-026', 'REP-ECARTER', '2026-Q2', 'Mail',     'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-027 | B-lead | Owner | Closed | RESCINDED (LOA period deal reversed)
  ('TOUR-Q1-027', 'REP-ECARTER', '2026-Q2', 'Owner',    'B', 'Preview',
   TRUE,  TRUE,  'RESCINDED', TRUE,  1750.00,  875.00,  350.00),

  -- TOUR-Q1-028 | A-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-028', 'REP-ECARTER', '2026-Q2', 'OPC',      'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3400.00, 1700.00,  680.00),

  -- TOUR-Q1-029 | C-lead | Referral | No-sale
  ('TOUR-Q1-029', 'REP-ECARTER', '2026-Q2', 'Referral', 'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-030 | B-lead | OPC | Closed | PENDING
  ('TOUR-Q1-030', 'REP-ECARTER', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'PENDING',   FALSE, 2000.00, 1000.00,  400.00),

-- ---------------------------------------------------------------------------
-- REP-DLEE (10 tours) | SDG | HGV | (Joined 2025-01-15 — fewer early tours)
-- ---------------------------------------------------------------------------

  -- TOUR-Q1-031 | C-lead | OPC | No-sale
  ('TOUR-Q1-031', 'REP-DLEE', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-032 | B-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-032', 'REP-DLEE', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2200.00, 1100.00,  440.00),

  -- TOUR-Q1-033 | D-lead | Mail | No-show
  ('TOUR-Q1-033', 'REP-DLEE', '2026-Q2', 'Mail',     'D', 'Discovery',
   FALSE, FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-034 | A-lead | Referral | Closed | ACTIVE
  ('TOUR-Q1-034', 'REP-DLEE', '2026-Q2', 'Referral', 'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3000.00, 1500.00,  600.00),

  -- TOUR-Q1-035 | C-lead | Internet | No-sale
  ('TOUR-Q1-035', 'REP-DLEE', '2026-Q2', 'Internet', 'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-036 | B-lead | OPC | Closed | RESCINDED (payee_id fix ADMEVT-0011)
  ('TOUR-Q1-036', 'REP-DLEE', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'RESCINDED', TRUE,  2000.00, 1000.00,  400.00),

  -- TOUR-Q1-037 | B-lead | OPC | No-sale (payee_id fix ADMEVT-0011)
  ('TOUR-Q1-037', 'REP-DLEE', '2026-Q2', 'OPC',      'B', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-038 | C-lead | Mail | No-sale (payee_id fix ADMEVT-0011)
  ('TOUR-Q1-038', 'REP-DLEE', '2026-Q2', 'Mail',     'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-039 | D-lead | OPC | No-sale
  ('TOUR-Q1-039', 'REP-DLEE', '2026-Q2', 'OPC',      'D', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-040 | B-lead | Owner | Closed | ACTIVE
  ('TOUR-Q1-040', 'REP-DLEE', '2026-Q2', 'Owner',    'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2400.00, 1200.00,  480.00),

-- ---------------------------------------------------------------------------
-- REP-KNGUYEN (10 tours) | LAS | HGV | (L7 — highest performer)
-- ---------------------------------------------------------------------------

  -- TOUR-Q1-041 | A-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-041', 'REP-KNGUYEN', '2026-Q2', 'OPC',      'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3600.00, 1800.00,  720.00),

  -- TOUR-Q1-042 | A-lead | Referral | Closed | ACTIVE
  ('TOUR-Q1-042', 'REP-KNGUYEN', '2026-Q2', 'Referral', 'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 3400.00, 1700.00,  680.00),

  -- TOUR-Q1-043 | B-lead | OPC | Closed | ACTIVE
  ('TOUR-Q1-043', 'REP-KNGUYEN', '2026-Q2', 'OPC',      'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2600.00, 1300.00,  520.00),

  -- TOUR-Q1-044 | B-lead | Owner | Closed | ACTIVE
  ('TOUR-Q1-044', 'REP-KNGUYEN', '2026-Q2', 'Owner',    'B', 'Preview',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2200.00, 1100.00,  440.00),

  -- TOUR-Q1-045 | C-lead | OPC | No-sale
  ('TOUR-Q1-045', 'REP-KNGUYEN', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-046 | A-lead | Internet | Closed | ACTIVE
  ('TOUR-Q1-046', 'REP-KNGUYEN', '2026-Q2', 'Internet', 'A', 'Flex',
   TRUE,  TRUE,  'ACTIVE',    FALSE, 2800.00, 1400.00,  560.00),

  -- TOUR-Q1-047 | B-lead | OPC | No-sale
  ('TOUR-Q1-047', 'REP-KNGUYEN', '2026-Q2', 'OPC',      'B', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-048 | D-lead | Mail | No-show
  ('TOUR-Q1-048', 'REP-KNGUYEN', '2026-Q2', 'Mail',     'D', 'Discovery',
   FALSE, FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-049 | C-lead | OPC | No-sale
  ('TOUR-Q1-049', 'REP-KNGUYEN', '2026-Q2', 'OPC',      'C', 'Discovery',
   TRUE,  FALSE, 'NONE',      FALSE,    0.00,    0.00,    0.00),

  -- TOUR-Q1-050 | B-lead | Referral | Closed | PENDING
  ('TOUR-Q1-050', 'REP-KNGUYEN', '2026-Q2', 'Referral', 'B', 'Preview',
   TRUE,  TRUE,  'PENDING',   FALSE, 2400.00, 1200.00,  480.00);

-- =============================================================================
-- END OF SEED FILE: 05a_seed_admin_finance.sql
-- Total records seeded:
--   fact_plan_eligibility : 6 rows
--   fact_comp_admin_log   : 15 rows
--   fact_chargeback       : 8 rows (3 OPEN, 3 CLOSED, 2 PENDING)
--   fact_tour_quality     : 50 rows (TOUR-Q1-001 through TOUR-Q1-050)
-- =============================================================================
