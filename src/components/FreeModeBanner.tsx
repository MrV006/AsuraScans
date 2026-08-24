import React, { useState } from 'react';
import { Gift, Sparkles, LogIn, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

interface FreeModeBannerProps {
  onOpenAuthModal?: () => void;
}

export function FreeModeBanner({ onOpenAuthModal }: FreeModeBannerProps) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [isMinimized, setIsMinimized] = useState(false);

  if (!settings?.globalFreeMode) {
    return null;
  }

  const bannerText = settings.globalFreeBannerText?.trim() || 
    "🎉 جشنواره دسترسی رایگان سراسری به تمامی چپترها فعال است!";

  return (
    <AnimatePresence>
      <div 
        id="free-mode-festival-banner"
        className="fixed top-16 left-0 right-0 z-40 bg-gradient-to-r from-emerald-950/95 via-teal-900/95 to-emerald-950/95 backdrop-blur-md border-b border-emerald-500/30 text-emerald-100 shadow-lg shadow-emerald-950/40 transition-all duration-300"
        dir="rtl"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4 text-xs font-bold">
          {/* Right/Start (RTL): Icon & Badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide">
              <Sparkles size={11} className="text-emerald-400" />
              <span>جشنواره رایگان</span>
            </div>
          </div>

          {/* Center: Dynamic Banner Text */}
          {!isMinimized && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 text-center min-w-0 px-1"
            >
              <p className="text-[11px] sm:text-xs text-emerald-100/90 font-medium truncate sm:whitespace-normal">
                {bannerText}
              </p>
            </motion.div>
          )}

          {/* Left/End (RTL): Actions (Guest login button & minimize toggle) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!user && onOpenAuthModal && !isMinimized && (
              <button
                id="btn-banner-login"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-[10px] sm:text-[11px] px-2.5 py-1 rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
              >
                <LogIn size={12} />
                <span>ورود / ثبت‌نام</span>
              </button>
            )}

            {user && !isMinimized && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <Check size={10} className="text-emerald-400" />
                <span>دسترسی رایگان برای شما فعال است</span>
              </span>
            )}

            {/* Minimize / Expand Toggle */}
            <button
              id="btn-banner-toggle-collapse"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/10 rounded transition-colors"
              title={isMinimized ? "نمایش کامل متن جشنواره" : "جمع کردن نوار"}
            >
              {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
