import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [identifier, setIdentifier] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register, loginWithGoogle } = useAuth();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('لطفا تمام فیلدها را پر کنید.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // First, try logging in
      await login(identifier, password);
      onClose();
    } catch (loginError: any) {
      // If user not found, and it looks like an email, automatically register them!
      if (loginError.message.includes('یافت نشد') || loginError.message.includes('not found')) {
        if (identifier.includes('@')) {
          try {
            const displayName = identifier.split('@')[0];
            await register(identifier, displayName, password);
            onClose();
          } catch (regError: any) {
            setError(regError.message || 'خطا در ثبت نام.');
          }
        } else {
          setError('کاربری با این نام کاربری یافت نشد. لطفا ابتدا با ایمیل ثبت نام کنید.');
        }
      } else {
        setError(loginError.message || 'ایمیل/نام کاربری یا رمز عبور اشتباه است.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      // Fallback: Simulation/Prompt when VITE_GOOGLE_CLIENT_ID is not configured
      const email = prompt("ایمیل شبیه‌ساز گوگل:");
      if (!email) return;
      const displayName = prompt("نام نمایشی شبیه‌ساز:", email.split('@')[0]);
      if (!displayName) return;
      const avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";
      
      setLoading(true);
      try {
        const parts = displayName.trim().split(/\s+/);
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(' ') || "";
        
        await loginWithGoogle({
          email,
          displayName,
          avatarUrl,
          firstName,
          lastName,
          phoneNumber: ""
        });
        onClose();
      } catch (err: any) {
        setError(err.message || "خطا در ورود با گوگل شبیه‌سازی شده");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Real Google Identity Services (GIS) auth
    try {
      setLoading(true);
      
      // Load Google Sign-In SDK if not loaded
      if (!(window as any).google) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Google SDK"));
          document.head.appendChild(script);
        });
      }

      const google = (window as any).google;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            const token = response.credential;
            const decoded = decodeJwt(token);
            if (!decoded) {
              throw new Error("رمزگشایی توکن گوگل ناموفق بود.");
            }

            const { email, name, picture, given_name, family_name } = decoded;
            
            await loginWithGoogle({
              email: email,
              displayName: name || email.split('@')[0],
              avatarUrl: picture || "",
              firstName: given_name || "",
              lastName: family_name || "",
              phoneNumber: ""
            });
            onClose();
          } catch (err: any) {
            setError(err.message || "خطا در احراز هویت با گوگل.");
          } finally {
            setLoading(false);
          }
        }
      });

      google.accounts.id.prompt();
    } catch (err: any) {
      setError("بارگذاری ورود با گوگل با خطا مواجه شد. لطفا اتصال خود را بررسی کنید.");
      setLoading(false);
    }
  };

  const decodeJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("JWT Decode failed", e);
      return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 text-right" dir="rtl">
                <h2 className="text-xl font-black text-white">
                  ورود یا ثبت‌نام در <span className="text-[var(--color-asura-accent)]">آسورا</span>
                </h2>
                <button 
                  onClick={onClose}
                  className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-right" dir="rtl">
                  {error}
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4 text-right" dir="rtl">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">
                    ایمیل یا نام کاربری
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right"
                      placeholder="ایمیل یا نام کاربری"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">
                    رمز عبور
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'در حال پردازش...' : 'ورود / ثبت‌نام'}
                  </button>
                  <p className="text-center text-xs text-zinc-500 mt-3">
                    در صورتی که حسابی با این مشخصات نباشد، حساب کاربری به صورت خودکار ساخته می‌شود.
                  </p>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  ورود با گوگل
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
