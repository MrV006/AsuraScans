import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Wrench, Globe, LogIn, Lock, AlertCircle, X, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function isUserStaffOrAdmin(profile: any, user: any): boolean {
  if (!profile && !user) return false;
  const target = profile || user;
  const email = target.email || '';
  if (email === 'amirrezaveisi45@gmail.com' || email === 'Mr.V@admin.com') return true;
  const roles: string[] = target.roles || (target.role ? [target.role] : ['user']);
  const staffRoles = ['super_admin', 'admin', 'translator', 'cleaner', 'editor', 'staff'];
  const isStaff = roles.some(r => staffRoles.includes(r));
  const hasPermissions = Array.isArray(target.permissions) && target.permissions.length > 0;
  return isStaff || hasPermissions;
}

export function MaintenanceView() {
  const { settings } = useSettings();
  const { user, profile, login } = useAuth();
  
  const [lang, setLang] = useState<'fa' | 'en'>('fa');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = lang === 'fa' 
    ? (settings.maintenanceTitleFa || "سایت در حال بروزرسانی و ارتقا می‌باشد")
    : (settings.maintenanceTitleEn || "Website Under Maintenance");

  const desc = lang === 'fa'
    ? (settings.maintenanceDescFa || "ما در حال ارتقای سرورها و افزودن امکانات جدید هستیم. لطفاً شکیبا باشید و به‌زودی دوباره سر بزنید.")
    : (settings.maintenanceDescEn || "We are currently upgrading our platform to serve you better. Please check back soon.");

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);
    setIsSubmitting(true);

    try {
      const loggedUser = await login(identifier, password);
      const isAuthorized = isUserStaffOrAdmin(loggedUser, loggedUser);

      if (isAuthorized) {
        setLoginSuccess(
          lang === 'fa' 
            ? "ورود موفقیت‌آمیز! در حال انتقال..." 
            : "Login successful! Redirecting..."
        );
        setTimeout(() => {
          setShowLoginModal(false);
          window.location.reload();
        }, 1000);
      } else {
        setLoginError(
          lang === 'fa'
            ? "دسترسی غیرمجاز: فقط ادمین‌ها و اعضای کادر مجاز به ورود در حالت بروزرسانی هستند."
            : "Access Denied: Only administrators and staff members are allowed during maintenance mode."
        );
      }
    } catch (err: any) {
      setLoginError(err.message || (lang === 'fa' ? "نام کاربری/ایمیل یا رمز عبور اشتباه است." : "Invalid credentials."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-between relative overflow-hidden select-none" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Background Animated Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--color-asura-accent)]/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-red-600/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Top Header Bar */}
      <header className="max-w-7xl w-full mx-auto p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--color-asura-accent)]/10 border border-[var(--color-asura-accent)]/30 flex items-center justify-center text-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/10">
            <Wrench size={20} className="animate-pulse" />
          </div>
          <span className="font-black text-lg tracking-wider text-white">
            {settings.siteName || 'Mangata'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setLang('fa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'fa' ? 'bg-[var(--color-asura-accent)] text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
            >
              فارسی
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'en' ? 'bg-[var(--color-asura-accent)] text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
            >
              English
            </button>
          </div>

          {/* Admin Login Button */}
          <button
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] shadow-lg active:scale-95"
          >
            <LogIn size={15} className="text-[var(--color-asura-accent)]" />
            <span>{lang === 'fa' ? 'ورود مدیران' : 'Admin Login'}</span>
          </button>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="max-w-2xl w-full mx-auto px-6 py-12 text-center z-10 my-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          {/* Maintenance Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black tracking-wide uppercase shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>{lang === 'fa' ? 'حالت تعمیرات و ارتقای سیستم' : 'Maintenance & System Upgrade'}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">
            {title}
          </h1>

          {/* Description */}
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto font-medium">
            {desc}
          </p>

          {/* Admin Note Box */}
          <div className="pt-6">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 max-w-md mx-auto text-center space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 font-bold">
                <Lock size={15} className="text-amber-400" />
                <span>
                  {lang === 'fa' ? 'مخصوص اعضای کادر و مدیران:' : 'For Staff & Administrators:'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {lang === 'fa' 
                  ? 'اگر از ادمین‌ها یا مترجمین وبسایت هستید، می‌توانید با زدن دکمه ورود مدیران وارد حساب خود شده و به تمامی بخش‌ها دسترسی کامل داشته باشید.'
                  : 'If you are an administrator or team staff, click Admin Login to log into your account and access all sections normally.'}
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full mt-2 py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-[var(--color-asura-accent)]/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <LogIn size={16} />
                <span>{lang === 'fa' ? 'ورود به حساب مدیریت' : 'Log Into Admin Account'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-zinc-600 z-10 border-t border-white/5">
        <span>© {new Date().getFullYear()} {settings.siteName || 'Mangata'}. {lang === 'fa' ? 'تمامی حقوق محفوظ است.' : 'All rights reserved.'}</span>
      </footer>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0f0f13] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 md:p-8"
              dir={lang === 'fa' ? 'rtl' : 'ltr'}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 left-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[var(--color-asura-accent)]/10 border border-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {lang === 'fa' ? 'ورود مدیران و اعضای کادر' : 'Admin & Staff Login'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                    {lang === 'fa' ? 'فقط ادمین‌های مجاز حق عبور از حالت تعمیرات را دارند' : 'Only authorized staff can bypass maintenance mode'}
                  </p>
                </div>
              </div>

              {/* Login Errors / Success Messages */}
              {loginError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-3 font-medium leading-relaxed">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {loginSuccess && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-3 font-medium">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{loginSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">
                    {lang === 'fa' ? 'نام کاربری یا ایمیل' : 'Email or Username'}
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder={lang === 'fa' ? 'مثال: admin@site.com یا admin' : 'e.g. admin@site.com'}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">
                    {lang === 'fa' ? 'رمز عبور' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[var(--color-asura-accent)]/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <LogIn size={16} />
                      <span>{lang === 'fa' ? 'ورود و بررسی دسترسی' : 'Login & Verify Access'}</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
