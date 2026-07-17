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
  loginWithGoogle: (googleProfile: any) => Promise<any>;
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
  loginWithGoogle: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
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
    return { ...u, uid: u.id, id: u.id };
  };

  const refreshProfile = async () => {
    const savedUid = localStorage.getItem('asura_user_uid');
    if (!savedUid) return;
    try {
      const userProfile = await apiClient.getUser(savedUid);
      if (userProfile) {
        const enriched = enrichUser(userProfile);
        setProfile(enriched);
        setUser(enriched);
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
      localStorage.setItem('asura_user_uid', loggedUser.id);
      const enriched = enrichUser(loggedUser);
      setUser(enriched);
      setProfile(enriched);
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
      localStorage.setItem('asura_user_uid', newUser.id);
      const enriched = enrichUser(newUser);
      setUser(enriched);
      setProfile(enriched);
      setShowSetupModal(true);
      return enriched;
    } catch (err) {
      console.error("Registration failed:", err);
      throw err;
    }
  };

  const loginWithGoogle = async (googleProfile: { email: string; displayName: string; avatarUrl: string; firstName?: string; lastName?: string; phoneNumber?: string }) => {
    try {
      const loggedUser = await apiClient.googleLogin(googleProfile);
      localStorage.setItem('asura_user_uid', loggedUser.id);
      const enriched = enrichUser(loggedUser);
      setUser(enriched);
      setProfile(enriched);
      if (loggedUser.hasCompletedSetup === false) {
        setShowSetupModal(true);
      } else {
        setShowSetupModal(false);
      }
      return enriched;
    } catch (err) {
      console.error("Google login failed:", err);
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem('asura_user_uid');
    localStorage.removeItem('asura_simulate_user');
    setUser(null);
    setProfile(null);
    setShowSetupModal(false);
    window.location.href = '/';
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedUid = localStorage.getItem('asura_user_uid');
      if (savedUid) {
        try {
          const userProfile = await apiClient.getUser(savedUid);
          if (userProfile) {
            if (userProfile.banned) {
              localStorage.removeItem('asura_user_uid');
              setUser(null);
              setProfile(null);
              alert("حساب کاربری شما مسدود شده است.");
            } else {
              const enriched = enrichUser(userProfile);
              setUser(enriched);
              setProfile(enriched);
              if (userProfile.hasCompletedSetup === false) {
                setShowSetupModal(true);
              }
            }
          } else {
            localStorage.removeItem('asura_user_uid');
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
      loginWithGoogle,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
