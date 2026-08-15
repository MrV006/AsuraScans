import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  Server, 
  HardDrive, 
  CheckCircle, 
  AlertCircle, 
  FolderTree, 
  Save, 
  Wifi, 
  Key, 
  Globe, 
  ShieldCheck, 
  Zap, 
  HelpCircle,
  FileCode,
  Layers,
  ArrowRightLeft
} from "lucide-react";

interface DownloadHostTabProps {
  isSuperAdmin: boolean;
}

export default function DownloadHostTab({ isSuperAdmin }: DownloadHostTabProps) {
  const { user } = useAuth();
  const getAdminUid = () => user?.uid || localStorage.getItem("asura_user_id") || localStorage.getItem("userUid") || "";

  const [enabled, setEnabled] = useState(false);
  const [ftpHost, setFtpHost] = useState("");
  const [ftpUser, setFtpUser] = useState("");
  const [ftpPassword, setFtpPassword] = useState("");
  const [ftpPort, setFtpPort] = useState(21);
  const [ftpSecure, setFtpSecure] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [organizing, setOrganizing] = useState(false);
  const [organizeResult, setOrganizeResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleOrganizeFiles = async () => {
    setOrganizing(true);
    setOrganizeResult(null);
    try {
      const adminUid = getAdminUid();
      const res = await fetch(`/api/admin/organize-files?adminUid=${encodeURIComponent(adminUid)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-uid": adminUid
        }
      });
      const data = await res.json();
      setOrganizeResult({
        success: data.success,
        message: data.message || (data.success ? "سازماندهی فایل‌ها با موفقیت انجام شد." : "خطا در سازماندهی فایل‌ها.")
      });
    } catch (err: any) {
      setOrganizeResult({
        success: false,
        message: err.message || "خطا در سازماندهی و مرتب‌سازی فایل‌ها."
      });
    } finally {
      setOrganizing(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/download_host_settings");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setEnabled(Boolean(data.enabled));
          setFtpHost(data.host || "");
          setFtpUser(data.user || "");
          setFtpPassword(data.password || "");
          setFtpPort(Number(data.port) || 21);
          setFtpSecure(Boolean(data.secure));
          setBaseUrl(data.baseUrl || "");
        }
      }
    } catch (e) {
      console.error("Error fetching FTP settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const adminUid = getAdminUid();
      const res = await fetch(`/api/admin/test-ftp?adminUid=${encodeURIComponent(adminUid)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-uid": adminUid
        },
        body: JSON.stringify({
          host: ftpHost,
          user: ftpUser,
          password: ftpPassword,
          port: ftpPort,
          secure: ftpSecure
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "خطا در برقراری ارتباط با سرور."
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const adminUid = getAdminUid();
      const payload = {
        enabled,
        host: ftpHost.trim(),
        user: ftpUser.trim(),
        password: ftpPassword,
        port: Number(ftpPort) || 21,
        secure: Boolean(ftpSecure),
        baseUrl: baseUrl.trim().replace(/\/$/, "")
      };

      const res = await fetch(`/api/settings/download_host_settings?adminUid=${encodeURIComponent(adminUid)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-uid": adminUid
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveMessage({
          type: "success",
          text: "تنظیمات هاست دانلود با موفقیت ذخیره شد و از این پس تمام آپلودهای جدید مستقیماً روی هاست دانلود منتقل می‌شوند."
        });
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطا در ذخیره‌سازی تنظیمات");
      }
    } catch (err: any) {
      setSaveMessage({
        type: "error",
        text: err.message || "خطا در ذخیره‌سازی تنظیمات هاست دانلود"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-500/10 rounded-2xl border border-red-500/20" dir="rtl">
        شما دسترسی به این بخش را ندارید. فقط مدیریت کل مجاز به پیکربندی هاست دانلود می‌باشد.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-400 font-medium" dir="rtl">
        در حال دریافت تنظیمات هاست دانلود...
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right text-zinc-100" dir="rtl">
      {/* Title & Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-zinc-900/80 p-6 md:p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/30">
                <Server className="w-7 h-7" />
              </span>
              <h2 className="text-2xl font-black text-white tracking-wide">
                تنظیمات هاست دانلود و متصل‌سازی FTP
              </h2>
            </div>
            <p className="text-zinc-300 text-sm max-w-2xl leading-relaxed">
              با فعال‌سازی این بخش، تمامی صفحات مانهوا/مانگا، کاورها و فایل‌های Zip به‌صورت خودکار و مستقیم با ساختار پوشه‌بندی استاندارد به هاست دانلود مجزا منتقل و از دمین دانلود فراخوانی می‌شوند.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              enabled 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${enabled ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {enabled ? "هاست دانلود فعال است" : "ذخیره‌سازی روی سرور اصلی (محلی)"}
            </div>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold ${
          saveMessage.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {saveMessage.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* FTP Configuration Form */}
      <form onSubmit={handleSaveSettings} className="bg-zinc-900/80 rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-xl space-y-6">
        
        {/* Toggle FTP */}
        <div className="flex items-center justify-between p-5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              انتقال خودکار فایل‌ها به هاست دانلود خارجی (FTP)
            </h3>
            <p className="text-xs text-zinc-400">
              با روشن کردن این گزینه، پس از آپلود فصل‌ها، تصاویر به‌طور اتوماتیک از طریق FTP به هاست دانلود منتقل می‌شوند.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)} 
              className="sr-only peer" 
            />
            <div className="w-14 h-7 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FTP Host */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              آدرس سرور هاست دانلود (FTP Host)
            </label>
            <input 
              type="text" 
              placeholder="مثال: dl.yourdomain.com یا 185.123.45.67"
              value={ftpHost}
              onChange={(e) => setFtpHost(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 dir-ltr text-left"
            />
            <p className="text-[11px] text-zinc-500">دامنه یا آی‌پی مربوط به FTP هاست دانلود شما.</p>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              آدرس اینترنتی عمومی هاست دانلود (STORAGE_BASE_URL)
            </label>
            <input 
              type="text" 
              placeholder="مثال: https://dl.yourdomain.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 dir-ltr text-left"
            />
            <p className="text-[11px] text-zinc-500">لینک‌های تصاویر در سایت با این آدرس شروع خواهند شد.</p>
          </div>

          {/* FTP Username */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              نام کاربری FTP (FTP Username)
            </label>
            <input 
              type="text" 
              placeholder="مثال: mrvir111_dl"
              value={ftpUser}
              onChange={(e) => setFtpUser(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 dir-ltr text-left"
            />
          </div>

          {/* FTP Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              کلمه عبور FTP (FTP Password)
            </label>
            <input 
              type="password" 
              placeholder="کلمه عبور اکانت FTP"
              value={ftpPassword}
              onChange={(e) => setFtpPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 dir-ltr text-left"
            />
          </div>

          {/* Port */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-400" />
              پورت FTP (Port - پیش‌فرض 21)
            </label>
            <input 
              type="number" 
              value={ftpPort}
              onChange={(e) => setFtpPort(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 dir-ltr text-left"
            />
          </div>

          {/* Secure SSL */}
          <div className="space-y-2 flex flex-col justify-end">
            <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-2xl cursor-pointer">
              <input 
                type="checkbox" 
                checked={ftpSecure} 
                onChange={(e) => setFtpSecure(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-700 text-indigo-600 focus:ring-0 bg-zinc-900"
              />
              <span className="text-xs font-bold text-zinc-200">استفاده از اتصال امن (FTPS / SSL)</span>
            </label>
          </div>
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 ${
            testResult.success 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 border border-zinc-700 disabled:opacity-50"
          >
            <Wifi className={`w-4 h-4 ${testing ? "animate-pulse text-indigo-400" : ""}`} />
            {testing ? "در حال بررسی اتصال به هاست دانلود..." : "تست اتصال به هاست دانلود"}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "در حال ذخیره‌سازی..." : "ذخیره تنظیمات هاست دانلود"}
          </button>
        </div>
      </form>

      {/* Organize Existing Files Section */}
      <div className="bg-indigo-950/40 rounded-3xl p-6 md:p-8 border border-indigo-500/20 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-black text-base text-white flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-400" />
              سازماندهی و مرتب‌سازی فایل‌های قبلی در هاست
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              با فشردن این دکمه، تمام کاورها، بنرها و تصویرهای چپترهایی که قبلاً بدون پوشه‌بندی یا به صورت پراکنده آپلود شده‌اند، بر اساس نام اثر و شماره چپتر به صورت خودکار دسته‌بندی، انتقال و لینک‌های آن‌ها در دیتابیس بروزرسانی می‌شوند.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOrganizeFiles}
            disabled={organizing}
            className="shrink-0 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${organizing ? "animate-spin" : ""}`} />
            {organizing ? "در حال مرتب‌سازی و انتقال فایل‌ها..." : "سازماندهی فایل‌های قبلی"}
          </button>
        </div>

        {organizeResult && (
          <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
            organizeResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            {organizeResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{organizeResult.message}</span>
          </div>
        )}
      </div>

      {/* Structure & Architecture Info Box */}
      <div className="bg-zinc-900/60 rounded-3xl p-6 md:p-8 border border-zinc-800/80 space-y-6">
        <div className="flex items-center gap-3 text-indigo-400 border-b border-zinc-800 pb-4">
          <FolderTree className="w-6 h-6" />
          <h3 className="font-bold text-lg text-white">نحوه پوشه‌بندی اتوماتیک در هاست دانلود</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-300">
          <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-3">
            <h4 className="font-bold text-indigo-300 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4" />
              ساختار استاندارد ذخیره‌سازی فایل‌ها:
            </h4>
            <div className="font-mono text-[12px] text-emerald-400 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800/80 leading-relaxed dir-ltr text-left overflow-x-auto">
              <div>uploads/</div>
              <div className="pl-4">└── series/</div>
              <div className="pl-8">└── [نام-اثر]/</div>
              <div className="pl-12">├── cover/</div>
              <div className="pl-16">└── cover.webp</div>
              <div className="pl-12">├── banner/</div>
              <div className="pl-16">└── banner.webp</div>
              <div className="pl-12">└── chapters/</div>
              <div className="pl-16">├── chapter-1.zip (فشرده‌سازی حداکثری)</div>
              <div className="pl-16">├── chapter-2.zip</div>
              <div className="pl-16">└── chapter-3.zip</div>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              هر اثر دارای یک پوشه اختصاصی شامل کاور، بنر و پوشه چپترهاست. هر چپتر به صورت فایل فشرده <code className="text-indigo-400 font-bold">.zip</code> در هاست ذخیره می‌شود تا حداقل فضای ممکن را اشغال کند. ریدر بدون نیاز به استخراج فیزیکی روی دیسک، تصاویر را مستقیماً از داخل فایل Zip استریم و لود می‌کند.
            </p>
          </div>

          <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-3">
            <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              راهنمای راه‌اندازی هاست دانلود در cPanel:
            </h4>
            <ul className="space-y-2 text-zinc-300 leading-relaxed list-disc list-inside">
              <li>
                در cPanel هاست دانلود خود یک اکانت FTP بسازید و مسیر اصلی آن را روی پوشه <code className="text-indigo-400 bg-zinc-900 px-1.5 py-0.5 rounded">public_html</code> یا مسیر دلخواه تنظیم نمایید.
              </li>
              <li>
                ساب‌دامنه‌ای مانند <code className="text-emerald-400 bg-zinc-900 px-1.5 py-0.5 rounded">dl.yourdomain.com</code> را به cPanel هاست دانلود متصل کنید.
              </li>
              <li>
                اطلاعات FTP فوق را در فرم بالا وارد کرده و کلید <span className="text-white font-bold">تست اتصال</span> را بزنید.
              </li>
              <li>
                پس از ذخیره، تمامی آپلودهای تیم ترجمه و ادیت مستقیم و با سرعت بالا به هاست دانلود منتقل خواهند شد!
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
