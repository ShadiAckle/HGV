# HGV Marketing Compensation - Critical Stakeholder Questions

**Context**: We have successfully materialized 2026 marketing compensation data from Cognos sources into the `hgv_comp` schema. The SQL logic is functionally complete, but we need clarification on specific business rules to finalize payout calculations with 100% confidence.

**Data Scope**: Analysis based on 163,233 tours from 2026 YTD data in `edw_dev_hris.it_smt_marketing`.

---

## 1. Tour Status Definitions & Payout Rules

### Current State
From live Cognos data, we observe these `tour_status_desc` values with the following distribution:

| Status Value | Tour Count | % of Total |
|-------------|-----------|-----------|
| `TOUR` | 85,895 | 52.6% |
| `null` | 59,707 | 36.6% |
| `SHOW` | 979 | 0.6% |
| `CANCELLED` | 6,852 | 4.2% |
| `NO SHOW` | 6,649 | 4.1% |
| `SHOW - NO TOUR` | 1,451 | 0.9% |
| `BOOKED` | 1,428 | 0.9% |
| `BOOK` | 272 | 0.2% |

### Questions

**Q1.1**: What is the exact definition of each status value?
- What does **`TOUR`** mean? (This is 52.6% of all tours)
  - Does this mean the tour presentation was completed?
  - Is this equivalent to a "showed up" status?
- What does **`null`** mean? (This is 36.6% of all tours)
  - Are these preliminary bookings?
  - Pre-arrival states?
  - Data quality issues?
- What does **`APT`** mean? (If it exists in your data)
- What does **`CHECKIN`** mean? (If it exists in your data)
- What is the difference between `SHOW` vs `TOUR`?
- What is the difference between `BOOK` vs `BOOKED`?

**Q1.2**: Which statuses should trigger OPC marketing rep payouts, and at what rate?

**Current V2 SQL Assumption** (based on market standards from IGNITE PPT):
```
WHEN tour_status_desc IN ('SHOW', 'TOUR') THEN 50.00
WHEN tour_status_desc = 'NO SHOW' THEN 25.00
WHEN tour_status_desc IN ('CANCELLED', 'CANCELED', 'SHOW - NO TOUR') THEN 0.00
WHEN tour_status_desc IN ('BOOKED', 'BOOK') THEN 0.00  -- no payout until tour occurs
WHEN tour_status_desc IS NULL THEN ???
```

**Please specify**:
- Should `TOUR` status receive a payout? If yes, how much?
- Should `null` status receive a payout? If yes, how much?
- Should `SHOW` status receive a payout? If yes, how much?
- Should `BOOKED`/`BOOK` status receive a payout? If yes, how much?
- Are there different payout rates for different statuses, or is it flat?
- Any other status values we should handle?

---

## 2. Multi-Rep Credit Attribution

### Current State
- **47.5%** of tours (77,536 out of 163,233) have **multiple OPC reps** listed across `opc_person_1_name` through `opc_person_3_name` columns in `it_smt_marketing`.
- Current V2 SQL assigns 100% credit to `opc_person_1_name` (first rep listed) using `ROW_NUMBER()` logic.

### Example Scenarios
- Tour ID 12345 has:
  - `opc_person_1_name = "John Smith"`
  - `opc_person_2_name = "Jane Doe"`
  - `opc_person_3_name = NULL`

### Questions

**Q2.1**: How should tours with multiple OPC reps be credited?
- [ ] **Option A**: Give 100% credit to the first rep listed (`opc_person_1_name`)
- [ ] **Option B**: Split credit equally (e.g., 50/50 for 2 reps, 33/33/33 for 3 reps)
- [ ] **Option C**: Use a priority/hierarchy rule (e.g., first rep gets primary credit)
- [ ] **Option D**: Give 100% credit to ALL reps (each rep counts the tour)
- [ ] **Option E**: Other (please specify)

**Q2.2**: Does the order of `opc_person_1`, `opc_person_2`, `opc_person_3` have business meaning?
- Is `opc_person_1` always the "primary" rep?
- Or are these just data entry artifacts with no hierarchy?

---

## 3. Marketing Rep Population & Filtering

### Current State
- `dim_marketing_rep` is built in **`01_MATERIALIZE_ALL_TABLES.sql` Step 5** from `opc_person_1_employee_id` / `opc_person_1_name` on **`it_smt_personnel`** (one rep per tour), plus synthesized C2b managers (`MGR-<office_code>`) and C2c directors (`DIR-<region>`).
- Only **`opc_person_1`** receives tour credit today; `opc_person_2` / `opc_person_3` are **not** included in the rep population.
- See **`01_ui_section_query_map.sql`** for the full source → warehouse mapping.

### Questions

