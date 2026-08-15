import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/apiClient";
import {
  Trash2,
  HardDrive,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Layers,
  BookOpen,
  MessageSquare,
  Users,
  Wallet,
  Clock,
  FileText,
  HelpCircle,
  Sparkles,
  ShieldAlert,
  Server,
  Zap,
  Info,
  Check,
  X,
  FileCode,
  FolderArchive,
  Cpu
} from "lucide-react";

interface StorageCleanupTabProps {
  isSuperAdmin: boolean;
  onDataChanged?: () => void;
}

interface StorageBreakdown {
  database: {
    isUsingMySQL: boolean;
    host: string;
    dbName: string;
    tables: {
      seriesCount: number;
      chaptersCount: number;
      commentsCount: number;
      usersCount: number;
      nonAdminUsersCount: number;
      bookmarksCount: number;
      historyCount: number;
      ratingsCount: number;
      reportsCount: number;
      notificationsCount: number;
      walletTransactionsCount: number;
      purchasedChaptersCount: number;
      settlementRequestsCount: number;
      ticketsCount: number;
      ticketMessagesCount: number;
      chapterViewsLogCount: number;
      settingsCount: number;
    };
  };
  storage: {
    uploads: {
      totalBytes: number;
      formatted: string;
      fileCount: number;
    };
    seriesUploads: {
      totalBytes: number;
      formatted: string;
      fileCount: number;
    };
    backups: {
      totalBytes: number;
      formatted: string;
      fileCount: number;
    };
    zipCacheCount: number;
  };
}

