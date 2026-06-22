# HGV Marketing Compensation Hub — UI Data Contract

**Audience:** HGV data / comp engineering team  
**Purpose:** Document every UI section that reads warehouse data, the exact tables/columns the app expects, and how the `hgv_comp` semantic layer fits in. Use this to **rewrite ETL/SQL** so you can load from the sample CSV base tables (or production Cognos equivalents) and **only surface data in this structure** — no app changes required.

**App:** HGV Compensation Hub (`MarketingCompensationView` — “My Compensation” for Marketing Representative)  
**Catalog:** `edw_dev_hris.hgv_comp` (configurable via `COMP_CATALOG` / `COMP_SCHEMA` env vars)  
**Reference SQL today:** `data/comp/edw_dev_hris/00_CLEAN_AND_REBUILD.sql` + `01_MATERIALIZE_ALL_TABLES.sql` (materialized Delta). UI/query companion: `01_ui_section_query_map.sql`. Legacy script `16_materialize_marketing_core.sql` is **deprecated**.

---

## 1. Architecture overview

```mermaid
flowchart TB
  subgraph sources [Source layer — HGV owns rewrite]
    CSV[Sample CSVs / Cognos FM tables]
    CSV --> detail[it_smt_detail]
    CSV --> mkt[it_smt_marketing]
    CSV --> pers[it_smt_personnel]
    CSV --> lead[it_uni_lead]
    CSV --> contr[it_uni_contract]
  end

  subgraph semantic [Semantic layer — hgv_comp contract]
  detail --> spine[Tour grain spine]
  mkt --> spine
  pers --> spine
  spine --> FTP[fact_marketing_tour_payout]
  FTP --> FRP[fact_marketing_rep_period]
  FTP --> DMR[dim_marketing_rep]
  FRP --> FRM[fact_marketing_rep_metric]
  FTP --> FC[fact_marketing_chargeback]
  FTP --> FA[fact_marketing_arrival]
  DMR --> META[dim_marketing_rep picker]
  DP[dim_period] --> META
  end

  subgraph app [App — read-only consumer]
  META --> API1[GET /api/comp/metadata]
  FRP --> API2[GET /api/comp/marketing/workspace]
  FRM --> API2
  FC --> API2
  FA --> API2
  FTP --> API2
  API2 --> UI[My Compensation UI sections]
  API1 --> UI
  end
```

### What the semantic layer does

| Role | Description |
|------|-------------|
| **Contract** | The app never queries Cognos directly. It only reads named objects in `hgv_comp` with fixed column names and types (see §4). |
| **Grain shift** | Source data is transaction-level (`it_smt_detail`) and tour-key-level (`it_smt_marketing`, `it_smt_personnel`). The semantic layer collapses to **tour grain** and **rep×period grain**. |
| **Denormalization** | KPIs, plan metrics, chargebacks, and arrivals are pre-joined or rolled up so the Node server runs simple `SELECT … WHERE rep_id AND period_id` queries (sub-second on materialized Delta). |
| **Dependency** | **Hard dependency:** if `fact_marketing_rep_period` has no row for `(rep_id, period_id)`, the workspace API errors. Empty `dim_marketing_rep` → empty rep dropdown. Tour ledger drives most visible numbers. |

### What the app computes (not in warehouse)

These are **derived in TypeScript** from warehouse payloads — HGV does **not** need to populate them separately:

| Derived artifact | Source |
|------------------|--------|
| Money Map (Rule of Three, plan progress bars) | `shared/marketingMoneyMap.ts` from KPIs + plan_metrics + tours |
| Plan metric earnings alignment | `shared/marketingEarningsAlign.ts` rebalance metric $ to match `qtd_earnings` |
| Desk rank | `marketingMoneyMap.ts` — ranks peers on same `team_id` |
| AI insight text | LLM over serialized workspace context (no extra SQL) |
| Plan assessment fallback | Static catalog if `plan_assessment_*` tables empty |

---

## 2. Source data — CSV samples → production tables

Sample files at repo root map to Cognos FM tables used in current SQL:

| CSV file | Production table | Join key | Role |
|----------|------------------|----------|------|
| `detail.csv` | `edw_dev_cognos.cognos_fm.it_smt_detail` | `tour_key_hash`, `tour_id`, `enterprise_lead_id` | Transaction grain: showed, qualified, net_volume, tour_date |
| `marketing.csv` | `edw_dev_cognos.cognos_fm.it_smt_marketing` | `tour_key_hash`, `tour_id` | Tour booking: office, channel, program, `tour_booked_date` |
| `personnel.csv` | `edw_dev_cognos.cognos_fm.it_smt_personnel` | `tour_key_hash` | **Marketing rep = `opc_person_1_employee_id` / `opc_person_1_name`** (not `salesperson_1_*`, which is field sales) |
| `uni_lead.csv` | `edw_dev_cognos.cognos_fm.it_uni_lead` | `enterprise_lead_id` | Guest / household demographics (guest 360) |
| `uni_contract.csv` | `edw_dev_cognos.cognos_fm.it_uni_contract` | `contr_num`, `tour_id` | Contract volume, status (sales linkage) |
| `commissions.csv` | `edw_dev_hris.pwcmodels.commissions` | `participant` | Field sales comp (not marketing channel picker) |

### Recommended join spine (tour grain)

```
it_smt_marketing (tour booked, office, channel)
    ON tour_key_hash
it_smt_detail (showed, qualified, net_volume, tour_date)  — GROUP BY tour_key_hash, tour_id
    ON tour_key_hash
it_smt_personnel (opc_person_1_* for marketing rep credit)
```

**Period assignment:** `period_id` = `YYYY-Qn` from tour date (calendar quarter of `tour_date` or `tour_booked_date`).

---

## 3. UI section → API → warehouse mapping

Page: **My Compensation — Marketing Representative** (`client/src/pages/comp/MarketingCompensationView.tsx`)

### 3.0 Global chrome — Rep & period picker

| UI | API | Warehouse object | Query |
|----|-----|------------------|-------|
| Rep dropdown | `GET /api/comp/metadata` | `dim_marketing_rep` | See §5.1 |
| Period dropdown | `GET /api/comp/metadata` | `dim_period` | See §5.2 |

**Filter rules (app-side):** excludes `rep_id LIKE 'PERSONA-MKT-%'`; max 500 marketing reps.

---

### 3.1 Hero strip — “Your 3 numbers that matter”

| Widget | Fields shown | Warehouse source |
|--------|--------------|------------------|
| What I earned | `kpis.qtd_earnings` | `fact_marketing_rep_period.qtd_earnings` |
| Am I on track? | `kpis.penetration_pct` vs `penetration_target_pct` | `fact_marketing_rep_period` |
| What’s next | `kpis.next_tier_label`, `next_tier_gap_tours` | `fact_marketing_rep_period` |

**API:** `GET /api/comp/marketing/workspace?rep_id=&period_id=`  
**Primary SQL:** §5.3 (`fact_marketing_rep_period` + `dim_period`)

---

### 3.2 Rule of Three / Money Map / Plan progress / Desk rank

| Widget | Data used |
|--------|-----------|
| `MarketingRuleOfThreeBars` | `kpis`, `plan_metrics`, `money_map` |
| `MarketingMoneyMapSummary` | `money_map` (computed) |
| `MarketingPlanProgressBars` | `plan_metrics` |
| `MarketingDeskRankCard` | Desk rank query §5.9 |

**Warehouse:** `fact_marketing_rep_period`, `fact_marketing_rep_metric`, `fact_marketing_tour_payout` (tour chips). Money map itself is **not** a table.

---

### 3.3 KPI cards (advanced view)

| Card | Column |
|------|--------|
| QTD earnings | `qtd_earnings`, `paid_to_date` |
| Qualified tours | `qualified_tours`, `tours_shown`, `show_rate_pct` |
| Penetration | `penetration_pct`, `penetration_target_pct` |
| Next tier | `next_tier_label`, `next_tier_gap_tours`, `spiff_active` |

