import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  getMarketingDropdownIdentities,
  getMarketingPersonaId,
  mergeMarketingIdentities,
  resolveRoleTitle,
  type IdentityGroup,
} from '@/data/identityCatalog';
import type { MarketingPersonaId } from '@/data/marketingPlanAssessment';
import { DEFAULT_PERIODS, LEGACY_PERIOD_ID, LEGACY_PRIOR_PERIOD_ID } from '@shared/compPeriods';
import { PLAIN_ENGLISH_STORAGE_KEY, SIMPLE_VIEW_USER_SET_KEY, resolveSimpleViewDefault } from '@shared/plainLanguage';

export interface UserProfile {
  rep_id: string;
  rep_name: string;
  level_code: string;
  team_id: string;
  team_name: string;
  region: string;
  is_manager: boolean;
  username: string;
}

export interface MetadataRep {
  rep_id: string;
  rep_name: string;
  level_code: string;
  team_id: string;
  region: string;
  is_active: boolean;
  role_title?: string;
  persona_id?: string;
  plan_id?: string;
  identity_group?: IdentityGroup;
}

export interface MetadataTeam {
  team_id: string;
  team_name: string;
  region: string;
}

export interface MetadataPeriod {
  period_id: string;
  period_label: string;
  is_current: boolean;
}

export interface MetadataScenario {
  scenario_id: string;
  scenario_name: string;
  period_id: string;
}

export interface MetadataDeal {
  deal_id: string;
  rep_id: string;
  amount: string | number;
  status: string;
  description: string;
}

export interface AppMetadata {
  reps: MetadataRep[];
  teams: MetadataTeam[];
  periods: MetadataPeriod[];
  scenarios: MetadataScenario[];
  deals: MetadataDeal[];
}

export const MOCK_REPS: MetadataRep[] = [
  { rep_id: 'REP-JASON', rep_name: 'Jason', level_code: 'L6', team_id: 'TEAM-WEST', region: 'West', is_active: true },
  { rep_id: 'REP-DLEE', rep_name: 'D. Lee', level_code: 'L4', team_id: 'TEAM-WEST', region: 'West', is_active: true },
  { rep_id: 'REP-RSMITH', rep_name: 'R. Smith', level_code: 'L8', team_id: 'TEAM-WEST', region: 'West', is_active: true },
  { rep_id: 'REP-ECARTER', rep_name: 'E. Carter', level_code: 'L5', team_id: 'TEAM-WEST', region: 'West', is_active: true },
  { rep_id: 'REP-KNGUYEN', rep_name: 'K. Nguyen', level_code: 'L7', team_id: 'TEAM-WEST', region: 'West', is_active: true },
  { rep_id: 'REP-MGR-01', rep_name: 'M. Vance', level_code: 'L9', team_id: 'TEAM-WEST', region: 'West', is_active: true }
];

export const MOCK_TEAMS: MetadataTeam[] = [
  { team_id: 'TEAM-WEST', team_name: 'West Coast Sales', region: 'West' },
  { team_id: 'TEAM-EAST', team_name: 'East Coast Sales', region: 'East' }
];

export const MOCK_PERIODS: MetadataPeriod[] = DEFAULT_PERIODS;

