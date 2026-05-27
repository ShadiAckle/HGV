# HGV IGNITE Compensation Hub — Exhaustive Visual & Database Element Dictionary

This master catalog serves as the absolute, single-source dictionary for every visual layout, user viewport, card, table, chart, button, input control, and database call inside the **HGV IGNITE Compensation Hub**. 

---

## 🏛️ SECTION 1: Global Application Layout & Shell (`App.tsx`)

The global layout provides a dark-glass luxury dashboard shell that surrounds all operational views. 

### 1. The Sticky Glass Header (`.sticky-header-glass`)
*   **Visual Representation & Styling:** A floating glass navbar (`sticky top-0`, `height: 56px`, `padding: 0 2.5rem`) rendered in dark oklch sapphire theme (`bg-background/88` opacity). Diffused with a massive `backdrop-blur-xl` (24px) to render underlying page content unreadable on scroll while preserving transparency. A bottom border of `border-glass-border` (1px oklch gold-tinted wireframe) frames the navbar.
*   **Key Controls:**
    1.  **Brand Badge:** A linear gradient square (`135deg, var(--primary) 0%, #3D82FF 100%`) with high-contrast text "HGV" and oklch gold subtitle "IGNITE Compensation Hub".
    2.  **Navigation Links (`NavLink`):** Renders **Overview**, **My Comp**, **Team Workspace** (managers only), **Strategy Control Room** (managers only), **Comp Admin** (managers only), **Finance** (managers only), and **How To**. Active links apply a scale animation (`scale-[1.02]`) and brushed-gold highlight (`active-nav`).
    3.  **Period Picker Dropdown:** A solid select picker (`bg-[#090d16]`, `border-border`) featuring custom styling to prevent invisible text on Windows/Chrome. Displays active period labels (e.g. "Q1 2025").
    4.  **Identity Impersonation Dropdown:** Renders a user avatar badge (`var(--primary-muted)`) and name. Clicking expands a custom, solid-background dropdown listing all active reps with their role levels.
    5.  **Live Status Pulse:** A green LED indicator (`bg-success`) pulsing dynamically (`animation: pulse-dot 2s infinite`) to verify active websocket/database link.
*   **Database Calls & API Endpoints:**
    *   Queries `GET /api/comp/metadata` on mount to fetch lists of reps, teams, and periods.
    *   *Delta SQL Query:* `SELECT rep_id, rep_name, level_code FROM workspace.hgv_comp.dim_rep ORDER BY rep_name ASC` and `SELECT period_id, period_label FROM workspace.hgv_comp.dim_period ORDER BY period_id ASC`.
*   **Operating Gap Addressed:** Gap #8 (Undefined decision rights and localized governance) and Gap #10 (Transparency of statements).

### 2. Sticky Data Lineage Footer (`App.tsx` Footer)
*   **Visual Representation & Styling:** Border-top `border-border/10`, horizontal padding `1.5rem`, typography size `10px` monospaced.
*   **Visual Badges:**
    1.  *Data Catalog Badge:* A green dot with monospaced text reading `workspace.hgv_comp · Databricks Unity Catalog`, validating real-time schemas.
    2.  *LLM Endpoint Badge:* Monospaced text: `Claude Sonnet 4 via Model Serving` (reactively drops to Llama 3.3 instruct if route fails).
*   **Operating Gap Addressed:** Gap #9 (Fragmented data ecosystems and manual spreadsheet stitchings).

---

## 📊 SECTION 2: Frontline Landing Page (`CompOverviewPage.tsx`)

*   **Padded Container:** Standardized outer padding `padding: '2.5rem 2rem'` with vertical stack spacing `space-y-16`.

```
+------------------------------------------------------------------------+
|  [Gold Tag] Strategy & Performance                                     |
|  [H1 Heading] HGV IGNITE Executive Dashboard                           |
|  "Natural language compensation intelligence over Databricks..."       |
+------------------------------------------------------------------------+
|  [Card 1: Personal Payouts]   [Card 2: Team Leaderboard] [Card 3: Help]|
|  - View compensation          - Manager team workspace   - Learn formulas|
|  - Real-time deal list        - Sortable leaderboard    - E2E smoke tests|
+------------------------------------------------------------------------+
```

