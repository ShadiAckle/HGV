import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';

// Helper to inject styled glassmorphic overlay banner inside the browser page
const injectOverlay = async (page: any) => {
  await page.evaluate(() => {
    if (document.getElementById('demo-overlay-banner')) return;
    
    const div = document.createElement('div');
    div.id = 'demo-overlay-banner';
    div.style.position = 'fixed';
    div.style.bottom = '24px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%) translate3d(0, 20px, 0)';
    div.style.width = '90%';
    div.style.maxWidth = '920px';
    div.style.background = 'rgba(7, 11, 22, 0.9)';
    div.style.backdropFilter = 'blur(16px)';
    div.style.border = '1px solid rgba(229, 169, 60, 0.4)'; // brushed HGV gold border
    div.style.borderRadius = '12px';
    div.style.padding = '1rem 1.35rem';
    div.style.zIndex = '999999';
    div.style.color = '#ffffff';
    div.style.fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    div.style.boxShadow = '0 15px 40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '0.75rem';
    div.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    div.style.opacity = '0';
    div.style.pointerEvents = 'none';
    
    // Left pulsing gold indicator dot
    const indicator = document.createElement('div');
    indicator.style.width = '8px';
    indicator.style.height = '8px';
    indicator.style.borderRadius = '50%';
    indicator.style.background = 'linear-gradient(135deg, #e5a93c 0%, #ff8c00 100%)';
    indicator.style.boxShadow = '0 0 10px #e5a93c';
    indicator.style.flexShrink = '0';
    indicator.style.animation = 'gold-glow 1.5s infinite alternate';
    
    // Text container
    const textContainer = document.createElement('div');
    textContainer.style.flex = '1';
    
    const title = document.createElement('div');
    title.id = 'demo-overlay-title';
    title.style.fontSize = '8.5px';
    title.style.fontWeight = '800';
    title.style.textTransform = 'uppercase';
    title.style.letterSpacing = '0.08em';
    title.style.color = '#e5a93c';
    title.style.marginBottom = '2px';
    title.innerText = 'HGV IGNITE SYSTEM WALKTHROUGH';
    
    const body = document.createElement('div');
    body.id = 'demo-overlay-text';
    body.style.fontSize = '11.5px';
    body.style.fontWeight = '500';
    body.style.lineHeight = '1.45';
    body.style.color = '#e2e8f0';
    body.innerText = 'Initializing interactive console...';
    
    textContainer.appendChild(title);
    textContainer.appendChild(body);
    
    div.appendChild(indicator);
    div.appendChild(textContainer);
    document.body.appendChild(div);
    
    // Inject animation styles
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes gold-glow {
        0% { transform: scale(0.9); box-shadow: 0 0 4px #e5a93c; }
        100% { transform: scale(1.1); box-shadow: 0 0 12px #e5a93c; }
      }
    `;
    document.head.appendChild(style);
  });
};

// Helper to dynamically update the text overlay with a sleek transition
const updateOverlay = async (page: any, text: string, subtitle = 'HGV IGNITE SYSTEM WALKTHROUGH') => {
  await page.evaluate(({ txt, sub }) => {
    const banner = document.getElementById('demo-overlay-banner');
    const title = document.getElementById('demo-overlay-title');
    const body = document.getElementById('demo-overlay-text');
    if (banner && title && body) {
      // Fade & slide down
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(-50%) translate3d(0, 15px, 0)';
      
      setTimeout(() => {
        title.innerText = sub.toUpperCase();
        body.innerText = txt;
        // Fade & slide up
        banner.style.opacity = '1';
        banner.style.transform = 'translateX(-50%) translate3d(0, 0, 0)';
      }, 300);
    }
  }, { txt: text, sub: subtitle });
  await page.waitForTimeout(2200); // 2.2s delay to allow reading the caption overlay
};

test('record E2E demo walkthrough video with annotations', async ({ browser }) => {
  // 10-minute timeout to allow thorough and smooth demonstration walks
  test.setTimeout(600000);

  const context = await browser.newContext({
    recordVideo: {
      dir: join(process.cwd(), '.smoke-test-videos'),
      size: { width: 1024, height: 576 }
    },
    viewport: { width: 1024, height: 576 },
    extraHTTPHeaders: {
      'x-user-username': 'Vance', // Launch as manager M. Vance (L9) by default
    }
  });

  const page = await context.newPage();

  const mockScenarios = [
    { "scenario_id": "SCN-BASELINE", "scenario_name": "Baseline Plan", "period_id": "2026-Q2", "quota_change_pct": 0, "commission_rate_pct": 6, "bonus_rate_change_pct": 0, "accelerator_change_pct": 0, "created_by": "system", "projected_payouts": 14200000, "budget_impact": 0, "projected_cost": 14200000, "expected_performance_pct": 82.0 },
    { "scenario_id": "SCN-SIM-01", "scenario_name": "Q2 Strategy Recommendation", "period_id": "2026-Q2", "quota_change_pct": 10, "commission_rate_pct": 6, "bonus_rate_change_pct": 5, "accelerator_change_pct": 10, "created_by": "system", "projected_payouts": 15800000, "budget_impact": 1600000, "projected_cost": 15800000, "expected_performance_pct": 87.5 },
    { "scenario_id": "SCN-PLAN-A", "scenario_name": "Optimal NOI Alignment Plan", "period_id": "2026-Q2", "quota_change_pct": 15, "commission_rate_pct": 6.5, "bonus_rate_change_pct": 10, "accelerator_change_pct": 20, "created_by": "system", "projected_payouts": 17200000, "budget_impact": 3000000, "projected_cost": 17200000, "expected_performance_pct": 91.2 },
    { "scenario_id": "SCN-SPIFF-Q1", "scenario_name": "Ocean Breeze Q2 SPIFF", "period_id": "2026-Q2", "quota_change_pct": 0, "commission_rate_pct": 6, "bonus_rate_change_pct": 0, "accelerator_change_pct": 0, "created_by": "system", "projected_payouts": 14215000, "budget_impact": 15000, "projected_cost": 14215000, "expected_performance_pct": 84.5 },
    { "scenario_id": "SCN-LOA-ADJ", "scenario_name": "LOA Compensation Shield", "period_id": "2026-Q2", "quota_change_pct": 0, "commission_rate_pct": 6, "bonus_rate_change_pct": 0, "accelerator_change_pct": 0, "created_by": "system", "projected_payouts": 14202000, "budget_impact": 2000, "projected_cost": 14202000, "expected_performance_pct": 82.2 },
    { "scenario_id": "SCN-HIGH-RAMP", "scenario_name": "New Hire Action Line Ramp", "period_id": "2026-Q2", "quota_change_pct": -10, "commission_rate_pct": 6, "bonus_rate_change_pct": 5, "accelerator_change_pct": 15, "created_by": "system", "projected_payouts": 13800000, "budget_impact": -400000, "projected_cost": 13800000, "expected_performance_pct": 89.0 },
    { "scenario_id": "SCN-NOI-PROT", "scenario_name": "Margin Protection Plan", "period_id": "2026-Q2", "quota_change_pct": 5, "commission_rate_pct": 6, "bonus_rate_change_pct": 10, "accelerator_change_pct": 25, "created_by": "system", "projected_payouts": 15600000, "budget_impact": 1400000, "projected_cost": 15600000, "expected_performance_pct": 93.5 }
  ];

  // ─── AppKit SSE and REST Route Mocking ──────────────────────────────────────
  // Renders high-fidelity, consistent datasets to ensure offline E2E reliability
  await page.route('**/api/comp/user-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rep_id: "REP-MGR-01",
        rep_name: "M. Vance",
        level_code: "L9",
        team_id: "TEAM-WEST",
        team_name: "West Coast Sales",
        region: "West",
        is_manager: true,
        username: "Vance"
      })
    });
  });

  await page.route('**/api/comp/metadata', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reps: [
          { "rep_id": "REP-JASON", "rep_name": "Jason Morrison", "level_code": "L6", "team_id": "TEAM-WEST", "region": "West", "is_active": true },
          { "rep_id": "REP-DLEE", "rep_name": "D. Lee", "level_code": "L4", "team_id": "TEAM-WEST", "region": "West", "is_active": true },
          { "rep_id": "REP-RSMITH", "rep_name": "R. Smith", "level_code": "L7", "team_id": "TEAM-EAST", "region": "East", "is_active": true },
          { "rep_id": "REP-ECARTER", "rep_name": "E. Carter", "level_code": "L6", "team_id": "TEAM-WEST", "region": "West", "is_active": true },
          { "rep_id": "REP-KNGUYEN", "rep_name": "K. Nguyen", "level_code": "L6", "team_id": "TEAM-EAST", "region": "East", "is_active": true },
          { "rep_id": "REP-MGR-01", "rep_name": "M. Vance", "level_code": "L9", "team_id": "TEAM-WEST", "region": "West", "is_active": true }
        ],
        teams: [
          { "team_id": "TEAM-WEST", "team_name": "West Coast Sales", "region": "West" },
          { "team_id": "TEAM-EAST", "team_name": "East Coast Sales", "region": "East" }
        ],
        periods: [
          { "period_id": "2026-Q2", "period_label": "Q2 2026", "is_current": true },
          { "period_id": "2025-Q4", "period_label": "Q4 2025", "is_current": false }
        ],
        scenarios: mockScenarios.map(s => ({ "scenario_id": s.scenario_id, "scenario_name": s.scenario_name, "period_id": s.period_id })),
        deals: [
          { "deal_id": "DEAL-1001", "rep_id": "REP-JASON", "amount": 42000.0, "status": "APPROVED", "description": "Gold VIP Suite upgrade" }
        ]
      })
    });
  });

  // Mock LLM Copilot invoke endpoint to speed up record execution and maintain offline robustness
  await page.route('**/api/comp/copilot/invoke', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const prompt = String(body.prompt || '').toLowerCase();
    
    let content = "I am HGV Ignite Compensation Advisor. How can I help you today?";
    if (prompt.includes('booster')) {
      content = "Based on HGV Ignite governed metrics and your current active transactions, you have closed 18 deals for a total of $230,000 in volume, putting you at 92.00% quota progress. To unlock your next commission accelerator at 100.00% attainment, you need exactly $20,000 more in credited sales volume.";
    } else if (prompt.includes('lee') || prompt.includes('intervene') || prompt.includes('coaching') || prompt.includes('performance')) {
      content = "### Representative Performance Audit: D. Lee (REP-DLEE)\\n- **Current Progress:** 62.00% quota progress ($124,000 credited vs. $200,000 Q1 target).\\n- **Key Revenue Gaps:** Lacking Grand Waikikian (GWK) inventory splits. Over-indexing on low-margin Preview packages.\\n- **Actionable Coaching Directive:** Shift focus to Fee-For-Service (FFS) vacation points. Present the high-attributing Waikikian 3PH upgrade using HGV's premium standard closing playbook.";
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content } }]
      })
    });
  });

  await page.route('**/api/comp/scenarios/**', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      const url = route.request().url();
      const id = url.split('/api/comp/scenarios/')[1] || '';
      const index = mockScenarios.findIndex(s => s.scenario_id === id);
      if (index > -1) mockScenarios.splice(index, 1);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
  });

  await page.route('**/api/comp/scenarios', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockScenarios) });
    } else if (method === 'POST') {
      const postData = JSON.parse(route.request().postData() || '{}');
      const newScenario = {
        scenario_id: postData.scenario_id || 'SCN-PLAN-B',
        scenario_name: postData.scenario_name || 'SCN-PLAN-B',
        period_id: '2026-Q2',
        quota_change_pct: Number(postData.quota_change_pct || 0),
        commission_rate_pct: Number(postData.commission_rate_pct || 6),
        bonus_rate_change_pct: Number(postData.bonus_rate_change_pct || 0),
        accelerator_change_pct: Number(postData.accelerator_change_pct || 0),
        created_by: 'user_created',
        projected_payouts: 16800000,
        budget_impact: 2600000,
        projected_cost: 16800000,
        expected_performance_pct: 88.5
      };
      mockScenarios.push(newScenario);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, ...newScenario })
      });
    }
  });

  await page.route('**/api/analytics/query/**', async (route) => {
    const url = route.request().url();
    const queryKey = url.split('/api/analytics/query/')[1]?.split('?')[0] || '';
    
    let mockData: any = [];
    if (queryKey === 'comp_rep_kpi') {
      mockData = [{"qtd_earnings": 18750.0, "quota_attainment_pct": 92.0, "contracts_closed": 18, "next_rate_booster_threshold": 100.0, "next_rate_booster_gap": 20000.0}];
    } else if (queryKey === 'comp_rep_earnings_breakdown') {
      mockData = [{"base_earnings": 5000.0, "commission_earnings": 10500.0, "booster_earnings": 3250.0}];
    } else if (queryKey === 'comp_rep_deals') {
      mockData = [
        {"deal_id": "DEAL-1001", "close_date": "2025-02-14", "product_code": "PROD-GWK", "volume": 42000.0, "earnings": 2500.0, "status": "CREDITED"},
        {"deal_id": "DEAL-1002", "close_date": "2025-02-28", "product_code": "PROD-UPSELL", "volume": 18500.0, "earnings": 1100.0, "status": "CREDITED"},
        {"deal_id": "DEAL-1003", "close_date": "2025-03-10", "product_code": "PROD-CLUB", "volume": 25000.0, "earnings": 1500.0, "status": "PENDING"}
      ];
    } else if (queryKey === 'comp_rep_monthly_attainment') {
      mockData = [
        {"month_label": "Jan", "attainment_pct": 85.0},
        {"month_label": "Feb", "attainment_pct": 95.0},
        {"month_label": "Mar", "attainment_pct": 92.0}
      ];
    } else if (queryKey === 'comp_team_kpi') {
      mockData = [{"team_attainment_pct": 92.0, "top_performer_count": 2, "at_risk_count": 1, "ffs_sales_pct": 14.5, "ffs_target_pct": 15.0, "ffs_gap_pct": -0.5, "team_name": "West Coast Sales"}];
    } else if (queryKey === 'comp_team_agent_performance') {
      mockData = [
        {"agent_name": "Jason Morrison", "level": "L6", "quota_attainment_pct": 92.0, "ffs_sales_pct": 12.0, "total_earnings": 18750.0},
        {"agent_name": "R. Smith", "level": "L8", "quota_attainment_pct": 105.0, "ffs_sales_pct": 24.0, "total_earnings": 23500.0},
        {"agent_name": "E. Carter", "level": "L5", "quota_attainment_pct": 78.0, "ffs_sales_pct": 14.0, "total_earnings": 14900.0},
        {"agent_name": "D. Lee", "level": "L4", "quota_attainment_pct": 62.0, "ffs_sales_pct": 9.0, "total_earnings": 10700.0},
        {"agent_name": "K. Nguyen", "level": "L7", "quota_attainment_pct": 96.0, "ffs_sales_pct": 20.0, "total_earnings": 19700.0}
      ];
    }
    
    const bodyStr = `data: ${JSON.stringify({ type: 'result', data: mockData })}\n\n`;
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      body: bodyStr,
    });
  });

  // Mock Comp Admin and Finance REST APIs
  await page.route('**/api/comp/admin/**', async (route) => {
    const url = route.request().url();
    let data: any = {};
    if (url.includes('eligibility')) {
      data = {
        eligibility: { rep_id: "REP-JASON", period_id: "2026-Q2", plan_version_id: "PLAN-FT-2026", plan_name: "Full-Time 2025 Commission Plan", job_code: "FT-SALES-L6", location_code: "LAS", brand: "HGV", effective_start: "2026-04-01", proration_pct: 100.0, eligibility_flag: true },
        rep: { rep_id: "REP-JASON", rep_name: "Jason Morrison", level_code: "L6", team_id: "TEAM-WEST", region: "West" },
      };
    } else if (url.includes('payout-trail')) {
      data = {
        quota: { quota_amount: 250000.0, credited_amount: 230000.0, attainment_pct: 92.0, deals_closed_count: 18 },
        payout: { base_pay: 5000.0, commission: 10500.0, bonus: 3250.0, total_earnings: 18750.0, total_paid: 15000.0 },
        deals: [
          { deal_id: "DEAL-1001", credit_amount: 2500.0, credit_status: "APPROVED", property_display_name: "Gold VIP Suite", product_line_id: "PROD-GWK", credit_date: "2025-02-14" }
        ],
        adjustments: [
          { event_id: "ADJ-01", event_type: "ADJUSTMENT", amount: 1250.0, reason: "Deal Correction", approved_by: "J. Barsoum", created_at: "2026-05-15" }
        ],
        summary: { deals_credited: 18, total_adjustments: 1250.0, net_commission_after_adj: 11750.0, plan_version: "PLAN-FT-2026" }
      };
    } else if (url.includes('chargebacks')) {
      data = {
        chargebacks: [
          { chargeback_id: "CB-01", deal_id: "DEAL-004", rep_id: "REP-JASON", period_id: "2026-Q2", original_commission: 1500.0, chargeback_amount: 1500.0, reserve_held: 150.0, reserve_released: 0.0, reason: "RESCISSION", status: "OPEN" }
        ],
        totals: { total_chargebacks: 1500.0, total_reserve_held: 150.0, total_reserve_released: 0.0, open_count: 1, closed_count: 0 }
      };
    } else if (url.includes('adjustments')) {
      data = {
        adjustments: [
          { event_id: "ADJ-01", rep_id: "REP-JASON", period_id: "2026-Q2", event_type: "ADJUSTMENT", amount: 1250.0, reason: "Deal Correction", approved_by: "J. Barsoum", created_at: "2026-05-15" }
        ],
        pending_approvals: 0
      };
    } else if (url.includes('audit-log')) {
      data = {
        events: [
          { event_id: "ADJ-01", rep_id: "REP-JASON", period_id: "2026-Q2", event_type: "ADJUSTMENT", amount: 1250.0, reason: "Deal Correction", approved_by: "J. Barsoum", created_at: "2026-05-15" }
        ],
        total: 1
      };
    } else if (url.includes('data-quality')) {
      data = { data_issues: [], resolved_issues: [], total_deals: 50, clean_pct: 100 };
    } else if (url.includes('payroll-preview')) {
      data = {
        payroll: [
          { rep_id: "REP-JASON", rep_name: "Jason Morrison", level_code: "L6", region: "West", base_pay: 5000.0, commission: 10500.0, bonus: 3250.0, total_earnings: 18750.0, total_paid: 15000.0, manual_adjustments: 1250.0, net_payable: 20000.0 }
        ],
        grand_total: 20000.0,
        period_id: "2026-Q2"
      };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.route('**/api/comp/finance/**', async (route) => {
    const url = route.request().url();
    let data: any = {};
    if (url.includes('cost-summary')) {
      data = {
        by_role: [{ level_code: "L6", headcount: 3, total_comp: 55000.0, avg_comp: 18333.33, total_commission: 35000.0, total_bonus: 20000.0 }],
        totals: { total_comp: 55000.0, avg_comp: 18333.33, total_commission: 35000.0, total_bonus: 20000.0, headcount: 3 },
        nsv: { total_nsv: 500000.0, tour_count: 150, closed_nsv: 350000.0 },
        var_comp_pct_of_nsv: 11.0,
        budget_comp: 14500000,
        budget_variance: -14445000
      };
    } else if (url.includes('tour-quality')) {
      data = {
        matrix: [{ lead_source: "OPC", abc_score: "A", tour_count: 20, showed_count: 19, closed_count: 8, avg_vpg: 1450.0, total_nsv: 180000.0, rescission_count: 0, avg_ebitda: 32000.0 }],
        summary: { total_tours: 150, total_showed: 120, total_closed: 45, total_rescissions: 2, overall_vpg: 1100.0, total_nsv: 500000.0, total_ebitda: 95000.0 }
      };
    } else if (url.includes('lead-performance')) {
      data = { lead_performance: [{ abc_score: "A", total_tours: 50, showed: 45, closed: 20, show_rate_pct: 90.0, close_rate_pct: 44.4, avg_vpg: 1500.0, rescission_rate_pct: 5.0, total_nsv: 300000.0, avg_ebitda_per_tour: 1100.0 }] };
    } else if (url.includes('roi-analysis')) {
      data = { spiff_events: [{ event_id: "SPIFF-01", rep_id: "REP-JASON", amount: 500.0, reason: "Contest SPIFF", approved_by: "J. Barsoum", created_at: "2025-02-28" }], total_spiff_cost: 500.0, incremental_nsv_estimate: 2400000.0, roi_ratio: 4.8, roi_threshold: 3.0, exceeds_threshold: true, spiff_count: 1 };
    } else if (url.includes('chargeback-exposure')) {
      data = { by_status: [{ status: "OPEN", count: 1, original_commission: 1500.0, chargeback_amount: 1500.0, reserve_held: 150.0, reserve_released: 0.0 }], totals: { open_reserve: 150.0, total_chargedback: 1500.0, total_released: 0.0 } };
    } else if (url.includes('accrual-summary')) {
      data = { payout: { total_commission: 10500.0, total_bonus: 3250.0, total_earned: 18750.0, total_paid: 15000.0 }, chargebacks: { total_reserve_held: 150.0, total_released: 0.0, total_chargebacks: 1500.0 }, accrual_to_book: 3750.0, open_reserve_liability: 150.0, accrual_basis: "Monthly earned, true-up quarterly", payroll_lock_date: "2025-04-15" };
    } else if (url.includes('pay-for-perf')) {
      data = { reps: [{ rep_id: "REP-JASON", rep_name: "Jason Morrison", level_code: "L6", region: "West", total_earnings: 18750.0, commission: 10500.0, attainment_pct: 92.0, credited_amount: 230000.0, deals_closed_count: 18, vpg: 1250.0, earnings_per_sale: 1041.0 }] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.route('**/api/admin/varicent/ingest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        message: 'Varicent data ingested successfully to Delta Lake!',
        validCount: 3,
        invalidCount: 0,
        tablesAffected: ['dim_rep'],
        statementsCount: 3,
        preflight: { columns: [], rowsCount: 3, mode: 'MERGE' }
      })
    });
  });

  // ─── E2E walkthrough ────────────────────────────────────────────────────────

  // 1. Load Overview page
  await page.goto('/');
  await injectOverlay(page);
  await updateOverlay(page, 'Welcome to the HGV IGNITE Compensation Hub: A modern, high-contrast console connected directly to Databricks Unity Catalog star schemas.', 'Overview Landing Portal');

  // 2. Click on 'My Comp' tab
  await updateOverlay(page, 'Navigating to the My Compensation Tab — the personal dashboard for frontline sales representatives.', 'Frontline Seller View');
  await page.click('#nav-my-comp');
  await page.waitForTimeout(3000);

  // 3. Open identity dropdown and select "Jason" (Sales Rep)
  await updateOverlay(page, 'Using the Impersonation dropdown switcher to view the screen through Sales Executive Jason Morrison\'s credentials.', 'Role Simulation');
  await page.click('#nav-identity-picker');
  await page.waitForTimeout(1500);
  await page.locator('button', { hasText: /Jason/ }).first().click();
  await page.waitForTimeout(3500);

  // 4. Highlight Quota & Booster metrics
  await updateOverlay(page, 'Jason views his QTD Earnings ($18,750), base/commission Pay Mix Volatility, and his active Quota Attainment progress (92.00%).', 'Reconciling Earnings & Goals');
  await page.locator('#nav-my-comp').hover();
  await page.waitForTimeout(3000);

  // 5. Ask Rep Copilot "How close am I to my next rate booster?"
  await updateOverlay(page, 'Jason uses the grounded AI Copilot to check his goals in natural language, asking: "How close am I to my next rate booster?"', 'AI Copilot Lakehouse Grounding');
  const copilotInput = page.locator('#copilot-input');
  await copilotInput.fill('How close am I to my next rate booster?');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000); // Wait for response

  // 6. Open identity dropdown again to restore manager M. Vance
  await updateOverlay(page, 'Switching identity back to Manager M. Vance to access team-wide analytics, pricing overrides, and cost controls.', 'Manager Workspace');
  await page.click('#nav-identity-picker');
  await page.waitForTimeout(1500);
  await page.locator('button', { hasText: /Vance|Johnson/ }).first().click();
  await page.waitForTimeout(3500);

  // 7. Click on 'Team Workspace' tab
  await updateOverlay(page, 'Navigating to the Team Workspace Tab — a site supervision ledger displaying our sortable performance leaderboard.', 'Manager Workspace');
  await page.click('#nav-team');
  await page.waitForTimeout(3000);

  // 8. Highlight performance risk alerts
  await updateOverlay(page, 'Underperforming representatives (attainment < 70%) are flagged with red alerts so managers can take immediate action.', 'Leaderboard & Risk Alerts');
  await page.waitForTimeout(3000);

  // 9. Trigger rep coaching intervention
  await updateOverlay(page, 'Manager Vance clicks "Intervene" on a low-attaining representative\'s row to open the Player-Coach takeover drawer.', 'Player-Coach Takeover');
  await page.locator('button:has-text("Intervene")').first().click();
  await page.waitForTimeout(2500);

  // Toggle the Takeover Pricing switch via data-testid attribute
  await page.locator('[data-testid="takeover-pricing-toggle"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="takeover-pricing-toggle"]').click();
  await page.waitForTimeout(1500);

  await updateOverlay(page, 'Submitting coaching context to the Copilot — the AI generates a customized, high-margin closing script and coaching agenda.', 'AI In-Context Coaching');
  // Click "Submit & Ask Advisor" via data-testid — this closes the drawer AND pre-populates copilot
  await page.locator('[data-testid="submit-ask-advisor"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="submit-ask-advisor"]').click();
  await page.waitForTimeout(2000);

  // Now the drawer is closed — send the pre-populated copilot message
  await page.keyboard.press('Escape'); // Ensure any remaining overlay is dismissed
  await page.waitForTimeout(500);
  const copilotInput2 = page.locator('#copilot-input').first();
  if (await copilotInput2.isVisible()) {
    await copilotInput2.focus();
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(3000);

  // 11. Go to Strategy Control Room (/admin-console)
  await updateOverlay(page, 'Navigating to the Strategy Control Room — the centralized governance dashboard for executive strategy review.', 'Strategy Control Room');
  await page.keyboard.press('Escape'); // Dismiss any overlays
  await page.waitForTimeout(300);
  await page.click('#nav-admin-console', { force: true });
  await page.waitForTimeout(3000);

  // 12. Switch to 'Scenario Modeler' sub-tab
  await updateOverlay(page, 'Opening the Scenario Modeler sub-tab. Here, leaders compare compensation plans and rebalance plan parameters.', 'Scenario Modeler');
  await page.locator('button:has-text("Scenario Modeler")').first().click();
  await page.waitForTimeout(3000);

  // 13. Rebalance Director NOI weights & strategic notes
  await updateOverlay(page, 'Interacting with industry competitive benchmark levers. We toggle the Director+ NOI weight to 65% to rebalance plans toward margin protection.', 'Director plan Rebalancing');
  await page.locator('#noi-weight-slider').fill('65');
  await page.waitForTimeout(2000);
  await page.locator('#strategic-notepad').fill('Q2 Strategy Recommendation: Shift weights to 65% NOI to protect margins and reduce talent attrition.');
  await page.waitForTimeout(4000);

  // 14. Open 'Create Scenario' modal
  await updateOverlay(page, 'Creating a new plan: opening the Scenario Creator form to model and test SCN-PLAN-B.', 'Testing Scenarios & Impact');
  await page.click('#btn-add-scenario');
  await page.waitForTimeout(3000);

  // 15. Fill out form and submit
  await updateOverlay(page, 'Setting levers: Name = "SCN-PLAN-B", Quota = +5%, Commission = 7.5%, Bonus = +15%, Accelerator = +20%.', 'Simulating Plan Parameters');
  await page.locator('#scenario-name').fill('SCN-PLAN-B (Strategy Target)');
  await page.waitForTimeout(1000);
  await page.locator('#quota-change').fill('5');
  await page.waitForTimeout(1000);
  await page.locator('#commission-rate').fill('7.5');
  await page.waitForTimeout(1000);
  await page.locator('#bonus-rate').fill('15');
  await page.waitForTimeout(1000);
  await page.locator('#accelerator-change').fill('20');
  await page.waitForTimeout(1000);
  await page.locator('#create-scenario-annotation').fill('Q2 Strategy Recommendation: aligned with competitive standards.');
  await page.waitForTimeout(3000);

  await updateOverlay(page, 'Submitting to Unity Catalog. The modeler reactively recalculates and plots projected payout models, EBITDA, and expected performance.', 'Understanding Change Impact');
  await page.click('#btn-create-scenario-submit');
  await page.waitForTimeout(6000);

  // 17. Data Model tab (default) — review blueprint
  await updateOverlay(page, 'Reviewing the Data Model blueprint: star schema entities, rep-to-plan mapping, and API-to-UI binding contract.', 'Data Model Reference');
  await page.locator('button:has-text("Data Model & Ingestion")').first().click();
  await page.waitForTimeout(3500);

  // 18. Switch to Semantic Metrics
  await updateOverlay(page, 'Opening Semantic Metrics catalog — each metric maps to a table, API route, and live UI surface.', 'Governed Semantic Layer');
  await page.locator('button:has-text("Semantic Metrics")').first().click();
  await page.waitForTimeout(3500);

  // 19. Navigate to Comp Admin Page
  await updateOverlay(page, 'Navigating to the Compensation Administration Desk — checking plan eligibility settings, audit timelines, and reserve schedules.', 'Compensation Administration Desk');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('#nav-comp-admin', { force: true });
  await page.waitForTimeout(3000);
  
  await page.locator('button:has-text("Audit Trail")').first().click();
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("Chargebacks")').first().click();
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("Payroll Preview")').first().click();
  await page.waitForTimeout(2000);

  // 21. Navigate to Finance Page
  await updateOverlay(page, 'Navigating to the Finance Intelligence tab — auditing compensation corridors (8%-12% target) and lead VPG scores.', 'Finance Intelligence Hub');
  await page.click('#nav-finance', { force: true });
  await page.waitForTimeout(3000);

  await page.locator('button:has-text("Tour Quality")').first().click();
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("SPIFF / ROI")').first().click();
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Accruals")').first().click();
  await page.waitForTimeout(2500);

  // 22. Return to Overview Home
  await updateOverlay(page, 'E2E Walkthrough complete! A fully unified, robust, type-safe, and secure console mapped completely to industry compensation specifications.', 'IGNITE Compensation Hub');
  await page.click('#nav-overview');
  await page.waitForTimeout(2000);

  // Close context to flush and save video file
  console.log('Closing page context...');
  await context.close();

  // Copy recorded video to final artifacts destination & client public assets
  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    
    // Destination 1: Artifacts
    const destDir1 = 'C:/Users/Shadi/.gemini/antigravity/brain/0b4a67db-1794-42b7-ad3f-af510958c742';
    mkdirSync(destDir1, { recursive: true });
    const destPath1 = join(destDir1, 'hgv_ignite_live_demo.webm');
    copyFileSync(videoPath, destPath1);
    console.log('Walkthrough Video saved to artifacts:', destPath1);
    
    // Destination 2: Client Public Assets
    const destDir2 = 'c:/Users/Shadi/Desktop/databricks_ai/hilton-kb-chat/client/public';
    mkdirSync(destDir2, { recursive: true });
    const destPath2 = join(destDir2, 'hgv_ignite_live_demo.webm');
    copyFileSync(videoPath, destPath2);
    console.log('Walkthrough Video saved to client public assets:', destPath2);
  } else {
    console.error('Playwright failed to record browser session video.');
  }
});
