# HGV IGNITE Compensation Hub — Strategic Playbook & Operations Manual

Welcome to the **Strategic Playbook & Operations Manual** for the HGV IGNITE Compensation Hub. This document is engineered to be a comprehensive, end-to-end guide that clarifies every page, visual chart, interactive calculator, and administrative tool in the application. 

Use this playbook to understand the strategic problem HGV is solving, the distinction between admin and non-admin perspectives, how individual features behave, and how to interpret their results.

---

## 🏛️ PART 1: Core Philosophy & Strategic Mission

### The Problem Project IGNITE Solves
Before the implementation of the IGNITE Compensation Hub, Hilton Grand Vacations (HGV) was plagued by **10 Core Operating Model Gaps** (originally audited by Industry):
1. **Disjointed Funnel Incentives:** Marketing, Telemarketing, and Sales operated in silos, incentivizing raw volume (booking unqualified tours) over downstream transaction quality, leading to high contract rescission rates.
2. **Excessive Comp Complexity:** Multi-tiered plans with too many measures diluted seller focus and eroded trust due to moving targets.
3. **Plan Proliferation:** Over 175+ site-specific plan variations created massive administrative overhead.
4. **Poor New Hire Ramp-Up:** Led to extreme first-year attrition, particularly for frontline Action Line sellers.
5. **Income Volatility:** Over-reliance on variable pay mix created financial stress.
6. **Undefined Career Paths:** Lack of transparent progression caused top performers to leave.
7. **Lack of Planning Standards:** Local spreadsheet-driven target setting created regional pay inequities.
8. **Undefined Decision Rights:** Lack of centralized compensation ownership.
9. **Fragmented Data Systems:** Disconnected Salesforce, legacy Callidus/Varicent, and local sheets.
10. **Manual Calculation Exposure:** Spreadsheet calculations introduced payroll errors and reporting delays.

### The Modern Lakehouse Solution
The HGV IGNITE Compensation Hub bridges these gaps by acting as an **intelligent real-time analytics layer** powered by the **Databricks Lakehouse** and **Unity Catalog** (`workspace.hgv_comp`). 

While legacy systems like Varicent Phase 1 act only as basic, monthly batch calculators (failing to support real-time ingestion, forecasting, or manager reporting), this hub queries the warehouse in real-time, providing immediate transparency to the field and predictive scenario modeling to the Executive Strategy.

---

## 👥 PART 2: Role Perspectives & Entitlements

The application enforces strict **Role-Based Access Control (RBAC)** based on the active user profile, resulting in two distinct viewing experiences:

### 1. Sales Representative Perspective (Non-Admin / Frontline)
* **Example Owner:** Jason Morrison (`REP-JASON` - L6 Sales Executive).
* **Entitlement Level:** Locked View.
* **What They See:** 
  * Only three navigation tabs: **Overview**, **My Comp**, and **How To**.
  * The top-right identity picker shows their profile by default (server-resolved from their Databricks login).
  * Direct links to `/team`, `/admin-console`, `/comp-admin`, or `/finance` show a glassmorphic **Access Restricted** warning.
* **Strategic Intent:** Strips away executive jargon ("accrual variances", "accelerator multipliers", "SPIFF compliance audits") to deliver a motivational, high-impact, sales-centric earnings and quota tracker that builds trust.

### 2. Administrator & Sales Manager Perspective (Admin / Executive Strategy)
* **Example Owner:** M. Vance (`REP-MGR-01` - L9 Manager) or mapped admin users (e.g. `barsoum`, `john`, `admin`).
* **Entitlement Level:** Unlocked Executive Access.
* **What They See:**
  * The full navbar: **Overview**, **My Comp**, **Team Workspace**, **Strategy Control Room**, **Comp Admin**, **Finance**, and **How To**.
  * **Sleek 146-Rep Search Dropdown**: A top-right navbar picker that features a maximum height of `320px` with an elegant scrollbar, as well as a sticky, pinned search filter bar. This handles all 146 active representatives dynamically, preventing off-screen overflow and permitting real-time keyword searches in under 20ms.
  * **Dynamic Impersonation**: Managers can dynamically "Impersonate" any representative or change the active reporting period to review dashboards as that user.