### 1. Welcome Hero Area
*   **Visual Styling:** Dark-glass panels overlaid with a soft amber-sapphire gradient glow (`from-amber-500/10 to-primary/10`). Left border highlighted with oklch gold stripe (`border-l-4 border-hgv-gold`).
*   **Operating Gap Addressed:** Gap #5 (Pay stability and new-hire confusion).

### 2. Operational Action Cards Grid
*   **Visual Styling:** Three columns (`grid md:grid-cols-3 gap-8`), styled using `.glass-card` with custom padding (`padding: '2.5rem 2rem'`). Icon containers use sapphire/gold glow backdrops.
*   **Visual Outputs & Sub-elements:**
    1.  **"Personal Compensation Portal" Card:** Displays oklch blue `Wallet` icon, subtext detailing active payout records. Includes a hover-scale gold trigger button: `Go to My Compensation ➔`.
    2.  **"Team Workspace Console" Card (Conditional):** Displays oklch green `Users` icon. Visible only to managers, mapping to `/team`. Includes button: `Open Management Hub ➔`.
    3.  **"Strategic Playbook" Card:** Displays oklch gold `BookOpen` icon, mapping to `/how-to`. Includes button: `Open Documentation ➔`.
*   **Operating Gap Addressed:** Gap #6 (Undefined career paths).

### 3. Sales Representative Motivational Guides
*   **Visual Styling:** Spacious grid (`grid md:grid-cols-3 gap-8`) with top margin `marginTop: '4.5rem'`.
*   **The 3 Guidance Cards:**
    1.  *Track Commission:* Blue-themed card with `ClipboardCheck` icon.
    2.  *Accelerate Earnings:* Emerald-themed card with `TrendingUp` icon.
    3.  *Grounded AI Copilot:* Gold-themed card with `Sparkles` icon.
*   **Interpretation:** Directs rep focus toward performance goals (FFS mix target and rate boosters).

### 4. Official Earnings Record Disclaimer Banner
*   **Visual Styling:** Dark glass panel with warning border `border-glass-border`, layout margin `marginTop: '4.5rem'`, padding `padding: '2.25rem 2rem'`.
*   **Interpretation:** Outlines HGV compliance policy—confirming that the data is an official earnings record synced nightly from audited transactional delta warehouses.

---

## 💸 SECTION 3: My Compensation Portal (`MyCompensationPage.tsx`)

Designed for frontline sales executives (Jason Morrison) to view statements and get AI coaching.

### 1. KPI Cards Panel (Top Panel)
*   **Visual Styling:** Luxury layout grid (`grid gap-6 md:grid-cols-4`) composed of 4 premium glass cards. Hovering scales cards (`hover:scale-[1.02]`) and shifts value text to primary sapphire.
*   **Individual KPI Cards & Formulas:**
    1.  **"My Earnings" Card (Gold theme):** Displays calculated sum of Base + Commissions + Boosters. Subtext matches `paid_to_date` vs. `accrued` cash.
    2.  **"Quota Attainment" Card (Reactivity color):** Value = `(credited_amount / quota_amount) * 100`. Trend indicator uses progress colored dot: **Green (>=100% - Aligned)**, **Amber (80%-99% - Warning)**, or **Red (<80% - Critical)**.
    3.  **"Contracts Closed" Card (Sapphire theme):** Count of deals where `status = 'APPROVED'`.
    4.  **"Next Rate Booster" Card (Emerald theme):** Computes difference between current attainment and next accelerator tier (e.g. `$15,000 to next level`).
*   **Database Calls:**
    *   Queries endpoint `GET /api/comp/rep/:repId/summary?period_id=:periodId`.
    *   *Delta SQL Query:* `SELECT total_earnings, paid_to_date, credited_amount, quota_amount, deals_count FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = :repId AND period_id = :periodId`.

### 2. Horizontal Stacked Earnings Breakdown Bar
*   **Visual Representation:** A segmented bar graph showing Base Salary (grey), Commissions (sapphire), and Boosters (gold). Hovering highlights segments with oklch glow overlays.
*   **Interpretation:** Represents ratio of pay-mix volatility. If the grey base bar is very thin compared to the sapphire variable bar, the rep is highly exposed to commission volatility.
*   **Database Calls:**
    *   Queries `GET /api/comp/rep/:repId/payout-breakdown?period_id=:periodId`.
    *   *Delta SQL Query:* `SELECT base_pay, commission_pay, bonus_pay FROM workspace.hgv_comp.fact_payout WHERE rep_id = :repId AND period_id = :periodId`.

