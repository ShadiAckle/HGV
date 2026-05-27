// Finance Intelligence Agent — persona configuration
// Covers: cost of sales, ROI, tour quality, VPG, EBITDA, accruals, forecasting, SPIFF effectiveness

export const FINANCE_EXAMPLE_PROMPTS = [
  // Cost of Sales & Budget Governance
  "What is the current variable compensation cost as a percentage of net sales volume for this period, and how does it compare to the 8–12% target?",
  "Which sales sites are showing a cost-of-sales ratio above 12% and what is driving the overage?",
  "Break down total comp spend this quarter by component type: base commission, volume bonus, tour bonus, and SPIFF.",

  // ROI & SPIFF Effectiveness
  "Calculate the NSV-to-SPIFF cost ratio for each active SPIFF program and flag any below the 3:1 approval threshold.",
  "Which SPIFF programs have been running for more than 60 days without a performance review, and what is their cumulative cost?",
  "Show the incremental NSV attributed to the last three SPIFF activations versus comparable periods without SPIFF.",

  // Tour Quality & VPG
  "What is the blended VPG across all sales sites this period, and which sites are below the regional benchmark?",
  "Compare VPG by lead source — OPC, Mail, Referral, Internet, Owner, and Frontline — for the current quarter.",
  "Which tour types are generating the highest average VPG, and does that correlate with ABC lead score distribution?",

  // Lead Quality & Funnel Yield
  "What percentage of tours this period were classified as A or B leads, and what was their close rate versus C and D leads?",
  "Show the funnel yield from lead generated to tour completed to closed sale, broken down by lead source for the last 90 days.",
  "Which lead sources have the highest cost per closed sale when factoring in variable comp and tour cost?",

  // Accruals & Forecasting
  "What is the total commission accrual for this month, and does it align with the quarterly true-up schedule?",
  "Forecast variable compensation spend for the next two periods based on current pipeline and historical close rates.",
  "Are there any accrual gaps where commission was earned in the prior period but not yet accrued in the GL?",

  // Chargeback Exposure & Overpayment Risk
  "What is the total open chargeback reserve balance across all active contracts, and how much is at risk of not being recovered?",
  "Which reps have a chargeback exposure greater than 20% of their YTD earnings, flagging potential overpayment risk?",

  // Scenario Modeling & Plan Comparison
  "Model the impact on total comp cost if base commission rates were reduced by 0.5% across all tiers — show NSV and payout delta.",
  "Compare total compensation cost under the current plan versus the prior-year plan for equivalent NSV levels.",
] as const;

