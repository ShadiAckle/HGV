-- App service principal runtime grants for hilton-kb-chat Databricks App.
-- Run as a catalog admin (your user) — NOT as the app SP.
-- Service principal: d8d67f27-1896-4549-9351-e7b53a9df800

GRANT USE CATALOG ON CATALOG workspace TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT USE SCHEMA ON SCHEMA workspace.hgv_comp TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT SELECT ON SCHEMA workspace.hgv_comp TO `d8d67f27-1896-4549-9351-e7b53a9df800`;

-- Bootstrap: CREATE TABLE IF NOT EXISTS + idempotent seed INSERT/UPDATE/DELETE at app startup
GRANT CREATE TABLE ON SCHEMA workspace.hgv_comp TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON SCHEMA workspace.hgv_comp TO `d8d67f27-1896-4549-9351-e7b53a9df800`;

-- Explicit table grants (redundant with MODIFY ON SCHEMA; kept for clarity / least-surprise audits)
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_plan_component TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_call_center_credit TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.scenario_run TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.scenario_result TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.scenario_payout_series TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_period TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_rep TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_team TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.industry_comp_benchmark TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_regional_bonus_area TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_regional_bonus_tier TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_marketing_rep_period TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_marketing_rep_metric TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_marketing_tour_payout TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_marketing_chargeback TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_marketing_arrival TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_rep_market_position TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.plan_assessment_profile TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.plan_assessment_segment TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_payout TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_quota_attainment TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_team_snapshot TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_tour_quality TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_plan_eligibility TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_comp_admin_log TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_manager_intervention TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_chargeback TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_finance_period TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_rep_product_mix TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_household TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_location TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.dim_guest TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.bridge_tour_guest TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_guest_ownership TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_guest_rental_stay TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
GRANT MODIFY ON TABLE workspace.hgv_comp.fact_guest_tour_history TO `d8d67f27-1896-4549-9351-e7b53a9df800`;
