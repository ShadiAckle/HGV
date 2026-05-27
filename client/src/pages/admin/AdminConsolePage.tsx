import { useState } from 'react';
import { BarChart3, Database, ShieldAlert } from 'lucide-react';
import { CompAnalysisPage } from '../comp/CompAnalysisPage';
import { SemanticLayerPage } from './SemanticLayerPage';
import { DataModelIngestionPage } from './DataModelIngestionPage';
import { useAppContext } from '@/context/AppContext';

type StrategyTab = 'scenarios' | 'semantic' | 'data-model';

export function AdminConsolePage() {
  const { isManager, loading: authLoading } = useAppContext();
  const [activeTab, setActiveTab] = useState<StrategyTab>('data-model');

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
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-destructive/20 bg-destructive/5 backdrop-blur-md max-w-2xl mx-auto space-y-4 my-10 animate-fade-in-up">
        <div className="p-4 bg-destructive/15 rounded-2xl text-destructive border border-destructive/25 animate-bounce">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Access Restricted</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          The Strategy Control Room is reserved for Sales Managers and Administrators.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'data-model' as const, label: 'Data Model & Ingestion', icon: Database },
    { id: 'semantic' as const, label: 'Semantic Metrics', icon: Database },
    { id: 'scenarios' as const, label: 'Scenario Modeler', icon: BarChart3 },
  ];

  return (
    <div className="space-y-10">
      <div className="relative rounded-3xl overflow-hidden glass-panel p-8 sm:p-10 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-primary/10 opacity-30 pointer-events-none" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-500 border border-amber-500/25 mb-3">
            Strategy & Governance
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Strategy Control Room
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Governed data model reference, semantic metric catalog, and scenario planning. Import pipelines should match
            the table contracts and API bindings documented here — no new UI hooks required at go-live.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-2 rounded-2xl bg-muted/20 border border-border/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'shadow-lg scale-[1.02]'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
              style={
                isActive
                  ? { background: 'linear-gradient(90deg, var(--gold) 0%, var(--gold-light) 100%)', color: '#000000' }
                  : {}
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in-up mt-8">
        {activeTab === 'data-model' && <DataModelIngestionPage />}
        {activeTab === 'semantic' && <SemanticLayerPage />}
        {activeTab === 'scenarios' && <CompAnalysisPage />}
      </div>
    </div>
  );
}