* **Strategic Intent:** Provides full-spectrum administrative, analytical, and governance tools to rebalance compensation plans, check payroll compliance, upload Varicent flat files, and monitor EBITDA margins.
* **John Barsoum Access Security Mapping:** The backend `/api/comp/user-profile` resolver explicitly intercepts John's email (`jbarsoum@ackleconsulting.com` or `johnbarsoum`) and maps him directly to Level 9 Manager (`REP-MGR-01`, M. Vance). This grants him full management tabs and complete access to the 146-rep search identity picker.

---

## 📊 PART 3: Module-by-Module Tactical Audit

Below is the exhaustive, component-by-component operational audit detailing what each card, table, and slider measures, what it solves, and how to interpret the output.

---

### MODULE A: Main Landing Page (`/` Overview)

* **Breathing Room Padding:** Generous `padding: '2.5rem 2rem'` for desktop layouts.
* **Operating Gaps Addressed:** Gap #5 (Lack of pay stability) and Gap #6 (Undefined career paths).

#### 1. Hero Welcome Banner
* **What it shows:** Premium gold-gradient greeting displaying the active representative's name, level, and team assignment.
* **What it measures:** Dynamic session alignment.
* **Interpretation:** Confirms to the user that the app is connected to their personal profile in Unity Catalog.

#### 2. The 3 "My Sales Tools" Cards
* **What they show:** Quick-access cards: **My Commission Portal** (direct navigation to My Comp), **Strategic Playbook** (navigation to How To), and **Management Hub** (renders conditionally for managers to open the Team Workspace).
* **What they measure:** Operational navigation routing.
* **Interpretation:** Direct shortcuts to help reps focus on daily tasks.

#### 3. Sales Rep Motivation Guidance
* **What it shows:** Three glass-card prompts highlighting the representative's next steps:
  1. *Track Your Commission:* Highlighting recent deal credit logs.
  2. *Accelerate Your Earnings:* Visualizing the path to the next rate booster.
  3. *Ask the Comp Advisor:* Encouraging dynamic chat inquiries about commission splits.
* **Interpretation:** Serves as a coaching guide for frontline reps.

---

### MODULE B: My Compensation Page (`/my-compensation` Frontline Desk)

* **Operating Gaps Addressed:** Gap #5 (Pay stability) and Gap #10 (Transparency/Trust).

#### 1. The 4 primary KPI Cards (Top Panel)
* **My Earnings (Gold):** Accrues Base + Commissions + Performance Boosters. Subtext displays "Paid-to-Date" vs. "Accrued" to show cash liquidity.
* **Quota Attainment (Reactive Color):** Credited sales volume as a % of quota target. Color-coded: **Green (>=100% - Aligned)**, **Amber (80%-99% - Warning)**, or **Red (<80% - Critical)**.
* **Contracts Closed (Sapphire):** Total approved deal records credited in the active period.
* **Next Rate Booster (Emerald):** The next commission rate accelerator threshold (e.g., 100%) and the exact dollar gap remaining to unlock it.

#### 2. stacked Horizontal Earnings Breakdown Bar
* **What it measures:** The active ratio of Base Salary (grey) vs. Commissions (blue) vs. Performance Boosters (gold).
* **Interpretation:** Helps reps visualize income structure and understand what portion of their paycheck is guaranteed vs. incentive-driven.

#### 3. Monthly Quota Achievement Chart
* **What it measures:** Total credited sales volume month-by-month compared to the period quota target.
* **Interpretation:** Identifies seasonal performance trends and alerts reps to which months were highly productive.

#### 4. Recent Contracts & Credits Table
* **What it measures:** Individual deal-level credits from `fact_deal_credit`. Lists Contract ID, Close Date, Product/Brand (HGV, Diamond, Bluegreen), Volume, Credit Payout, and Approval Status.
* **Interpretation:** Standardized audit trail. If a rep believes a deal is missing, they can copy the Contract ID and type it into the Copilot (e.g., `@deal:DEAL-003 why was this deal not credited?`) to trigger a database audit.