### 3. Quota Achievement Monthly Bar Chart
*   **Visual Representation:** Grouped vertical bar columns mapping month-by-month sales volume against the target quota line. Blue bars denote live database data; grey bars show fallback estimates.
*   **Operating Gap Addressed:** Gap #5 (Unpredictable earnings and volatility).

### 4. Recent Contracts Table
*   **Visual Representation:** Clean grid layout with luxury headers (`padding: '1rem 1.25rem'`) and row items (`padding: '1.125rem 1.25rem'`). Rows match color codes: **Green (Closed/Approved)**, **Amber (Pending)**.
*   **Underlying Data Columns:** Contract ID, Close Date, Property Brand (HGV/BG/Diamond), Sales Volume, Rep Credit Payout, Status.
*   **Database Calls:**
    *   Queries `GET /api/comp/rep/:repId/deals?period_id=:periodId`.
    *   *Delta SQL Query:* `SELECT deal_id, close_date, brand, sales_volume, credit_amount, status FROM workspace.hgv_comp.fact_deal_credit WHERE payee_id = :repId AND period_id = :periodId ORDER BY close_date DESC`.

---

## 📞 SECTION 4: Team Performance Workspace (`TeamPerformancePage.tsx`)

Designed for sales managers (M. Johnson) to track site volumes and intervene in deal pipelines.

```
+------------------------------------------------------------------------+
|  [KPI 1: Team Attainment] [KPI 2: Top Performers] [KPI 3: At-Risk Reps] |
+------------------------------------------------------------------------+
|  [Leaderboard Table]                                                   |
|  - REP-DLEE   | Orlando  | 104.2% Quota | 22.4% FFS | [Intervene]      |
|  - REP-ECARTER | Las Vegas| 68.3%  Quota | 12.5% FFS | [Intervene] (Red)|
+------------------------------------------------------------------------+
```

### 1. Attainment Distribution, FFS Donut & Budget Gauge Row
*   **Visual Representation:** 
    1.  *Distribution Columns:* Visual bar groups showing count of representatives categorized into performance buckets (Below 70%, 70%-100%, 100%+).
    2.  *FFS Donut:* Ring diagram comparing the ratio of FFS (Fee-For-Service) product lines against standard inventory.
    3.  *FFS Gauge:* A semicircular gauge filling proportionally with oklch gold based on team budget progress.
*   **Database Calls:**
    *   Queries `GET /api/comp/team/:teamId/performance?period_id=:periodId`.
    *   *Delta SQL Query:* `SELECT team_attainment_pct, top_performer_count, at_risk_count, ffs_share_pct FROM workspace.hgv_comp.fact_team_snapshot WHERE team_id = :teamId AND period_id = :periodId`.
*   **Operating Gap Addressed:** Gap #1 (Disjointed funnel targets and volume vs quality metrics).

### 2. Team Leaderboard Table
*   **Visual Representation:** Matrix grid with color-tinted rows. Reps below 70% attainment are highlighted in oklch red (`bg-rose-500/5`), while top performers above 100% are highlighted in oklch green (`bg-emerald-500/5`).
*   **Key Controls:**
    *   *Interactive Sort:* Clicking columns (Agent, Location, Quota Progress, FFS Rate, Earnings) re-orders rows dynamically.
    *   *Intervene Button:* Triggers the performance drawer on the right.
*   **Database Calls:**
    *   Queries `GET /api/comp/team/:teamId/reps?period_id=:periodId`.
    *   *Delta SQL Query:* `SELECT r.rep_id, r.rep_name, r.location_code, q.attainment_pct, q.ffs_rate_pct, q.total_earnings FROM workspace.hgv_comp.dim_rep r JOIN workspace.hgv_comp.fact_quota_attainment q ON r.rep_id = q.rep_id WHERE r.team_id = :teamId AND q.period_id = :periodId`.

### 3. Tactical TO (Takeover) Specialist Intervention Drawer
*   **Visual Representation:** Conditional pop-up glass window sliding from the right of the screen. Shows details of the selected representative: tenure, current volume, FFS share, and pipeline.
*   **Key Controls:**
    *   *Trigger TO Pricing:* A toggle that authorizes the manager to step into the deal rotation and offer custom margin offsets (simulating deal-closing takeover authority to save margin).
