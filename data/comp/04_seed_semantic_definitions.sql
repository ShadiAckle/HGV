-- Seed definitions for HGV Sales Compensation Semantic Layer
-- Path: data/comp/04_seed_semantic_definitions.sql

DELETE FROM workspace.hgv_comp.semantic_definitions;

INSERT INTO workspace.hgv_comp.semantic_definitions 
  (metric_id, display_name, description, category, sql_expression, source_tables, owner, created_at, updated_at, is_active)
VALUES
  (
    'REP_EARNINGS',
    'Total Earnings',
    'Cumulative representative earnings including base pay, commission, and bonuses for the active period.',
    'KPI',
    'SUM(total_earnings)',
    'workspace.hgv_comp.fact_payout',
    'comp-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'BASE_PAY',
    'Base Pay',
    'Base salary payout amount for the representative during the period.',
    'KPI',
    'SUM(base_pay)',
    'workspace.hgv_comp.fact_payout',
    'comp-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'COMMISSION_EARNED',
    'Commission Earned',
    'Total commission payments earned by the representative from completed deals.',
    'KPI',
    'SUM(commission)',
    'workspace.hgv_comp.fact_payout',
    'comp-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'BONUS_PAID',
    'Bonus Paid',
    'Special performance bonuses, SPIFFs, or target incentive payouts.',
    'KPI',
    'SUM(bonus)',
    'workspace.hgv_comp.fact_payout',
    'comp-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'REP_ATTAINMENT',
    'Quota Attainment',
    'Average quota attainment percentage across sales representatives.',
    'Measure',
    'AVG(attainment_pct)',
    'workspace.hgv_comp.fact_quota_attainment',
    'sales-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'DEALS_CLOSED',
    'Deals Closed',
    'Count of credit-approved deals closed by the rep.',
    'Measure',
    'SUM(deals_closed_count)',
    'workspace.hgv_comp.fact_quota_attainment',
    'sales-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'REP_NAME',
    'Sales Rep Name',
    'Full legal or display name of the sales representative.',
    'Dimension',
    'rep_name',
    'workspace.hgv_comp.dim_rep',
    'sales-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'MANAGER_NAME',
    'Manager Name',
    'Name of the direct manager of the representative.',
    'Dimension',
    'manager_rep_id',
    'workspace.hgv_comp.dim_rep',
    'sales-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'COMMISSION_RATIO',
    'Commission Ratio',
    'Commission earnings expressed as a percentage of quota amount.',
    'Calculated',
    'commission / NULLIF(quota_amount, 0) * 100',
    'workspace.hgv_comp.fact_payout, workspace.hgv_comp.fact_quota_attainment',
    'finance@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  ),
  (
    'NEXT_TIER_GAP',
    'Gap to Next Tier',
    'Remaining credited sales volume required to hit the next accelerator tier.',
    'Calculated',
    'SUM(next_tier_gap_amount)',
    'workspace.hgv_comp.fact_quota_attainment',
    'sales-ops@hgv.com',
    current_timestamp(),
    current_timestamp(),
    true
  );