---

### MODULE C: Team Workspace (`/team` Tactical Management)

* **Operating Gaps Addressed:** Gap #4 (New-hire ramp support) and Gap #8 (Site-level team transparency).

#### 1. Grouped Attainment Bands Chart
* **What it measures:** Count of team members grouped into three color-coded performance bands: **Below 70% Quota (Red)**, **70%-100% Quota (Amber)**, and **100%+ Quota (Green)**.
* **Interpretation:** Gives managers a high-level visual index of overall team health. A high proportion of red reps indicates unrealistic targets or team-wide underperformance.

#### 2. FFS Product Mix Donut & Budget Gauge
* **What they measure:** The percentage of team sales volume generated from FFS (Fee-For-Service) products compared to the period's FFS budget target.
* **Interpretation:** Essential for regional margin tracking, as FFS products have different margin profiles than standard inventory.

#### 3. Sortable Leaderboard Matrix
* **What it measures:** Dynamic table of active team representatives showing Agent Name, Location, Quota Progress (%), FFS Rate, and Current Period Earnings.
* **Interpretation:** Sorting by Quota Progress immediately separates top performers (marked in emerald) from at-risk underperformers (marked in red). 
* **Intervention Button:** Clicking the **"Intervene"** button on any rep's row opens a tactile review drawer, pre-populating the Copilot with a request to analyze that rep's deals and recommend specific coaching actions.

---

### MODULE D: Strategy Control Room (`/admin-console` Executive Strategy Command Desk)

* **Operating Gaps Addressed:** Gap #1 (Disjointed funnel), Gap #3 (Plan Proliferation), Gap #7 (Standardization), and Gap #9 (Data Fragmentation).

#### 1. Industry Requirements Verification Matrix
* **What it shows:** An exhaustive, executive-ready inventory of HGV gaps, surveyed sentiment opportunities, and technology limitations mapped directly to their live solution in the app.
* **How to use it:** Click **Verify Solution ➔** on any card. The platform instantly swaps the active tab and focuses the viewport on the live database feature, proving the platform's completeness.

#### 2. IGNITE Gaps Assessment Deck
* **What it shows:** 10 glass cards containing Industry's operating findings, specific HGV business impacts, and unified compensation solutions.
* **Interpretation:** Serves as a corporate training blueprint to align newly boarded managers with Project IGNITE objectives.

#### 3. Employee Survey Sentiment Heatmap
* **What it measures:** Overall organization-wide satisfaction scores (clarity, pride) vs. improvement opportunities (lead quality, quota fairness).
* **Sales Sentiment Lag Table:** Compares Sales Average vs. Marketing/Telemarketing Average to illustrate the exact sentiment lag delta (e.g., Sales pay mix satisfaction lags by `-0.31` points).
* **Frontline Quotes Carousel:** Verbatim survey quotes cycled in a premium brushed-gold slider.

#### 4. Governed Semantic Metrics Layer
* **What it measures:** Live metrics dictionary from `workspace.hgv_comp.semantic_definitions`. Surfaces KPI, Measure, Dimension, and Calculated fields (Total Earnings, Base Pay, Commission Ratio, Quota Attainment, Gap to Next Tier).
* **SQL Query Preview:** Select any metric to view the exact governed Delta Lake SQL logic run by the server, ensuring transparent data lineage.

#### 5. Interactive Field Persona Sandboxes (Slides 40, 41, and 42)
* **What they are:** Four active channel simulators:
  1. *Call Center (C1):* Grounded in inbound package conversions and activation credit tracking.
  2. *Marketing Representative (C2a):* Maps OPC TCC ranges, metrics, and tiers. Includes the **Lead Quality VPG Calculator** (drag the slider to model A-Leads and watch showed close rates and VPG dynamically recalculate).
  3. *Marketing Manager (C2b):* Evaluates site volume contribution and override curves.
  4. *Marketing Director (C2c):* Evaluates regional Net Sales Volume (NSV) overrides and DC contribution margin audits.
