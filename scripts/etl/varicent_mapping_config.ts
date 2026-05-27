// Configuration schema mapping dictionary for Varicent exports to HGV Delta Star Schema
// Decouples the ingestion engine from database layouts, allowing quick custom updates.

export const VARICENT_MAPPINGS = {
  payees: {
    label: "Payees & Plan Eligibility",
    sourceFormat: "csv",
    targets: [
      {
        table: "workspace.hgv_comp.dim_rep",
        uniqueKeys: ["rep_id"],
        ingestionMode: "MERGE",
        fields: {
          rep_id: { source: "PayeeCode", type: "string", required: true },
          rep_name: { source: "PayeeName", type: "string", required: true },
          level_code: { source: "Level", type: "string", defaultValue: "L6" },
          team_id: { source: "TeamCode", type: "string", defaultValue: "TEAM-WEST" },
          manager_rep_id: { source: "ManagerCode", type: "string", defaultValue: "REP-MGR-01" },
          region: { source: "RegionCode", type: "string", defaultValue: "West" },
          is_active: {
            source: "StatusActive",
            type: "boolean",
            transform: (val: any) => String(val).trim() === "1" || String(val).toLowerCase() === "true"
          }
        }
      },
      {
        table: "workspace.hgv_comp.fact_plan_eligibility",
        uniqueKeys: ["rep_id", "period_id"],
        ingestionMode: "MERGE",
        fields: {
          rep_id: { source: "PayeeCode", type: "string", required: true },
          period_id: { source: "PeriodId", type: "string", defaultValue: "2026-Q2", required: true },
          plan_version_id: { source: "CompPlan", type: "string", defaultValue: "PLAN-FT-2026", required: true },
          job_code: {
            source: "Level",
            type: "string",
            transform: (val: any) => val === "L9" ? "FT-MGR-L9" : `FT-SALES-${val || "L6"}`
          },
          location_code: {
            source: "TeamCode",
            type: "string",
            transform: (val: any) => String(val).includes("WEST") || String(val).includes("LAS") ? "LAS" : "ORL"
          },
          brand: { source: "Brand", type: "string", defaultValue: "HGV" },
          effective_start: { source: "EffectiveStart", type: "date", defaultValue: "2026-04-01" },
          effective_end: { source: "EffectiveEnd", type: "date", defaultValue: null },
          proration_pct: {
            source: "ProrationPercent",
            type: "decimal",
            defaultValue: 100.00,
            transform: (val: any) => val ? parseFloat(val) : 100.00
          },
          eligibility_flag: {
            source: "StatusActive",
            type: "boolean",
            transform: (val: any) => String(val).trim() === "1" || String(val).toLowerCase() === "true"
          },
          exclusion_reason: { source: "ExclusionReason", type: "string", defaultValue: null }
        }
      }
    ]
  },
  deals: {
    label: "Deals & Tour Quality",
    sourceFormat: "json",
    targets: [
      {
        table: "workspace.hgv_comp.fact_deal_credit",
        uniqueKeys: ["deal_id"],
        ingestionMode: "MERGE",
        fields: {
          deal_id: { source: "TransactionId", type: "string", required: true },
          rep_id: { source: "RepCode", type: "string", required: true },
          period_id: { source: "PeriodId", type: "string", defaultValue: "2026-Q2", required: true },
          product_line_id: {
            source: "ProductType",
            type: "string",
            transform: (val: any) => String(val).toUpperCase() === "FFS" ? "PROD-FFS" : "PROD-NONFFS"
          },
          property_code: { source: "Location", type: "string", defaultValue: "LAS" },
          property_display_name: { source: "LocationName", type: "string", defaultValue: "Las Vegas Resort" },
          credit_amount: {
            source: "CreditAmount",
            type: "decimal",
            required: true,
            transform: (val: any) => parseFloat(val || 0)
          },
          credit_status: { source: "Status", type: "string", defaultValue: "APPROVED" },
          credit_date: { source: "CloseDate", type: "date", required: true }
        }
      },
      {
        table: "workspace.hgv_comp.fact_tour_quality",
        uniqueKeys: ["tour_id"],
        ingestionMode: "MERGE",
        fields: {
          tour_id: {
            source: "TransactionId",
            type: "string",
            required: true,
            transform: (val: any) => `TOUR-${val}`
          },
          rep_id: { source: "RepCode", type: "string", required: true },
          period_id: { source: "PeriodId", type: "string", defaultValue: "2026-Q2", required: true },
          lead_source: { source: "Location", type: "string", transform: (val: any) => val === "ORL" ? "Referral" : "OPC" },
          abc_score: { source: "LeadScore", type: "string", defaultValue: "B" },
          package_type: { source: "PackageType", type: "string", defaultValue: "Preview" },
          showed_flag: { source: "Showed", type: "boolean", defaultValue: true },
          closed_flag: { source: "Closed", type: "boolean", defaultValue: true },
          contract_status: { source: "ContractStatus", type: "string", defaultValue: "ACTIVE" },
          rescission_flag: { source: "Rescinded", type: "boolean", defaultValue: false },
          net_sales_volume: {
            source: "NetSales",
            type: "decimal",
            transform: (val: any) => parseFloat(val || 0)
          },
          vpg: {
            source: "VPG",
            type: "decimal",
            transform: (val: any) => parseFloat(val || 0)
          },
          ebitda_estimate: {
            source: "EbitdaEstimate",
            type: "decimal",
            transform: (val: any) => parseFloat(val || 0)
          }
        }
      }
    ]
  },
  payouts: {
    label: "Period Payout Snapshots",
    sourceFormat: "csv",
    targets: [
      {
        table: "workspace.hgv_comp.fact_payout",
        uniqueKeys: ["rep_id", "period_id"],
        ingestionMode: "MERGE",
        fields: {
          rep_id: { source: "EmployeeId", type: "string", required: true },
          period_id: { source: "PeriodCode", type: "string", required: true },
          base_pay: { source: "BaseSalary", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          commission: { source: "CommissionValue", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          bonus: { source: "BonusValue", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          total_earnings: { source: "EarningsTotal", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          total_paid: { source: "PaidTotal", type: "decimal", transform: (val: any) => parseFloat(val || 0) }
        }
      },
      {
        table: "workspace.hgv_comp.fact_quota_attainment",
        uniqueKeys: ["rep_id", "period_id"],
        ingestionMode: "MERGE",
        fields: {
          rep_id: { source: "EmployeeId", type: "string", required: true },
          period_id: { source: "PeriodCode", type: "string", required: true },
          plan_version_id: { source: "PlanCode", type: "string", defaultValue: "PLAN-FT-2026" },
          quota_amount: { source: "QuotaTarget", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          credited_amount: { source: "CreditAchieved", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          attainment_pct: { source: "AttainmentPercent", type: "decimal", transform: (val: any) => parseFloat(val || 0) },
          deals_closed_count: { source: "DealsCount", type: "int", transform: (val: any) => parseInt(val || 0) },
          next_tier_threshold_pct: { source: "NextTierThreshold", type: "decimal", defaultValue: 100.00 },
          next_tier_gap_amount: {
            source: "EmployeeId",
            type: "decimal",
            transform: (_: any, row: any) => {
              const target = parseFloat(row.QuotaTarget || 0);
              const achieved = parseFloat(row.CreditAchieved || 0);
              return Math.max(0, target - achieved);
            }
          }
        }
      }
    ]
  }
} as const;
