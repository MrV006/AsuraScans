import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState(''); // email or username
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('لطفاً ایمیل/نام‌کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await login(identifier.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'ایمیل/نام کاربری یا رمز عبور اشتباه است.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !displayName.trim()) {
      setError('لطفاً تمام فیلدها را برای ثبت‌نام پر کنید.');
      return;
    }
    if (!email.includes('@')) {
      setError('لطفاً یک آدرس ایمیل معتبر وارد کنید.');
      return;
    }
    if (password.length < 4) {
      setError('رمز عبور باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await register(email.trim(), displayName.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در فرآیند ثبت‌نام.');
    } finally {
      setLoading(false);
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
                <div>
                  <h2 className="text-xl font-black text-white">
                    {mode === 'login' ? 'ورود به حساب کاربری' : 'ایجاد حساب کاربری'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {settings.siteName || 'آسورا'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/5 rounded-xl mb-5" dir="rtl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'login'
                      ? 'bg-[var(--color-asura-accent)] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LogIn size={15} />
                  ورود
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'register'
                      ? 'bg-[var(--color-asura-accent)] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={15} />
                  ثبت‌نام جدید
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-xs text-right leading-relaxed" dir="rtl">
                  {error}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4 text-right" dir="rtl">
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
                        className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right text-sm"
                        placeholder="ایمیل یا نام کاربری"
                        autoFocus
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
                        className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] active:scale-[0.99] text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
                    >
                      {loading ? 'در حال ورود...' : 'ورود به حساب'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4 text-right" dir="rtl">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 mb-2">
                      نام نمایشی / مستعار
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                        <UserIcon size={18} />
                      </div>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right text-sm"
                        placeholder="نام شما در سایت"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 mb-2">
                      آدرس ایمیل
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right text-sm"
                        placeholder="example@gmail.com"
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
                        className="w-full bg-black/40 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right text-sm"
                        placeholder="حداقل ۴ کاراکتر"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] active:scale-[0.99] text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
                    >
                      {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام و ورود'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
