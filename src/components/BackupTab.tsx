import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../lib/apiClient";
import { 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  Server, 
  RefreshCw, 
  FileText, 
  Terminal, 
  Image, 
  HelpCircle,
  Mail,
  Clock,
  ShieldCheck,
  Send,
  Save
} from "lucide-react";

interface BackupTabProps {
  isSuperAdmin: boolean;
}

export default function BackupTab({ isSuperAdmin }: BackupTabProps) {
  const { user } = useAuth();
  const getAdminUid = () => user?.uid || localStorage.getItem("asura_user_id") || localStorage.getItem("userUid") || "";

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [stats, setStats] = useState<{
    usersCount: number;
    seriesCount: number;
    chaptersCount: number;
    purchasedChaptersCount: number;
    walletTransactionsCount: number;
  } | null>(null);
  const [downloadingManifest, setDownloadingManifest] = useState(false);

  // Automated Backup States
  const [backupEmail, setBackupEmail] = useState("");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly">("daily");
  const [lastBackupInfo, setLastBackupInfo] = useState<{ time?: string; status?: string; file?: string } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingBackup, setIsTestingBackup] = useState(false);

  const handleDownloadManifest = async () => {
    setDownloadingManifest(true);
    try {
      const blob = await apiClient.downloadMigrationManifest(getAdminUid());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asura-migration-manifest-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "خطا در دانلود مانیفست مهاجرت");
    } finally {
      setDownloadingManifest(false);
    }
  };
  const [verifyingImages, setVerifyingImages] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    totalChapters: number;
    totalImages: number;
    localImagesCount: number;
    externalImagesCount: number;
  } | null>(null);

  useEffect(() => {
    if (user?.uid) {
      fetchStats();
      fetchBackupSettings();
    }
  }, [user]);

  const fetchBackupSettings = async () => {
    try {
      const data = await apiClient.getBackupSettings(getAdminUid());
      if (data) {
        setBackupEmail(data.email || "");
        setAutoBackupEnabled(!!data.autoBackupEnabled);
        setScheduleFrequency(data.scheduleFrequency || "daily");
        setLastBackupInfo({
          time: data.lastBackupTime,
          status: data.lastBackupStatus,
          file: data.lastBackupFile
        });
      }
    } catch (e) {
      console.error("Failed to load backup settings:", e);
    }
  };

  const handleSaveBackupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setMessage(null);
    try {
      await apiClient.saveBackupSettings({
        email: backupEmail,
        autoBackupEnabled,
        scheduleFrequency
      }, getAdminUid());
      setMessage({ type: "success", text: "تنظیمات پشتیبان‌گیری خودکار و ایمیل ذخیره شد و دیگر نیاز به وارد کردن مجدد ندارد." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "خطا در ذخیره تنظیمات" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRunBackupNow = async () => {
    setIsTestingBackup(true);
    setMessage(null);
    try {
      const res = await apiClient.runBackupNow(backupEmail, getAdminUid());
      if (res.success) {
        setMessage({
          type: "success",
          text: res.emailed 
            ? `پشتیبان‌گیری انجام شد، در هاست ذخیره گردید و یک نسخه کامل به ایمیل ${backupEmail} ارسال شد.`
            : `پشتیبان‌گیری انجام شد و فایل به صورت خودکار در مسیر هاست (/backups) ذخیره شد.`
        });
        fetchBackupSettings();
      } else {
        throw new Error(res.error || "خطا در ایجاد پشتیبان");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "خطا در ایجاد پشتیبان" });
    } finally {
      setIsTestingBackup(false);
    }
  };

  const fetchStats = async () => {
    try {
      const adminUid = getAdminUid();
      const res = await fetch(`/api/admin/stats?adminUid=${encodeURIComponent(adminUid)}`, {
        headers: {
          "x-admin-uid": adminUid
        }
      });
      if (res.ok) {
        const data = await res.json();
        // Since stats has user info, let's map counts
        setStats({
          usersCount: data.totalUsers || 0,
          seriesCount: data.totalSeries || 0,
          chaptersCount: data.totalChapters || 0,
          purchasedChaptersCount: data.purchasesCount || 0,
          walletTransactionsCount: data.transactionsCount || 0
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const blob = await apiClient.downloadBackup(getAdminUid());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asuraclone-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "نسخه پشتیبان کامل با موفقیت دانلود شد." });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "خطا در عملیات پشتیبان‌گیری" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setMessage({ type: "error", text: "لطفا ابتدا فایل نسخه پشتیبان را انتخاب کنید." });
      return;
    }

    if (confirmText !== "CONFIRM") {
      setMessage({ type: "error", text: "لطفا کلمه تاییدیه را به درستی وارد کنید (CONFIRM)." });
      return;
    }

    setIsImporting(true);
    setMessage(null);

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const jsonContent = JSON.parse(event.target?.result as string);
          const data = await apiClient.restoreBackup(jsonContent, getAdminUid());
          
          if (data.success) {
            setMessage({ type: "success", text: "دیتابیس با موفقیت بازگردانی شد! تمامی اطلاعات کاربران، خریدها، کیف پول و آثار جایگزین شدند." });
            setImportFile(null);
            setConfirmText("");
            fetchStats();
          } else {
            throw new Error(data.error || "خطا در بازگردانی فایل دیتابیس");
          }
        } catch (err: any) {
          setMessage({ type: "error", text: err.message || "فایل پشتیبان نامعتبر است یا ساختار مناسبی ندارد." });
        } finally {
          setIsImporting(false);
        }
      };
      fileReader.readAsText(importFile);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "خطا در بارگذاری فایل پشتیبان" });
      setIsImporting(false);
    }
  };

  const verifyChapterAssets = async () => {
    setVerifyingImages(true);
    setVerificationResult(null);
    try {
      const adminUid = localStorage.getItem("userUid") || "";
      // Let's call /api/series to get all series and chapters to check their image paths
      const res = await fetch("/api/series");
      if (res.ok) {
        const seriesList = await res.json();
        let totalChaps = 0;
        let totalImgs = 0;
        let localImgs = 0;
        let extImgs = 0;

        for (const s of seriesList) {
          const chapRes = await fetch(`/api/series/${s.id}/chapters`);
          if (chapRes.ok) {
            const chapters = await chapRes.json();
            totalChaps += chapters.length;
            for (const c of chapters) {
              const imgs = c.images || [];
              totalImgs += imgs.length;
              imgs.forEach((img: string) => {
                if (img.startsWith("/uploads/") || img.startsWith("uploads/")) {
                  localImgs++;
                } else {
                  extImgs++;
                }
              });
            }
          }
        }

        setVerificationResult({
          totalChapters: totalChaps,
          totalImages: totalImgs,
          localImagesCount: localImgs,
          externalImagesCount: extImgs
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingImages(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-500/10 rounded-2xl border border-red-500/20" dir="rtl">
        شما دسترسی به این بخش را ندارید. دسترسی به سیستم بک‌آپ و مهاجرت فقط برای مدیریت کل تعریف شده است.
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right text-zinc-100" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-100">
            <Database className="text-[var(--color-asura-accent)]" /> پشتیبان‌گیری، مهاجرت و انتقال دیتابیس
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            تهیه خروجی کامل از اطلاعات سایت، تغییر دیتابیس، بازگردانی بک‌آپ و راه‌حل‌های انتقال رسانه‌های با حجم بالا
          </p>
        </div>
        <button 
          onClick={fetchStats}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl flex items-center gap-2 text-xs transition"
        >
          <RefreshCw size={14} /> به‌روزرسانی آمار دیتابیس
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {message.type === "success" ? <CheckCircle className="shrink-0 mt-0.5" /> : <AlertTriangle className="shrink-0 mt-0.5" />}
          <div>
            <p className="font-bold">{message.type === "success" ? "عملیات موفق" : "خطا در عملیات"}</p>
            <p className="text-sm mt-1">{message.text}</p>
          </div>
        </div>
      )}

      {/* Automated Scheduled Backup & Email Card */}
      <div className="bg-gradient-to-br from-zinc-900/90 to-[#12131a] border border-amber-500/20 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                پشتیبان‌گیری خودکار زمان‌بندی‌شده و ارسال ایمیل
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                ذخیره خودکار بک‌آ‌پ روی هاست + ارسال نسخه کامل به ایمیل مدیریت کل (ذخیره‌سازی همیشگی ایمیل)
              </p>
            </div>
          </div>

          {lastBackupInfo?.time && (
            <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs text-zinc-300 flex flex-col items-end">
              <span className="text-[11px] text-zinc-400">آخرین پشتیبان‌گیری:</span>
              <strong className="text-amber-300 font-sans dir-ltr">{new Date(lastBackupInfo.time).toLocaleString('fa-IR')}</strong>
              {lastBackupInfo.status && (
                <span className="text-[10px] text-emerald-400 mt-0.5">{lastBackupInfo.status}</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSaveBackupSettings} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
              <Mail size={15} className="text-amber-400" />
              ایمیل دریافت‌کننده بک‌آ‌پ مدیریت کل:
            </label>
            <input
              type="email"
              placeholder="مثلا: admin@domain.com"
              value={backupEmail}
              onChange={e => setBackupEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:font-sans focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-[10px] text-zinc-500 mt-1">این ایمیل ذخیره شده و دیگر هر بار از شما پرسیده نمی‌شود.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
              <Clock size={15} className="text-amber-400" />
              زمان‌بندی اجرای خودکار:
            </label>
            <select
              value={scheduleFrequency}
              onChange={e => setScheduleFrequency(e.target.value as 'daily' | 'weekly')}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="daily">روزانه (هر ۲۴ ساعت)</option>
              <option value="weekly">هفتگی (هر ۷ روز)</option>
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/10 transition-colors">
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={e => setAutoBackupEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-zinc-200">فعال‌سازی پشتیبان‌گیری خودکار</span>
            </label>
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>فایل‌ها به صورت ایمن در مسیر <code className="text-amber-300 bg-black/40 px-1.5 py-0.5 rounded font-mono">/backups/</code> هاست ذخیره می‌گردند.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRunBackupNow}
                disabled={isTestingBackup}
                className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTestingBackup ? (
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={14} />
                    <span>ایجاد و ارسال فوراً بک‌آ‌پ</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={14} />
                    <span>ذخیره تنظیمات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Grid: Export and Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Export Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Download size={20} />
              <h3 className="text-lg font-bold">بک‌آپ گیری کامل دیتابیس (JSON دیتابیس‌محور)</h3>
            </div>
            
            <p className="text-sm text-zinc-400 leading-relaxed">
              این ابزار یک فایل ساختار یافته <code className="text-amber-400 font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-xs">JSON</code> از کل دیتابیس شما شامل تمامی کاربران، سابقه خریدها، تراکنش‌های مالی، کارهای تیمی، آثار، چپترها، تنظیمات و آمار استخراج می‌کند. این بک‌آپ کاملا مستقل از نوع دیتابیس (محلی یا MySQL) است و می‌توانید آن را در هر دیتابیس دیگری درون‌ریزی کنید.
            </p>

            {stats && (
              <div className="bg-zinc-950/60 p-4 rounded-xl space-y-2 border border-zinc-800">
                <p className="text-xs text-zinc-500 font-bold mb-1">آیتم‌های آماده خروجی:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between border-b border-zinc-800/50 pb-1">
                    <span className="text-zinc-400">تعداد کاربران:</span>
                    <span className="font-mono text-zinc-200">{stats.usersCount}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/50 pb-1">
                    <span className="text-zinc-400">تعداد آثار مانهوا/مانگا:</span>
                    <span className="font-mono text-zinc-200">{stats.seriesCount}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/50 pb-1">
                    <span className="text-zinc-400">تعداد کل چپترها:</span>
                    <span className="font-mono text-zinc-200">{stats.chaptersCount}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/50 pb-1">
                    <span className="text-zinc-400">تراکنش‌های کیف پول:</span>
                    <span className="font-mono text-zinc-200">{stats.walletTransactionsCount}</span>
                  </div>
                  <div className="flex justify-between col-span-2 pt-1">
                    <span className="text-zinc-400">چپترهای خریداری شده توسط کاربران:</span>
                    <span className="font-mono text-zinc-200">{stats.purchasedChaptersCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  در حال آماده‌سازی و دانلود نسخه پشتیبان...
                </>
              ) : (
                <>
                  <Download size={18} />
                  دانلود نسخه پشتیبان کامل دیتابیس (JSON)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Upload size={20} />
              <h3 className="text-lg font-bold">بازگردانی دیتابیس / درون‌ریزی پشتیبان</h3>
            </div>
            
            <p className="text-sm text-zinc-400 leading-relaxed">
              با انتخاب فایل بک‌آپ گرفته شده، تمام دیتابیس فعلی شما پاک شده و کل سیستم با اطلاعات داخل فایل جایگزین می‌شود. این ویژگی برای مهاجرت از دیتابیس محلی به MySQL روی سرور اصلی یا بالعکس فوق‌العاده کاربردی است.
            </p>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-400">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <div className="text-xs space-y-1">
                <p className="font-bold">هشدار بسیار مهم:</p>
                <p>این کار تمام اطلاعات فعلی دیتابیس را بازنویسی می‌کند. حتما قبل از انجام این کار، از دیتابیس فعلی خود بک‌آپ دانلود کنید تا اطلاعاتی از دست نرود.</p>
              </div>
            </div>

            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">انتخاب فایل پشتیبان (.json):</label>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleFileChange}
                  className="w-full text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-xl p-3 file:ml-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                />
              </div>

              {importFile && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-xs text-zinc-300 font-bold">
                    جهت تایید کلمه <span className="font-mono text-red-400 uppercase font-extrabold bg-red-950/50 px-1 py-0.5 rounded">CONFIRM</span> را به انگلیسی تایپ کنید:
                  </label>
                  <input 
                    type="text" 
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CONFIRM"
                    className="w-full bg-zinc-950 border border-red-500/30 text-red-400 text-center font-mono font-bold py-2 rounded-xl focus:border-red-500 focus:outline-none"
                  />
                </div>
              )}

              {importFile && (
                <button
                  type="submit"
                  disabled={isImporting || confirmText !== "CONFIRM"}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      در حال بازگردانی دیتابیس... لطفا صفحه را نبندید
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      تایید نهایی و بازگردانی دیتابیس از فایل
                    </>
                  )}
                </button>
              )}
            </form>
          </div>
        </div>

      </div>

      {/* Asset Migration Strategy Section */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <Server className="text-[var(--color-asura-accent)]" size={24} />
          <div>
            <h3 className="text-xl font-bold text-zinc-100">راهکار انتقال رسانه‌ها و تصاویر چپترها (با حجم بالا)</h3>
            <p className="text-xs text-zinc-400 mt-1">
              تصاویر مانهواها و چپترها به علت حجم بسیار زیاد (گاهی صدها گیگابایت) نباید در دیتابیس یا فایل پشتیبان متنی قرار گیرند. در ادامه بهترین روش‌ها را بررسی کنید.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Rsync Option */}
          <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--color-asura-accent)]">
                <Terminal size={18} />
                <h4 className="font-bold text-sm">روش اول: rsync (رویکرد حرفه‌ای و سریع)</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                دستور <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded">rsync</code> در لینوکس بهترین گزینه برای انتقال پوشه‌های حجیم است. این ابزار از کپی مجدد فایل‌های تکراری خودداری کرده و در صورت قطعی اینترنت، انتقال را ادامه می‌دهد.
              </p>
            </div>
            
            <div className="mt-3 bg-zinc-900/80 p-3 rounded-lg font-mono text-[10px] text-zinc-300 select-all border border-zinc-800 leading-5">
              # اجرا در سرور جدید جهت دریافت رسانه‌ها<br/>
              rsync -avzhP --ssh-port=22 root@old-server-ip:/var/www/asura-clone/uploads/ /var/www/asura-clone/uploads/
            </div>
          </div>

          {/* S3 Object Storage Option */}
          <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sky-400">
                <Server size={18} />
                <h4 className="font-bold text-sm">روش دوم: سرویس ذخیره‌سازی ابری (S3 Bucket)</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                اگر حجم فایل‌های شما بیش از توان هارد دیسک سرور است، تصاویر را به یک فضای ابری سازگار با S3 (مانند لیارا، آروان‌کلاد، یا Cloudflare R2) منتقل کنید. در این صورت، موقع اضافه کردن چپتر به سادگی لینک‌های مستقیم فایل ابری را وارد کنید تا وبسایت بدون پر شدن فضای هارد کار کند.
              </p>
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-900/30 p-3 rounded-lg">
              💡 <span className="font-bold text-zinc-400">مزیت:</span> مقیاس‌پذیری نامحدود، سرعت دانلود فوق‌العاده بالا به واسطه CDN سرویس‌دهنده و عدم اشغال هارد سرور اصلی.
            </div>
          </div>

          {/* SFTP/FTP Option */}
          <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText size={18} />
                <h4 className="font-bold text-sm">روش سوم: نرم‌افزارهای کلاینت (FileZilla)</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                اگر مایل به استفاده از محیط ترمینال نیستید، نرم‌افزار رایگان <span className="text-zinc-200 font-bold">FileZilla</span> را دانلود کرده و با پروتکل SFTP به هر دو سرور متصل شوید. سپس کل محتوای پوشه <code className="text-zinc-300 font-mono bg-zinc-900 px-1 rounded text-xs">uploads/</code> را به سیستم شخصی دانلود و به سرور جدید آپلود کنید.
              </p>
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-900/30 p-3 rounded-lg">
              💡 <span className="font-bold text-zinc-400">نکته:</span> جهت بهبود سرعت، در تنظیمات FileZilla تعداد فایل‌های همزمان در حال انتقال (Max concurrent transfers) را روی عدد ۱۰ قرار دهید.
            </div>
          </div>

        </div>

        {/* Image Assets Checker */}
        <div className="border border-zinc-800 bg-zinc-950/30 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h4 className="font-bold text-zinc-200 flex items-center gap-2">
                <Image className="text-indigo-400" size={18} /> اسکنر و ناظر سلامت پیوندهای تصویری چپترها
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                این سیستم با پایش دیتابیس مشخص می‌کند که چند مگابایت یا گیگابایت تصاویر محلی و چند تصویر خارجی (لینک مستقیم خارج از سرور) روی سایت وجود دارد.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadManifest}
                disabled={downloadingManifest}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-zinc-950 font-extrabold rounded-xl text-xs transition flex items-center gap-2"
              >
                {downloadingManifest ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    در حال ساخت مانیفست...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    دانلود مانیفست ساختاریافته مهاجرت (.json)
                  </>
                )}
              </button>
              <button
                onClick={verifyChapterAssets}
                disabled={verifyingImages}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
              >
                {verifyingImages ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    در حال اسکن کردن چپترها...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    شروع اسکن و بررسی سلامت تصاویر
                  </>
                )}
              </button>
            </div>
          </div>

          {verificationResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800 animate-fadeIn text-xs">
              <div className="space-y-1">
                <p className="text-zinc-500 font-bold">کل چپترهای بررسی شده:</p>
                <p className="text-lg font-mono font-bold text-indigo-400">{verificationResult.totalChapters}</p>
              </div>
              <div className="space-y-1">
                <p className="text-zinc-500 font-bold">کل تصاویر پیوند داده شده:</p>
                <p className="text-lg font-mono font-bold text-indigo-400">{verificationResult.totalImages}</p>
              </div>
              <div className="space-y-1">
                <p className="text-zinc-500 font-bold">تصاویر آپلود شده روی هاست شما:</p>
                <p className="text-lg font-mono font-bold text-emerald-400">{verificationResult.localImagesCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-zinc-500 font-bold">تصاویر با لینک مستقیم خارجی:</p>
                <p className="text-lg font-mono font-bold text-amber-400">{verificationResult.externalImagesCount}</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