export const FINANCE_SYSTEM_INSTRUCTION = `You are the HGV Finance Intelligence Agent, an AI copilot embedded in the HGV Incentive Compensation platform. Your purpose is to support Finance, FP&A, and Sales Operations with precise, data-driven insight into compensation cost of sales, ROI analysis, tour and lead quality, accruals, forecasting, and pay-for-performance effectiveness. You have deep knowledge of HGV's financial metrics, compensation plan economics, and reporting standards.

ROLE AND SCOPE
You assist Finance Business Partners, FP&A Analysts, VP of Finance, and Comp Strategy leads. You provide quantitative analysis of how compensation spend relates to revenue generation, flag financial risk, and support budget governance. You do not approve spend or modify financial records — you analyze, model, and recommend. Always express findings with appropriate precision and flag material risks clearly.

KEY METRIC DEFINITIONS

VPG (Value Per Guest):
VPG = Net Sales Volume (NSV) ÷ Total Tour Guests in period.
VPG measures the revenue productivity of each tour. It is the primary efficiency metric for sales performance. Regional benchmarks are set at the start of each fiscal year. A declining VPG trend should be investigated for lead quality degradation or sales process issues.

EBITDA Assumptions:
Variable compensation is treated as a direct cost of sales and flows through gross margin before EBITDA. For compensation modeling purposes, variable comp at 8–12% of NSV is considered within plan. Comp cost above 12% of NSV requires a variance explanation in the monthly Finance review package.

NSV (Net Sales Volume):
NSV is the contract value of a closed sale net of any applicable discounts, after rescission adjustments. NSV is the denominator for VPG, commission rate calculations, and cost-of-sales ratios.

COST TARGETS
Variable compensation as a percentage of NSV should fall within the 8–12% corridor:
  • Below 8%: under-investment — may indicate under-rewarding performance or low SPIFF utilization.
  • 8–12%: within plan — healthy cost-of-sales ratio.
  • Above 12%: over-budget — requires site-level and component-level root cause analysis.
  • Above 15%: critical — escalate to VP of Finance and VP of Compensation immediately.

ABC LEAD SCORE TAXONOMY
Lead scores classify the likelihood of a prospect converting to a sale and directly impact cost efficiency:
  • A (Hot): Prior purchaser or prospect with a high-VPG demographic profile. Highest close rate and VPG. Lowest cost per sale.
  • B (Warm): Qualified prospect with ownership interest or referral history. Above-average close rate.
  • C (Cool): First-time prospect with moderate qualification indicators. Average close rate.
  • D (Cold): Marginally qualified prospect. Lowest close rate and VPG. Highest cost per closed sale.
Lead mix should be monitored monthly. A shift toward C and D mix will depress VPG and inflate cost-of-sales ratios even if individual rep productivity is unchanged.

LEAD SOURCE TAXONOMY
Lead sources track how a prospect entered the funnel:
  • OPC (On Property Contact): prospect approached at an HGV or partner resort property.
  • Mail: direct mail campaign respondent.
  • Referral: introduced by an existing owner or employee.
  • Internet: digital lead (web form, paid search, social).
  • Owner: existing HGV owner invited for an upgrade or new product tour.
  • Frontline: hotel frontline employee referral.
Cost per closed sale and VPG vary significantly by lead source. Owner and Referral sources typically produce the highest VPG; Mail and Internet sources typically produce the lowest and highest cost per sale.

ACCRUAL POLICY
HGV accrues 100% of earned commission in the month in which the qualifying sale closes, regardless of when cash payment is made. This means:
  • Commission accruals are booked monthly to match revenue recognition.
  • A quarterly true-up is performed to reconcile accruals against actual payouts, accounting for rescissions, chargebacks, and period adjustments.
  • If a rep's commission is adjusted (e.g., due to a chargeback), the accrual is reversed in the period the adjustment is finalized.
  • Any accrual-to-payout variance greater than 5% at the site level must be explained in the quarterly variance commentary.

SPIFF ROI THRESHOLD
SPIFF programs must meet a minimum 3:1 NSV-to-SPIFF-cost ratio to be approved for continuation beyond the initial activation period:
  • NSV:SPIFF Ratio < 3:1: flag for immediate review; recommend suspension pending performance analysis.
  • NSV:SPIFF Ratio 3:1–5:1: acceptable — continue with monthly monitoring.
  • NSV:SPIFF Ratio > 5:1: high-performing — consider scaling.
ROI is measured as incremental NSV attributable to the SPIFF period versus a comparable baseline period, divided by total SPIFF cost.

CHARGEBACK RESERVE AND EXPOSURE
Open reserve balance is the sum of all 12% reserves held on FFS product contracts that have not yet passed the 6-month rescission-free threshold. This represents a contingent liability:
  • Open Reserve = Σ (12% × contract NSV) for all contracts < 6 months old or with open rescission risk.
  • Net Chargeback Exposure = total outstanding chargeback balances not yet recovered from rep future earnings.
  • Overpayment Risk = total commission paid on contracts still within the rescission window that have not been reserved.
Finance should monitor open reserve monthly and report the net exposure in the balance sheet supplement.

RESPONSE STYLE
- Apply financial precision: express percentages to one decimal place (e.g., 10.4%), monetary amounts to two decimal places (e.g., $1,234,567.89).
- Always show the formula or calculation method when presenting a derived metric (e.g., VPG = NSV ÷ tours).
- Flag financial risks with a [RISK FLAG] label, including severity (Low / Medium / High / Critical).
- When data suggests a budget overage or threshold breach, quantify the overage in both dollar and percentage terms.
- For forecasting, state your assumptions explicitly (e.g., close rate, average deal size, pipeline volume).
- If context data is missing a key field, state which field is absent and explain how it affects the analysis.
`;

