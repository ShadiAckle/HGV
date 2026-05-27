/** Marketing field roster — realistic mix of HGV coaching / comp scenarios (Q2 2026). */
import { CURRENT_PERIOD_ID } from './compPeriods.js';

export interface MarketingRepMarket {
  tcc_gap_vs_market_pct: number;
  base_pct: number;
  variable_pct: number;
  quota_attainment_pct: number;
}

export interface MarketingRepPeriodFacts {
  qtd_earnings: number;
  paid_to_date: number;
  qualified_tours: number;
  tours_shown: number;
  show_rate_pct: number;
  penetration_pct: number;
  penetration_target_pct: number;
  spiff_active: boolean;
  next_tier_label: string;
  next_tier_gap_tours: number;
  qualified_tour_pay: number;
  courtesy_tour_pay: number;
  penetration_spiff: number;
  chargebacks: number;
  total_payout: number;
  base_pct: number;
  variable_pct: number;
  tcc_gap_vs_market_pct: number;
  assigned_area: string;
}

export interface MarketingTourQualitySeed {
  tour_id: string;
  lead_source: string;
  abc_score: string;
  package_type: string;
  showed_flag: boolean;
  closed_flag: boolean;
  contract_status: string;
  rescission_flag: boolean;
  net_sales_volume: number;
  vpg: number;
}

export interface MarketingTeamMember {
  rep_id: string;
  rep_name: string;
  level_code: string;
  team_id: string;
  manager_rep_id: string;
  region: string;
  /** Human-readable scenario label for demos / docs */
  scenario: string;
  period: MarketingRepPeriodFacts;
  market: MarketingRepMarket;
  tours: MarketingTourQualitySeed[];
}

export const MARKETING_PERIOD_ID = CURRENT_PERIOD_ID;