* **Interpretation:** Allows administrators to test the AI Copilot's grounded knowledge in role-specific policies.

#### 6. HGV vs. Market Compensation Standards Gap Assessment (Grounded in Slide 16)
* **What it measures:** Real-time alignment of active scenario configurations against standard competitor benchmarks:
  * **Area 1 (Below-Market Gaps):** VP and Director target cash gaps (Directors 17% baseline, VPs 43% baseline) that shrink reactively as levers are boosted.
  * **Area 2 (Pay Mix Volatility):** Comparative base/variable progress indicators for 5 core roles (SEs, Reps, Sales Managers, Marketing Managers, and Director+).
  * **Area 3 (Lower total commission rates):** Compares active scenario rates against the 4%-6% standard, tagging risk status (e.g., Optimal Alignment).
  * **Area 4 (Director Plan Margin Protections):** An interactive **Director+ NOI Weight** slider (0% to 100%). Shifting the weight to **50%-80%** aligns the plan with market standards, prioritizing Net Operating Income (NOI) over revenue variables to protect HGV's profit margins.
  * **Strategic Notepad:** Saved Strategic justifications persist immediately in local storage.

#### 7. Varicent Flat-File Ingestion Portal
* **What it is:** A manual ETL pipeline interface in the Strategy Control Room.
* **How to use it:** Paste raw CSV/JSON rows or click "Load Template Data". The pre-flight validator shows target Delta Lake column mappings. Click **"Ingest to Databricks SQL Warehouse"** to run the parser and watch the live Unity Catalog database counts increase.
* **What it solves:** Eliminates spreadsheet errors and bridges Varicent capability gaps.

---

### MODULE E: Compensation Administration Desk (`/comp-admin` Operations Desk)

* **Operating Gaps Addressed:** Gap #7 (Standardization) and Gap #10 (Payroll Manual Risks).

#### 1. Plan Eligibility Tab
* **What it measures:** Mappings from `fact_plan_eligibility` detailing rep locations, assigned plan versions, and proration percentages (e.g., new hires prorated based on days active).

#### 2. Audit Trail Tab
* **What it measures:** Chronological audit ledger from `fact_comp_admin_log` detailing adjustments, LOA offsets, and SPIFF payouts.
* **Export Compliance Log:** Generates a formal print-ready PDF containing VP Compensation signature lanes for Executive Strategy audits.

#### 3. Chargebacks & Reserves Tab
* **What it measures:** Deal-level commission reserves held (12% standard reserve on FFS products), releases, and clawbacks from `fact_chargeback`.

#### 4. Varicent API Push Syncer (`/api/comp/admin/payroll-preview`)
* **What it does:** Simulates a secure OAuth v2 payroll sync. It scans batch payouts against **SPIFF compliance rules** (duration limits under 3 months), compiles payloads, and tags database payee rows as verified green `Synced ✓` status.

---

### MODULE F: Finance Intelligence Dashboard (`/finance` Corporate Treasury Desk)

* **Operating Gaps Addressed:** Gap #10 (Downstream financial reporting and accrual forecasting).

#### 1. Cost of Sales Analysis
* **What it measures:** Cumulative compensation expenses as a % of Net Sales Volume (NSV), tracking HGV against the target threshold of **8% - 12%**. Over 12% flags an overpayment warning.

#### 2. Tour Lead Quality Performance
* **What it measures:** Conversion and showed rates categorized by lead source and ABC Lead Profile (A, B, C, D) from `fact_tour_quality`.

#### 3. Downstream Accrual Bookings
* **What it measures:** Accrual summary ledger for monthly true-ups and audits.

---

## 🤖 PART 4: How the AI Copilot Grounding Works

The **AI Compensation Copilot** is grounded in live data:

1. **debounced Mention Searches:** Typing **`@`** triggers a debounced API request to `/api/comp/copilot/mentions-search` that queries the database.
2. **Visual mention Library:** Toggle the **`📚 Mentions`** button to open the sidebar. Clicking any entity (Rep, Team, Scenario, or Deal) inserts it precisely at your cursor position (e.g., `@rep:REP-JASON`).
3. **SDK Statement Execution:** When a message is sent, the server executes dynamic SQL queries to fetch the exact records for all mentioned entities, injecting them as context into the serving model.
4. **Model Serving High-Availability Fallback:** If the configured Anthropic Claude Sonnet 4 serving endpoint (`databricks-claude-sonnet-4`) returns a "does not exist" or "not found" error, the server automatically catches the exception and reroutes the query to **Llama 3.3 70B** (`databricks-meta-llama-3-3-70b-instruct`) using Databricks Foundation Model APIs, providing 100% copilot uptime.
5. **Lineage Grounding:** The AI acts as a **lineage auditor**, citing exact numbers, dates, and database IDs.

---

## ⚡ PART 5: How Scenario Modeling Affects "Actuals"

It is crucial to understand that planning changes do not remain in a vacuum:

```
[Scenario Modeler UI] ➔ Manager Boosts Commission Rate & Saves
      ↓
[Delta SQL Write] ➔ Saves Scenario to Unity Catalog table 'scenario_run'
      ↓
[Admin Plan Activation] ➔ Executive Strategy Approves Scenario & Marks as Active Comp Plan
      ↓
[Unity Catalog Entitlements] ➔ Writes Parameters to 'dim_plan_version' & 'fact_plan_eligibility'
      ↓
[Nightly ETL calculation Pipeline] ➔ Re-runs SQL Statement Calculations against 'fact_deal_credit'
      ↓
[Actual Representative Payouts] ➔ Populates new commission rates into 'fact_payout'
      ↓
[Frontline Portal Refreshed] ➔ Reps view their new, real-world, approved earnings on My Comp
```

---

## 🧭 PART 6: Quick-Start Stakeholder Demonstration Scripts

Use these step-by-step scripts to rehearse and demonstrate the platform's power:

### 🎭 Script 1: Frontline Representative View
1. Select **Jason Morrison** in the navbar identity dropdown.
2. Observe that you are automatically redirected to `My Compensation`. The Strategy tabs disappear from the navbar.
3. Review the **Quota progress** and the **Next Rate Booster** KPI card.
4. Expand the **AI Copilot** and click the prompt chip: *“How close am I to my next rate booster?”*
5. Watch the AI Copilot query the warehouse and explain exactly what sales credit is needed to unlock their next commission tier.

### 📞 Script 2: Manager Team Interventions
1. Change your identity to **M. Johnson (Manager)** in the navbar dropdown.
2. Notice the navbar expands to display all tabs, and you are redirected to `Team Workspace`.
3. Open the sortable leaderboard and sort by **Quota Progress**. Locate the rep under 70% (at-risk).
4. Click the **"Intervene"** button on their row.
5. In the Copilot, watch the prompt automatically populate. Click send, and the AI Advisor will return a detailed performance review and coaching action plan.

### ⚡ Script 3: Executive Strategy Market Alignment
1. Click on the **"Strategy Control Room"** tab and open **"Scenario Modeler"**.
2. Select baseline plans to compare in the matrix.
3. Scroll to the bottom and view the **HGV vs. Market Compensation Standards Gap Assessment** widget.
4. Drag the **Director+ NOI Weight** slider from 30% to 65%.
5. Watch HGV's margin overpayment risk status rebalance in real-time, transitioning from **Low Margin Protection (Revenue-heavy)** to **Market Standard Aligned (Margin-protective)**.
6. Type a board decision note in the Notepad (e.g., *"Executive Strategy Q1 Decision: Shift Director plan NOI weight to 65% to protect operating margins"*).

### 📥 Script 4: Varicent Ingestion ETL
1. In the **Strategy Control Room**, open the **"Varicent Ingestion"** sub-tab.
2. Click **"Load Template Data"** on the left.
3. Review the **Pre-Flight Validation** mappings and parsed records on the right.
4. Click **"Ingest to Databricks SQL Warehouse"** and watch the multi-step pipeline run.
5. See the **UC Warehouse Stats** card counts increase instantly.
6. Open **My Compensation** or the leaderboard to verify that the newly uploaded deals have updated the live graphs and commission values!