**Source:** `fact_marketing_rep_period` via workspace API.

---

### 3.4 Earnings breakdown & pay mix

| UI | Fields | Warehouse |
|----|--------|-----------|
| Earnings breakdown | `qualified_tour_pay`, `courtesy_tour_pay`, `penetration_spiff`, `chargebacks`, `total_payout`, `net_payout` | `fact_marketing_rep_period` (+ app aligns net) |
| Pay mix | `base_pct`, `variable_pct` | `fact_marketing_rep_period` |
| Market position | `tcc_gap_vs_market_pct` | `fact_marketing_rep_period` (optional: `fact_rep_market_position` for manager views) |

---

### 3.5 Earnings by Plan Metric

| UI component | Warehouse |
|--------------|-----------|
| `EarningsByPlanMetricTable` | `fact_marketing_rep_metric` |

**Expected rows per rep×period:** 3 metrics (names flexible; weights should sum ~100):

| metric_name (current seed) | weight_pct | attainment driver |
|----------------------------|------------|-------------------|
| Qualified Tours | 40 | `penetration_pct` |
| Show Rate | 35 | `show_rate_pct` |
| Qualified Tour Pay | 25 | qualified tour count tier |

---

### 3.6 Tour Activity & Credits

| UI | Warehouse |
|----|-------------|
| `MarketingTourActivitySection` | `fact_marketing_tour_payout` (+ optional guest enrichment) |

**Per-tour columns required:**

| Column | Description |
|--------|-------------|
| `tour_id` | PK for intervene drawer |
| `rep_id`, `period_id` | Filters |
| `guest_name`, `guest_type` | Display (Qualified / Showed / Courtesy) |
| `arrival_date` | Tour date |
| `tour_status`, `code` | Status / desk code |
| `payout` | Tour-level earnings |
| `fps_eligible`, `fps_potential` | FPS upsell display |
| `notes` | Free text (e.g. marketing program) |
| `guest_id`, `household_id` | Guest 360 joins |
| `lead_source`, `abc_score`, `package_type` | Quality chips |
| `xref_tour_id`, `tour_booked_date` | Cross-refs |

**Enrichment (optional):** `enrichMarketingTours()` joins `dim_guest`, `dim_household`, `dim_location`, `fact_tour_quality`, `fact_guest_*`. If enrichment fails, app falls back to base tour columns only.

---

### 3.7 Chargebacks

| UI | Warehouse |
|----|-------------|
| `ChargebacksAndArrivals` (chargeback table) | `fact_marketing_chargeback` |

| Column | Notes |
|--------|-------|
| `chargeback_id` | Unique |
| `rep_id`, `period_id` | Filter |
| `guest_name`, `tour_id` | Display |
| `premium_gift` | Optional |
| `chargeback_amount` | Positive $ |
| `notes` | Reason |

---

### 3.8 Upcoming Arrivals

| UI | Warehouse |
|----|-------------|
| `ChargebacksAndArrivals` (arrivals table) | `fact_marketing_arrival` |

| Column | Notes |
|--------|-------|
| `arrival_id` | Unique |
| `guest_name`, `guest_type` | Display |
| `arrival_datetime` | Sort key |
| `desk` | Location/desk label |
| `potential_qualified_tour`, `potential_fps_payout`, `projected_total_payout` | Opportunity $ |

**Current ETL logic (provisional):** tours with status Scheduled/Booked/Confirmed OR `arrival_date >= today`.

---

### 3.9 Tour Intervene drawer (Guest 360)

| UI | API |
|----|-----|
| `MarketingTourInterveneDrawer` | `GET /api/comp/marketing/tour/:tour_id/context` |

**SQL:** `server/marketingTourContext.ts` — `TOUR_ENRICHMENT_SELECT` (§5.8) plus per-guest ownership, rental, history, chargebacks.

**Prerequisites:** `00` + `01` (tour ledger + `dim_location`). Guest 360 tables are **stubs after 00 only** — run `09_create_guest_registry.sql` + `09a_seed_guest_registry.sql` (or future `it_uni_lead` ETL) to populate.

