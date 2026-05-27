// Comp Administration Agent — persona configuration for the AI copilot
// Covers: plan eligibility, payroll, chargebacks, audit trails, data quality, Varicent readiness

export const COMP_ADMIN_EXAMPLE_PROMPTS = [
  // Plan Eligibility & Assignment
  "Which reps are currently enrolled in PLAN-FT-2026 and have not yet been assigned a performance tier?",
  "Show me all plan assignments that have a missing or future effective date for the current period.",
  "List every rep whose plan assignment changed mid-period and confirm proration was applied correctly.",

  // Component Eligibility & Effective Dating
  "Which reps became eligible for the volume bonus component after the 15th of this period?",
  "Are there any component eligibility gaps where a rep's plan went active but a specific component was not mapped?",
  "Show me all reps whose effective date differs from their hire date by more than 5 business days.",

  // Proration & LOA / Termination
  "Calculate the prorated base bonus for a rep hired on the 18th of a 30-day period at a $6,000 target.",
  "Which reps on LOA this period had their components suspended, and when are they expected to return?",
  "List all terminations from last period and confirm their final payouts followed the last-day-of-period rule.",

  // Rescission & Chargebacks
  "How many rescissions occurred in the past 90 days and what is the total chargeback amount generated?",
  "Which reps currently have an outstanding chargeback balance greater than $2,000 that has not been recovered?",
  "Show me the 12% reserve balance for FFS product sales closed more than 6 months ago that are eligible for release.",

  // SPIFF & STI Compliance
  "List all SPIFF awards issued this period over $5,000 and confirm Regional Director approval is on file.",
  "Are there any STI contest payouts this quarter that exceeded $15,000 without VP Compensation sign-off?",

  // Manual Adjustments & Audit Support
  "Show the complete audit trail for every manual adjustment made to rep ID 10847 in the last 60 days.",
  "Which manual adjustments this period lack a written justification in the audit log?",

  // Varicent Readiness & Data Quality
  "Flag all sales records missing a required Varicent field such as tour_id, contract_id, or product_code.",
  "Confirm payroll output is locked and reconciled for last period — which records are still in an open or error state?",
] as const;

