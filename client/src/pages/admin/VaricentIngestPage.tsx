import { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, Play, RefreshCw, Layers, Database, BookOpen } from 'lucide-react';
import { parseCsv } from '../../../../scripts/etl/varicent_etl_processor';
import { VARICENT_MAPPINGS } from '../../../../scripts/etl/varicent_mapping_config';

export function VaricentIngestPage() {
  const [exportType, setExportType] = useState<'payees' | 'deals' | 'payouts'>('payees');
  const [mode, setMode] = useState<'MERGE' | 'APPEND' | 'OVERWRITE'>('MERGE');
  const [rawText, setRawText] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Status states
  const [, setIsParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message: string;
    validCount?: number;
    invalidCount?: number;
    tablesAffected?: string[];
    statementsCount?: number;
    error?: string;
  } | null>(null);

  // Db stats
  const [dbCounts, setDbCounts] = useState<{ reps: number; deals: number; payouts: number } | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  // Parse local metadata/db counts to display in UI
  const fetchDbCounts = async () => {
    setIsCounting(true);
    try {
      const res = await fetch('/api/comp/metadata');
      if (res.ok) {
        const data = await res.json();
        setDbCounts({
          reps: data.reps?.length || 0,
          deals: data.counts?.deals ?? data.deals?.length ?? 0,
          payouts: data.counts?.payouts ?? 0,
        });
      }
    } catch (err) {
      console.error('Failed to load DB counts:', err);
    } finally {
      setIsCounting(false);
    }
  };

  useEffect(() => {
    fetchDbCounts();
  }, []);

  // Client-side quick parser to show Pre-flight check!
  const preflightReport = useMemo(() => {
    if (!rawText.trim()) return null;
    try {
      let records: Record<string, any>[] = [];
      const isJson = VARICENT_MAPPINGS[exportType].sourceFormat === 'json';
      
      if (isJson) {
        const parsed = JSON.parse(rawText);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        records = parseCsv(rawText);
      }

      if (records.length === 0) return { ok: false, error: 'Empty file payload' };

      // Map field keys to show preview
      const firstRow = records[0];
      const mappingsList: { source: string; target: string }[] = [];
      
      VARICENT_MAPPINGS[exportType].targets.forEach((t: any) => {
        Object.entries(t.fields).forEach(([targetKey, fDef]: [string, any]) => {
          if (firstRow[fDef.source] !== undefined) {
            mappingsList.push({ source: fDef.source, target: targetKey });
          }
        });
      });

      return {
        ok: true,
        rowCount: records.length,
        detectedHeaders: Object.keys(firstRow),
        mappingsList,
        sampleRow: firstRow
      };
    } catch (err: any) {
      return { ok: false, error: err.message || 'JSON or CSV format mismatch' };
    }
  }, [rawText, exportType]);

  // Handle manual file uploading
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setSyncResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawText(event.target?.result as string || '');
      setIsParsing(false);
    };
    reader.onerror = () => {
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  // Trigger the real backend ingestion!
  const triggerIngest = async () => {
    if (!rawText.trim() || isSyncing) return;
    
    setIsSyncing(true);
    setSyncStep(1); // Parsing
    setSyncResult(null);

    // Multi-step loader animations
    const steps = [
      { step: 2, delay: 600 },  // Transforming
      { step: 3, delay: 1200 }, // Validating
      { step: 4, delay: 1800 }  // Syncing
    ];

    steps.forEach(({ step, delay }) => {
      setTimeout(() => {
        setSyncStep(prev => prev < 5 ? step : prev);
      }, delay);
    });

    try {
      const res = await fetch('/api/admin/varicent/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportType, rawText, mode })
      });

      const data = await res.json();
      
      // Delay response slightly so the user sees the beautiful loader finish!
      setTimeout(() => {
        if (res.ok) {
          setSyncResult({
            ok: true,
            message: data.message,
            validCount: data.validCount,
            invalidCount: data.invalidCount,
            tablesAffected: data.tablesAffected,
            statementsCount: data.statementsCount
          });
          fetchDbCounts(); // Refresh counts!
        } else {
          setSyncResult({
            ok: false,
            message: data.error || 'Ingestion failed',
            invalidCount: data.invalidCount
          });
        }
        setSyncStep(5);
        setIsSyncing(false);
      }, 2200);

    } catch (err: any) {
      setTimeout(() => {
        setSyncResult({
          ok: false,
          message: err.message || 'Network error executing ingestion statement'
        });
        setSyncStep(5);
        setIsSyncing(false);
      }, 2200);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Premium Integration Guide Banner */}
      <div className="glass-panel font-sans" style={{ padding: '2rem 2.25rem', borderLeft: '4px solid var(--gold)' }}>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex-shrink-0" style={{ padding: '0.75rem' }}>
            <BookOpen size={24} className="text-hgv-gold" />
          </div>
          <div className="space-y-3 flex-grow" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <div className="flex justify-between items-center flex-wrap gap-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-hgv-gold">Modernization Integration Guide</span>
                <h3 className="text-lg font-bold text-foreground mt-0.5">Varicent Flat-File Transition Pipeline</h3>
              </div>
              <button 
                onClick={() => setIsGuideOpen(!isGuideOpen)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-border/10 text-xs font-bold text-muted-foreground hover:bg-white/10 hover:text-foreground transition cursor-pointer"
              >
                {isGuideOpen ? 'Hide Instructions' : 'Show Instructions'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This ingestion portal serves as HGV’s intermediate manual data bridge while we migrate from legacy Varicent local flat-file exports to our fully integrated, automated Databricks Lakehouse architecture. Managers can paste or upload files to directly write and upsert records into Unity Catalog schema tables.
            </p>
            
            {isGuideOpen && (
              <div className="mt-6 pt-5 border-t border-border/10 space-y-6 animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {/* Reps */}
                  <div className="p-5 rounded-2xl bg-white/5 border border-border/5 space-y-3" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">1. Reps & Eligibility (CSV)</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Maps Varicent’s payee rosters and comp plans directly into salesperson records and active rules.
                    </p>
                    <div className="text-[10px] space-y-1.5 pt-2" style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <div className="flex justify-between border-b border-border/5 pb-1" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span className="text-muted-foreground">Source Table:</span>
                        <span className="font-mono text-foreground">Varicent Payees</span>
                      </div>
                      <div className="flex justify-between border-b border-border/5 pb-1" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span className="text-muted-foreground">Delta Target:</span>
                        <span className="font-mono text-hgv-gold">dim_rep, fact_plan_eligibility</span>
                      </div>
                      <div className="text-muted-foreground font-semibold pt-1">Key Fields Mapping:</div>
                      <ul className="list-disc pl-3 text-muted-foreground space-y-1" style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <li><code className="text-primary font-mono text-[9px]">PayeeCode</code> ➔ <code className="font-mono text-[9px]">rep_id</code></li>
                        <li><code className="text-primary font-mono text-[9px]">PayeeName</code> ➔ <code className="font-mono text-[9px]">rep_name</code></li>
                        <li><code className="text-primary font-mono text-[9px]">Level</code> ➔ <code className="font-mono text-[9px]">level_code</code></li>
                        <li><code className="text-primary font-mono text-[9px]">CompPlan</code> ➔ <code className="font-mono text-[9px]">plan_version_id</code></li>
                      </ul>
                    </div>
                  </div>

                  {/* Deals */}
                  <div className="p-5 rounded-2xl bg-white/5 border border-border/5 space-y-3" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">2. Deals & Tours (JSON)</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Syncs individual contract payouts, sales credits, showing metrics, and tour quality scores.
                    </p>
                    <div className="text-[10px] space-y-1.5 pt-2" style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <div className="flex justify-between border-b border-border/5 pb-1" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span className="text-muted-foreground">Source Table:</span>
                        <span className="font-mono text-foreground">Transaction Ledgers</span>
                      </div>
                      <div className="flex justify-between border-b border-border/5 pb-1" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span className="text-muted-foreground">Delta Target:</span>
                        <span className="font-mono text-hgv-gold">fact_deal_credit, fact_tour_quality</span>
                      </div>
                      <div className="text-[10px] space-y-1.5 pt-2" style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <span className="text-muted-foreground font-semibold">Key Fields Mapping:</span>
                        <ul className="list-disc pl-3 text-muted-foreground space-y-1 mt-1" style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <li><code className="text-primary font-mono text-[9px]">TransactionId</code> ➔ <code className="font-mono text-[9px]">deal_id</code></li>
                          <li><code className="text-primary font-mono text-[9px]">RepCode</code> ➔ <code className="font-mono text-[9px]">rep_id</code></li>
                          <li><code className="text-primary font-mono text-[9px]">CreditAmount</code> ➔ <code className="font-mono text-[9px]">amount</code></li>
                          <li><code className="text-primary font-mono text-[9px]">Rescinded</code> ➔ <code className="font-mono text-[9px]">rescission_flag</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Payouts */}
                  <div className="p-5 rounded-2xl bg-white/5 border border-border/5 space-y-3" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">3. Payouts & Quotas (CSV)</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Updates cumulative commission earnings, salary snapshots, and quota performance metrics.
                    </p>
                    <div className="text-[10px] space-y-1.5 pt-2" style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <div className="flex justify-between border-b border-border/5 pb-1" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span className="text-muted-foreground">Source Table:</span>
                        <span className="font-mono text-foreground">Payout Register</span>
                      </div>
                      <div className="flex justify-between border-b border-border/5 pb-1" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span className="text-muted-foreground">Delta Target:</span>
                        <span className="font-mono text-hgv-gold">fact_payout, fact_quota_attainment</span>
                      </div>
                      <div className="text-[10px] space-y-1.5 pt-2" style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <span className="text-muted-foreground font-semibold">Key Fields Mapping:</span>
                        <ul className="list-disc pl-3 text-muted-foreground space-y-1 mt-1" style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <li><code className="text-primary font-mono text-[9px]">EmployeeId</code> ➔ <code className="font-mono text-[9px]">rep_id</code></li>
                          <li><code className="text-primary font-mono text-[9px]">BaseSalary</code> ➔ <code className="font-mono text-[9px]">base_pay</code></li>
                          <li><code className="text-primary font-mono text-[9px]">CommissionValue</code> ➔ <code className="font-mono text-[9px]">commission</code></li>
                          <li><code className="text-primary font-mono text-[9px]">AttainmentPercent</code> ➔ <code className="font-mono text-[9px]">quota_attainment_pct</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operations Guide */}
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <h4 className="text-xs font-bold text-hgv-gold uppercase tracking-wider">Operational Ingestion Modes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[10px] text-muted-foreground leading-relaxed" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <strong className="text-foreground">MERGE (Upsert) - Recommended</strong>
                      <p className="mt-1" style={{ fontSize: '10px' }}>Queries key match constraints and selectively updates existing rows while inserting new ones. Prevents duplicate rows when uploading files multiple times.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">APPEND (Insert)</strong>
                      <p className="mt-1" style={{ fontSize: '10px' }}>Appends raw rows directly to Delta tables. Useful for daily transaction streaming logs, but might cause duplicate records if the same file is uploaded twice.</p>
                    </div>
                    <div>
                      <strong className="text-foreground">OVERWRITE (Reload)</strong>
                      <p className="mt-1 text-rose-300" style={{ fontSize: '10px' }}>Truncates (wipes) the targeted period and fully reloads the uploaded records. Use with caution in production during full reconciliation true-ups.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Varicent Capability Gap Matrix (Modernization Roadmap Assessment) */}
      <div className="glass-panel" style={{ padding: '2rem 2.25rem', borderLeft: '4px solid var(--primary)', marginTop: '1.5rem' }}>
        <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-xl flex-shrink-0" style={{ padding: '0.75rem' }}>
              <Layers size={24} />
            </div>
            <div className="space-y-3 flex-grow" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              <div className="flex justify-between items-center flex-wrap gap-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-primary">Enterprise Roadmap Assessment</span>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">Varicent vs. Databricks Capability Gap Matrix</h3>
                </div>
                <button 
                  onClick={() => setIsMatrixOpen(!isMatrixOpen)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-border/10 text-xs font-bold text-muted-foreground hover:bg-white/10 hover:text-foreground transition cursor-pointer"
                >
                  {isMatrixOpen ? 'Hide Assessment Matrix' : 'Show Assessment Matrix'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The compensation assessment revealed that the current Varicent implementation roadmap acts only as a basic sales compensation calculator, missing crucial enterprise capabilities. Below is the comparative capability matrix showing how this <strong>Databricks Comp Hub</strong> bridges these legacy gaps (converting manual <strong>✗</strong> and planned <strong>?</strong> states into fully automated <strong>✓</strong> solutions).
              </p>

              {isMatrixOpen && (
                <div className="mt-6 pt-5 border-t border-border/10 space-y-6 animate-fade-in" style={{ width: '100%', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--foreground-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Capability Dimension</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--foreground-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Telemarketing</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--foreground-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Marketing</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--foreground-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Sales</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Databricks Solution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Section 1: Admin */}
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          <td colSpan={5} style={{ padding: '0.5rem 1rem', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)' }}>
                            1. Admin & Operations Capabilities
                          </td>
                        </tr>
                        {[
                          { name: "Payee Automation / User Management", tele: "Planned (?)", mktg: "Planned (?)", sales: "Automated (✓)", desc: "Databricks App proxy automatically maps username headers directly to dim_rep records upon page load." },
                          { name: "Compensation Plan Setup & Versioning", tele: "Planned (?)", mktg: "Planned (?)", sales: "Automated (✓)", desc: "Supports unlimited plan versions (PLAN-FT-2026) and granular effective dating structures in fact_plan_eligibility." },
                          { name: "Reporting & Analytics", tele: "Manual (✗)", mktg: "Manual (✗)", sales: "Partial (-)", desc: "Integrated Manager Performance Hub and Admin Semantic Layer query direct Delta Lake records instantly." },
                          { name: "Exceptions & Dispute Tracking", tele: "Planned (?)", mktg: "Planned (?)", sales: "Automated (✓)", desc: "Comprehensive audit ledger log (fact_comp_admin_log) tracks manual overrides, LOAs, and proration offsets." }
                        ].map((row, idx) => {
                          const isExpanded = expandedRow === row.name;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td colSpan={5} style={{ padding: 0 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <tbody>
                                    <tr 
                                      onClick={() => setExpandedRow(isExpanded ? null : row.name)}
                                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(26,109,255,0.03)' : 'transparent', transition: 'background 0.2s' }}
                                    >
                                      <td style={{ padding: '0.75rem 1rem', width: '35%', fontWeight: 600 }}>{row.name}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: 'var(--foreground-muted)' }}>{row.tele}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: 'var(--foreground-muted)' }}>{row.mktg}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>{row.sales}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '20%', textAlign: 'center' }}>
                                        <span className="badge badge-green" style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}>✓ Automated</span>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={5} style={{ padding: '0.875rem 1.25rem', background: 'rgba(26,109,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                                          <div style={{ fontSize: '11px', color: 'var(--foreground-muted)', lineHeight: 1.4 }}>
                                            <strong className="text-primary" style={{ marginRight: 6 }}>Databricks Bridge Strategy:</strong>
                                            {row.desc}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Section 2: Management */}
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          <td colSpan={5} style={{ padding: '0.5rem 1rem', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)' }}>
                            2. Management & Leadership Capabilities
                          </td>
                        </tr>
                        {[
                          { name: "Quota Management & Target Setting", tele: "Manual (✗)", mktg: "Manual (✗)", sales: "Manual (✗)", desc: "Data-driven quota allocation and monthly site targets are loaded via the Semantic Metrics Console." },
                          { name: "Performance Dashboards", tele: "Planned (?)", mktg: "Planned (?)", sales: "Automated (✓)", desc: "Dynamic earnings summaries, quota progress circles, and transaction deal tables reload reactively." },
                          { name: "Incentive Forecasting / What-If Modeler", tele: "Manual (✗)", mktg: "Manual (✗)", sales: "Manual (✗)", desc: "Scenario Modeler runs serverless calculations to forecast plan changes and budget impacts side-by-side." },
                          { name: "Team Performance Insights", tele: "Manual (✗)", mktg: "Manual (✗)", sales: "Manual (✗)", desc: "Team Performance Page highlights at-risk agents, upsell opportunities, and FFS package shortfalls." }
                        ].map((row, idx) => {
                          const isExpanded = expandedRow === row.name;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td colSpan={5} style={{ padding: 0 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <tbody>
                                    <tr 
                                      onClick={() => setExpandedRow(isExpanded ? null : row.name)}
                                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(26,109,255,0.03)' : 'transparent', transition: 'background 0.2s' }}
                                    >
                                      <td style={{ padding: '0.75rem 1rem', width: '35%', fontWeight: 600 }}>{row.name}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{row.tele}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{row.mktg}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{row.sales}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '20%', textAlign: 'center' }}>
                                        <span className="badge badge-green" style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}>✓ Automated</span>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={5} style={{ padding: '0.875rem 1.25rem', background: 'rgba(26,109,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                                          <div style={{ fontSize: '11px', color: 'var(--foreground-muted)', lineHeight: 1.4 }}>
                                            <strong className="text-primary" style={{ marginRight: 6 }}>Databricks Bridge Strategy:</strong>
                                            {row.desc}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Section 3: Finance */}
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          <td colSpan={5} style={{ padding: '0.5rem 1rem', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)' }}>
                            3. Finance Intelligence Capabilities
                          </td>
                        </tr>
                        {[
                          { name: "Incentive Breakdowns & Accruals", tele: "Planned (?)", mktg: "Planned (?)", sales: "Automated (✓)", desc: "Finance Intelligence desk handles monthly/quarterly accrual bookings and reserve clawback exposures." },
                          { name: "Compensation Expense Forecasting", tele: "Manual (✗)", mktg: "Manual (✗)", sales: "Manual (✗)", desc: "Forecasts variable compensation expense as a % of Net Sales Volume (target 8-12%) based on seasonal run rates." },
                          { name: "Payout Validation & Audit", tele: "Manual (✗)", mktg: "Manual (✗)", sales: "Manual (✗)", desc: "Delta Lake transactional consistency checks ensure every single deal credit maps back to an active plan version." }
                        ].map((row, idx) => {
                          const isExpanded = expandedRow === row.name;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td colSpan={5} style={{ padding: 0 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <tbody>
                                    <tr 
                                      onClick={() => setExpandedRow(isExpanded ? null : row.name)}
                                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(26,109,255,0.03)' : 'transparent', transition: 'background 0.2s' }}
                                    >
                                      <td style={{ padding: '0.75rem 1rem', width: '35%', fontWeight: 600 }}>{row.name}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{row.tele}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{row.mktg}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '15%', textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{row.sales}</td>
                                      <td style={{ padding: '0.75rem 1rem', width: '20%', textAlign: 'center' }}>
                                        <span className="badge badge-green" style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}>✓ Automated</span>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={5} style={{ padding: '0.875rem 1.25rem', background: 'rgba(26,109,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                                          <div style={{ fontSize: '11px', color: 'var(--foreground-muted)', lineHeight: 1.4 }}>
                                            <strong className="text-primary" style={{ marginRight: 6 }}>Databricks Bridge Strategy:</strong>
                                            {row.desc}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-[10px] text-muted-foreground" style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(26,109,255,0.03)', border: '1px dashed rgba(26,109,255,0.2)' }}>
                    <strong>Tip:</strong> Click on any row to view detailed HGV Databricks architectural mapping strategies and bridging parameters.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Overview stats from UC warehouse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel" style={{ padding: '1.75rem 2rem' }}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Governed Payees</span>
              <h2 className="text-2xl font-black text-foreground mt-1">
                {isCounting ? '...' : dbCounts?.reps ?? '-'}
              </h2>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl">
              <RefreshCw size={16} className={isCounting ? 'animate-spin' : ''} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Active reps in `dim_rep` table</p>
        </div>

        <div className="glass-panel" style={{ padding: '1.75rem 2rem' }}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Deal Credits</span>
              <h2 className="text-2xl font-black text-foreground mt-1">
                {isCounting ? '...' : dbCounts?.deals ?? '-'}
              </h2>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl">
              <Database size={16} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Credited deals in `fact_deal_credit`</p>
        </div>

        <div className="glass-panel" style={{ padding: '1.75rem 2rem' }}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Period Payouts</span>
              <h2 className="text-2xl font-black text-foreground mt-1">
                {isCounting ? '...' : dbCounts?.payouts ?? '-'}
              </h2>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl">
              <Layers size={16} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Payout snapshots in `fact_payout`</p>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-5" style={{ gap: '2.5rem' }}>
        
        {/* Left Side: Setup & Paste */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-panel" style={{ padding: '2.5rem 2.25rem' }}>
            <h3 className="text-md font-bold text-foreground mb-4">Varicent Export Ingestion Panel</h3>
            
            <div className="space-y-4">
              {/* Type & Mode selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Export Structure</label>
                  <select
                    value={exportType}
                    onChange={(e) => {
                      setExportType(e.target.value as any);
                      setRawText('');
                      setSyncResult(null);
                    }}
                    className="w-full bg-[#090d16] text-foreground text-xs font-semibold rounded-xl border border-border/15 p-3 outline-none focus:border-primary/50 transition"
                  >
                    <option value="payees">Reps & Eligibility (CSV)</option>
                    <option value="deals">Deals & Tours (JSON)</option>
                    <option value="payouts">Payouts & Quotas (CSV)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Ingestion Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                    className="w-full bg-[#090d16] text-foreground text-xs font-semibold rounded-xl border border-border/15 p-3 outline-none focus:border-primary/50 transition"
                  >
                    <option value="MERGE">MERGE (Upsert Records)</option>
                    <option value="APPEND">APPEND (Insert Only)</option>
                    <option value="OVERWRITE">OVERWRITE (Truncate & Reload)</option>
                  </select>
                </div>
              </div>

              {/* Paste or Upload Drag Drop */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Raw Payload Content</label>
                </div>

                {/* Upload Zone */}
                <div className="relative group border border-dashed border-border/20 rounded-2xl p-6 bg-muted/5 hover:bg-muted/10 hover:border-primary/30 transition text-center mb-4 cursor-pointer">
                  <input
                    type="file"
                    accept={exportType === 'deals' ? '.json' : '.csv'}
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-full group-hover:scale-110 transition">
                      <Upload size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Click to upload raw export file</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Accepts {VARICENT_MAPPINGS[exportType].sourceFormat.toUpperCase()} structure exports
                      </p>
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      setSyncResult(null);
                    }}
                    placeholder={
                      exportType === 'deals' 
                        ? 'Paste Varicent raw JSON transaction export here...'
                        : 'Paste Varicent CSV payee/payout columns here...'
                    }
                    className="w-full h-48 bg-[#090d16] text-foreground font-mono text-[11px] rounded-2xl border border-border/15 p-4 outline-none focus:border-primary/50 transition-all resize-none"
                  />
                  {rawText && (
                    <button
                      onClick={() => { setRawText(''); setSyncResult(null); }}
                      className="absolute right-3 top-3 px-2 py-1 rounded bg-white/5 text-[9px] font-bold text-muted-foreground hover:bg-white/10 hover:text-foreground transition cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Sync Trigger */}
              <button
                onClick={triggerIngest}
                disabled={!rawText.trim() || isSyncing}
                className={`w-full relative overflow-hidden py-3.5 px-6 rounded-2xl text-xs font-black tracking-widest uppercase transition-all duration-300 ${
                  rawText.trim() && !isSyncing
                    ? 'bg-gradient-to-r from-hgv-gold to-hgv-gold-light text-black shadow-lg shadow-hgv-gold/15 hover:scale-[1.01] hover:shadow-hgv-gold/25 active:scale-[0.99] cursor-pointer'
                    : 'bg-muted/10 text-muted-foreground border border-border/10 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Play size={12} fill="currentColor" />
                  Ingest to Databricks SQL Warehouse
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Pre-Flight Check & Feedback */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ingestion Steps Overlay Loader */}
          {isSyncing && (
            <div className="glass-panel border-primary/20 bg-primary/5 p-6 animate-glow-pulse space-y-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                <h4 className="text-xs font-black uppercase tracking-wider text-primary">Executing Ingestion Pipeline</h4>
              </div>
              <div className="space-y-4">
                {[
                  { step: 1, label: "Parsing raw content..." },
                  { step: 2, label: "Evaluating Varicent mapping config..." },
                  { step: 3, label: "Checking non-null schema constraints..." },
                  { step: 4, label: "Syncing Delta tables in Unity Catalog..." }
                ].map((s) => {
                  const isDone = syncStep > s.step;
                  const isCurrent = syncStep === s.step;
                  return (
                    <div key={s.step} className="flex items-center gap-3 transition-opacity duration-300">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border text-[9px] font-bold ${
                        isDone ? 'bg-primary border-primary text-black' :
                        isCurrent ? 'border-primary text-primary animate-pulse' :
                        'border-border/30 text-muted-foreground'
                      }`}>
                        {isDone ? '✓' : s.step}
                      </div>
                      <span className={`text-xs font-semibold ${
                        isDone ? 'text-muted-foreground line-through' :
                        isCurrent ? 'text-foreground font-bold' :
                        'text-muted-foreground'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sync Result Feedback Banner */}
          {syncResult && (
            <div className={`glass-panel border-2 p-6 animate-fade-in-up ${
              syncResult.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'
            }`} style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', border: syncResult.ok ? '2px solid rgba(16,185,129,0.3)' : '2px solid rgba(239,68,68,0.3)' }}>
              <div className="flex gap-3">
                <div className={`p-2 rounded-xl border ${
                  syncResult.ok ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
                }`} style={{ padding: '0.5rem', borderRadius: 8 }}>
                  {syncResult.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${syncResult.ok ? 'text-emerald-400' : 'text-destructive'}`} style={{ fontSize: '13px' }}>
                    {syncResult.ok ? 'Ingestion Sync Succeeded!' : 'Ingestion Sync Failed'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed" style={{ fontSize: '11px', marginTop: 4 }}>{syncResult.message}</p>
                  
                  {syncResult.ok && (
                    <div className="mt-4 pt-3 border-t border-border/10 grid grid-cols-2 gap-4" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Processed Rows</span>
                        <p className="text-xs font-bold text-foreground mt-0.5" style={{ fontSize: '12px', marginTop: 2 }}>{syncResult.validCount} rows</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">SQL Queries</span>
                        <p className="text-xs font-bold text-foreground mt-0.5" style={{ fontSize: '12px', marginTop: 2 }}>{syncResult.statementsCount} run</p>
                      </div>
                      <div className="col-span-2" style={{ gridColumn: 'span 2' }}>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Tables Updated</span>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5" style={{ fontSize: '10px', marginTop: 2 }}>
                          {syncResult.tablesAffected?.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pre-Flight Check Details */}
          <div className="glass-panel" style={{ padding: '2.5rem 2.25rem' }}>
            <div className="flex justify-between items-center border-b border-border/10 pb-3 mb-4">
              <h4 className="text-xs font-bold text-foreground">Pre-Flight Validation Check</h4>
              {preflightReport ? (
                preflightReport.ok ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    ✓ PASSED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-destructive/15 text-destructive border border-destructive/25 animate-pulse">
                    ⚠ INVALID
                  </span>
                )
              ) : (
                <span className="text-[10px] text-muted-foreground font-semibold">No data pasted yet</span>
              )}
            </div>

            {preflightReport ? (
              preflightReport.ok ? (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Detected Row Count</span>
                      <p className="text-xs font-bold text-foreground mt-0.5">{preflightReport.rowCount} rows</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Source Format</span>
                      <p className="text-xs font-bold text-primary mt-0.5 uppercase">
                        {VARICENT_MAPPINGS[exportType].sourceFormat}
                      </p>
                    </div>
                  </div>

                  {/* Mapping Preview list */}
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-2">Column Mapping Matrix</span>
                    <div className="max-h-40 overflow-y-auto border border-border/10 rounded-xl bg-[#090d16] p-2 space-y-1.5 scrollbar-thin">
                      {preflightReport.mappingsList?.map((m, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] p-1.5 rounded bg-white/5 border border-border/5">
                          <span className="font-mono text-muted-foreground">{m.source}</span>
                          <span className="text-[9px] text-muted-foreground">➔</span>
                          <span className="font-mono text-hgv-gold font-bold">{m.target}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sample Data Card */}
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">First Record Payload</span>
                    <pre className="text-[9px] font-mono bg-[#090d16] border border-border/10 rounded-xl p-3 text-muted-foreground overflow-x-auto max-h-36">
                      {JSON.stringify(preflightReport.sampleRow, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 text-destructive p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Format Alert</span>
                    <p className="text-[10px] text-destructive mt-0.5 leading-relaxed">{preflightReport.error}</p>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-6 text-muted-foreground text-xs space-y-2">
                <FileText size={24} className="mx-auto text-muted-foreground/30" />
                <p>Upload a file or paste columns from Varicent above to run a pre-flight schema mapping validation check.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