**Additional tables (guest registry — optional for MVP):**

- `dim_guest`, `dim_household`, `dim_location` — `dim_location` populated in script 01 Step 4; guest/household empty until 09a
- `fact_tour_quality`
- `fact_guest_ownership`, `fact_guest_tour_history`, `fact_guest_rental_stay`

If guest registry is empty, drawer still opens with tour payout fields only. See **`01_ui_section_query_map.sql`** § Tour Intervene for smoke queries.

**Note:** `edw_dev_hris.pwcmodels.commissions` is **not** used for marketing tour intervene or earnings (field sales channel only).

---

### 3.10 Plan rules & weights (Plan Assessment panel)

| UI | API |
|----|-----|
| `MarketingPlanAssessmentPanel` | `GET /api/comp/plan-assessment?persona_id=marketing_rep&period_id=` |

**Tables:** `plan_assessment_profile`, `plan_assessment_segment`  
**Prerequisites:** `10_create_plan_assessment.sql` + `10a_seed_plan_assessment.sql` (not in 00/01).  
**Fallback:** static catalog in `shared/planAssessmentCatalog.ts` if warehouse empty.

**Not the same as:** `dim_tour_status_config` (live tour payout $ from 00) or `fact_marketing_rep_metric` (live attainment from 01 Step 9).

See **`01_ui_section_query_map.sql`** § Plan Rules / Assessment for runtime SQL and persona_id values (`marketing_rep`, `marketing_manager`, `marketing_director`).

---

### 3.11 AI panels (no additional warehouse queries)

| UI | API | Data source |
|----|-----|-------------|
| `RepAiInsightsPanel`, `SimpleViewAiInsight` | `POST /api/comp/rep/insights` | `insights_context` string from workspace |
| `CompCopilot` | Copilot routes | `grounding_context` from workspace |
| `CompInterpretationPanel` | `POST /api/comp/marketing/tour-insights` | Client-serialized tours/chargebacks |

Optional grounding: `industry_comp_benchmark` where `role_key = 'marketing_rep'`.

---

## 4. Warehouse contract — table schemas

The app assumes these objects exist in `hgv_comp`. Types match `data/comp/edw_dev_hris/06_create_marketing_benchmark.sql` unless noted.

### 4.1 `dim_marketing_rep` (rep picker)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `rep_id` | STRING | PK | Employee ID as string |
| `rep_name` | STRING | | Display name |
| `level_code` | STRING | | e.g. `MKT` |
| `team_id` | STRING | | OPC / marketing team code |
| `region` | STRING | | Office region |
| `is_active` | BOOLEAN | | `TRUE` for active reps |

**Grain:** one row per marketing rep with ≥1 tour in scope.

---

### 4.2 `dim_period`

| Column | Type | Notes |
|--------|------|-------|
| `period_id` | STRING | e.g. `2026-Q3` |
| `period_label` | STRING | e.g. `Q3 2026` |
| `period_start`, `period_end` | DATE | Quarter bounds |
| `is_current` | BOOLEAN | One period flagged current |

---

### 4.3 `fact_marketing_tour_payout` (tour ledger)

See §3.6 column list. Schema in `06_create_marketing_benchmark.sql` lines 61–84.

**Grain:** one row per `tour_id` per crediting rep (if split credit needed, app expects single primary rep per tour today).

---

### 4.4 `fact_marketing_rep_period` (period KPI spine)