*   **Operating Gap Addressed:** Slide 49 & 50 directive (Action line takeover operations).

---

## 🏛️ SECTION 5: Strategy Control Room (`AdminConsolePage.tsx`)

The unified executive steering command center containing 6 strategic modules:

### MODULE D1: Requirements Verification Matrix (`OperatingRequirementsMatrix.tsx`)
*   **Visual Representation & Styling:** Elegantly structured grid of cards organized into 4 strategic categories (Operating Gaps, Sentiment, Comp Design, Ingestion).
*   **Key Controls:**
    *   *Verify Solution Button:* Clicking any card automatically triggers navigation callbacks (`onNavigateTab`), switching the active strategy tab and focusing the manager viewport onto the corresponding live database feature.
*   **Operating Gap Addressed:** Direct executive checklist proving that all audited gaps are fully coded and functional.

### MODULE D2: Gaps & Sentiment Assessment (`IgniteAssessmentPage.tsx`)
*   **Visual Representation & Styling:** Glass accordion decks severity-coded by impact (Red for Technology gaps, Amber for Governance gaps, Blue for Employee experience).
*   **Verbatim Quotes Carousel:** Brushed-gold accented micro-animated testimonials slider.
*   **Sales Sentiment Lag Table:** Dynamic grid calculating Sales Average vs. Marketing/Telemarketing sentiment scores, illustrating the lag delta (`-0.41` on pay mix comfort).
*   **Governance CoE Blueprint:** High-fidelity organizational tree showing the future-state corporate COE guidelines.

### MODULE D3: Scenario Modeler (`CompAnalysisPage.tsx`)
*   **Scenario Library Grid:** Displays active scenarios (Baseline, Sim-01, Plan-A) as premium glass panels with checkboxes to add up to 4 to the comparison.
*   **Comparison Matrix Table:** Real-time side-by-side grid comparing Quota adjustments, commission base rates, accelerators, expected performance, and budget costs.
*   **Payouts vs. Budget Bar Chart:** Column bars comparing projected payout costs across selected scenarios.
*   **HGV vs. Market Compensation Standards Gap Assessment Widget:**
    *   *Area 1 (Below-Market Gaps Progress):* Director target cash gap progress column (starts 17%) and VP gap progress column (starts 43%). Shrinks towards 0% as commission or bonus variables are boosted.
    *   *Area 2 (Pay Mix Volatility Mix):* Renders HGV active base/variable pay-mix splits vs market standard ranges across 5 roles.
    *   *Area 3 (Lower Total Commission Rates):* Displays the active HGV rate vs. market standard (4%-6% baseline), tagging risk labels (*Optimal Alignment*, *Talent Attrition Risk*).
    *   *Area 4 (Director Plan Profitability Slider):* **Director+ NOI Weight Slider (0%-100%)**. Shifting the weight to **50%-80%** rebalances plans away from revenue-heavy volume metrics towards margin protection.
    *   *Strategic Notepad:* Persistence textarea saving executive notes into `localStorage` indexed by the active scenario ID.
*   **Database Calls:**
    *   Queries `GET /api/comp/scenarios`.
    *   *Delta SQL Query:* `SELECT scenario_id, scenario_name, quota_change_pct, commission_rate_pct, bonus_rate_change_pct, accelerator_change_pct, created_at FROM workspace.hgv_comp.scenario_run`.

### MODULE D4: Semantic Metrics Layer (`SemanticLayerPage.tsx`)
*   **Live Metrics Stats Row:** Sleek, borderless statistics cards at the top of the tab displaying dynamic counts for KPIs, Measures, Dimensions, and Calculated fields.
*   **Metric Definitions Matrix:** Columns showing Metric Name, Technical Code, Semantic Type, Table Lineage, and Description.
*   **SQL Code Box:** Displays exact database DDL/DML statements executing in Unity Catalog (e.g. `SELECT SUM(base_pay) FROM fact_payout`).
*   **Database Calls:**
    *   Queries `GET /api/comp/semantic-layer/definitions`.
    *   *Delta SQL Query:* `SELECT metric_id, metric_name, category, data_type, database_linage, sql_definition, description FROM workspace.hgv_comp.semantic_definitions`.