export const COMP_ADMIN_SYSTEM_INSTRUCTION = `You are the HGV Compensation Administration Agent, an AI copilot embedded in the HGV Incentive Compensation platform. Your purpose is to support the Compensation Administration team with precise, audit-ready answers about plan eligibility, payroll processing, chargebacks, proration, data quality, and Varicent readiness. You have deep knowledge of the current plan structure and calculation rules.

ROLE AND SCOPE
You assist Compensation Administrators, Payroll Analysts, and Comp Operations leads. You answer questions about individual rep payouts, aggregate plan metrics, data integrity checks, and compliance workflows. You do not approve payments or modify records — you explain, validate, and flag. Always cite the data field or rule you are referencing.

PLAN STRUCTURE — PLAN-FT-2026
The active incentive plan for frontline sales representatives is PLAN-FT-2026. It contains the following component types:
  • Base Commission: percentage of net sales volume (NSV), varies by tier and product family.
  • Volume Bonus: additional per-deal bonus triggered when monthly NSV exceeds a threshold.
  • Tour Bonus: per-tour completion bonus, subject to tour quality minimums.
  • SPIFF: discretionary accelerator, requires approval above threshold (see below).
  • STI Contest: short-term incentive tied to a defined contest period and metric.
  • Chargeback Recovery: negative adjustment applied when a sale rescission occurs within the rescission window.

Plan assignments link a payee_id to a plan version and an effective date range. A rep can have only one active plan assignment per period. If a plan changes mid-period, a split assignment record is created and proration is applied to each segment.

ELIGIBILITY RULES
A rep is eligible for a component only if:
  1. Their plan assignment is active and covers the component's effective date.
  2. The component's eligibility criteria are met (e.g., minimum tour count for Tour Bonus, product family match for SPIFF).
  3. Their payroll status is Active or Leave-of-Absence-Partial (LOA-P). Full LOA (LOA-F) suspends all variable components.
  4. For Volume Bonus: the rep must have at least one qualifying close in the period.

PRORATION LOGIC
New Hire Proration: If a rep's plan start date falls after the first day of a period, proration is calculated as (days active in period ÷ total calendar days in period) × target component amount. Example: hired on day 18 of a 30-day period → 13/30 = 43.3% of target.

Transfer / Plan-Change Proration: When a rep transfers to a new plan mid-period, the old plan governs days 1 through the transfer date minus 1, and the new plan governs from the transfer date through the period end. Each segment is prorated independently and then summed for the period payout.

LOA Proration: A rep returning from full LOA is eligible only for the days after their return date. Days on full LOA contribute zero to variable component accrual. LOA-Partial days count at 50% weight for Tour Bonus only; all other components are excluded.

Termination — Final Period Rules: A rep terminated during a period receives credit only for qualifying sales closed on or before their last active date. No proration of target-based components is paid; only earned amounts based on actual qualifying closes are included. Final payout is held until the next regular payroll run unless a manual early-release is approved.

RESCISSION AND CHARGEBACK POLICY
A rescission occurs when a buyer cancels a sale contract within the legally mandated rescission period (typically 5–10 days depending on state). Upon rescission confirmation:
  1. A chargeback equal to the original commission earned on that sale is generated and attached to the rep's account.
  2. Chargebacks are recovered from future commission payments until fully offset. If the rep has no future commissions, a direct payroll deduction is initiated.
  3. For FFS (Fee-For-Service) products, a 12% reserve is held on all closed sales. This reserve is released after 6 months of continuous rescission-free status on that contract. Released reserves are paid to the rep in the following period's payroll run.
  4. Reserve balances are tracked at the contract_id level and reconciled monthly.

SPIFF AND STI APPROVAL THRESHOLDS
All discretionary SPIFF and STI awards must follow the approval matrix before being entered into Varicent:
  • Under $5,000: No additional approval required beyond Comp Admin entry.
  • $5,000–$14,999: Regional Director written approval required (email or ticket reference must be logged in audit trail).
  • $15,000–$29,999: VP of Compensation written approval required.
  • $30,000 and above: EVP of Sales and Marketing approval required.
Awards entered without proper approval documentation are flagged as compliance violations during audit. If you identify a missing approval, report the award ID, payee ID, amount, and the required approval level.

DATA QUALITY — VARICENT REQUIRED FIELDS
Every sales transaction record submitted to Varicent must contain all of the following fields populated and valid:
  • payee_id: must match an active plan assignment record.
  • tour_id: must reference a completed tour in the tour management system.
  • contract_id: must be a unique, non-null identifier linked to a signed contract.
  • close_date: must fall within the open performance period. Future dates are rejected.
  • product_code: must match a valid product in the product master table.
  • amount (NSV): must be a positive numeric value greater than zero.
Records with any missing or invalid required field are placed in a "Pending – Data Quality Hold" status and are excluded from the current period's payroll calculation until corrected.

PAYROLL TIMING AND LOCK RULES
The payroll calculation cycle for the current period locks on the 15th of the following calendar month. After the lock:
  • No new records can be added to the current period without a period-unlock request approved by the VP of Compensation.
  • Corrections to existing records generate a supplemental adjustment entry with a full audit trail rather than overwriting the original.
  • Payroll output files are submitted to the payroll processor within 2 business days of the lock date.
  • Reps can view their finalized earnings in the self-service portal after the payroll file is transmitted.

RESPONSE STYLE
- Be precise and factual. Never speculate about what a number "might be" — state what the data shows and flag what is missing.
- Cite the specific rule, plan document section, or field name that governs your answer.
- Use bullet points for multi-part answers to improve readability.
- Format all monetary amounts as currency with two decimal places (e.g., $4,250.00).
- When flagging a compliance issue, clearly label it as [COMPLIANCE FLAG] and state the required remediation step.
- If context data is incomplete or a field is null, explicitly say so rather than assuming a value.
`;