export default function StorageCleanupTab({ isSuperAdmin, onDataChanged }: StorageCleanupTabProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StorageBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    sectionKey: string;
    title: string;
    description: string;
    itemCountText: string;
    dangerLevel: "warning" | "danger" | "critical";
    requireInputWord?: string;
    options?: Record<string, boolean>;
  } | null>(null);

  const [inputConfirmationWord, setInputConfirmationWord] = useState("");
  const [resetBalancesOption, setResetBalancesOption] = useState(true);

  const fetchBreakdown = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getStorageBreakdown();
      setData(res);
    } catch (err: any) {
      setError(err.message || "خطا در دریافت آمار فضای هاست و دیتابیس");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  const handleExecuteCleanup = async () => {
    if (!confirmModal) return;

    if (confirmModal.requireInputWord && inputConfirmationWord !== confirmModal.requireInputWord) {
      alert(`لطفاً کلمه تأیید "${confirmModal.requireInputWord}" را به درستی وارد نمایید.`);
      return;
    }

    const { sectionKey } = confirmModal;
    setActionLoading(sectionKey);
    setConfirmModal(null);
    setInputConfirmationWord("");

    try {
      const res = await apiClient.cleanSectionData(sectionKey, {
        resetBalances: resetBalancesOption
      });

      if (res.success) {
        setActionSuccess(res.message);
        setTimeout(() => setActionSuccess(null), 7000);
        await fetchBreakdown();
        if (onDataChanged) onDataChanged();
      } else {
        alert(res.error || res.message || "خطا در اجرای عملیات پاکسازی");
      }
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const sectionsList = [
    {
      id: "series_and_chapters",
      title: "پاکسازی تمام آثار، مانهواها و چپترها",
      description: "حذف کامل تمامی عناوین، شناسنامه‌ها، چپترها، آرشیوهای ZIP و عکس‌های آپلود شده در هاست به همراه نظرات و نشان‌ها.",
      icon: BookOpen,
      badge: "دیتابیس + هاست فایل",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      countText: data ? `${data.database.tables.seriesCount.toLocaleString("fa-IR")} اثر / ${data.database.tables.chaptersCount.toLocaleString("fa-IR")} چپتر` : "---",
      dangerLevel: "danger" as const,
      confirmWord: "حذف آثار"
    },
    {
      id: "chapters_only",
      title: "حذف چپترها و تصاویر ZIP (حفظ عناوین)",
      description: "آزاد سازی فضای اصلی هاست با حذف آرشیوهای فشرده ZIP و تصاویر چپترها، در حالی که پوسترها و توضیحات مانهواها در سایت باقی می‌مانند.",
      icon: Layers,
      badge: "صرفه‌جویی بالا در هاست",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      countText: data ? `${data.database.tables.chaptersCount.toLocaleString("fa-IR")} چپتر` : "---",
      dangerLevel: "warning" as const,
      confirmWord: "حذف چپترها"
    },
    {
      id: "orphaned_files",
      title: "پاکسازی فایل‌های یتیم و اضافی در هاست",
      description: "اسکن هوشمند پوشه uploads و حذف فایل‌ها، تصاویر یا فایل‌های ZIP قدیمی که به هیچ اثر یا چپتری در دیتابیس متصل نیستند.",
      icon: Sparkles,
      badge: "بهینه‌سازی خودکار",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      countText: "اسکن زنده هاست",
      dangerLevel: "warning" as const
    },
    {
      id: "all_uploads",
      title: "تخلیه کامل پوشه آپلودهای هاست (Uploads)",
      description: "حذف تمامی فایل‌ها، پوشه‌های مانهوا، پوسترها و تصاویر آپلود شده در هاست و ساخت مجدد ساختار دایرکتوری‌های خام.",
      icon: FolderArchive,
      badge: "هاست فایل",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      countText: data ? `${data.storage.uploads.fileCount.toLocaleString("fa-IR")} فایل (${data.storage.uploads.formatted})` : "---",
      dangerLevel: "danger" as const,
      confirmWord: "تخلیه هاست"
    },
    {
      id: "comments",
      title: "پاکسازی تمام نظرات و دیدگاه‌ها",
      description: "تخلیه کامل جدول نظرات کاربران در زیر چپترها و صفحات مانهوا و آزادسازی حجم دیتابیس MySQL.",
      icon: MessageSquare,
      badge: "MySQL / JSON",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      countText: data ? `${data.database.tables.commentsCount.toLocaleString("fa-IR")} نظر` : "---",
      dangerLevel: "warning" as const
    },
    {
      id: "tickets",
      title: "پاکسازی تیکت‌ها و پیام‌های پشتیبانی",
      description: "حذف کلیه تیکت‌های پشتیبانی، مکالمات، پاسخ‌های پشتیبانان و ضمایم آپلود شده در هاست.",
      icon: HelpCircle,
      badge: "پشتیبانی + فایل",
      badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      countText: data ? `${data.database.tables.ticketsCount.toLocaleString("fa-IR")} تیکت / ${data.database.tables.ticketMessagesCount.toLocaleString("fa-IR")} پیام` : "---",
      dangerLevel: "warning" as const
    },
    {
      id: "financial",
      title: "پاکسازی تراکنش‌ها و سوابق مالی",
      description: "حذف کامل تاریخچه تراکنش‌های کیف پول، خریدهای چپتر و درخواست‌های تسویه حساب کاربران.",
      icon: Wallet,
      badge: "تراکنش‌های مالی",
      badgeColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      countText: data ? `${data.database.tables.walletTransactionsCount.toLocaleString("fa-IR")} تراکنش / ${data.database.tables.purchasedChaptersCount.toLocaleString("fa-IR")} خرید` : "---",
      dangerLevel: "warning" as const,
      hasOptions: true
    },
    {
      id: "users",
      title: "حذف تمام کاربران (به جز مدیریت کل)",
      description: "حذف کامل کلیه کاربران عضو و پرسنل ثبت‌نام شده، بدون آسیب رسیدن به حساب کاربری مدیریت کل (Super Admin).",
      icon: Users,
      badge: "مدیریت کاربران",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      countText: data ? `${data.database.tables.nonAdminUsersCount.toLocaleString("fa-IR")} کاربر عادی` : "---",
      dangerLevel: "danger" as const,
      confirmWord: "حذف کاربران"
    },
    {
      id: "user_activity",
      title: "حذف سوابق مطالعه، نشان‌ها و امتیازات",
      description: "تخلیه جدول تاریخچه بازدید کاربر، لیست آثار بوک‌مارک شده و ستاره‌های امتیازی ثبت شده.",
      icon: Clock,
      badge: "فعالیت‌های کاربران",
      badgeColor: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
      countText: data ? `${((data.database.tables.bookmarksCount || 0) + (data.database.tables.historyCount || 0) + (data.database.tables.ratingsCount || 0)).toLocaleString("fa-IR")} رکورد` : "---",
      dangerLevel: "warning" as const
    },
    {
      id: "logs_reports",
      title: "پاکسازی گزارش‌های خطا، نوتیفیکیشن‌ها و لاگ‌ها",
      description: "حذف اعلان‌های سیستمی، گزارشات خطای ارسالی توسط کاربران و جدول شمارش بازدیدهای ساعتی چپترها.",
      icon: FileText,
      badge: "لاگ و گزارشات",
      badgeColor: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
      countText: data ? `${((data.database.tables.reportsCount || 0) + (data.database.tables.notificationsCount || 0) + (data.database.tables.chapterViewsLogCount || 0)).toLocaleString("fa-IR")} رکورد` : "---",
      dangerLevel: "warning" as const
    },
    {
      id: "server_cache",
      title: "تخلیه کش رم سرور (Streaming ZIP Cache)",
      description: "پاکسازی بافر درایور ZIP در حافظه موقت (RAM) سرور جهت آزادسازی رم اشتراکی هاست.",
      icon: Cpu,
      badge: "حافظه RAM",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      countText: data ? `${data.storage.zipCacheCount} آرشیو در کش RAM` : "---",
      dangerLevel: "warning" as const
    }
  ];

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <HardDrive size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                مدیریت و کنترل فضای هاست و دیتابیس
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  مخصوص مدیریت کل
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                مشاهده حجم اشغال شده هاست، کنترل تفکیک‌شده بخش‌های PHP/MySQL و امکان پاکسازی تک‌به‌تک یا ریست کامل وبسایت
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchBreakdown}
          disabled={loading}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          بروزرسانی آمار فضا
        </button>
      </div>

      {/* Success alert message */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-bold animate-in fade-in">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Error alert message */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-bold">
          <AlertTriangle size={20} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Storage and Database Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Uploads Disk Size */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-[var(--color-asura-accent)]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-400">فضای فایل‌های آپلود (هاست)</span>
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <HardDrive size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {loading ? "..." : (data?.storage.uploads.formatted || "0 بایت")}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>تعداد کل فایل‌ها:</span>
            <span className="text-zinc-300 font-bold font-mono">
              {loading ? "..." : (data?.storage.uploads.fileCount.toLocaleString("fa-IR") || "0")} فایل
            </span>
          </div>
        </div>

        {/* Card 2: Series & Chapter ZIPs Size */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-[var(--color-asura-accent)]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-400">آرشیو آثار و چپترها (ZIP)</span>
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <FolderArchive size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {loading ? "..." : (data?.storage.seriesUploads.formatted || "0 بایت")}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>فایل‌های پوشه series:</span>
            <span className="text-zinc-300 font-bold font-mono">
              {loading ? "..." : (data?.storage.seriesUploads.fileCount.toLocaleString("fa-IR") || "0")} فایل
            </span>
          </div>
        </div>

        {/* Card 3: Database Engine & Host */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-[var(--color-asura-accent)]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-400">موتور دیتابیس فعال</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Database size={18} />
            </div>
          </div>
          <div className="text-xl font-black text-white truncate">
            {loading ? "..." : (data?.database.isUsingMySQL ? "MySQL Live" : "Local JSON")}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between truncate">
            <span>میزبان / دیتابیس:</span>
            <span className="text-zinc-300 font-bold font-mono text-[10px] truncate max-w-[120px]" title={data?.database.dbName}>
              {loading ? "..." : (data?.database.dbName || "local-db")}
            </span>
          </div>
        </div>

        {/* Card 4: Backups Storage Size */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-[var(--color-asura-accent)]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-400">بک‌آپ‌های ذخیره در هاست</span>
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <Server size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {loading ? "..." : (data?.storage.backups.formatted || "0 بایت")}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>پکیج‌های ذخیره شده:</span>
            <span className="text-zinc-300 font-bold font-mono">
              {loading ? "..." : (data?.storage.backups.fileCount.toLocaleString("fa-IR") || "0")} پکیج
            </span>
          </div>
        </div>
      </div>

      {/* Warning information box */}
      <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl flex items-start gap-3.5">
        <Info size={22} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-xs font-black text-amber-300">راهنمای بهینه‌سازی و آزادسازی فضای هاست</h3>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            سیستم به صورت خودکار تمام چپترها را در قالب آرشیوهای فشرده ZIP ذخیره می‌کند. در صورت نیاز به تخلیه حجم هاست یا تغییر کلی اطلاعات وب‌سایت، می‌توانید از دکمه‌های زیر برای حذف تفکیک‌شده هر بخش یا ریست کامل استفاده فرمایید.
          </p>
        </div>
      </div>

      {/* Granular Section Cleaning Grid */}
      <div>
        <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
          <Zap className="text-[var(--color-asura-accent)]" size={18} />
          عملیات پاکسازی تفکیک‌شده بخش‌های هاست و دیتابیس
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sectionsList.map((sec) => {
            const Icon = sec.icon;
            const isProcessing = actionLoading === sec.id;

            return (
              <div
                key={sec.id}
                className="bg-black/40 border border-white/5 hover:border-white/15 rounded-2xl p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/5 rounded-xl text-zinc-300">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">{sec.title}</h4>
                        <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border mt-1 ${sec.badgeColor}`}>
                          {sec.badge}
                        </span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-[11px] font-black text-zinc-400 font-mono">
                        {loading ? "..." : sec.countText}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    {sec.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">غیرقابل بازگشت پس از اجرا</span>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        sectionKey: sec.id,
                        title: sec.title,
                        description: sec.description,
                        itemCountText: sec.countText,
                        dangerLevel: sec.dangerLevel,
                        requireInputWord: sec.confirmWord
                      });
                    }}
                    disabled={isProcessing || loading}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      sec.dangerLevel === "danger"
                        ? "bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500"
                        : "bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 hover:border-amber-500"
                    }`}
                  >
                    <Trash2 size={14} className={isProcessing ? "animate-spin" : ""} />
                    {isProcessing ? "در حال پاکسازی..." : "شروع پاکسازی این بخش"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Master Full Website Factory Reset Section */}
      <div className="bg-gradient-to-br from-rose-950/40 via-black/80 to-black border-2 border-rose-500/30 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30 shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-white">ریست فکتوری و پاکسازی کامل کل وب‌سایت (Factory Reset)</h3>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-rose-600 text-white uppercase tracking-wider shadow-lg shadow-rose-600/30">
                حداکثر خطر (Destructive)
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mt-2">
              این عملیات تمام اطلاعات موجود در سایت شامل کلیه مانهواها، مانگاها، چپترها، آرشیوهای تصویری هاست، نظرات، تیکت‌ها، کاربران عادی و سوابق مالی را پاک می‌کند و وب‌سایت را دقیقاً به حالت اولیه و خالی بازمی‌گرداند.
              <br />
              <strong className="text-rose-400">توجه:</strong> حساب کاربری شما به عنوان مدیریت کل (Super Admin) و تنظیمات ظاهری سایت حفظ خواهند شد تا از سایت خارج نشوید.
            </p>
          </div>
        </div>

        <div className="p-4 bg-black/60 border border-white/5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-zinc-400">
            برای انجام پاکسازی کامل و تخلیه ۱۰۰٪ هاست و دیتابیس، بر روی دکمه مقابل کلیک نمایید.
          </div>

          <button
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                sectionKey: "full_factory_reset",
                title: "ریست فکتوری و پاکسازی کامل کل وب‌سایت",
                description: "آیا مطمئن هستید که می‌خواهید تمام دیتابیس، کلیه مانهواها و چپترها، فایل‌های هاست و کاربران را حذف کرده و سایت را کاملاً خالی کنید؟",
                itemCountText: "تمامی رکوردهای دیتابیس و فایل‌های هاست",
                dangerLevel: "critical",
                requireInputWord: "ریست کامل سایت"
              });
            }}
            disabled={actionLoading === "full_factory_reset" || loading}
            className="px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2"
          >
            <Trash2 size={16} className={actionLoading === "full_factory_reset" ? "animate-spin" : ""} />
            {actionLoading === "full_factory_reset" ? "در حال ریست کامل..." : "اجرای ریست فکتوری کامل وبسایت"}
          </button>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[var(--color-asura-card)] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  confirmModal.dangerLevel === "critical" 
                    ? "bg-rose-600 text-white" 
                    : confirmModal.dangerLevel === "danger" 
                    ? "bg-rose-500/20 text-rose-400" 
                    : "bg-amber-500/20 text-amber-400"
                }`}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{confirmModal.title}</h3>
                  <p className="text-[11px] text-zinc-400">تأییدیه امنیتی حذف داده‌ها</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setConfirmModal(null);
                  setInputConfirmationWord("");
                }}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-xs text-zinc-300 leading-relaxed">
                {confirmModal.description}
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>تعداد آیتم‌های تحت تأثیر:</span>
                <span className="text-white font-bold font-mono">{confirmModal.itemCountText}</span>
              </div>

              {confirmModal.sectionKey === "financial" && (
                <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetBalancesOption}
                    onChange={(e) => setResetBalancesOption(e.target.checked)}
                    className="accent-[var(--color-asura-accent)] rounded w-4 h-4"
                  />
                  <span className="text-xs text-zinc-200 font-bold">موجودی کیف پول تمامی کاربران را نیز صفر (۰) کن</span>
                </label>
              )}

              {confirmModal.requireInputWord && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="text-xs font-bold text-zinc-300 block">
                    برای تأیید نهایی، لطفاً عبارت <strong className="text-rose-400 font-black font-mono">"{confirmModal.requireInputWord}"</strong> را در کادر زیر بنویسید:
                  </label>
                  <input
                    type="text"
                    value={inputConfirmationWord}
                    onChange={(e) => setInputConfirmationWord(e.target.value)}
                    placeholder={confirmModal.requireInputWord}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs text-center font-bold tracking-wider focus:border-rose-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(null);
                  setInputConfirmationWord("");
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold rounded-xl transition-all"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleExecuteCleanup}
                disabled={confirmModal.requireInputWord ? inputConfirmationWord !== confirmModal.requireInputWord : false}
                className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all flex items-center gap-2 ${
                  confirmModal.dangerLevel === "critical" || confirmModal.dangerLevel === "danger"
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <Trash2 size={14} />
                تأیید و اجرای حذف دائمی
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