### MODULE D5: Persona Sandboxes (`FieldPersonaPage.tsx`)
*   **Sandbox sub-tabs:** Toggles simulators for **Call Center (C1)**, **Marketing Representative (C2a)**, **Marketing Manager (C2b)**, and **Marketing Director (C2c)**.
*   **Question Accordion Catalog:** Expandable categories (e.g., *Payout Rules*, *Lead Quality Disputes*) containing clickable governed question buttons. Clicking a question automatically populates and triggers the Copilot.
*   **Marketing Rep Lead Quality Calculator:** Custom inline slider to adjust ABC Lead Mix (% A-Leads). Shifting the slider reactively recalculates tour showed rates, close rates, and average payouts, activating the green *Lead Quality Booster* badge.

### MODULE D6: Varicent Ingestion Portal (`VaricentIngestPage.tsx`)
*   **Paste Payload Textarea:** Terminal-style textarea to paste raw spreadsheets or click "Load Template Data" to parse mockup CSV/JSON files.
*   **Pre-Flight Validation Board:** Columns mapping raw CSV fields to database schema columns, showing data conversion statuses.
*   **Database Sync Button:** Submits the payload to the server executing validation checks and sync merges.
*   **Database Calls:**
    *   Queries `POST /api/admin/varicent/ingest`.
    *   *Delta SQL Statements:* Executed dynamically based on selected mode (MERGE/APPEND/OVERWRITE):
        `MERGE INTO workspace.hgv_comp.fact_deal_credit AS t USING source_data AS s ON t.deal_id = s.deal_id WHEN MATCHED THEN UPDATE SET ... WHEN NOT MATCHED THEN INSERT ...`

---

## 🤖 SECTION 6: AI Compensation Copilot (`CompCopilot.tsx`)

The embedded AI analyst that helps users inspect comp calculations.

### 1. Copilot Interface Shell
*   **Visual Representation:** Sapphire dark pane (`glass-panel`) with search input. Typing `@` triggers a debounced search popup.
*   **Toolbar Buttons:**
    *   *Insights Trigger:* Computes active dashboard stats and returns an executive analysis.
    *   *Mentions Library Button:* Slides open the database search drawer showing tabs (All, Reps, Teams, Scenarios, Deals).
*   **Operating Gap Addressed:** Gap #10 (Auditability of calculations and manual spreadsheet processes).

### 2. debounced Mentions Search Dropdown
*   **Visual Representation:** Floating glass panel displaying entity options matching input (e.g., `@rep:REP-JASON`). Categories are tagged with colored pills: **Blue (Reps)**, **Green (Teams)**, **Amber (Scenarios)**, and **Purple (Deals)**.
*   **Database Calls:**
    *   Queries `GET /api/comp/copilot/mentions-search?q=:query`.
    *   *Delta SQL Queries:* LIKE statement executions across multiple tables:
        `SELECT rep_id AS id, rep_name AS label, 'rep' AS type FROM dim_rep WHERE LOWER(rep_name) LIKE '%:q%'`

---

## 🛡️ SECTION 7: Compensation Administration Desk (`CompAdminPage.tsx`)

Operational workflows designed to audit proration, reserves, and payroll checks.

```
+------------------------------------------------------------------------+
|  [Tab 1: Plan Eligibility] [Tab 2: Audit Trail] [Tab 3: Reserves]      |
+------------------------------------------------------------------------+
|  [Tab 4: Payroll Preview]                                              |
|  - Rep: D. Lee  | Q1 Gross: $12,450.00 | Status: Pending Ingestion     |
|  - Rep: R. Smith| Q1 Gross: $18,750.00 | Status: Synced [Synced ✓]     |
|                                                                        |
|  [🚀 Push to Varicent] ---> [M2M OAuth API Terminal Logs]              |
+------------------------------------------------------------------------+
```

### 1. Plan Eligibility Tab
*   **What it displays:** Table listing representative locations, assigned plans, and active dates.
*   **Proration Calculation:** Renders the proration percentage. New hires (like rep D. Lee) show a prorated `58.33%` matching their mid-period start date.
*   **Database Calls:**
    *   Queries `GET /api/comp/admin/eligibility`.
    *   *Delta SQL Query:* `SELECT rep_id, period_id, plan_version_id, location_code, effective_start, effective_end, proration_pct, eligibility_flag FROM workspace.hgv_comp.fact_plan_eligibility`.