interface AppContextType {
  activeRepId: string;
  activeTeamId: string;
  activePeriodId: string;
  activeScenarioId: string;
  isManager: boolean;
  activeRoleTitle: string;
  activePersonaId: MarketingPersonaId | null;
  isMarketingChannel: boolean;
  identityGroup: IdentityGroup;
  currentUser: UserProfile | null;
  metadata: AppMetadata | null;
  loading: boolean;
  loadingMetadata: boolean;
  metadataReady: boolean;
  /** Session + comp catalog + active period are resolved — safe to mount data pages. */
  appReady: boolean;
  error: string | null;
  changeActiveRep: (repId: string) => void;
  changeActiveTeam: (teamId: string) => void;
  changeActivePeriod: (periodId: string) => void;
  changeActiveScenario: (scenarioId: string) => void;
  refreshUserProfile: () => Promise<void>;
  /** Marketing rep picker — from warehouse metadata when available. */
  marketingReps: MetadataRep[];
  /** Field mode — simpler labels and AI phrasing for frontline reps. */
  plainEnglish: boolean;
  togglePlainEnglish: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [activeRepId, setActiveRepId] = useState(() => {
    const cached = localStorage.getItem('hgv_active_rep_id');
    // Demo personas (PERSONA-MKT-*) are invalid for live warehouse — metadata will replace.
    if (cached && !cached.startsWith('PERSONA-MKT-')) return cached;
    return '';
  });
  const [activeTeamId, setActiveTeamId] = useState(() => {
    const cached = localStorage.getItem('hgv_active_team_id');
    if (cached) return cached;
    return 'TEAM-MKT';
  });
  const [activePeriodId, setActivePeriodId] = useState(() => localStorage.getItem('hgv_active_period_id') || '');
  const [activeScenarioId, setActiveScenarioId] = useState(() => localStorage.getItem('hgv_active_scenario_id') || 'SCN-SIM-01');

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [metadata, setMetadata] = useState<AppMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plainEnglish, setPlainEnglish] = useState(() => {
    try {
      return localStorage.getItem(PLAIN_ENGLISH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Fetch resolved user profile from headers
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/comp/user-profile');
      if (res.ok) {
        const data = (await res.json()) as UserProfile;
        setCurrentUser(data);

        // Always sync the active identity from the server-resolved profile.
        // This ensures the deployed Databricks user always maps to the correct rep.
        // If a user has manually switched via the dropdown, that localStorage value wins
        // only for the session — a page reload will re-sync from the server.
        // Active marketing rep comes from warehouse metadata (fetchMetadata), not demo personas.
      } else {
        throw new Error(`HTTP ${res.status} retrieving profile`);
      }
    } catch (err) {
      console.error('Failed to fetch dynamic user profile:', err);
      setError(err instanceof Error ? err.message : 'Auth profile lookup failed');
    } finally {
      setLoading(false);
    }
  };

  // Fetch full lists of active reps, teams, periods, etc.
  const fetchMetadata = async () => {
    try {
      setLoadingMetadata(true);
      const res = await fetch('/api/comp/metadata');
      if (res.ok) {
        const data = (await res.json()) as AppMetadata;
        const periods = data.periods?.length ? data.periods : MOCK_PERIODS;
        const mergedReps = mergeMarketingIdentities(data.reps ?? []);
        setMetadata({
          ...data,
          periods,
          reps: mergedReps,
        });

        const storedPeriod = localStorage.getItem('hgv_active_period_id');
        const currentPeriod = periods.find((p) => p.is_current);
        const legacyPeriods = new Set([LEGACY_PERIOD_ID, LEGACY_PRIOR_PERIOD_ID, '2024-Q2', '2024-Q1']);
        const validStored =
          storedPeriod &&
          !legacyPeriods.has(storedPeriod) &&
          periods.some((p) => p.period_id === storedPeriod);
        if (validStored) {
          setActivePeriodId(storedPeriod);
        } else if (currentPeriod) {
          setActivePeriodId(currentPeriod.period_id);
          localStorage.setItem('hgv_active_period_id', currentPeriod.period_id);
        } else if (periods[0]) {
          setActivePeriodId(periods[0].period_id);
          localStorage.setItem('hgv_active_period_id', periods[0].period_id);
        }

        const marketingFromMeta = getMarketingDropdownIdentities(mergedReps);
        const storedRep = localStorage.getItem('hgv_active_rep_id');
        const storedRepValid =
          storedRep &&
          !storedRep.startsWith('PERSONA-MKT-') &&
          marketingFromMeta.some((r) => r.rep_id === storedRep);
        if (!storedRepValid && marketingFromMeta[0]) {
          setActiveRepId(marketingFromMeta[0].rep_id);
          localStorage.setItem('hgv_active_rep_id', marketingFromMeta[0].rep_id);
          if (marketingFromMeta[0].team_id) {
            setActiveTeamId(marketingFromMeta[0].team_id);
            localStorage.setItem('hgv_active_team_id', marketingFromMeta[0].team_id);
          }
        } else if (storedRepValid) {
          setActiveRepId(storedRep);
        }
      } else {
        throw new Error(`HTTP ${res.status} retrieving metadata`);
      }
    } catch (err) {
      console.error('Failed to load database metadata:', err);
      setMetadata({
        reps: getMarketingDropdownIdentities(),
        teams: MOCK_TEAMS,
        periods: MOCK_PERIODS,
        scenarios: [],
        deals: [],
      });
      if (!localStorage.getItem('hgv_active_period_id')) {
        setActivePeriodId(MOCK_PERIODS[0].period_id);
        localStorage.setItem('hgv_active_period_id', MOCK_PERIODS[0].period_id);
      }
    } finally {
      setLoadingMetadata(false);
    }
  };

  const marketingReps = useMemo(
    () => getMarketingDropdownIdentities(metadata?.reps ?? []),
    [metadata?.reps],
  );

  const activeRepMetadata = useMemo(() => {
    return marketingReps.find((r) => r.rep_id === activeRepId);
  }, [activeRepId, marketingReps]);

  const activeRoleTitle = useMemo(() => {
    if (activeRepMetadata) return resolveRoleTitle(activeRepMetadata);
    return 'Marketing Representative';
  }, [activeRepMetadata]);

  const activePersonaId = useMemo(
    () => getMarketingPersonaId(activeRepId, activeRepMetadata),
    [activeRepId, activeRepMetadata],
  );

  const isMarketingChannel = useMemo(
    () => marketingReps.some((r) => r.rep_id === activeRepId),
    [marketingReps, activeRepId],
  );

  const identityGroup: IdentityGroup = useMemo(() => {
    if (isMarketingChannel) return 'marketing_channel';
    if (activeRepId.includes('MGR') || activeRepMetadata?.level_code === 'L9') return 'sales_manager';
    return 'sales_executive';
  }, [activeRepId, activeRepMetadata, isMarketingChannel]);

  const isManager = useMemo(
    () => activePersonaId === 'marketing_manager' || activePersonaId === 'marketing_director',
    [activePersonaId],
  );

  const metadataReady = !loadingMetadata && metadata !== null;

  const appReady = useMemo(
    () => !loading && metadataReady && Boolean(activePeriodId),
    [loading, metadataReady, activePeriodId],
  );

  useEffect(() => {
    void fetchUserProfile();
    void fetchMetadata();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('plain-english-mode', plainEnglish);
    document.documentElement.classList.toggle('simple-view-layout', plainEnglish);
    try {
      localStorage.setItem(PLAIN_ENGLISH_STORAGE_KEY, plainEnglish ? 'true' : 'false');
    } catch {
      /* ignore storage errors */
    }
  }, [plainEnglish]);

  const togglePlainEnglish = () => {
    setPlainEnglish((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIMPLE_VIEW_USER_SET_KEY, 'true');
        localStorage.setItem(PLAIN_ENGLISH_STORAGE_KEY, next ? 'true' : 'false');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const legacyPeriodIds = useMemo(
    () => new Set([LEGACY_PERIOD_ID, LEGACY_PRIOR_PERIOD_ID, '2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']),
    [],
  );

  // Ensure active identity is a valid marketing rep from metadata (warehouse or demo personas)
  useEffect(() => {
    if (loadingMetadata || marketingReps.length === 0) return;
    const repInvalid =
      !activeRepId ||
      activeRepId.startsWith('PERSONA-MKT-') ||
      !marketingReps.some((r) => r.rep_id === activeRepId);
    if (repInvalid) {
      const next = marketingReps[0].rep_id;
      setActiveRepId(next);
      localStorage.setItem('hgv_active_rep_id', next);
    }
  }, [loadingMetadata, activeRepId, marketingReps]);

  useEffect(() => {
    if (loadingMetadata || !metadata?.periods?.length) return;
    const periodInvalid =
      !activePeriodId ||
      legacyPeriodIds.has(activePeriodId) ||
      !metadata.periods.some((p) => p.period_id === activePeriodId);
    if (periodInvalid) {
      const next =
        metadata.periods.find((p) => p.is_current)?.period_id ?? metadata.periods[0].period_id;
      setActivePeriodId(next);
      localStorage.setItem('hgv_active_period_id', next);
    }
  }, [loadingMetadata, activePeriodId, metadata?.periods, legacyPeriodIds]);

  // Role-based Simple View default (reps on, managers off) until user toggles manually
  useEffect(() => {
    if (loadingMetadata) return;
    try {
      if (localStorage.getItem(SIMPLE_VIEW_USER_SET_KEY) === 'true') return;
    } catch {
      return;
    }
    const defaultOn = resolveSimpleViewDefault(isManager, activePersonaId);
    setPlainEnglish(defaultOn);
  }, [loadingMetadata, isManager, activePersonaId]);

  const changeActiveRep = (repId: string) => {
    if (!marketingReps.some((r) => r.rep_id === repId)) return;
    setActiveRepId(repId);
    localStorage.setItem('hgv_active_rep_id', repId);

    const matched = marketingReps.find((r) => r.rep_id === repId);
    if (matched && matched.team_id) {
      setActiveTeamId(matched.team_id);
      localStorage.setItem('hgv_active_team_id', matched.team_id);
    }
  };

  const changeActiveTeam = (teamId: string) => {
    setActiveTeamId(teamId);
    localStorage.setItem('hgv_active_team_id', teamId);
  };

  const changeActivePeriod = (periodId: string) => {
    setActivePeriodId(periodId);
    localStorage.setItem('hgv_active_period_id', periodId);
  };

  const changeActiveScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    localStorage.setItem('hgv_active_scenario_id', scenarioId);
  };

  return (
    <AppContext.Provider
      value={{
        activeRepId,
        activeTeamId,
        activePeriodId,
        activeScenarioId,
        isManager,
        activeRoleTitle,
        activePersonaId,
        isMarketingChannel,
        identityGroup,
        currentUser,
        metadata,
        loading,
        loadingMetadata,
        metadataReady,
        appReady,
        error,
        changeActiveRep,
        changeActiveTeam,
        changeActivePeriod,
        changeActiveScenario,
        refreshUserProfile: fetchUserProfile,
        marketingReps,
        plainEnglish,
        togglePlainEnglish,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
