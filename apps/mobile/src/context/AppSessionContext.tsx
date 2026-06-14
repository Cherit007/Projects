import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AppUser, GroupSummary } from '../navigation/types';
import { getLastSportForGroup, setLastSportForGroup } from '../utils/activeSportStorage';

type AppSessionContextValue = {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  groups: GroupSummary[];
  setGroups: (groups: GroupSummary[]) => void;
  activeGroup: GroupSummary | null;
  setActiveGroup: (group: GroupSummary | null) => void;
  sportId: string;
  setSportId: (sportId: string) => void;
  signOutLocal: () => void;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export const AppSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupSummary | null>(null);
  const [sportId, setSportIdState] = useState('badminton');

  const setSportId = useCallback((nextSportId: string) => {
    setSportIdState(nextSportId);
  }, []);

  useEffect(() => {
    if (!activeGroup?.id) return;
    void setLastSportForGroup(activeGroup.id, sportId);
  }, [activeGroup?.id, sportId]);

  useEffect(() => {
    if (!activeGroup?.id) return;
    void getLastSportForGroup(activeGroup.id).then((savedSportId) => {
      setSportIdState(savedSportId);
    });
  }, [activeGroup?.id]);

  const signOutLocal = useCallback(() => {
    setUser(null);
    setGroups([]);
    setActiveGroup(null);
    setSportIdState('badminton');
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    groups,
    setGroups,
    activeGroup,
    setActiveGroup,
    sportId,
    setSportId,
    signOutLocal,
  }), [user, groups, activeGroup, sportId, signOutLocal, setSportId]);

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
};

export const useAppSession = () => {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }
  return context;
};