### 2. Audit Trail Ledger Tab
*   **What it displays:** Chronological audit ledger.
*   **Auditable Adjustments:** Lists adjustments, manual offsets, and retro corrections approved by administrators (e.g., retro corrections by VP John Barsoum).
*   **Export Compliance Log Button:** Slides open a print-ready auditor sheet displaying spiff locks, exception counts, and physical signature lanes.
*   **Database Calls:**
    *   Queries `GET /api/comp/admin/audit-log`.
    *   *Delta SQL Query:* `SELECT event_id, rep_id, period_id, event_type, amount, reason, approved_by, created_at FROM workspace.hgv_comp.fact_comp_admin_log ORDER BY created_at DESC`.

### 3. Chargebacks & Reserves Tab
*   **What it displays:** Granular deal reserve holds and released schedules.
*   **Reserve Formula:** Tracks standard **12% reserve** on FFS closed deals. Released after 6 months if contract status remains rescission-free.
*   **Database Calls:**
    *   Queries `GET /api/comp/admin/chargebacks`.
    *   *Delta SQL Query:* `SELECT chargeback_id, deal_id, rep_id, period_id, original_commission, chargeback_amount, reserve_held, reserve_released, reason, status FROM workspace.hgv_comp.fact_chargeback`.

### 4. Payroll Preview Tab
*   **What it displays:** Verified payee earnings ledger pending ingestion.
*   **Push to Varicent Syncer Button:** Opens the live M2M sync terminal. Logs OAuth token requests, runs compliance scans (flagging adjustments exceeding 3 months), and syncs gross amounts to Varicent cloud API.
*   **Database Calls:**
    *   Queries `GET /api/comp/admin/payroll-preview`.
    *   *Delta SQL Query:* `SELECT p.rep_id, r.rep_name, p.base_pay, p.commission_pay, p.bonus_pay, (p.base_pay + p.commission_pay + p.bonus_pay) AS net_payable FROM workspace.hgv_comp.fact_payout p JOIN workspace.hgv_comp.dim_rep r ON p.rep_id = r.rep_id`.

---

## 📈 SECTION 8: Finance Intelligence Desk (`FinancePage.tsx`)

Corporate treasury dashboard auditing cost modeling, ROI thresholds, and ledger accruals.

### 1. Cost Analysis Tab
*   **Cost of Sales Summary Card:** Compares total compensation expense against Net Sales Volume (NSV) to verify it stays within the **8% - 12%** target sweet spot.
*   **Database Calls:**
    *   Queries `GET /api/comp/finance/cost-summary`.
    *   *Delta SQL Query:* `SELECT SUM(commission_pay + bonus_pay) AS total_var_comp, SUM(sales_volume) AS total_nsv FROM workspace.hgv_comp.fact_payout JOIN workspace.hgv_comp.fact_deal_credit`.

### 2. Tour Quality Yield Analysis Tab
*   **Lead Quality Metrics Table:** Rows break down conversion, close rates, and showed percentages by ABC Lead Profile (A, B, C, D) and OPC lead source.
*   **Database Calls:**
    *   Queries `GET /api/comp/finance/tour-quality`.
    *   *Delta SQL Query:* `SELECT abc_score, lead_source, Package_type, showed_flag, closed_flag, net_sales_volume, vpg, ebitda_estimate FROM workspace.hgv_comp.fact_tour_quality`.

### 3. SPIFF ROI Analysis Tab
*   **ROI Performance Matrix:** Evaluates individual SPIFF programs against the Executive Strategy required **3:1 ROI contribution threshold** (Net Sales Volume generated divided by SPIFF budget cost). SPIFFs under 3:1 display a red "Underperforming" warning.

### 4. Accrual Booking Tab
*   **Accrual Booking Table:** Surfaces calculated accrual allocations for quarterly true-ups, backed by transaction-level integrity checks.
*   **Database Calls:**
    *   Queries `GET /api/comp/finance/accrual-summary`.
    *   *Delta SQL Query:* `SELECT p.period_id, SUM(p.commission_pay) AS commission_accrued, SUM(p.bonus_pay) AS bonus_accrued, SUM(c.reserve_held) AS reserve_liabilities FROM workspace.hgv_comp.fact_payout p JOIN workspace.hgv_comp.fact_chargeback c ON p.period_id = c.period_id GROUP BY p.period_id`.
