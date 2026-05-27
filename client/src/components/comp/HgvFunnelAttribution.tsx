import { useState, useMemo } from 'react';
import { PhoneCall, Compass, Target, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/compFormat';

export function HgvFunnelAttribution() {
  // Slider state: Mix of A-Leads (Lead Quality)
  const [aLeadPct, setALeadPct] = useState(25);
  const [activeTab, setActiveTab] = useState<'funnel' | 'attribution' | 'lead-quality'>('funnel');

  // Dynamic calculations for Marketing Lead Quality incentives
  const calculatedMetrics = useMemo(() => {
    // A-leads have high VPG and high show rates. D-leads have low show rates and low VPG.
    // Base assumptions matching operational audit and lead-quality process assessment findings:
    const showRate = 60 + (aLeadPct / 100) * 30; // 60% to 90%
    const vpg = 500 + (aLeadPct / 100) * 1100;    // $500 to $1600 VPG
    const closeRate = 12 + (aLeadPct / 100) * 18; // 12% to 30% close rate
    
    // Marketing Rep commission base:
    // Sells tours, but gets a "Lead Quality Booster" if shown tours convert to timeshares or have high VPG.
    const baseTourPay = 1500; // flat rate
    const qualityBooster = (vpg / 1000) * 800 + (closeRate / 10) * 500;
    const totalPayout = baseTourPay + qualityBooster;

    return {
      showRate: Math.round(showRate),
      vpg: Math.round(vpg),
      closeRate: Math.round(closeRate * 10) / 10,
      totalPayout: Math.round(totalPayout),
      boosterEarned: Math.round(qualityBooster)
    };
  }, [aLeadPct]);

  return (
    <div className="glass-card" style={{ padding: '2rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-gold">
            <Sparkles size={10} style={{ marginRight: 2 }} />
            Funnel &amp; Lead Quality Strategy
          </span>
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          HGV Star Funnel &amp; <span className="text-gold-gradient">Attribution Control</span>
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', lineHeight: 1.4 }}>
          Tracks lead attribution and incentive mechanics. Designed to resolve disjointed incentives by reinforcing pay-for-performance.
        </p>
      </div>

      {/* ── Sub Tabs ── */}
      <div className="tab-bar" style={{ width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('funnel')}
          className={`tab-item${activeTab === 'funnel' ? ' active' : ''}`}
        >
          3-Tier Journey Funnel
        </button>
        <button
          onClick={() => setActiveTab('attribution')}
          className={`tab-item${activeTab === 'attribution' ? ' active' : ''}`}
        >
          Attribution Split
        </button>
        <button
          onClick={() => setActiveTab('lead-quality')}
          className={`tab-item${activeTab === 'lead-quality' ? ' active' : ''}`}
        >
          Lead Quality Calculator
        </button>
      </div>

      <div className="divider" />

      {/* ── Tab Content ── */}
      <div>
        
        {/* 1. 3-TIER JOURNEY FUNNEL */}
        {activeTab === 'funnel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Step Explanation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 8 }}>
                  <PhoneCall size={14} color="var(--primary)" />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>1. Call Center</span>
                </div>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>Sells Packages</h4>
                <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Cold-calls prospective lists &amp; call-ins. Secures deposit packages.
                </p>
              </div>

              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 8 }}>
                  <Compass size={14} color="var(--gold-light)" />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>2. Marketing</span>
                </div>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>Books Property Tours</h4>
                <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Activates open packages, confirms travel dates, and books on-site presentation slots.
                </p>
              </div>

              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 8 }}>
                  <Target size={14} color="var(--success)" />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>3. Sales Exec Desk</span>
                </div>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>Closes Timeshares</h4>
                <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Conducts the lifetime-value tour presentation and closes the timeshare contracts.
                </p>
              </div>

            </div>

            {/* Visual Funnel Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
              
              {/* Funnel Block 1: Call Center */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  background: 'linear-gradient(90deg, rgba(26,109,255,0.15) 0%, rgba(26,109,255,0.05) 100%)',
                  border: '1px solid rgba(26, 109, 255, 0.25)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)' }}>STAGE 1: TELEMARKETING</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>Vacation Package Sales</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>12,400 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground-muted)' }}>Sold</span></div>
                  <div style={{ fontSize: '10px', color: 'var(--foreground-muted)' }}>7,200 Active (58% rate)</div>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight size={14} color="var(--foreground-muted)" style={{ transform: 'rotate(90deg)', margin: '-2px 0' }} />

              {/* Funnel Block 2: Marketing */}
              <div
                style={{
                  width: '90%',
                  maxWidth: '450px',
                  background: 'linear-gradient(90deg, rgba(201,162,39,0.15) 0%, rgba(201,162,39,0.05) 100%)',
                  border: '1px solid rgba(201, 162, 39, 0.25)',
                  borderRadius: '12px',
                  padding: '0.875rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--gold-light)' }}>STAGE 2: MARKETING</span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>Booked &amp; Shown Tours</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>8,500 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground-muted)' }}>Booked</span></div>
                  <div style={{ fontSize: '10px', color: 'var(--foreground-muted)' }}>6,120 Shown (72% rate)</div>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight size={14} color="var(--foreground-muted)" style={{ transform: 'rotate(90deg)', margin: '-2px 0' }} />

              {/* Funnel Block 3: Sales */}
              <div
                style={{
                  width: '80%',
                  maxWidth: '400px',
                  background: 'linear-gradient(90deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--success)' }}>STAGE 3: SALES DESK</span>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>Timeshares Closed</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--success)' }}>1,224 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground-muted)' }}>Deals</span></div>
                  <div style={{ fontSize: '10px', color: 'var(--foreground-muted)' }}>20% Final Conversion</div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 2. ATTRIBUTION SPLIT */}
        {activeTab === 'attribution' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <p style={{ fontSize: '12px', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
              A timeshare deal closed by Sales can be attributed back to two distinct selling avenues, each initiating from a different funnel path.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr md:grid-cols-2', gap: '1.5rem' }}>
              
              {/* Avenue 1: Call Center */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(26,109,255,0.2)', borderRadius: 'var(--radius)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-blue">45% of Sales</span>
                  <PhoneCall size={16} color="var(--primary)" />
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--foreground)' }}>Call Center Selling Avenue</h4>
                  <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    Attributed when a remote telemarketing agent sells a package, activations confirms dates, and the guest tours.
                  </p>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--foreground-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Average VPG:</span>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>$880 VPG</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--foreground-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Reps Incentivized:</span>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>Call Center &amp; Sales rep</span>
                </div>
              </div>

              {/* Avenue 2: Direct Marketing */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: 'var(--radius)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-gold">55% of Sales</span>
                  <Compass size={16} color="var(--gold)" />
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--foreground)' }}>Direct Marketing Avenue</h4>
                  <p style={{ fontSize: '11px', color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    Attributed when direct local marketing (OPC, In-House, referrals) books a guest direct to property.
                  </p>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--foreground-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Average VPG:</span>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>$1,150 VPG</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--foreground-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Reps Incentivized:</span>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>Marketing &amp; Sales rep</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 3. LEAD QUALITY INCENTIVE CALCULATOR */}
        {activeTab === 'lead-quality' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '0.75rem' }}>
              <p style={{ fontSize: '11.5px', color: 'var(--foreground-muted)', lineHeight: 1.4 }}>
                <strong>Operational Quality Process Fix:</strong> Instead of paying marketing representatives purely on <i>tour volume</i> (which led to booking unqualified tours), HGV’s new model incentives marketing reps based on **Lead Quality**.
              </p>
            </div>

            {/* Interactive Slider */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>ABC Lead Quality Mix (% A-Leads)</span>
                <span className="badge badge-gold" style={{ fontSize: 11, fontWeight: 800 }}>
                  {aLeadPct}% Hot A-Leads
                </span>
              </div>

              {/* Custom Slider */}
              <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: 'var(--bg-overlay)', borderRadius: 999 }} />
                <div style={{ position: 'absolute', left: 0, width: `${aLeadPct}%`, height: 6, background: 'var(--gold)', borderRadius: 999 }} />
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="5"
                  value={aLeadPct}
                  onChange={(e) => setALeadPct(Number(e.target.value))}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 10
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `calc(${aLeadPct}% - 10px)`,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    border: '3px solid var(--gold)',
                    boxShadow: 'var(--shadow-sm)',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--foreground-faint)', fontWeight: 600 }}>
                <span>RECYCLED / COLD LEADS</span>
                <span>HARMONIOUS LUXURY TARGET</span>
              </div>

            </div>

            {/* Dynamic Results Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.75rem 1rem', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>Show Rate</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gold-light)', marginTop: 2 }}>{calculatedMetrics.showRate}%</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.75rem 1rem', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>VPG Contribution</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-hover)', marginTop: 2 }}>{formatCurrency(calculatedMetrics.vpg)}</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.75rem 1rem', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>Close Rate</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--foreground)', marginTop: 2 }}>{calculatedMetrics.closeRate}%</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.75rem 1rem', borderRadius: 8, textAlign: 'center', boxShadow: 'var(--shadow-glow)' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Est Payout</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>{formatCurrency(calculatedMetrics.totalPayout)}</div>
              </div>

            </div>

            <div style={{ fontSize: '10.5px', color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(34, 197, 94, 0.03)', border: '1px dashed rgba(34, 197, 94, 0.2)', padding: '0.75rem', borderRadius: 8 }}>
              <ShieldCheck size={14} color="var(--success)" style={{ flexShrink: 0 }} />
              <span>
                <strong>Lead Quality Booster:</strong> Higher VPG and close rates earned a quality multiplier booster of <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(calculatedMetrics.boosterEarned)}</span> on top of baseline tour pay!
              </span>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