| Column | Type | UI usage |
|--------|------|----------|
| `rep_id`, `period_id` | STRING | Keys |
| `rep_name` | STRING | Header “Hey {name}” |
| `plan_id` | STRING | Plan reference |
| `assigned_area` | STRING | Desk / area label |
| `bonus_area_id` | STRING | Regional bonus lookup |
| `qtd_earnings` | DECIMAL | Hero + KPI |
| `paid_to_date` | DECIMAL | KPI |
| `qualified_tours` | INT | KPI, tiers |
| `tours_shown` | INT | Show rate |
| `show_rate_pct` | DECIMAL(6,2) | Penetration / show widgets |
| `penetration_pct` | DECIMAL(6,2) | Hero “on track” |
| `penetration_target_pct` | DECIMAL(6,2) | Target line |
| `spiff_active` | BOOLEAN | Tier badge |
| `next_tier_label` | STRING | Hero “what’s next” |
| `next_tier_gap_tours` | INT | Tours to next tier |
| `qualified_tour_pay` | DECIMAL | Earnings breakdown |
| `courtesy_tour_pay` | DECIMAL | Earnings breakdown |
| `penetration_spiff` | DECIMAL | Earnings breakdown |
| `chargebacks` | DECIMAL | Earnings breakdown |
| `total_payout` | DECIMAL | Total |
| `base_pct`, `variable_pct` | DECIMAL(6,2) | Pay mix |
| `tcc_gap_vs_market_pct` | DECIMAL(6,2) | Market position |

**Grain:** one row per `(rep_id, period_id)`.

**Rollup rule (current provisional SQL):** aggregate from `fact_marketing_tour_payout` grouped by `rep_id`, `period_id`.

---

### 4.5 `fact_marketing_rep_metric`

| Column | Type |
|--------|------|
| `rep_id`, `period_id`, `metric_name` | STRING |
| `weight_pct`, `earnings`, `attainment_pct` | DECIMAL |
| `target_label` | STRING |
| `opportunity_usd` | DECIMAL (nullable) |

---

### 4.6 `fact_marketing_chargeback` / `fact_marketing_arrival`

See §3.7 and §3.8.

---

## 5. Reference SQL (app queries — rewrite targets)

All SQL uses `workspace.hgv_comp` in code; runtime rewrites to `edw_dev_hris.hgv_comp` when `COMP_CATALOG=edw_dev_hris`.

### 5.1 Rep picker — `server/compMetadata.ts`

```sql
SELECT
  rep_id,
  COALESCE(rep_name, rep_id) AS rep_name,
  level_code,
  team_id,
  region,
  is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE rep_id IS NOT NULL
  AND NOT rep_id LIKE 'PERSONA-MKT-%'
ORDER BY rep_name
LIMIT 500;
```

### 5.2 Period picker

```sql
SELECT period_id, period_label, is_current
FROM edw_dev_hris.hgv_comp.dim_period
ORDER BY period_start DESC
LIMIT 24;
```

### 5.3 Workspace spine — `server/marketingRepWorkspace.ts`

```sql
-- Period KPIs + label
SELECT p.*, d.period_label
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
LEFT JOIN edw_dev_hris.hgv_comp.dim_period d ON d.period_id = p.period_id
WHERE p.rep_id = :rep_id AND p.period_id = :period_id;

-- Plan metrics
SELECT metric_name, weight_pct, earnings, attainment_pct, target_label, opportunity_usd
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY weight_pct DESC;

-- Chargebacks
SELECT chargeback_id, guest_name, tour_id, premium_gift, chargeback_amount, notes
FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
WHERE rep_id = :rep_id AND period_id = :period_id;

-- Arrivals
SELECT arrival_id, guest_name, guest_type, arrival_datetime, desk,
       potential_qualified_tour, potential_fps_payout, projected_total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_arrival
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY arrival_datetime;

-- Tours (fallback if enrichment fails)
SELECT tour_id, guest_name, guest_type, arrival_date, tour_status, code,
       payout, fps_eligible, fps_potential, notes
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE rep_id = :rep_id AND period_id = :period_id
ORDER BY arrival_date DESC;
```

### 5.4 Tour ledger SQL (implemented in script 01 Step 7)

**Rep credit:** `opc_person_1_employee_id` / `opc_person_1_name` from `it_smt_personnel` (one row per `tour_key_hash`, `rn = 1`).

**Payout rates:** looked up from `dim_tour_status_config` (seeded in `00_CLEAN_AND_REBUILD.sql`) via `comp_status_key` (`QUALIFIED` / `COURTESY` / `NO SHOW`). Case-insensitive join — do **not** multiply `net_volume` by a rate.

