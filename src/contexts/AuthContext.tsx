import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { apiClient } from '../lib/apiClient';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isSimulatingUser: boolean;
  setIsSimulatingUser: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isSimulatingUser: false,
  setIsSimulatingUser: () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulatingUser, setIsSimulatingUserInternal] = useState<boolean>(() => {
    return localStorage.getItem('asura_simulate_user') === 'true';
  });

  const setIsSimulatingUser = (val: boolean) => {
    localStorage.setItem('asura_simulate_user', val ? 'true' : 'false');
    setIsSimulatingUserInternal(val);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        localStorage.setItem('asura_user_uid', user.uid);
        // Try creating/fetching user profile
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          let profileData: any = null;
          
          if (!userSnap.exists()) {
            profileData = {
              displayName: user.displayName || user.email?.split('@')[0] || 'Unknown',
              avatarUrl: user.photoURL || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              banned: false
            };
            await setDoc(userRef, profileData);
          } else {
            profileData = userSnap.data();
          }

          if (profileData.banned) {
            await auth.signOut();
            setUser(null);
            setProfile(null);
            localStorage.removeItem('asura_user_uid');
            alert("Your account has been suspended.");
          } else {
            setProfile(profileData);
            
            // Auto-sync with backend SQL/JSON database
            const role = (user.email === 'amirrezaveisi45@gmail.com' || user.email === 'Mr.V@admin.com' || profileData.role === 'admin') ? 'admin' : 'user';
            await apiClient.saveUser({
              id: user.uid,
              email: user.email || '',
              displayName: profileData.displayName || 'Unknown',
              avatarUrl: profileData.avatarUrl || '',
              role: role
            }).catch(e => console.error("Failed to sync profile to backend", e));
          }
        } catch (error) {
          console.error("Error fetching profile", error);
        }
      } else {
        setProfile(null);
        localStorage.removeItem('asura_user_uid');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSimulatingUser, setIsSimulatingUser }}>
      {children}
    </AuthContext.Provider>
  );
}
