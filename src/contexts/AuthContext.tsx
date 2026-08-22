import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '../lib/apiClient';

interface AuthContextType {
  user: any | null;
  profile: any | null;
  loading: boolean;
  isSimulatingUser: boolean;
  setIsSimulatingUser: (val: boolean) => void;
  showSetupModal: boolean;
  setShowSetupModal: (val: boolean) => void;
  refreshProfile: () => Promise<void>;
  login: (emailOrUsername: string, password?: string) => Promise<any>;
  register: (email: string, displayName: string, password?: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isSimulatingUser: false,
  setIsSimulatingUser: () => {},
  showSetupModal: false,
  setShowSetupModal: () => {},
  refreshProfile: async () => {},
  login: async () => {},
  register: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const getInitialUser = () => {
    try {
      const saved = localStorage.getItem('asura_user_cache');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse cached user:", e);
    }
    return null;
  };

  const [user, setUser] = useState<any | null>(getInitialUser);
  const [profile, setProfile] = useState<any | null>(getInitialUser);
  const [loading, setLoading] = useState<boolean>(() => {
    const saved = localStorage.getItem('asura_user_cache');
    const savedUid = localStorage.getItem('asura_user_uid') || localStorage.getItem('asura_user_id') || localStorage.getItem('userUid');
    return Boolean(!saved && savedUid);
  });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isSimulatingUser, setIsSimulatingUserInternal] = useState<boolean>(() => {
    return localStorage.getItem('asura_simulate_user') === 'true';
  });

  const setIsSimulatingUser = (val: boolean) => {
    localStorage.setItem('asura_simulate_user', val ? 'true' : 'false');
    setIsSimulatingUserInternal(val);
  };

  const enrichUser = (u: any) => {
    if (!u) return null;
    return { ...u, uid: u.id || u.uid, id: u.id || u.uid };
  };

  const saveUserSession = (enriched: any) => {
    if (enriched && (enriched.id || enriched.uid)) {
      const id = enriched.id || enriched.uid;
      localStorage.setItem('asura_user_uid', id);
      localStorage.setItem('asura_user_id', id);
      localStorage.setItem('userUid', id);
      localStorage.setItem('asura_user_cache', JSON.stringify(enriched));
    }
    setUser(enriched);
    setProfile(enriched);
  };

  const clearUserSession = () => {
    localStorage.removeItem('asura_user_uid');
    localStorage.removeItem('asura_user_id');
    localStorage.removeItem('userUid');
    localStorage.removeItem('asura_user_cache');
    localStorage.removeItem('asura_simulate_user');
    setUser(null);
    setProfile(null);
    setShowSetupModal(false);
  };

  const refreshProfile = async () => {
    const savedUid = localStorage.getItem('asura_user_uid') || localStorage.getItem('asura_user_id') || localStorage.getItem('userUid') || user?.id;
    if (!savedUid) return;
    try {
      const userProfile = await apiClient.getUser(savedUid);
      if (userProfile) {
        const enriched = enrichUser(userProfile);
        saveUserSession(enriched);
        if (userProfile.hasCompletedSetup) {
          setShowSetupModal(false);
        }
      }
    } catch (e) {
      console.error("Failed to refresh profile:", e);
    }
  };

  const login = async (emailOrUsername: string, password?: string) => {
    try {
      const loggedUser = await apiClient.login({ identifier: emailOrUsername, password });
      const enriched = enrichUser(loggedUser);
      saveUserSession(enriched);
      if (loggedUser.hasCompletedSetup === false) {
        setShowSetupModal(true);
      } else {
        setShowSetupModal(false);
      }
      return enriched;
    } catch (err) {
      console.error("Login failed:", err);
      throw err;
    }
  };

  const register = async (email: string, displayName: string, password?: string) => {
    try {
      const newUser = await apiClient.register({ email, displayName, password });
      const enriched = enrichUser(newUser);
      saveUserSession(enriched);
      setShowSetupModal(true);
      return enriched;
    } catch (err) {
      console.error("Registration failed:", err);
      throw err;
    }
  };

  const logout = async () => {
    clearUserSession();
    window.location.href = '/';
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedUid = localStorage.getItem('asura_user_uid') || localStorage.getItem('asura_user_id') || localStorage.getItem('userUid');
      if (savedUid) {
        try {
          const userProfile = await apiClient.getUser(savedUid);
          if (userProfile) {
            if (userProfile.banned) {
              clearUserSession();
              alert("حساب کاربری شما مسدود شده است.");
            } else {
              const enriched = enrichUser(userProfile);
              saveUserSession(enriched);
              if (userProfile.hasCompletedSetup === false) {
                setShowSetupModal(true);
              }
            }
          } else {
            // Check if super admin identifier
            const lowerUid = savedUid.toLowerCase();
            if (lowerUid === 'admin' || lowerUid === 'super_admin' || lowerUid.includes('amirrezaveisi') || lowerUid.includes('mr.v')) {
              const adminFallback = enrichUser({
                id: 'admin',
                email: 'amirrezaveisi45@gmail.com',
                displayName: 'مدیریت کل',
                avatarUrl: '',
                role: 'admin',
                roles: ['super_admin', 'admin'],
                permissions: ['all'],
                banned: false,
                canCreateSeries: true,
                walletBalance: 1000000,
                hasCompletedSetup: true,
                createdAt: new Date().toISOString()
              });
              saveUserSession(adminFallback);
            }
          }
        } catch (e) {
          console.error("Failed to restore session:", e);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isSimulatingUser,
      setIsSimulatingUser,
      showSetupModal,
      setShowSetupModal,
      refreshProfile,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
