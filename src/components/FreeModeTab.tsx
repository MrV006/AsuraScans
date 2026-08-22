import React, { useState, useEffect } from "react";
import { apiClient, getSocketInstance } from "../lib/apiClient";
import { useSettings } from "../contexts/SettingsContext";
import {
  Sparkles,
  Gift,
  CheckCircle,
  AlertTriangle,
  Zap,
  RefreshCw,
  Coins,
  ShieldCheck,
  Eye,
  Info,
  Sliders,
  Check,
  Lock,
  Unlock,
  Volume2,
  ArrowRight,
  TrendingDown,
  UserCheck,
  BookOpen
} from "lucide-react";

interface FreeModeTabProps {
  adminUid?: string;
}

export default function FreeModeTab({ adminUid }: FreeModeTabProps) {
  const { settings, reloadSettings } = useSettings();
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [bannerText, setBannerText] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastToggledAt, setLastToggledAt] = useState<string | null>(null);

  // Sync with current site settings
  useEffect(() => {
    if (settings) {
      setIsEnabled(!!settings.globalFreeMode);
      setBannerText(
        settings.globalFreeBannerText ||
          "🎉 جشنواره دسترسی رایگان سراسری فعال است - تمامی چپترها برای همه کاربران بدون نیاز به پرداخت رایگان می‌باشد."
      );
    }
  }, [settings]);

  // Listen to live socket events for global free mode updates
  useEffect(() => {
    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data && typeof data.enabled === "boolean") {
        setIsEnabled(data.enabled);
        if (data.bannerText) setBannerText(data.bannerText);
      }
      setLastToggledAt(new Date().toLocaleTimeString("fa-IR"));
    };

    socket.on("settings:global_free_mode_updated", handleUpdate);
    socket.on("global_free_mode:updated", handleUpdate);

    return () => {
      socket.off("settings:global_free_mode_updated", handleUpdate);
      socket.off("global_free_mode:updated", handleUpdate);
    };
  }, []);

  const handleToggle = async (nextState: boolean) => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiClient.toggleGlobalFreeMode(
        nextState,
        bannerText.trim(),
        adminUid
      );

      setIsEnabled(nextState);
      if (reloadSettings) await reloadSettings();

      setSuccessMessage(
        nextState
          ? "✨ حالت رایگان سراسری با موفقیت فعال شد! تمام کاربران اکنون به صورت کاملاً رایگان چپترها را می‌خوانند."
          : "🔒 حالت رایگان سراسری غیرفعال شد. سیستم به وضعیت پولی استاندارد و توزیع سود بازگشت."
      );
      setLastToggledAt(new Date().toLocaleTimeString("fa-IR"));

      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
    } catch (err: any) {
      setErrorMessage(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBannerTextOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await apiClient.toggleGlobalFreeMode(
        isEnabled,
        bannerText.trim(),
        adminUid
      );
      if (reloadSettings) await reloadSettings();
      setSuccessMessage("✅ متن پیام نوار اعلان جشنواره با موفقیت بروزرسانی شد.");
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "خطا در ذخیره‌سازی متن");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <Gift size={28} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                مدیریت دسترسی رایگان سراسری (جشنواره / مطالعه آزاد)
              </h2>
              <p className="text-xs md:text-sm text-zinc-400 mt-1">
                کنترل یکپارچه باز بودن تمامی چپترها برای تمام کاربران، بدون ثبت خرید در دیتابیس و بدون توزیع سود
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-3">
          {lastToggledAt && (
            <span className="text-[11px] text-zinc-500">
              آخرین تغییر: {lastToggledAt}
            </span>
          )}
          <div
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
              isEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-950/50 animate-pulse"
                : "bg-white/5 border-white/10 text-zinc-400"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isEnabled ? "bg-emerald-400" : "bg-zinc-500"
              }`}
            />
            {isEnabled ? "حالت رایگان: فعال (دسترسی باز)" : "حالت عادی: فعال (پولی و توزیع سود)"}
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-300 text-sm font-bold flex items-center gap-3 animate-fade-in">
          <CheckCircle size={20} className="shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-2xl text-red-300 text-sm font-bold flex items-center gap-3 animate-fade-in">
          <AlertTriangle size={20} className="shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Switch Card */}
      <div
        className={`p-6 md:p-8 rounded-3xl border transition-all duration-300 ${
          isEnabled
            ? "bg-gradient-to-br from-emerald-950/40 via-[#0f1d16] to-[#0a120e] border-emerald-500/40 shadow-2xl shadow-emerald-950/60 ring-1 ring-emerald-500/20"
            : "bg-[var(--color-asura-card)] border-[var(--color-asura-border)] shadow-xl"
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isEnabled
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {isEnabled ? "🚀 هم‌اکنون فعال است" : "🔒 هم‌اکنون خاموش است"}
              </span>
              <span className="text-xs text-zinc-500">سوئیچ اصلی پلتفرم</span>
            </div>

            <h3 className="text-xl md:text-2xl font-black text-white">
              {isEnabled
                ? "تمامی چپترها برای اعضای ثبت‌نام‌شده سایت کاملاً رایگان است"
                : "سیستم فروش و خرید چپترها در حالت استاندارد است"}
            </h3>

            <p className="text-sm text-zinc-300 leading-relaxed">
              {isEnabled
                ? "در این حالت تنها شرط مطالعه رایگان تمامی چپترها، ورود یا ثبت‌نام در وب‌سایت است. هر کاربری که وارد حساب خود شده باشد بدون پرداخت هیچ هزینه‌ای و بدون کسر از کیف پول چپترها را می‌خواند. کاربران مهمان با صفحه ترغیب به ثبت‌نام/ورود برای مطالعه رایگان روبرو خواهند شد."
                : "در این حالت کاربران برای باز کردن چپترهای غیررایگان باید ۴۰۰ تومان از موجودی کیف پول خود پرداخت کنند. به ازای هر خرید، درصد سهم مترجم، ادیتور، کلینر و مدیر سایت طبق تنظیمات به حساب آن‌ها واریز می‌شود."}
            </p>
          </div>

          {/* Big Interactive Action Button */}
          <div className="shrink-0 w-full sm:w-auto flex flex-col items-center gap-3">
            <button
              id="btn-toggle-global-free-mode"
              disabled={saving}
              onClick={() => handleToggle(!isEnabled)}
              className={`w-full sm:w-64 py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all duration-300 shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isEnabled
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 hover:shadow-red-950/40 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  <span>در حال تغییر وضعیت...</span>
                </>
              ) : isEnabled ? (
                <>
                  <Lock size={20} />
                  <span>غیرفعال‌سازی حالت رایگان (قفل کردن مجدد)</span>
                </>
              ) : (
                <>
                  <Unlock size={20} />
                  <span>روشن کردن دسترسی رایگان سراسری</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-zinc-400 font-bold">
              {isEnabled
                ? "برای بازگرداندن به حالت پولی عادی کلیک کنید"
                : "برای رایگان شدن کل چپترها برای اعضا کلیک کنید"}
            </span>
          </div>
        </div>
      </div>

      {/* Rules & Behavioral Logic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* State 1: When Free Mode is Active */}
        <div className="bg-[var(--color-asura-card)] border border-emerald-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-400 border-b border-white/5 pb-3">
            <Sparkles size={20} />
            <h4 className="font-black text-sm text-white">
              منطق و رفتار سیستم در حالت رایگان (روشن بودن کلید)
            </h4>
          </div>

          <ul className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>تنها شرط دسترسی رایگان:</strong> کاربر باید وارد حساب کاربری خود شده یا ثبت‌نام کرده باشد.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>کاربران مهمان (خارج از حساب):</strong> با صفحه جذاب درخواست ورود یا ثبت‌نام مواجه می‌شوند تا پس از ورود بلافاصله رایگان بخوانند.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>مطالعه نامحدود برای کاربران:</strong> اعضای وارد شده می‌توانند بدون پرداخت وجه، تمام چپترها را بدون محدودیت بخوانند.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>عدم ثبت خرید در دیتابیس:</strong> هیچ رکوردی در جدول خریدهای کاربر (<code>purchased_chapters</code>) ثبت نخواهد شد.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>عدم کسر وجه و عدم توزیع سود:</strong> موجودی کاربران دست‌نخورده می‌ماند و پولی توزیع نمی‌شود.
              </span>
            </li>
          </ul>
        </div>

        {/* State 2: When Free Mode is Turned Off */}
        <div className="bg-[var(--color-asura-card)] border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-400 border-b border-white/5 pb-3">
            <ShieldCheck size={20} />
            <h4 className="font-black text-sm text-white">
              منطق و رفتار سیستم پس از خاموش کردن (بازگشت به حالت پولی)
            </h4>
          </div>

          <ul className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <Check size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>نیاز به خرید مجدد:</strong> کاربرانی که چپتری را در دوران رایگان بودن خوانده‌اند، برای دسترسی مجدد به آن چپتر پس از خاموش شدن این قابلیت، باید ۴۰۰ تومان پرداخت کنند.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>توزیع دقیق سود:</strong> با هر خرید، درصد سهم مترجم، ادیتور، کلینر و سایت طبق روال گذشته محاسبه و به کیف پولشان واریز می‌شود.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>حفظ خریدهای قبلی:</strong> خریدارانی که از قبل و با پرداخت پول چپتری را خریده بودند، همچنان به صورت دائمی به چپترهای خود دسترسی دارند.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>اعمال فوری:</strong> بلافاصله با زدن دکمه، وضعیت از طریق وب‌سوکت برای تمام کاربران آنلاین اعمال می‌شود.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Announcement Banner Customizer */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <Volume2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                شخصی‌سازی پیام نوار اعلان جشنواره (Banner)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                این پیام در زمان فعال بودن حالت رایگان سراسری، در بالای سایت و صفحات مانهوا و ریدر به کاربران نمایش داده می‌شود.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveBannerTextOnly} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-2">
              متن اعلان سراسری رایگان:
            </label>
            <input
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              placeholder="مثال: 🎉 جشنواره عیدانه: تمامی چپترهای مانگاتا برای تمامی کاربران رایگان شد!"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--color-asura-accent)] transition-colors"
            />
          </div>

          {/* Live Preview of Banner */}
          <div>
            <span className="block text-[11px] font-bold text-zinc-400 mb-2">
              پیش‌نمایش زنده نوار اعلان در سایت:
            </span>
            <div className="p-3 bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-emerald-950/80 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-emerald-300 text-xs font-bold shadow-lg shadow-emerald-950/30">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400 shrink-0 animate-pulse" />
                <span>{bannerText || "متن پیش‌فرض اعلان جشنواره..."}</span>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 border border-emerald-500/30">
                دسترسی رایگان فعال
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              <span>ذخیره متن پیام</span>
            </button>
          </div>
        </form>
      </div>

      {/* Quick Test / Verification Section */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-[var(--color-asura-accent)] shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-white">تست سریع در صفحه اصلی و ریدر</h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              می‌توانید به صفحه اصلی یا یکی از مانهواها مراجعه کرده و بدون ورود یا با هر حسابی تست نمایید.
            </p>
          </div>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white text-xs font-black rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-[var(--color-asura-accent)]/20"
        >
          <span>مشاهده سایت در تب جدید</span>
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
