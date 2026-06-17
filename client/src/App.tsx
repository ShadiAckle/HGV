import { useState, useRef, useEffect, useMemo } from 'react';
import { createBrowserRouter, RouterProvider, NavLink, Outlet, Navigate } from 'react-router';
import { ChevronDown, Check, User, BarChart3, Wallet, BookOpen, Settings, ClipboardCheck, TrendingUp } from 'lucide-react';
import { MyCompensationPage } from './pages/comp/MyCompensationPage';
import { TeamPerformancePage } from './pages/comp/TeamPerformancePage';
import { HowToPage } from './pages/HowToPage';
import { CompOverviewPage } from './pages/comp/CompOverviewPage';
import { AdminConsolePage } from './pages/admin/AdminConsolePage';
import { CompAdminPage } from './pages/comp/CompAdminPage';
import { FinancePage } from './pages/comp/FinancePage';
import { CompensationRulesPage } from './pages/admin/CompensationRulesPage';
import { AppContextProvider, useAppContext } from './context/AppContext';
import { resolveRoleTitle } from './data/identityCatalog';
import { Loader2 } from 'lucide-react';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { SimpleViewToggle } from '@/components/comp/SimpleViewToggle';

// ── Nav link class helper ───────────────────────────────────────────
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-tab${isActive ? ' active-nav' : ''}`;

// ── Layout ──────────────────────────────────────────────────────────
function Layout() {
  const {
    activeRepId,
    activePeriodId,
    metadata,
    isManager,
    activeRoleTitle,
    changeActiveRep,
    changeActivePeriod,
    metadataReady,
    appReady,
    loading: profileLoading,
    loadingMetadata,
    marketingReps,
  } = useAppContext();

  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const identityRef = useRef<HTMLDivElement>(null);
  const periodRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isIdentityOpen) setSearchQuery('');
  }, [isIdentityOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (identityRef.current && !identityRef.current.contains(e.target as Node)) setIsIdentityOpen(false);
      if (periodRef.current   && !periodRef.current.contains(e.target as Node))   setIsPeriodOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const identityLoading = !metadataReady;

  const identityLoadLabel = useMemo(() => {
    if (profileLoading) return 'Resolving Databricks session profile…';
    if (loadingMetadata) return 'Loading comp catalog & periods…';
    return 'Loading…';
  }, [profileLoading, loadingMetadata]);
  const repsList = marketingReps;
  const activeRep = repsList.find((r) => r.rep_id === activeRepId);
  const activeRepName  = identityLoading ? '' : (activeRep?.rep_name ?? '');
  const activeRepLevel = identityLoading ? '' : (activeRep ? resolveRoleTitle(activeRep) : activeRoleTitle);

  const periods        = metadata?.periods ?? [];
  const activePeriod   = periods.find(p => p.period_id === activePeriodId);
  const activePeriodLabel = identityLoading ? '' : (activePeriod?.period_label ?? '');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>

      {/* ── Top Header ── */}
      <header className="sticky-header-glass" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 2.5rem',
        height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem',
      }}>

        {/* Left: Brand + Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #0a2540 0%, #12365a 100%)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(10,37,64,0.25)',
            }}>
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', color: '#fff' }}>HGV</span>
            </div>
            <div>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', lineHeight: 1 }}>IGNITE</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>Compensation Hub</div>
            </div>
          </div>

          {/* Nav tabs — managers get all tabs, reps get Overview, My Comp, How To */}
          <nav className="header-nav-wrap" aria-label="Main navigation">
            <NavLink to="/" end className={navLinkClass} id="nav-overview">
              Overview
            </NavLink>
            <NavLink to="/my-compensation" className={navLinkClass} id="nav-my-comp">
              <Wallet size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
              My Comp
            </NavLink>
            {isManager && (
              <>
                <NavLink to="/team" className={navLinkClass} id="nav-team">
                  <BarChart3 size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
                  Team Coaching
                </NavLink>
                <NavLink to="/admin-console" className={navLinkClass} id="nav-admin-console">
                  <Settings size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
                  Strategy Control Room
                </NavLink>
                <NavLink to="/comp-admin" className={navLinkClass} id="nav-comp-admin">
                  <ClipboardCheck size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
                  Comp Admin
                </NavLink>
                <NavLink to="/compensation-rules" className={navLinkClass} id="nav-comp-rules">
                  <Settings size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
                  Comp Rules
                </NavLink>
                <NavLink to="/finance" className={navLinkClass} id="nav-finance">
                  <TrendingUp size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
                  Finance
                </NavLink>
              </>
            )}
            <NavLink to="/how-to" className={navLinkClass} id="nav-help">
              <BookOpen size={13} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />
              How To
            </NavLink>
          </nav>
        </div>

        {/* Right: Simple View + Period + Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          <SimpleViewToggle />

          {/* Period picker */}
          {(identityLoading || metadataReady) && (
            <div ref={periodRef} style={{ position: 'relative' }}>
              <button
                type="button"
                id="nav-period-picker"
                disabled={identityLoading}
                onClick={() => !identityLoading && setIsPeriodOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '0.3125rem 0.625rem',
                  fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)',
                  cursor: identityLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  minWidth: 88,
                }}
              >
                {identityLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={11} className="animate-spin" style={{ opacity: 0.7 }} />
                    <span className="animate-pulse">{identityLoadLabel}</span>
                  </span>
                ) : (
                  <>
                    {activePeriodLabel}
                    <ChevronDown size={11} style={{ transition: 'transform 0.2s', transform: isPeriodOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                  </>
                )}
              </button>
              {isPeriodOpen && !identityLoading && (
                <div className="animate-fade-in" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                  background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '0.25rem', minWidth: 130,
                  boxShadow: 'var(--shadow-lg)',
                }}>
                  {periods.map(p => (
                    <button key={p.period_id} type="button"
                      onClick={() => { changeActivePeriod(p.period_id); setIsPeriodOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '0.4375rem 0.625rem',
                        borderRadius: 'calc(var(--radius) - 4px)', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: activePeriodId === p.period_id ? 'var(--primary-muted)' : 'transparent',
                        color: activePeriodId === p.period_id ? 'var(--primary)' : 'var(--foreground)',
                        border: 'none',
                      }}
                    >
                      {p.period_label}
                      {activePeriodId === p.period_id && <Check size={11} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Identity */}
          <div ref={identityRef} style={{ position: 'relative' }}>
            <button
              type="button"
              id="nav-identity-picker"
              disabled={identityLoading}
              onClick={() => !identityLoading && setIsIdentityOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '0.3125rem 0.625rem',
                fontSize: 11, fontWeight: 600, color: 'var(--foreground)',
                cursor: identityLoading ? 'wait' : 'pointer', maxWidth: 220,
                minWidth: identityLoading ? 160 : undefined,
              }}
            >
              {identityLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" color="var(--primary)" />
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{identityLoadLabel}</span>
                </>
              ) : (
                <>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--primary-muted)', border: '1px solid var(--primary-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <User size={11} color="var(--primary)" />
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeRepName}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--foreground-muted)', flexShrink: 0 }}>({activeRepLevel})</span>
                  <ChevronDown size={11} color="var(--foreground-muted)" style={{ transition: 'transform 0.2s', transform: isIdentityOpen ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }} />
                </>
              )}
            </button>

            {isIdentityOpen && !identityLoading && (
              <div className="animate-fade-in" style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '0.25rem', minWidth: 230,
                boxShadow: 'var(--shadow-lg)',
                maxHeight: '320px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ padding: '0.375rem 0.625rem 0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem', position: 'sticky', top: 0, background: 'var(--bg-overlay)', zIndex: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                    Marketing Channel Plans
                  </span>
                </div>
                <div style={{ padding: '0 0.25rem 0.25rem', position: 'sticky', top: '28px', background: 'var(--bg-overlay)', zIndex: 10, borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
                  <input
                    type="text"
                    placeholder="Search marketing role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '0.35rem 0.5rem',
                      fontSize: '11px',
                      color: 'var(--foreground)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {repsList
                    .filter(rep =>
                      rep.rep_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      rep.rep_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      resolveRoleTitle(rep).toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((rep) => {
                      const isSelected = activeRepId === rep.rep_id;
                      const roleTitle = resolveRoleTitle(rep);
                      return (
                        <button key={rep.rep_id} type="button"
                          onClick={() => { changeActiveRep(rep.rep_id); setIsIdentityOpen(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '0.5rem 0.625rem',
                            borderRadius: 'calc(var(--radius) - 4px)', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                            background: isSelected ? 'var(--primary-muted)' : 'transparent',
                            color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                            border: 'none',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{rep.rep_name}</span>
                          <span style={{ fontSize: 9, color: isSelected ? 'var(--primary)' : 'var(--foreground-muted)', flexShrink: 0, fontWeight: 700, textAlign: 'right', maxWidth: 120 }}>{roleTitle}</span>
                          {isSelected && <Check size={11} style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 10, color: 'var(--foreground-muted)', flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Live
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '2.5rem 2rem', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {appReady ? (
          <Outlet />
        ) : (
          <div style={{ position: 'relative', minHeight: '60vh' }}>
            <LuxeDbLoader loading title="Compensation Hub" />
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '0.875rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10, color: 'var(--foreground-muted)', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          workspace.hgv_comp · Databricks Unity Catalog
        </span>
        <span style={{ fontFamily: 'monospace' }}>Databricks Model Serving</span>
      </footer>
    </div>
  );
}

// ── Router ──────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/',              element: <CompOverviewPage /> },
      { path: '/my-compensation', element: <MyCompensationPage /> },
      { path: '/team',          element: <TeamPerformancePage /> },
      { path: '/admin-console',  element: <AdminConsolePage /> },
      { path: '/comp-admin',     element: <CompAdminPage /> },
      { path: '/compensation-rules', element: <CompensationRulesPage /> },
      { path: '/finance',        element: <FinancePage /> },
      { path: '/how-to',        element: <HowToPage /> },
      { path: '*',              element: <Navigate to="/" replace /> },
    ],
  },
]);


export default function App() {
  return (
    <AppContextProvider>
      <RouterProvider router={router} />
    </AppContextProvider>
  );
}
