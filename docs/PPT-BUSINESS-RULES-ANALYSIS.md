# PPT Business Rules Analysis - IGNITE Current State Assessment

**Source:** `HGV - IGNITE - Current State Assessment 2026.05.020 Shared with JB and Team (1).pptx`  
**Date:** 2026-06-17  
**Key Finding:** The business rules we need are **THE PROBLEM** IGNITE is meant to solve.

---

## Executive Summary

The three outstanding questions about the SQL logic (multi-rep credit, BOOKED status payout, rep count) are **explicitly listed as governance gaps and friction points** in the PPT. HGV's current process is:

1. **Inconsistent** (varies by site)
2. **Manual** (requires manual credit adjustments)
3. **Focused on volume over quality** (pays on bookings, not outcomes)

IGNITE's goal is to move HGV **FROM legacy practices TO market standards**.

---

## Key PPT Findings

### Slide 67: Areas of Friction / Divergence

> **"Attribution across Marketing and Sales: How should credit be shared?"**

This is listed under **"Areas of Friction / Divergence"** — meaning **it's an open question**, not a documented policy.

**Implication:** Multi-rep credit policy is part of what IGNITE needs to define.

---

### Slide 60: Governance Gaps

> "Decentralized execution and decision-making drives **inconsistent rules (tours, VPG crediting, payouts, SPIFF budget usage)**"

> "**Unclear process for assigning credit**, requiring manual updates when deals close months after initial rep engagement"

**Current State:**
- Credit assignment is **manual and inconsistent**
- Varies by site and role
- Requires retroactive adjustments

**Implication:** No standardized multi-rep or credit attribution policy exists.

---

### Slide 40: Marketing Rep Plan (HGV vs. Market)

> "HGV is generally focused on **number of tours booked** and packages sold whereas **market plans generally place primary emphasis on tour generation / show-ups**, with some plans also rewarding downstream purchase outcomes"

**Current HGV Practice:**
- Pays on **tours booked** (not shown)

**Market Standard (What IGNITE Should Implement):**
- Pays on **show-ups / shown tours**
- Rewards **downstream purchase outcomes**
- Emphasizes **quality over volume**

**Implication:** BOOKED status should **NOT** trigger payout (tour hasn't happened yet). Pay on SHOW.

---

### Slide 44: Telemarketing Roles - Tensions

> **Tension:** "Volume focus may hurt downstream tour quality and margin"

> "Converting demand into **booked, high-quality tours**"

**Problem:** Paying on bookings incentivizes volume over quality.

**IGNITE Goal:** Shift focus to **shown tours and conversion outcomes**.

---

### Slide 48: Telemarketing Rep Plan - Metrics

**HGV Current Metrics (1-5 metrics):**
- Net Package Sales
- Conversion %
- **Tours Booked**
- Number of Arrivals
- Show
- VPG

**Market Standard:**
- **Booked Tours / Package Sales**
- **Show-ups / Show Rate** ← PRIMARY METRIC
- **Downstream purchase outcomes on booked tours**

**Implication:** Market pays on SHOWN tours, not BOOKED tours.

---

## Recommended SQL Policy (Based on Market Standards)

Since IGNITE's goal is to move HGV to **market-leading practices**, the V2 SQL should implement **market standard** rules, not legacy HGV practices:

### 1. Multi-Rep Credit (23% of tours)

**Legacy HGV:** Inconsistent, manual, varies by site  
**Market Standard:** Not explicitly stated in PPT  
**V2 SQL Recommendation:** **First OPC rep gets full credit**

**Rationale:**
- Deterministic and consistent (solves "governance gap")
- Prevents double-counting
- Can be refined later based on stakeholder feedback

**Alternative (if HGV wants to split):**
- Divide payout evenly among all OPC reps
- Requires SUM(payout) / COUNT(reps) calculation

---

### 2. BOOKED Status Payout

**Legacy HGV:** Pays on "tours booked" (Slide 40)  
**Market Standard:** Pays on "show-ups" (Slide 40, 48)  
**V2 SQL Recommendation:** **BOOKED = $0** (no payout until tour occurs)

**Rationale:**
- Aligns with market standard (pay on outcomes, not bookings)
- Reduces "volume over quality" problem (Slide 44)
- Tour hasn't happened yet, so no value delivered

**Tour Status → Payout Mapping:**
```sql
'SHOW' → $75 (qualified tour)
'SHOW - NO TOUR' → $20 (courtesy)
'NO SHOW' → $0 (no show)
'CANCELLED' → $0 (cancelled)
'BOOKED' → $0 (not yet occurred)
```

---

### 3. Rep Count (9,265 reps)

**Legacy HGV:** Varies by site, inconsistent rosters  
**V2 SQL Filter:** All reps with 2026 tours assigned  
**Recommendation:** **Validate count with HGV, may need team/office filter**

**Possible Refinements:**
- Filter by `opc_team_code` (if specific teams are marketing-only)
- Filter by `office_code` (if specific offices are marketing-only)
- Filter by `is_active` flag (if available)

---

## Decision Matrix: Legacy vs. Market Standard

| Policy | Legacy HGV (Problem) | Market Standard (IGNITE Goal) | V2 SQL Implements |
|--------|----------------------|-------------------------------|-------------------|
| **Payout Trigger** | Tours booked | Show-ups / shown tours | Market (SHOW = $75) |
| **BOOKED Status** | Pays immediately | No payout until shown | Market ($0) |
| **Multi-Rep Credit** | Manual, inconsistent | Not specified | First rep (deterministic) |
| **Quality Focus** | Volume-driven | Outcome-driven | Market (pay on SHOW) |
| **Governance** | Decentralized, varies by site | Standardized, consistent | Standardized in V2 |

---

## Validation Questions for HGV Stakeholders

Before finalizing V2 SQL, confirm:

1. **Multi-Rep Credit:**
   - Should first OPC rep get full credit? (V2 default)
   - Or split credit evenly among all OPC reps?
   - Or designate a "primary" rep in the data?

2. **BOOKED Status:**
   - Confirm BOOKED = $0 (market standard)
   - Or pay courtesy rate ($20) as placeholder?

3. **Rep Count:**
   - Is 9,265 the correct count for active 2026 marketing reps?
   - Or need to filter by team_code, office_code, or other criteria?

4. **IGNITE Policy:**
   - Should V2 implement **market standards** (pay on shown tours)?
   - Or preserve **legacy HGV** practices (pay on booked tours)?

---

## Conclusion

The PPT **explicitly identifies these business rules as problems** IGNITE is meant to solve:

- **Slide 67:** "How should credit be shared?" (open question)
- **Slide 60:** "Unclear process for assigning credit" (governance gap)
- **Slide 40:** HGV pays on "booked" but should move to "shown" (market standard)

**V2 SQL implements market standards** (pay on SHOW, not BOOKED) to align with IGNITE's goals. The multi-rep credit logic (first rep) is a reasonable default that solves the "inconsistent rules" problem.

**Next Step:** Run V2 SQL, validate results, and confirm policies with HGV stakeholders.

---

**END OF ANALYSIS**
