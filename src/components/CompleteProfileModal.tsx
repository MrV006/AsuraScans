import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import { X, User as UserIcon, Phone, FileText, Camera, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CompleteProfileModal() {
  const { user, profile, showSetupModal, setShowSetupModal, refreshProfile } = useAuth();
  
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setUsername(profile.displayName || '');
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhoneNumber(profile.phoneNumber || '');
      setAvatarUrl(profile.avatarUrl || '');
    }
  }, [profile]);

  if (!user || !showSetupModal) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("حجم تصویر باید کمتر از ۱ مگابایت باشد.");
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('لطفا نام کاربری خود را وارد کنید.');
      return;
    }
    if (username.length < 3) {
      setError('نام کاربری باید حداقل ۳ کاراکتر باشد.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Sync to Backend SQL & Local Database
      await apiClient.saveUser({
        id: user.id || user.uid,
        email: user.email || '',
        displayName: username.trim(),
        avatarUrl: avatarUrl,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        hasCompletedSetup: true
      });

      // Refresh the global auth state profile
      await refreshProfile();
      setShowSetupModal(false);
    } catch (err: any) {
      setError('خطا در ذخیره اطلاعات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowSetupModal(false)}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Content Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-[#0e0f14] border border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-asura-accent)]/15 border border-[var(--color-asura-accent)]/30 flex items-center justify-center text-[var(--color-asura-accent)]">
                <UserIcon size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-lg font-sans">تکمیل اطلاعات حساب کاربری</h3>
                <p className="text-[10px] text-zinc-400 font-medium">برای استفاده از تمامی امکانات سایت، لطفا اطلاعات خود را تکمیل کنید.</p>
              </div>
            </div>
            <button
              onClick={() => setShowSetupModal(false)}
              className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Warning Section */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/15 rounded-2xl text-amber-400 text-xs font-medium leading-relaxed">
              ⚠️ در صورت تکمیل نکردن اطلاعات، می‌توانید در سایت به گشت‌وگذار بپردازید اما امکان <strong className="font-black text-amber-300">ارسال دیدگاه، شارژ کیف پول و خرید چپترها</strong> را نخواهید داشت.
            </div>

            {/* Avatar Selector */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={40} className="text-zinc-600" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={20} />
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-[10px] text-zinc-500 font-bold">انتخاب یا بارگذاری تصویر پروفایل (اختیاری)</span>
            </div>

            {/* Fields Grid */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">نام کاربری (الزامی)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                    <UserIcon size={16} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: amirreza_v"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl pr-11 pl-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">نام</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                      <FileText size={16} />
                    </div>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="امیررضا"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl pr-11 pl-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">نام خانوادگی</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                      <FileText size={16} />
                    </div>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="ویسی"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl pr-11 pl-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">شماره تماس</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-500">
                    <Phone size={16} />
                  </div>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl pr-11 pl-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors text-right"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--color-asura-accent)]/10"
              >
                {loading ? 'در حال ثبت اطلاعات...' : 'ثبت و تکمیل اطلاعات'}
              </button>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="py-3.5 px-6 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-2xl font-bold text-xs transition-colors"
              >
                بستن و گشت‌وگذار در سایت
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