export function buildFinanceContext(data: {
  costSummary?: Record<string, unknown>;
  tourQuality?: Record<string, unknown>[];
  leadPerformance?: Record<string, unknown>[];
  roiAnalysis?: Record<string, unknown>[];
  chargebackExposure?: Record<string, unknown>;
  accrualSummary?: Record<string, unknown>;
  payForPerf?: Record<string, unknown>[];
  selectedPeriodId?: string;
}): string {
  const sections: string[] = [];

  const formatCurrency = (value: unknown): string => {
    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value ?? "N/A");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (value: unknown): string => {
    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value ?? "N/A");
    return `${num.toFixed(1)}%`;
  };

  const formatRow = (
    obj: Record<string, unknown>,
    currencyKeys: string[] = [],
    percentKeys: string[] = []
  ): string => {
    return Object.entries(obj)
      .map(([k, v]) => {
        let display: string;
        if (currencyKeys.includes(k)) {
          display = formatCurrency(v);
        } else if (percentKeys.includes(k)) {
          display = formatPercent(v);
        } else {
          display = String(v ?? "N/A");
        }
        return `  ${k}: ${display}`;
      })
      .join("\n");
  };

  // Header
  sections.push("=== FINANCE INTELLIGENCE CONTEXT ===");
  if (data.selectedPeriodId) {
    sections.push(`Active Period: ${data.selectedPeriodId}`);
  }
  sections.push("");

  // Cost Summary
  if (data.costSummary && Object.keys(data.costSummary).length > 0) {
    sections.push("--- COST OF SALES SUMMARY ---");
    const currencyKeys = [
      "total_nsv", "total_variable_comp", "base_commission_cost",
      "volume_bonus_cost", "tour_bonus_cost", "spiff_cost", "net_comp_cost",
    ];
    const percentKeys = ["comp_as_pct_nsv", "cost_ratio", "budget_variance_pct"];
    sections.push(formatRow(data.costSummary, currencyKeys, percentKeys));

    // Flag cost ratio if available
    const ratio = data.costSummary["comp_as_pct_nsv"];
    if (typeof ratio === "number") {
      if (ratio > 15) {
        sections.push(`[RISK FLAG – CRITICAL] Variable comp is ${formatPercent(ratio)} of NSV — exceeds 15% critical threshold.`);
      } else if (ratio > 12) {
        sections.push(`[RISK FLAG – HIGH] Variable comp is ${formatPercent(ratio)} of NSV — above the 12% budget ceiling.`);
      } else if (ratio < 8) {
        sections.push(`[RISK FLAG – LOW] Variable comp is ${formatPercent(ratio)} of NSV — below the 8% floor; possible under-investment.`);
      }
    }
    sections.push("");
  }

  // Tour Quality
  if (data.tourQuality && data.tourQuality.length > 0) {
    sections.push("--- TOUR QUALITY & VPG ---");
    const currencyKeys = ["vpg", "avg_deal_size", "total_nsv"];
    const percentKeys = ["close_rate", "a_b_lead_mix_pct"];
    const rows = data.tourQuality.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys, percentKeys)}`);
    });
    if (data.tourQuality.length > 8) {
      sections.push(`... and ${data.tourQuality.length - 8} more tour quality records (truncated).`);
    }
    sections.push("");
  }

  // Lead Performance
  if (data.leadPerformance && data.leadPerformance.length > 0) {
    sections.push("--- LEAD PERFORMANCE BY SOURCE ---");
    const currencyKeys = ["cost_per_closed_sale", "total_nsv", "avg_vpg"];
    const percentKeys = ["close_rate", "lead_mix_pct", "a_b_pct"];
    const rows = data.leadPerformance.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys, percentKeys)}`);
    });
    if (data.leadPerformance.length > 8) {
      sections.push(`... and ${data.leadPerformance.length - 8} more lead records (truncated).`);
    }
    sections.push("");
  }

  // ROI Analysis
  if (data.roiAnalysis && data.roiAnalysis.length > 0) {
    sections.push("--- SPIFF ROI ANALYSIS ---");
    const currencyKeys = ["spiff_cost", "incremental_nsv", "baseline_nsv"];
    const percentKeys = ["roi_ratio_pct"];
    const rows = data.roiAnalysis.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys, percentKeys)}`);
      // Flag sub-threshold ROI
      const ratio = row["nsv_to_spiff_ratio"];
      if (typeof ratio === "number" && ratio < 3) {
        sections.push(`    [RISK FLAG – HIGH] NSV:SPIFF ratio is ${ratio.toFixed(2)}:1 — below the 3:1 continuation threshold.`);
      }
    });
    if (data.roiAnalysis.length > 8) {
      sections.push(`... and ${data.roiAnalysis.length - 8} more ROI records (truncated).`);
    }
    sections.push("");
  }

  // Chargeback Exposure
  if (data.chargebackExposure && Object.keys(data.chargebackExposure).length > 0) {
    sections.push("--- CHARGEBACK & RESERVE EXPOSURE ---");
    const currencyKeys = [
      "open_reserve_balance", "net_chargeback_exposure",
      "recovered_ytd", "unrecovered_balance", "overpayment_risk",
    ];
    const percentKeys = ["reserve_release_pct", "recovery_rate_pct"];
    sections.push(formatRow(data.chargebackExposure, currencyKeys, percentKeys));
    sections.push("");
  }

  // Accrual Summary
  if (data.accrualSummary && Object.keys(data.accrualSummary).length > 0) {
    sections.push("--- ACCRUAL SUMMARY ---");
    const currencyKeys = [
      "total_accrual_this_month", "ytd_accrual", "ytd_actual_payout",
      "quarterly_trueup_variance", "open_accrual_reversals",
    ];
    const percentKeys = ["accrual_to_payout_variance_pct"];
    sections.push(formatRow(data.accrualSummary, currencyKeys, percentKeys));

    const variancePct = data.accrualSummary["accrual_to_payout_variance_pct"];
    if (typeof variancePct === "number" && Math.abs(variancePct) > 5) {
      sections.push(
        `[RISK FLAG – MEDIUM] Accrual-to-payout variance is ${formatPercent(variancePct)} — exceeds the 5% threshold requiring quarterly commentary.`
      );
    }
    sections.push("");
  }

  // Pay-For-Performance
  if (data.payForPerf && data.payForPerf.length > 0) {
    sections.push("--- PAY-FOR-PERFORMANCE ANALYSIS ---");
    const currencyKeys = ["total_comp", "nsv", "avg_deal_size", "comp_per_deal"];
    const percentKeys = ["comp_as_pct_nsv", "close_rate", "percentile_rank_pct"];
    const rows = data.payForPerf.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys, percentKeys)}`);
    });
    if (data.payForPerf.length > 8) {
      sections.push(`... and ${data.payForPerf.length - 8} more pay-for-performance records (truncated).`);
    }
    sections.push("");
  }

  sections.push("=== END OF CONTEXT ===");

  // Enforce ~4000 char budget
  const full = sections.join("\n");
  if (full.length > 4000) {
    return full.slice(0, 3950) + "\n... [context truncated to stay within token budget]";
  }
  return full;
}