/** Las Vegas Strip desk — reports to Marketing Manager (Castillo). */
export const LAS_VEGAS_MARKETING_TEAM: MarketingTeamMember[] = [
  {
    rep_id: 'MKT-REP-001',
    rep_name: 'M. Chen',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'Top performer — above quota, near market pay mix',
    period: {
      assigned_area: 'Las Vegas Strip South Desk',
      qtd_earnings: 3180,
      paid_to_date: 3150,
      qualified_tours: 9,
      tours_shown: 14,
      show_rate_pct: 93,
      penetration_pct: 28,
      penetration_target_pct: 22,
      spiff_active: true,
      next_tier_label: 'Accelerator — 115% penetration gate',
      next_tier_gap_tours: 1,
      qualified_tour_pay: 675,
      courtesy_tour_pay: 40,
      penetration_spiff: 250,
      chargebacks: 0,
      total_payout: 3180,
      base_pct: 38,
      variable_pct: 62,
      tcc_gap_vs_market_pct: -12,
    },
    market: { tcc_gap_vs_market_pct: -12, base_pct: 38, variable_pct: 62, quota_attainment_pct: 112 },
    tours: [
      { tour_id: 'MKT-T-101', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3400, vpg: 1700 },
      { tour_id: 'MKT-T-102', lead_source: 'Owner', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3200, vpg: 1600 },
      { tour_id: 'MKT-T-103', lead_source: 'Referral', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2200, vpg: 1100 },
      { tour_id: 'MKT-T-104', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-105', lead_source: 'Internet', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'PENDING', rescission_flag: false, net_sales_volume: 2400, vpg: 1200 },
      { tour_id: 'MKT-T-106', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-107', lead_source: 'Owner', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3600, vpg: 1800 },
      { tour_id: 'MKT-T-108', lead_source: 'OPC', abc_score: 'B', package_type: 'Preview', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REP-002',
    rep_name: 'J. Rivera',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'Solid mid-pack — on track, slightly above market TCC',
    period: {
      assigned_area: 'Las Vegas Strip North Desk',
      qtd_earnings: 2640,
      paid_to_date: 2600,
      qualified_tours: 6,
      tours_shown: 12,
      show_rate_pct: 86,
      penetration_pct: 21,
      penetration_target_pct: 20,
      spiff_active: false,
      next_tier_label: 'Tier 3 — $100 qualified tour rate',
      next_tier_gap_tours: 2,
      qualified_tour_pay: 600,
      courtesy_tour_pay: 60,
      penetration_spiff: 0,
      chargebacks: -25,
      total_payout: 2615,
      base_pct: 55,
      variable_pct: 45,
      tcc_gap_vs_market_pct: 5,
    },
    market: { tcc_gap_vs_market_pct: 5, base_pct: 55, variable_pct: 45, quota_attainment_pct: 94 },
    tours: [
      { tour_id: 'MKT-T-201', lead_source: 'OPC', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2200, vpg: 1100 },
      { tour_id: 'MKT-T-202', lead_source: 'Owner', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-203', lead_source: 'Referral', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-204', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3000, vpg: 1500 },
      { tour_id: 'MKT-T-205', lead_source: 'Internet', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 1600, vpg: 800 },
      { tour_id: 'MKT-T-206', lead_source: 'Mail', abc_score: 'D', package_type: 'Discovery', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REP-003',
    rep_name: 'A. Patel',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'At-risk — low show rate, below market, chargeback exposure',
    period: {
      assigned_area: 'Las Vegas Elara Desk',
      qtd_earnings: 980,
      paid_to_date: 920,
      qualified_tours: 2,
      tours_shown: 9,
      show_rate_pct: 64,
      penetration_pct: 12,
      penetration_target_pct: 20,
      spiff_active: false,
      next_tier_label: 'Tier 2 — $75 qualified tour rate',
      next_tier_gap_tours: 4,
      qualified_tour_pay: 150,
      courtesy_tour_pay: 80,
      penetration_spiff: 0,
      chargebacks: -120,
      total_payout: 860,
      base_pct: 35,
      variable_pct: 65,
      tcc_gap_vs_market_pct: -18,
    },
    market: { tcc_gap_vs_market_pct: -18, base_pct: 35, variable_pct: 65, quota_attainment_pct: 58 },
    tours: [
      { tour_id: 'MKT-T-301', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-302', lead_source: 'Mail', abc_score: 'D', package_type: 'Discovery', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-303', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: true, contract_status: 'RESCINDED', rescission_flag: true, net_sales_volume: 1400, vpg: 700 },
      { tour_id: 'MKT-T-304', lead_source: 'Internet', abc_score: 'D', package_type: 'Discovery', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-305', lead_source: 'Owner', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REP-004',
    rep_name: 'K. Nguyen',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'On track but inverted pay mix vs market 60/40',
    period: {
      assigned_area: 'Las Vegas Strip South Desk',
      qtd_earnings: 1890,
      paid_to_date: 1850,
      qualified_tours: 4,
      tours_shown: 11,
      show_rate_pct: 79,
      penetration_pct: 18,
      penetration_target_pct: 20,
      spiff_active: true,
      next_tier_label: 'Tier 3 — $100 qualified tour rate',
      next_tier_gap_tours: 2,
      qualified_tour_pay: 400,
      courtesy_tour_pay: 40,
      penetration_spiff: 75,
      chargebacks: 0,
      total_payout: 1890,
      base_pct: 42,
      variable_pct: 58,
      tcc_gap_vs_market_pct: -8,
    },
    market: { tcc_gap_vs_market_pct: -8, base_pct: 42, variable_pct: 58, quota_attainment_pct: 72 },
    tours: [
      { tour_id: 'MKT-T-401', lead_source: 'OPC', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2000, vpg: 1000 },
      { tour_id: 'MKT-T-402', lead_source: 'Referral', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-403', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-404', lead_source: 'Owner', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'PENDING', rescission_flag: false, net_sales_volume: 2400, vpg: 1200 },
    ],
  },
  {
    rep_id: 'MKT-REP-005',
    rep_name: 'S. Okonkwo',
    level_code: 'C2b',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'Top performer — high FPS conversion, SPIFF eligible',
    period: {
      assigned_area: 'Las Vegas Strip South Desk',
      qtd_earnings: 3420,
      paid_to_date: 3400,
      qualified_tours: 10,
      tours_shown: 13,
      show_rate_pct: 92,
      penetration_pct: 31,
      penetration_target_pct: 22,
      spiff_active: true,
      next_tier_label: 'FPS accelerator — 2 packages to max tier',
      next_tier_gap_tours: 0,
      qualified_tour_pay: 750,
      courtesy_tour_pay: 20,
      penetration_spiff: 400,
      chargebacks: 0,
      total_payout: 3420,
      base_pct: 58,
      variable_pct: 42,
      tcc_gap_vs_market_pct: 3,
    },
    market: { tcc_gap_vs_market_pct: 3, base_pct: 58, variable_pct: 42, quota_attainment_pct: 103 },
    tours: [
      { tour_id: 'MKT-T-501', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3600, vpg: 1800 },
      { tour_id: 'MKT-T-502', lead_source: 'Owner', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3200, vpg: 1600 },
      { tour_id: 'MKT-T-503', lead_source: 'Referral', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2600, vpg: 1300 },
      { tour_id: 'MKT-T-504', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REP-006',
    rep_name: 'L. Torres',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'Critical — below quota AND below market (combined at-risk)',
    period: {
      assigned_area: 'Las Vegas Elara Desk',
      qtd_earnings: 720,
      paid_to_date: 680,
      qualified_tours: 1,
      tours_shown: 8,
      show_rate_pct: 57,
      penetration_pct: 9,
      penetration_target_pct: 20,
      spiff_active: false,
      next_tier_label: 'Tier 1 — $50 qualified tour rate',
      next_tier_gap_tours: 5,
      qualified_tour_pay: 50,
      courtesy_tour_pay: 100,
      penetration_spiff: 0,
      chargebacks: -80,
      total_payout: 640,
      base_pct: 32,
      variable_pct: 68,
      tcc_gap_vs_market_pct: -22,
    },
    market: { tcc_gap_vs_market_pct: -22, base_pct: 32, variable_pct: 68, quota_attainment_pct: 48 },
    tours: [
      { tour_id: 'MKT-T-601', lead_source: 'Mail', abc_score: 'D', package_type: 'Discovery', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-602', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-603', lead_source: 'Internet', abc_score: 'D', package_type: 'Discovery', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 900, vpg: 450 },
    ],
  },
  {
    rep_id: 'MKT-REP-007',
    rep_name: 'R. Flores',
    level_code: 'C1',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'New hire ramp — prorated plan, building show rate',
    period: {
      assigned_area: 'Las Vegas Strip North Desk',
      qtd_earnings: 1120,
      paid_to_date: 1050,
      qualified_tours: 3,
      tours_shown: 7,
      show_rate_pct: 70,
      penetration_pct: 14,
      penetration_target_pct: 18,
      spiff_active: true,
      next_tier_label: 'Ramp Tier — 75% quota shield active',
      next_tier_gap_tours: 3,
      qualified_tour_pay: 225,
      courtesy_tour_pay: 60,
      penetration_spiff: 50,
      chargebacks: 0,
      total_payout: 1120,
      base_pct: 45,
      variable_pct: 55,
      tcc_gap_vs_market_pct: -6,
    },
    market: { tcc_gap_vs_market_pct: -6, base_pct: 45, variable_pct: 55, quota_attainment_pct: 65 },
    tours: [
      { tour_id: 'MKT-T-701', lead_source: 'OPC', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-702', lead_source: 'Referral', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 1800, vpg: 900 },
      { tour_id: 'MKT-T-703', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REP-008',
    rep_name: 'D. Kim',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    manager_rep_id: 'PERSONA-MKT-MGR',
    region: 'West',
    scenario: 'High tour volume, low close rate — ride-along coaching case',
    period: {
      assigned_area: 'Las Vegas Strip South Desk',
      qtd_earnings: 2050,
      paid_to_date: 2000,
      qualified_tours: 5,
      tours_shown: 15,
      show_rate_pct: 88,
      penetration_pct: 16,
      penetration_target_pct: 20,
      spiff_active: false,
      next_tier_label: 'Close-rate coaching — target 30% conversion',
      next_tier_gap_tours: 1,
      qualified_tour_pay: 375,
      courtesy_tour_pay: 120,
      penetration_spiff: 0,
      chargebacks: -35,
      total_payout: 2015,
      base_pct: 40,
      variable_pct: 60,
      tcc_gap_vs_market_pct: -4,
    },
    market: { tcc_gap_vs_market_pct: -4, base_pct: 40, variable_pct: 60, quota_attainment_pct: 78 },
    tours: [
      { tour_id: 'MKT-T-801', lead_source: 'OPC', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-802', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-803', lead_source: 'Owner', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2200, vpg: 1100 },
      { tour_id: 'MKT-T-804', lead_source: 'Internet', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-805', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
];

/** Regional marketing reps — report to Marketing Director (Whitfield). */
export const REGIONAL_MARKETING_TEAM: MarketingTeamMember[] = [
  {
    rep_id: 'MKT-REG-001',
    rep_name: 'T. Walsh',
    level_code: 'C2b',
    team_id: 'TEAM-MKT-REG',
    manager_rep_id: 'PERSONA-MKT-DIR',
    region: 'East',
    scenario: 'Regional top performer — Orlando market',
    period: {
      assigned_area: 'Orlando OPC Center',
      qtd_earnings: 2890,
      paid_to_date: 2850,
      qualified_tours: 8,
      tours_shown: 12,
      show_rate_pct: 90,
      penetration_pct: 24,
      penetration_target_pct: 20,
      spiff_active: true,
      next_tier_label: 'Regional LM NSV gate',
      next_tier_gap_tours: 1,
      qualified_tour_pay: 640,
      courtesy_tour_pay: 30,
      penetration_spiff: 180,
      chargebacks: 0,
      total_payout: 2890,
      base_pct: 52,
      variable_pct: 48,
      tcc_gap_vs_market_pct: 2,
    },
    market: { tcc_gap_vs_market_pct: 2, base_pct: 52, variable_pct: 48, quota_attainment_pct: 98 },
    tours: [
      { tour_id: 'MKT-T-R01', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3100, vpg: 1550 },
      { tour_id: 'MKT-T-R02', lead_source: 'Referral', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2400, vpg: 1200 },
    ],
  },
  {
    rep_id: 'MKT-REG-002',
    rep_name: 'N. Brooks',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-REG',
    manager_rep_id: 'PERSONA-MKT-DIR',
    region: 'East',
    scenario: 'Regional at-risk — Myrtle Beach desk slump',
    period: {
      assigned_area: 'Myrtle Beach OPC',
      qtd_earnings: 840,
      paid_to_date: 800,
      qualified_tours: 2,
      tours_shown: 7,
      show_rate_pct: 58,
      penetration_pct: 11,
      penetration_target_pct: 18,
      spiff_active: false,
      next_tier_label: 'Show-rate recovery plan',
      next_tier_gap_tours: 4,
      qualified_tour_pay: 150,
      courtesy_tour_pay: 90,
      penetration_spiff: 0,
      chargebacks: -60,
      total_payout: 780,
      base_pct: 38,
      variable_pct: 62,
      tcc_gap_vs_market_pct: -15,
    },
    market: { tcc_gap_vs_market_pct: -15, base_pct: 38, variable_pct: 62, quota_attainment_pct: 52 },
    tours: [
      { tour_id: 'MKT-T-R03', lead_source: 'Mail', abc_score: 'D', package_type: 'Discovery', showed_flag: false, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
      { tour_id: 'MKT-T-R04', lead_source: 'OPC', abc_score: 'C', package_type: 'Discovery', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REG-003',
    rep_name: 'E. Santos',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-REG',
    manager_rep_id: 'PERSONA-MKT-DIR',
    region: 'West',
    scenario: 'On track — Honolulu inbound owner tours',
    period: {
      assigned_area: 'Honolulu Owner Desk',
      qtd_earnings: 2180,
      paid_to_date: 2140,
      qualified_tours: 5,
      tours_shown: 10,
      show_rate_pct: 83,
      penetration_pct: 19,
      penetration_target_pct: 20,
      spiff_active: false,
      next_tier_label: 'Owner tour conversion focus',
      next_tier_gap_tours: 2,
      qualified_tour_pay: 375,
      courtesy_tour_pay: 50,
      penetration_spiff: 0,
      chargebacks: 0,
      total_payout: 2180,
      base_pct: 44,
      variable_pct: 56,
      tcc_gap_vs_market_pct: -5,
    },
    market: { tcc_gap_vs_market_pct: -5, base_pct: 44, variable_pct: 56, quota_attainment_pct: 81 },
    tours: [
      { tour_id: 'MKT-T-R05', lead_source: 'Owner', abc_score: 'B', package_type: 'Preview', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 2600, vpg: 1300 },
      { tour_id: 'MKT-T-R06', lead_source: 'Owner', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: false, contract_status: 'NONE', rescission_flag: false, net_sales_volume: 0, vpg: 0 },
    ],
  },
  {
    rep_id: 'MKT-REG-004',
    rep_name: 'P. Nguyen',
    level_code: 'C2b',
    team_id: 'TEAM-MKT-REG',
    manager_rep_id: 'PERSONA-MKT-DIR',
    region: 'West',
    scenario: 'Top regional — high penetration SPIFF',
    period: {
      assigned_area: 'San Diego OPC',
      qtd_earnings: 3050,
      paid_to_date: 3020,
      qualified_tours: 9,
      tours_shown: 11,
      show_rate_pct: 91,
      penetration_pct: 27,
      penetration_target_pct: 22,
      spiff_active: true,
      next_tier_label: 'Penetration SPIFF max tier',
      next_tier_gap_tours: 0,
      qualified_tour_pay: 675,
      courtesy_tour_pay: 25,
      penetration_spiff: 320,
      chargebacks: 0,
      total_payout: 3050,
      base_pct: 56,
      variable_pct: 44,
      tcc_gap_vs_market_pct: 4,
    },
    market: { tcc_gap_vs_market_pct: 4, base_pct: 56, variable_pct: 44, quota_attainment_pct: 106 },
    tours: [
      { tour_id: 'MKT-T-R07', lead_source: 'OPC', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'ACTIVE', rescission_flag: false, net_sales_volume: 3400, vpg: 1700 },
      { tour_id: 'MKT-T-R08', lead_source: 'Referral', abc_score: 'A', package_type: 'Flex', showed_flag: true, closed_flag: true, contract_status: 'PENDING', rescission_flag: false, net_sales_volume: 3000, vpg: 1500 },
    ],
  },
];

export const ALL_MARKETING_TEAM_MEMBERS = [...LAS_VEGAS_MARKETING_TEAM, ...REGIONAL_MARKETING_TEAM];