**Q3.1**: Is 9,265 the correct/expected count of active marketing reps for 2026?
- Does this seem too high or too low?
- Should we filter by:
  - [ ] Specific sites/properties?
  - [ ] Active employment status (requires join to `it_smt_personnel`)?
  - [ ] Minimum tour count threshold (e.g., exclude reps with < 5 tours)?
  - [ ] Specific person types or roles?
  - [ ] Other criteria?

**Q3.2**: Should we exclude certain rep names from `dim_marketing_rep`?
- Generic/placeholder names (e.g., "UNASSIGNED", "TBD", "HOUSE")?
- Non-person entities?

---

## 4. Data Quality & Row Duplication

### Current State (RESOLVED in V2 SQL)
- **Issue**: `it_smt_detail` contains ~1,780 rows per tour on average, causing massive row explosion and inflated earnings in earlier SQL versions.
- **Resolution**: V2 SQL pre-aggregates `it_smt_detail` before joining, and uses `COUNT(DISTINCT tour_id)` in all aggregations.

### Validation Results from V2 SQL
- Total tours: **163,233**
- Total payouts: **$5,065,750** (average $31.04 per tour)
- Rep with highest earnings: **$35,750** (715 tours at ~$50/tour)

### Questions

**Q4.1**: Do these aggregate numbers pass the "smell test"?
- Does $5M in total 2026 YTD marketing payouts align with your budget expectations?
- Does a top performer earning $35K (715 tours) seem reasonable?
- Average payout of $31/tour (considering mix of $50 shows and $25 no-shows)?

**Q4.2**: Are there any known data quality issues in `it_smt_detail` or `it_smt_marketing` we should be aware of?
- Duplicate tour records?
- Tours that should be excluded from comp calculations?
- Specific date ranges with bad data?

---

## 5. Period Aggregation & Reporting Cadence

### Current State
- `fact_marketing_rep_period` aggregates by `year_month` (e.g., `202601`, `202602`).
- Current V2 SQL includes tours from **January 2026 through June 2026** (based on `tour_date`).

### Questions

**Q5.1**: Is monthly aggregation correct?
- Or should we aggregate by:
  - [ ] Bi-weekly pay periods?
  - [ ] Weekly?
  - [ ] Calendar month is correct?

**Q5.2**: Which date field should drive period assignment?
- [ ] `tour_date` (when the tour occurred) - **Current V2 SQL**
- [ ] Booking/confirmation date?
- [ ] Payment posting date?

**Q5.3**: Are there any historical tours from 2025 or earlier that should be included in 2026 comp calculations?
- Late bookings?
- Retroactive adjustments?

---

## 6. Additional Comp Components (Future)

### Questions

**Q6.1**: Beyond tour-based payouts, are there other compensation components for marketing reps we should plan for?
- Package sales bonuses?
- Quality/conversion bonuses?
- SPIFFs or incentive programs?
- Team-based bonuses?

**Q6.2**: Do OPC marketing reps receive commission on downstream sales (VPG, contract value)?
- Or is their comp purely tour-based (as currently modeled)?

---

## 7. Manager Interventions & Audit Log

### Current State
- `fact_manager_intervention` table exists for manual comp adjustments.
- `fact_comp_admin_log` exists for audit trail.

### Questions

**Q7.1**: What types of manual interventions should the app support?
- Payout overrides?
- Tour credit reassignments?
- One-time bonuses?
- Dispute resolutions?

**Q7.2**: Who should have authorization to make these changes?
- Site managers?
- Regional directors?
- Comp team only?

---

## Priority for Immediate Action

**CRITICAL (blocks SQL finalization)**:
- Q1.1: Tour status definitions (especially `TOUR`, `null`, `APT`, `CHECKIN`)
- Q1.2: Payout rules per status
- Q2.1: Multi-rep credit attribution policy

**HIGH (affects data accuracy)**:
- Q3.1: Rep count validation
- Q4.1: Aggregate payout validation

**MEDIUM (can be deferred)**:
- Q5.1-Q5.3: Period aggregation
- Q6.1-Q6.2: Future comp components
- Q7.1-Q7.2: Manager intervention workflow

---

## How to Respond

Please provide answers in this format:

```
Q1.1: [Your answer]
Q1.2: [Your answer with specific dollar amounts if applicable]
Q2.1: [Select option A/B/C/D/E and explain]
...etc
```

**Target Response Time**: Within 2 business days to unblock SQL finalization and production deployment.

**Point of Contact**: [Your name/team]
**Follow-up Channel**: [Email/Slack/Teams channel]

---

## Appendix: Current V2 SQL Status

**File**: `data/comp/edw_dev_hris/16_materialize_marketing_core_REVISED_V2.sql`

**Status**: ✅ Executes successfully, no row duplication, reasonable aggregate numbers

**Blockers**: Business rule clarification only (questions above)

**Next Steps After Answers**:
1. Update SQL payout logic based on status rules
2. Update multi-rep credit logic
3. Add rep filtering if needed
4. Run final validation
5. Deploy to production
6. Rebuild and deploy app (`npm run deploy`)
