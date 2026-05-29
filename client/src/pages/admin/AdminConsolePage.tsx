import { useState } from 'react';
import { BarChart3, Database, Layers, ShieldAlert } from 'lucide-react';
import { CompAnalysisPage } from '../comp/CompAnalysisPage';
import { SemanticLayerPage } from './SemanticLayerPage';
import { DataModelIngestionPage } from './DataModelIngestionPage';
import { useAppContext } from '@/context/AppContext';

type StrategyTab = 'scenarios' | 'semantic' | 'data-model';

export function AdminConsolePage() {
  const { isManager, loading: authLoading } = useAppContext();
  const [activeTab, setActiveTab] = useState<StrategyTab>('scenarios');

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center my-10 space-y-4">
        <div className="h-6 w-48 rounded bg-muted/20 animate-pulse mx-auto" />
        <div className="h-4 w-96 rounded bg-muted/20 animate-pulse mx-auto" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-destructive/20 bg-destructive/5 max-w-2xl mx-auto space-y-4 my-10">
        <div className="p-4 bg-destructive/15 rounded-xl text-destructive border border-destructive/25">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Access Restricted</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          The Strategy Control Room is reserved for Sales Managers and Administrators.
        </p>
      </div>
    );
  }

  const secondaryTabs: Array<{ id: Exclude<StrategyTab, 'scenarios'>; label: string; icon: typeof Database }> = [
    { id: 'data-model', label: 'Data Model & Ingestion', icon: Database },
    { id: 'semantic', label: 'Semantic Metrics', icon: Layers },
  ];

  return (
    <div className="hgv-strategy-room space-y-6">
      {/* HGV-style navy hero */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0a2540 0%, #12365a 100%)' }}
      >
        <div className="px-8 py-8 sm:px-10 sm:py-9">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-white/90 border border-white/15">
            Strategy & Governance
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Strategy Control Room
          </h1>
          <p className="mt-2 text-sm text-white/75 max-w-2xl leading-relaxed">
            Model compensation scenarios, compare budget impact, and drill into governed data when you need the
            technical details.
          </p>
        </div>
      </div>

      {/* Pill tab bar — Scenario Modeler default; other tabs reveal content on click */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl p-1.5"
        style={{ background: '#eef1f5', border: '1px solid #dde3ea' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('scenarios')}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold transition-all"
          style={
            activeTab === 'scenarios'
              ? { background: '#fff', color: '#0a2540', boxShadow: '0 1px 4px rgba(10,37,64,0.12)' }
              : { color: '#64748b' }
          }
        >
          <BarChart3 className="h-4 w-4" />
          Scenario Modeler
        </button>

        {secondaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold transition-all"
              style={
                isActive
                  ? { background: '#fff', color: '#0a2540', boxShadow: '0 1px 4px rgba(10,37,64,0.12)' }
                  : { color: '#64748b' }
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in-up">
        {activeTab === 'scenarios' && <CompAnalysisPage />}
        {activeTab === 'data-model' && (
          <div className="rounded-2xl border bg-white p-1 shadow-sm" style={{ borderColor: '#e2e8f0' }}>
            <DataModelIngestionPage />
          </div>
        )}
        {activeTab === 'semantic' && (
          <div className="rounded-2xl border bg-white p-1 shadow-sm" style={{ borderColor: '#e2e8f0' }}>
            <SemanticLayerPage />
          </div>
        )}
      </div>
    </div>
  );
}
