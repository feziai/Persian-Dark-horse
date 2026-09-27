import { useState, useEffect } from 'react';

export type Project = {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'completed';
  description: string;
  createdAt: string;
};

export type ConnectorProfile = {
  id: string;
  name: string;
  serviceUrl: string;
  enabled: boolean;
  createdAt: string;
};

export type UserSkill = {
  id: string;
  nameEn: string;
  nameFa: string;
  instructionsEn: string;
  instructionsFa: string;
  enabled: boolean;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  planId: string;
  currencyId: string;
  txId: string;
  walletAddress?: string;
  createdAt: string;
  status: 'submitted' | 'pending' | 'approved' | 'rejected';
};

export type UserProfile = {
  name: string;
  email: string;
  bio: string;
};

export type PersonalizationSettings = {
  theme: 'light' | 'dark';
  accent: string;
  sidebarCollapsed: boolean;
};

export type AppSettings = {
  language: 'en' | 'fa';
  notificationsEnabled: boolean;
  voiceEnabled: boolean;
};

interface State {
  profile: UserProfile;
  personalization: PersonalizationSettings;
  appSettings: AppSettings;
  projects: Project[];
  connectors: ConnectorProfile[];
  skills: UserSkill[];
  paymentRecords: PaymentRecord[];
}

const defaultState: State = {
  profile: {
    name: '',
    email: '',
    bio: '',
  },
  personalization: {
    theme: 'dark',
    accent: '43 68% 60%',
    sidebarCollapsed: false,
  },
  appSettings: {
    language: 'en',
    notificationsEnabled: true,
    voiceEnabled: true,
  },
  projects: [],
  connectors: [],
  skills: [],
  paymentRecords: [],
};

let globalState: State = { ...defaultState };

try {
  const saved = localStorage.getItem('fezi-ai-storage');
  if (saved) {
    globalState = { ...globalState, ...JSON.parse(saved) };
    if ((globalState.personalization as any).theme === 'black') {
      globalState.personalization.theme = 'dark';
    }
    if (!['light', 'dark'].includes(globalState.personalization.theme)) {
      globalState.personalization.theme = 'dark';
    }
    if ((globalState.appSettings as any).direction) {
      delete (globalState.appSettings as any).direction;
    }
  }
} catch (e) {
  // Ignore
}

const listeners = new Set<() => void>();

function setState(newState: Partial<State> | ((prev: State) => Partial<State>)) {
  const updates = typeof newState === 'function' ? newState(globalState) : newState;
  globalState = { ...globalState, ...updates };
  localStorage.setItem('fezi-ai-storage', JSON.stringify(globalState));
  listeners.forEach(l => l());
}

export function useLocalStore<T = ReturnType<typeof getStoreApi>>(selector?: (store: ReturnType<typeof getStoreApi>) => T): T {
  const [state, setLocalState] = useState(globalState);

  useEffect(() => {
    const listener = () => setLocalState(globalState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const store = getStoreApi(state);
  return selector ? selector(store) : (store as unknown as T);
}

function getStoreApi(state: State) {
  return {
    ...state,
    setProfile: (profile: Partial<UserProfile>) => setState(s => ({ profile: { ...s.profile, ...profile } })),
    setPersonalization: (personalization: Partial<PersonalizationSettings>) => setState(s => ({ personalization: { ...s.personalization, ...personalization } })),
    setAppSettings: (appSettings: Partial<AppSettings>) => setState(s => ({ appSettings: { ...s.appSettings, ...appSettings } })),
    
    addProject: (project: Project) => setState(s => ({ projects: [...s.projects, project] })),
    updateProject: (id: string, project: Partial<Project>) => setState(s => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...project } : p)) })),
    deleteProject: (id: string) => setState(s => ({ projects: s.projects.filter((p) => p.id !== id) })),
    
    addConnector: (connector: ConnectorProfile) => setState(s => ({ connectors: [...s.connectors, connector] })),
    updateConnector: (id: string, connector: Partial<ConnectorProfile>) => setState(s => ({ connectors: s.connectors.map((c) => (c.id === id ? { ...c, ...connector } : c)) })),
    deleteConnector: (id: string) => setState(s => ({ connectors: s.connectors.filter((c) => c.id !== id) })),
    
    addSkill: (skill: UserSkill) => setState(s => ({ skills: [...s.skills, skill] })),
    updateSkill: (id: string, skill: Partial<UserSkill>) => setState(s => ({ skills: s.skills.map((s) => (s.id === id ? { ...s, ...skill } : s)) })),
    deleteSkill: (id: string) => setState(s => ({ skills: s.skills.filter((s) => s.id !== id) })),
    addPaymentRecord: (record: PaymentRecord) => setState(s => ({ paymentRecords: [...s.paymentRecords, record] })),
  };
}