**Showed / qualified:** `tour_status_desc` from `it_smt_marketing` drives `showed_flag`; owner/new-buyer signal from aggregated `it_smt_detail` drives `qualified_flag`.

See `01_MATERIALIZE_ALL_TABLES.sql` Step 7 and `01_ui_section_query_map.sql` for the full column map.

### 5.5 Period rollup (implemented in script 01 Step 8)

```sql
-- Pattern: pay sums from tour ledger + distinct tour counts from staging (anti fan-out)
-- penetration_pct = guest buy rate (sales_count > 0 / tours_shown), NOT qualified rate
-- next_tier at 3 / 6 / 10 qualified tours; penetration_spiff at 20% buy rate
SELECT rep_id, period_id, qtd_earnings, qualified_tours, tours_shown,
       show_rate_pct, penetration_pct, next_tier_label, next_tier_gap_tours
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE rep_id = :rep_id AND period_id = :period_id;
```

### 5.6 `dim_marketing_rep` (implemented in script 01 Step 5)

```sql
-- C2a: distinct opc_person_1 reps; team_id = dominant office_code
-- C2b: synthesized Manager per office  (rep_id = 'MGR-' || office_code)
-- C2c: synthesized Director per region (rep_id = 'DIR-' || region)
SELECT rep_id, rep_name, level_code, team_id, region, is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE level_code IN ('C2a', 'C2b', 'C2c');
```

### 5.7 Derived facts (Delta tables in script 01 — not views)

Script 01 materializes these as **Delta tables** (required — the app cannot write to views):

- `fact_marketing_rep_metric` — Step 9: 3 metrics per rep×period (qualified tours, FPS packages, tours shown)
- `fact_marketing_chargeback` — Step 10: from `cancel_count` on staging (contract rescinds)
- `fact_marketing_arrival` — Step 11: future-dated tours from tour ledger

Step 12 MERGE refreshes chargeback-adjusted columns on `fact_marketing_rep_period`.

### 5.8 Tour enrichment (Intervene drawer)

```sql
SELECT
  tp.tour_id, tp.rep_id, tp.period_id, tp.guest_name, tp.guest_type,
  tp.arrival_date, tp.tour_status, tp.code, tp.payout, tp.fps_eligible, tp.fps_potential, tp.notes,
  tp.guest_id, tp.household_id, tp.lead_source, tp.abc_score, tp.package_type, tp.xref_tour_id,
  tp.tour_booked_date,
  g.email AS guest_email, g.phone_token, g.qualification_code, g.owner_flag,
  hh.hh_size_band, hh.income_band, hh.home_msa,
  pl.location_id AS planned_location_id, pl.location_name AS planned_location_name,
  -- ... locations, fact_tour_quality, guest history aggregates
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
LEFT JOIN edw_dev_hris.hgv_comp.dim_guest g ON g.guest_id = tp.guest_id
LEFT JOIN edw_dev_hris.hgv_comp.dim_household hh ON hh.household_id = tp.household_id
-- ...
WHERE tp.tour_id = :tour_id AND tp.rep_id = :rep_id;
```

### 5.9 Desk rank — `server/marketingMoneyMap.ts`

```sql
SELECT p.rep_id, p.qualified_tours, p.tours_shown, p.penetration_pct
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
JOIN edw_dev_hris.hgv_comp.dim_rep r ON r.rep_id = p.rep_id
WHERE p.period_id = :period_id
  AND r.team_id = (SELECT team_id FROM edw_dev_hris.hgv_comp.dim_rep WHERE rep_id = :rep_id)
  AND r.level_code = 'C2a' AND r.is_active = TRUE;
```

---

## 6. Current semantic layer scripts