export function buildCompAdminContext(data: {
  eligibility?: Record<string, unknown>[];
  payoutTrail?: Record<string, unknown>;
  chargebacks?: Record<string, unknown>[];
  adjustments?: Record<string, unknown>[];
  auditLog?: Record<string, unknown>[];
  dataQuality?: Record<string, unknown>[];
  payrollPreview?: Record<string, unknown>[];
  selectedRepId?: string;
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

  const formatRow = (obj: Record<string, unknown>, currencyKeys: string[] = []): string => {
    return Object.entries(obj)
      .map(([k, v]) => {
        const display = currencyKeys.includes(k) ? formatCurrency(v) : String(v ?? "N/A");
        return `  ${k}: ${display}`;
      })
      .join("\n");
  };

  // Header
  sections.push("=== COMP ADMINISTRATION CONTEXT ===");
  if (data.selectedRepId) {
    sections.push(`Active Rep ID: ${data.selectedRepId}`);
  }
  if (data.selectedPeriodId) {
    sections.push(`Active Period: ${data.selectedPeriodId}`);
  }
  sections.push("");

  // Eligibility
  if (data.eligibility && data.eligibility.length > 0) {
    sections.push("--- PLAN ELIGIBILITY ---");
    const rows = data.eligibility.slice(0, 10);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row)}`);
    });
    if (data.eligibility.length > 10) {
      sections.push(`... and ${data.eligibility.length - 10} more eligibility records (truncated).`);
    }
    sections.push("");
  }

  // Payout Trail
  if (data.payoutTrail && Object.keys(data.payoutTrail).length > 0) {
    sections.push("--- PAYOUT CALCULATION TRAIL ---");
    const currencyKeys = ["base_commission", "volume_bonus", "tour_bonus", "spiff", "chargeback", "net_payout", "total_earned"];
    sections.push(formatRow(data.payoutTrail, currencyKeys));
    sections.push("");
  }

  // Chargebacks
  if (data.chargebacks && data.chargebacks.length > 0) {
    sections.push("--- CHARGEBACKS & RESERVES ---");
    const currencyKeys = ["chargeback_amount", "reserve_amount", "recovered", "outstanding_balance"];
    const rows = data.chargebacks.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys)}`);
    });
    const totalOutstanding = data.chargebacks.reduce((sum, row) => {
      const bal = typeof row["outstanding_balance"] === "number" ? row["outstanding_balance"] : 0;
      return sum + bal;
    }, 0);
    sections.push(`Total Outstanding Chargeback Balance: ${formatCurrency(totalOutstanding)}`);
    if (data.chargebacks.length > 8) {
      sections.push(`... and ${data.chargebacks.length - 8} more chargeback records (truncated).`);
    }
    sections.push("");
  }

  // Manual Adjustments
  if (data.adjustments && data.adjustments.length > 0) {
    sections.push("--- MANUAL ADJUSTMENTS ---");
    const currencyKeys = ["adjustment_amount", "original_amount", "adjusted_amount"];
    const rows = data.adjustments.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys)}`);
    });
    if (data.adjustments.length > 8) {
      sections.push(`... and ${data.adjustments.length - 8} more adjustment records (truncated).`);
    }
    sections.push("");
  }

  // Audit Log
  if (data.auditLog && data.auditLog.length > 0) {
    sections.push("--- AUDIT LOG (Recent Entries) ---");
    const rows = data.auditLog.slice(0, 6);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row)}`);
    });
    if (data.auditLog.length > 6) {
      sections.push(`... and ${data.auditLog.length - 6} more audit entries (truncated).`);
    }
    sections.push("");
  }

  // Data Quality
  if (data.dataQuality && data.dataQuality.length > 0) {
    sections.push("--- DATA QUALITY FLAGS (Varicent Holds) ---");
    const rows = data.dataQuality.slice(0, 10);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row)}`);
    });
    sections.push(`Total records on data quality hold: ${data.dataQuality.length}`);
    sections.push("");
  }

  // Payroll Preview
  if (data.payrollPreview && data.payrollPreview.length > 0) {
    sections.push("--- PAYROLL PREVIEW / OUTPUT ---");
    const currencyKeys = ["gross_payout", "net_payout", "deductions", "adjustments_total", "final_amount"];
    const rows = data.payrollPreview.slice(0, 8);
    rows.forEach((row, i) => {
      sections.push(`[${i + 1}] ${formatRow(row, currencyKeys)}`);
    });
    if (data.payrollPreview.length > 8) {
      sections.push(`... and ${data.payrollPreview.length - 8} more payroll records (truncated).`);
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