| Script | Purpose | Status |
|--------|---------|--------|
| **`00_CLEAN_AND_REBUILD.sql`** | Config tables, payout seeds, stubs, grants | **Run first** |
| **`01_MATERIALIZE_ALL_TABLES.sql`** | Cognos → Delta materialization (2026) | **Canonical ETL** |
| **`01_ui_section_query_map.sql`** | UI → step → runtime SQL companion | Documentation / smoke tests |
| `02_rebuild_rep_hierarchy.sql` | Rebuild managers/directors only | Optional fast fix |
| `03_manager_view_stubs.sql` | Analytics stubs for manager view | Run after 01 if needed |
| `12_bootstrap_live_source_views.sql` | Live views over Cognos | **Deprecated** — too slow for VDI |
| `16_materialize_marketing_core.sql` | Earlier prototype materialization | **Deprecated** — superseded by 01 |
| `16_ui_section_query_map.sql` | Companion to script 16 | **Deprecated** — use `01_ui_section_query_map.sql` |

### Issues fixed in script 01 (vs legacy script 16)

1. Payout join to `dim_tour_status_config` (case-insensitive) — fixes all-$0 tours
2. `penetration_pct` = guest buy rate, distinct from show/qualified rate
3. Detail pre-aggregation — prevents fan-out / inflated earnings
4. `dim_marketing_rep` C2a/C2b/C2c hierarchy with `dim_rep.manager_rep_id`
5. Chargebacks from real cancel counts, not negative payout view
6. Metric/chargeback/arrival as Delta **tables**, not views

HGV may tune business rules in SQL while keeping output table/column names identical to this contract.

---

## 7. HGV delivery checklist

Load from CSV or Cognos into staging, then publish **only** these objects:

- [ ] `dim_marketing_rep`
- [ ] `dim_period`
- [ ] `fact_marketing_tour_payout`
- [ ] `fact_marketing_rep_period`
- [ ] `fact_marketing_rep_metric`
- [ ] `fact_marketing_chargeback` (or empty view)
- [ ] `fact_marketing_arrival` (or empty view)
- [ ] Optional guest 360: `dim_guest`, `dim_household`, `dim_location`, `fact_tour_quality`, `fact_guest_*`

**Validation queries (paste results back):**

```sql
-- Row counts
SELECT 'dim_marketing_rep' AS t, COUNT(*) FROM edw_dev_hris.hgv_comp.dim_marketing_rep
UNION ALL SELECT 'fact_marketing_tour_payout', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
UNION ALL SELECT 'fact_marketing_rep_period', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period;

-- Sanity: earnings in realistic range (not millions per rep per quarter)
SELECT rep_id, period_id, qtd_earnings, qualified_tours, total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
ORDER BY qtd_earnings DESC
LIMIT 10;

-- Rep picker sample
SELECT rep_id, rep_name, team_id, region
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
ORDER BY rep_name
LIMIT 20;
```

**App smoke test (browser console after restart):**

```javascript
fetch('/api/comp/metadata').then(r=>r.json()).then(m => console.log({
  reps: m.reps?.length,
  periods: m.periods?.map(p => p.period_id)
}));
```

---

## 8. File index

| Path | Description |
|------|-------------|
| `docs/hgv-marketing-comp-ui-data-contract.md` | This document |
| `data/comp/edw_dev_hris/00_run_order.sql` | Canonical script run order |
| `data/comp/edw_dev_hris/00_CLEAN_AND_REBUILD.sql` | Config + seeds (prerequisite) |
| `data/comp/edw_dev_hris/01_MATERIALIZE_ALL_TABLES.sql` | **Canonical materialization ETL** |
| `data/comp/edw_dev_hris/01_ui_section_query_map.sql` | **UI → step → query companion** |
| `server/marketingRepWorkspace.ts` | Workspace API SQL |
| `server/compMetadata.ts` | Metadata SQL |
| `server/marketingTourContext.ts` | Tour enrichment SQL |
| `server/marketingMoneyMap.ts` | Desk rank SQL |
| `data/comp/edw_dev_hris/06_create_marketing_benchmark.sql` | Table DDL contract |
| `detail.csv`, `marketing.csv`, `personnel.csv`, `uni_lead.csv`, `uni_contract.csv` | Sample source extracts |

---

*Generated for HGV comp hub integration review. Questions: map each business rule to the tour ledger and period rollup columns in §4 — the app will consume whatever you publish into `hgv_comp` without code changes as long as names and grains match.*
