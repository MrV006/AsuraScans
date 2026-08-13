import React, { useState, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  Coins,
  Percent,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Sliders,
  Users,
  Layers,
  BookOpen,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Search,
  PieChart as PieChartIcon,
  Activity,
  FileText,
  History,
  CheckCircle2,
  Globe,
  UserPlus,
  X,
  Check,
  ShieldCheck,
  Edit3,
  ChevronLeft
} from "lucide-react";
import { Series } from "../lib/types";

interface RevenueRole {
  id: string;
  name: string;
  percentage: number;
  description?: string;
  isSystemDefault?: boolean;
}

interface StaffMember {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface RevenueTabProps {
  seriesList: Series[];
  isSuperAdmin: boolean;
}

// Built-in Predefined Roles Definitions
const SYSTEM_PRESET_ROLES: Record<string, { name: string; desc: string; defaultPct: number; iconColor: string }> = {
  website: {
    name: "سایت (کارمزد وبسایت)",
    desc: "سهم اختصاصی وبسایت از فروش هر چپتر که مستقیم به صندوق درآمدهای وبسایت واریز می‌شود.",
    defaultPct: 30,
    iconColor: "#8b5cf6"
  },
  translator: {
    name: "مترجم",
    desc: "سهم واریزی مستقیم به کیف پول مترجم یا مترجمین تعیین‌شده برای چپتر.",
    defaultPct: 30,
    iconColor: "#10b981"
  },
  editor: {
    name: "ادیتور",
    desc: "سهم واریزی مستقیم به کیف پول ادیتور یا ادیتورهای تعیین‌شده برای چپتر.",
    defaultPct: 20,
    iconColor: "#3b82f6"
  },
  cleaner: {
    name: "کلینر",
    desc: "سهم واریزی مستقیم به کیف پول کلینر یا کلینرهای تعیین‌شده برای چپتر.",
    defaultPct: 20,
    iconColor: "#f59e0b"
  }
};

export default function RevenueTab({ seriesList, isSuperAdmin }: RevenueTabProps) {
  // Financial & System States
  const [websiteRevenue, setWebsiteRevenue] = useState<number>(0);
  const [revenueTransactions, setRevenueTransactions] = useState<any[]>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  // Roles & Percentages States
  const [roles, setRoles] = useState<RevenueRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  // New Custom Role Form
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePercentage, setNewRolePercentage] = useState<number>(10);

  // Staff States
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Series Visual Grid & Search States
  const [seriesSearchQuery, setSeriesSearchQuery] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [salesSummary, setSalesSummary] = useState<any | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);

  // Add Series Contributor Modal States
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [selectedStaffUser, setSelectedStaffUser] = useState("");
  const [selectedStaffRole, setSelectedStaffRole] = useState("translator");
  const [submittingStaff, setSubmittingStaff] = useState(false);

  // Chapter Contributors Assignment Inline State
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterAssignments, setChapterAssignments] = useState<Record<string, string[]>>({});

  // Settlement Form States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDescription, setSettleDescription] = useState("");
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Activity Logs States
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Initial Data Fetching
  useEffect(() => {
    fetchWebsiteRevenue();
    fetchRoles();
    fetchStaff();
    fetchActivityLogs();
    if (seriesList.length > 0 && !selectedSeries) {
      setSelectedSeries(seriesList[0]);
    }
  }, [seriesList]);

  // Fetch sales summary when selected series changes
  useEffect(() => {
    if (selectedSeries) {
      fetchSalesSummary(selectedSeries.id);
    }
  }, [selectedSeries]);

  const fetchWebsiteRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const data = await apiClient.get("/api/admin/website-revenue");
      if (data && !data.error) {
        setWebsiteRevenue(data.totalEarned || 0);
        setRevenueTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      }
    } catch (err) {
      console.error("Error fetching website revenue:", err);
    } finally {
      setLoadingRevenue(false);
    }
  };

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const data = await apiClient.get("/api/admin/revenue-roles");
      if (Array.isArray(data) && data.length > 0) {
        setRoles(data);
      } else {
        // Fallback to predefined system roles if empty
        const defaultRoles: RevenueRole[] = Object.entries(SYSTEM_PRESET_ROLES).map(([id, info]) => ({
          id,
          name: info.name,
          percentage: info.defaultPct,
          description: info.desc,
          isSystemDefault: true
        }));
        setRoles(defaultRoles);
      }
    } catch (err) {
      console.error("Error fetching revenue roles:", err);
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const data = await apiClient.get("/api/admin/staff");
      if (Array.isArray(data)) {
        setStaff(data);
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchActivityLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await apiClient.get("/api/admin/logs");
      if (Array.isArray(logs)) {
        setActivityLogs(logs);
      }
    } catch (e) {
      console.error("Failed to fetch activity logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchSalesSummary = async (seriesId: string) => {
    setLoadingSales(true);
    try {
      const data = await apiClient.get(`/api/admin/series/${seriesId}/sales-summary`);
      if (data && !data.error && Array.isArray(data.byChapter)) {
        setSalesSummary(data);
      } else {
        setSalesSummary(null);
      }
    } catch (err) {
      console.error("Error fetching sales summary:", err);
      setSalesSummary(null);
    } finally {
      setLoadingSales(false);
    }
  };

  // Settlement Handler
  const handleSettleRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(settleAmount);
    if (!amount || amount <= 0) {
      alert("لطفا مبلغ معتبری وارد کنید.");
      return;
    }

    setSubmittingSettle(true);
    try {
      const res = await apiClient.post("/api/admin/settle-website-revenue", {
        amount,
        description: settleDescription.trim()
      });
      if (res.success) {
        alert("تسویه حساب با موفقیت ثبت شد و از سود تجمعی وبسایت کسر گردید.");
        setSettleAmount("");
        setSettleDescription("");
        setShowSettleModal(false);
        fetchWebsiteRevenue();
      } else {
        alert("خطا در ثبت تسویه حساب: " + (res.error || "خطای ناشناخته"));
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    } finally {
      setSubmittingSettle(false);
    }
  };

  // Role Changes Handlers
  const handleRolePercentageChange = (id: string, val: number) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, percentage: val } : r));
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      alert("لطفا عنوان نقش را وارد کنید.");
      return;
    }
    const id = "custom_" + Date.now().toString().substring(8);
    const newRole: RevenueRole = {
      id,
      name: newRoleName.trim(),
      percentage: newRolePercentage,
      description: "نقش سفارشی تعریف شده توسط مدیریت کل",
      isSystemDefault: false
    };
    setRoles(prev => [...prev, newRole]);
    setNewRoleName("");
    setNewRolePercentage(10);
  };

  const handleDeleteRole = (id: string) => {
    if (["website", "translator", "editor", "cleaner"].includes(id)) {
      alert("نقش‌های پایه و پیش‌فرض سیستم قابل حذف نیستند.");
      return;
    }
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveRoles = async () => {
    const totalPercentage = roles.reduce((sum, r) => sum + r.percentage, 0);
    if (totalPercentage !== 100) {
      alert(`خطا: مجموع درصد تخصیص باید دقیقا برابر با ۱۰۰ باشد. در حال حاضر: ${totalPercentage}%`);
      return;
    }

    setSavingRoles(true);
    try {
      const res = await apiClient.post("/api/admin/revenue-roles", { roles });
      if (res.success) {
        alert("تغییرات درصد سهم و نقش‌ها با موفقیت در سیستم ثبت شد.");
        fetchRoles();
      } else {
        alert("خطا در ذخیره‌سازی: " + (res.error || "خطای ناشناخته"));
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    } finally {
      setSavingRoles(false);
    }
  };

  // Add Contributor to Series
  const handleAddSeriesContributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries || !selectedStaffUser) {
      alert("لطفا یک همکار را انتخاب کنید.");
      return;
    }

    const staffMember = staff.find(s => s.id === selectedStaffUser);
    if (!staffMember) return;

    setSubmittingStaff(true);
    try {
      const res = await apiClient.post(`/api/series/${selectedSeries.id}/add-contributor`, {
        userId: staffMember.id,
        displayName: staffMember.displayName || staffMember.email,
        email: staffMember.email,
        role: selectedStaffRole
      });

      if (res.id) {
        alert(`همکار ${staffMember.displayName || staffMember.email} با موفقیت به تیم اثر افزود شد.`);
        setSelectedSeries(res);
        setShowAddStaffModal(false);
        fetchSalesSummary(selectedSeries.id);
      } else {
        alert("خطا در افزودن همکار: " + (res.error || "خطای ناشناخته"));
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    } finally {
      setSubmittingStaff(false);
    }
  };

  // Remove Contributor from Series
  const handleRemoveSeriesContributor = async (userId: string) => {
    if (!selectedSeries) return;
    if (!confirm("آیا از حذف این همکار از تیم این اثر اطمینان دارید؟")) return;

    try {
      const res = await apiClient.post(`/api/series/${selectedSeries.id}/approve-contributor`, {
        userId,
        action: 'remove'
      });
      if (res.id) {
        alert("همکار با موفقیت از تیم اثر حذف شد.");
        setSelectedSeries(res);
        fetchSalesSummary(selectedSeries.id);
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    }
  };

  // Chapter Level Contributors Handlers
  const startEditingContributors = (chapterId: string, currentContributors: any) => {
    setEditingChapterId(chapterId);
    setChapterAssignments(currentContributors || {});
  };

  const handleToggleContributor = (roleId: string, staffId: string) => {
    setChapterAssignments(prev => {
      const current = prev[roleId] || [];
      const updated = current.includes(staffId)
        ? current.filter(id => id !== staffId)
        : [...current, staffId];
      return { ...prev, [roleId]: updated };
    });
  };

  const handleSaveContributors = async (chapterId: string) => {
    if (!selectedSeries) return;
    try {
      const res = await apiClient.post(
        `/api/series/${selectedSeries.id}/chapters/${chapterId}/contributors`,
        { contributors: chapterAssignments }
      );
      if (res.id) {
        alert("دست‌اندرکاران و سهم پرداختی چپتر با موفقیت ثبت شد.");
        setEditingChapterId(null);
        fetchSalesSummary(selectedSeries.id);
      } else {
        alert("ثبت تغییرات با خطا مواجه شد.");
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    }
  };

  // Filtered Series List for Visual Grid
  const filteredSeriesList = seriesList.filter(s =>
    s.title.toLowerCase().includes(seriesSearchQuery.toLowerCase()) ||
    (s.alternativeTitles && s.alternativeTitles.some(t => t.toLowerCase().includes(seriesSearchQuery.toLowerCase())))
  );

  return (
    <div className="space-y-10" dir="rtl">
      {/* Top Header & Refresh */}
      <div className="border-b border-white/10 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Coins className="text-[var(--color-asura-accent-light)]" size={24} />
            تنظیمات مالی، درصد نقش‌ها و تخصیص سهم چپترها
          </h2>
          <p className="text-xs text-zinc-400 mt-1">مدیریت زنده امور مالی، تعیین درصد نقش‌های سیستم و تخصیص دقیق دست‌اندرکاران هر چپتر</p>
        </div>
        <button
          onClick={() => {
            fetchWebsiteRevenue();
            fetchRoles();
            fetchStaff();
            if (selectedSeries) fetchSalesSummary(selectedSeries.id);
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 self-start md:self-auto transition-all"
        >
          <RefreshCw size={14} className={loadingRevenue || loadingRoles ? "animate-spin" : ""} />
          بروزرسانی زنده داده‌ها
        </button>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Website Net Revenue */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/15 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between min-h-[160px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <Coins className="text-indigo-400 absolute left-4 bottom-4 opacity-15 animate-pulse" size={72} />
          <div className="z-10">
            <h3 className="text-xs font-bold text-zinc-400 mb-2">موجودی فعلی سود وبسایت (پس از تسویه)</h3>
            <p className="text-3xl font-black text-white font-mono mt-2 flex items-baseline gap-1">
              {websiteRevenue.toLocaleString("fa-IR")}
              <span className="text-xs text-zinc-400 font-bold">تومان</span>
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-4">
              <TrendingUp size={12} className="text-emerald-500" />
              <span>محاسبه زنده بر اساس کارمزد وبسایت از تمام فروش‌ها</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-indigo-500/10 z-10">
            {!showSettleModal ? (
              <button
                onClick={() => setShowSettleModal(true)}
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-black font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Percent size={14} />
                ثبت تسویه‌حساب و کسر از درآمد وبسایت
              </button>
            ) : (
              <form onSubmit={handleSettleRevenue} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="مبلغ (تومان)"
                    value={settleAmount}
                    onChange={e => setSettleAmount(e.target.value)}
                    className="w-full bg-black/60 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 font-mono text-left focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="توضیح تسویه..."
                    value={settleDescription}
                    onChange={e => setSettleDescription(e.target.value)}
                    className="w-full bg-black/60 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 text-right"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submittingSettle}
                    className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-[10px] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submittingSettle ? "در حال ثبت..." : "ثبت تسویه"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettleModal(false);
                      setSettleAmount("");
                      setSettleDescription("");
                    }}
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-white font-bold text-[10px] rounded-lg transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Total Active Roles */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between">
          <Percent className="text-emerald-400 absolute left-4 bottom-4 opacity-15" size={72} />
          <div>
            <h3 className="text-xs font-bold text-zinc-400 mb-2">تعداد نقش‌های مالی فعال سیستم</h3>
            <p className="text-3xl font-black text-white font-mono mt-2">
              {roles.length} <span className="text-xs font-bold text-zinc-500">نقش</span>
            </p>
          </div>
          <div className="text-[11px] text-zinc-400 border-t border-white/5 pt-3 mt-4">
            <span>مترجم، ادیتور، کلینر، وبسایت و نقش‌های سفارشی</span>
          </div>
        </div>

        {/* Total Active Staff */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between">
          <Users className="text-blue-400 absolute left-4 bottom-4 opacity-15" size={72} />
          <div>
            <h3 className="text-xs font-bold text-zinc-400 mb-2">تعداد کل کادر دست‌اندرکار سیستم</h3>
            <p className="text-3xl font-black text-white font-mono mt-2">
              {staff.length} <span className="text-xs font-bold text-zinc-500">نفر</span>
            </p>
          </div>
          <div className="text-[11px] text-zinc-400 border-t border-white/5 pt-3 mt-4">
            <span>پرسنل و اعضای کادر تولید آماده تخصیص به آثار</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: System Predefined Roles & Percentages */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="border-b border-white/5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Sliders className="text-[var(--color-asura-accent-light)]" size={18} />
              تنظیم درصد سهم نقش‌های مالی پیش‌فرض و سفارشی
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              درصدهای اختصاصی هر نقش از فروش هر چپتر را تنظیم کنید. مجموع درصدها **دقیقاً باید برابر با ۱۰۰٪** باشد.
            </p>
          </div>
          <div className="h-44 w-full md:w-56 shrink-0">
            {roles && roles.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roles.map(r => ({ name: r.name, value: r.percentage }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {roles.map((entry, index) => {
                      const colors = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#14b8a6"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                    formatter={(val: any) => [`${val}٪`, "سهم"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Roles Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((r, i) => {
            const isSystemDefault = ["website", "translator", "editor", "cleaner"].includes(r.id);
            const presetInfo = SYSTEM_PRESET_ROLES[r.id];

            return (
              <div key={r.id} className="bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col justify-between space-y-3 relative group hover:border-[var(--color-asura-accent)]/40 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      {isSystemDefault ? <ShieldCheck size={14} className="text-[var(--color-asura-accent-light)]" /> : <UserCheck size={14} className="text-emerald-400" />}
                      {r.name}
                    </span>
                    {!isSystemDefault && (
                      <button
                        onClick={() => handleDeleteRole(r.id)}
                        className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10"
                        title="حذف نقش سفارشی"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed min-h-[28px]">
                    {presetInfo ? presetInfo.desc : (r.description || "نقش تعریف‌شده سیستم")}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-zinc-500 text-[10px]">درصد سهم:</span>
                    <span className="text-[var(--color-asura-accent-light)] font-black text-sm">{r.percentage}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={r.percentage}
                    onChange={e => handleRolePercentageChange(r.id, Number(e.target.value))}
                    className="w-full accent-[var(--color-asura-accent)] cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Total validation & save button */}
        {(() => {
          const total = roles.reduce((sum, r) => sum + r.percentage, 0);
          const isValid = total === 100;

          return (
            <div className="space-y-3 pt-2">
              <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
                isValid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                <span className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {isValid
                    ? "مجموع درصدها برابر با ۱۰۰٪ بوده و آماده تایید است."
                    : `مجموع درصد تمام نقش‌ها باید دقیقا ۱۰۰٪ باشد. (مجموع فعلی: ${total}٪)`
                  }
                </span>
                <span className="font-mono text-sm font-black">{total}%</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <button
                  onClick={handleSaveRoles}
                  disabled={savingRoles || !isValid}
                  className="w-full sm:w-2/3 py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  {savingRoles ? "در حال ذخیره‌سازی..." : "ثبت و ذخیره‌سازی نهایی درصد نقش‌ها"}
                </button>

                {/* Inline custom role adder */}
                <form onSubmit={handleAddRole} className="w-full sm:w-1/3 flex gap-2">
                  <input
                    type="text"
                    placeholder="نام نقش جدید (مثلا: تایپیست)..."
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--color-asura-accent)]"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 px-3 py-2 rounded-xl text-xs font-black transition-colors shrink-0"
                  >
                    + افزودن
                  </button>
                </form>
              </div>
            </div>
          );
        })()}
      </div>

      {/* SECTION 2: Visual Manga Grid & Chapter Contributor Inspector */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="border-b border-white/5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <BookOpen className="text-indigo-400" size={18} />
              مدیریت آثار، کادر تولید و سهم مالی چپترها
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              روی هر اثر کلیک کنید تا مترجمین، ادیتورها و کلینرهای آن را مدیریت کرده یا سهم چپتر به چپتر را ویرایش نمایید.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="جستجوی عنوان مانهوا یا مانگا..."
              value={seriesSearchQuery}
              onChange={e => setSeriesSearchQuery(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--color-asura-accent)]"
            />
            <Search className="absolute right-3 top-3 text-zinc-500" size={15} />
          </div>
        </div>

        {/* Manga Visual Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredSeriesList.map(s => {
            const isSelected = selectedSeries?.id === s.id;
            const contribs = s.contributors || [];
            const translators = contribs.filter(c => c.role === 'translator');
            const editors = contribs.filter(c => c.role === 'editor');
            const cleaners = contribs.filter(c => c.role === 'cleaner');

            return (
              <div
                key={s.id}
                onClick={() => setSelectedSeries(s)}
                className={`group cursor-pointer rounded-2xl overflow-hidden border transition-all flex flex-col justify-between bg-black/40 relative ${
                  isSelected
                    ? "border-[var(--color-asura-accent)] ring-2 ring-[var(--color-asura-accent)]/30 shadow-xl shadow-[var(--color-asura-accent)]/10"
                    : "border-white/5 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <div>
                  <div className="aspect-[3/4] w-full overflow-hidden relative bg-zinc-900">
                    {s.cover ? (
                      <img
                        src={s.cover}
                        alt={s.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-bold">بدون کاور</div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-mono px-2 py-0.5 rounded-full border border-white/10">
                      {s.totalChapters || 0} چپتر
                    </div>
                  </div>

                  <div className="p-3 space-y-1.5">
                    <h4 className="text-xs font-black text-white truncate group-hover:text-[var(--color-asura-accent-light)] transition-colors">
                      {s.title}
                    </h4>

                    {/* Assigned staff summary badges */}
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {translators.length > 0 && (
                        <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold" title="مترجمین">
                          مترجم: {translators.length}
                        </span>
                      )}
                      {editors.length > 0 && (
                        <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold" title="ادیتورها">
                          ادیتور: {editors.length}
                        </span>
                      )}
                      {cleaners.length > 0 && (
                        <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold" title="کلینرها">
                          کلینر: {cleaners.length}
                        </span>
                      )}
                      {translators.length === 0 && editors.length === 0 && cleaners.length === 0 && (
                        <span className="text-zinc-600 italic">بدون کادر</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2 pt-0">
                  <button className={`w-full py-1.5 rounded-xl text-[10px] font-black transition-colors ${
                    isSelected ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-300 group-hover:bg-white/10"
                  }`}>
                    {isSelected ? "انتخاب شده" : "مدیریت کادر اثر"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Series Inspector Detail Panel */}
        {selectedSeries && (
          <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 space-y-6 mt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 gap-4">
              <div className="flex items-center gap-4">
                {selectedSeries.cover && (
                  <img src={selectedSeries.cover} alt="" className="w-12 h-16 rounded-lg object-cover shadow border border-white/10" />
                )}
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    {selectedSeries.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    شناسه اثر: <span className="font-mono text-zinc-300">{selectedSeries.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddStaffModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 self-start md:self-auto"
              >
                <UserPlus size={15} />
                + افزودن همکار به کادر کلی این اثر
              </button>
            </div>

            {/* Series Overall Team Members */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <Users size={15} className="text-indigo-400" />
                تیم دست‌اندرکاران اصلی اثر
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selectedSeries.contributors && selectedSeries.contributors.length > 0 ? (
                  selectedSeries.contributors.map(c => (
                    <div key={c.userId} className="bg-black/50 p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">{c.displayName || c.email}</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">
                          نقش: <span className="text-[var(--color-asura-accent-light)] font-bold">{c.role === 'translator' ? 'مترجم' : c.role === 'editor' ? 'ادیتور' : c.role === 'cleaner' ? 'کلینر' : c.role}</span>
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveSeriesContributor(c.userId)}
                        className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                        title="حذف از کادر"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 italic col-span-full">هنوز همکاری به کادر کلی این اثر متصل نشده است.</p>
                )}
              </div>
            </div>

            {/* Chapter Breakdown & Contributor Overrides */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Layers size={15} className="text-amber-400" />
                  لیست چپترها، دست‌اندرکاران و سهم پرداختی هر چپتر
                </h4>
                {salesSummary && (
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    درآمد کل این اثر: {salesSummary.totalSales.toLocaleString("fa-IR")} تومان
                  </div>
                )}
              </div>

              {loadingSales ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              ) : salesSummary && salesSummary.byChapter.length > 0 ? (
                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                  {salesSummary.byChapter.map((ch: any) => {
                    const isEditing = editingChapterId === ch.id;

                    return (
                      <div key={ch.id} className="bg-black/40 p-3.5 rounded-xl border border-white/5 space-y-3 hover:border-white/10 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="bg-indigo-500/10 text-indigo-300 font-mono font-black text-xs px-2.5 py-1 rounded-lg border border-indigo-500/20">
                              چپتر {ch.number}
                            </span>
                            <span className="text-xs font-bold text-zinc-300">
                              فروش: <span className="font-mono text-white">{ch.salesCount.toLocaleString("fa-IR")}</span> بار ({ch.totalSalesAmount.toLocaleString("fa-IR")} تومان)
                            </span>
                          </div>

                          {!isEditing && (
                            <button
                              onClick={() => startEditingContributors(ch.id, ch.contributors)}
                              className="bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors self-start sm:self-auto border border-white/5 flex items-center gap-1.5"
                            >
                              <Edit3 size={12} />
                              تغییر دست‌اندرکاران چپتر
                            </button>
                          )}
                        </div>

                        {/* Contributor Read View */}
                        {!isEditing && (
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5 text-[11px]">
                            {roles.filter(r => r.id !== "website").map(r => {
                              const assigned = ch.contributors?.[r.id] || [];

                              return (
                                <div key={r.id} className="bg-black/60 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                                  <span className="text-zinc-400 font-bold">{r.name}:</span>
                                  {assigned.length > 0 ? (
                                    assigned.map((uid: string) => {
                                      const member = staff.find(s => s.id === uid);
                                      return member ? member.displayName || member.email : uid;
                                    }).join(", ")
                                  ) : (
                                    <span className="text-zinc-500 italic">پیش‌فرض اثر</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Contributor Editing View */}
                        {isEditing && (
                          <div className="bg-zinc-900 p-4 rounded-xl border border-indigo-500/20 space-y-4">
                            <h5 className="text-xs font-bold text-indigo-300">
                              تعیین دست‌اندرکاران اختصاصی چپتر {ch.number}:
                            </h5>

                            <div className="space-y-3">
                              {roles.filter(r => r.id !== "website").map(r => (
                                <div key={r.id} className="space-y-1.5">
                                  <span className="text-xs font-bold text-white block">{r.name}:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {staff.map(member => {
                                      const isSelected = (chapterAssignments[r.id] || []).includes(member.id);

                                      return (
                                        <button
                                          key={member.id}
                                          type="button"
                                          onClick={() => handleToggleContributor(r.id, member.id)}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                            isSelected
                                              ? "bg-indigo-600 text-white border-indigo-500"
                                              : "bg-black/40 border-white/10 text-zinc-400 hover:bg-white/5"
                                          }`}
                                        >
                                          {member.displayName || member.email}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-white/10">
                              <button
                                onClick={() => handleSaveContributors(ch.id)}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-colors"
                              >
                                ذخیره تغییرات چپتر
                              </button>
                              <button
                                onClick={() => setEditingChapterId(null)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg transition-colors"
                              >
                                انصراف
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic py-4">هیچ چپتری برای این اثر ثبت نشده است.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Staff to Series Modal */}
      {showAddStaffModal && selectedSeries && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl dir-rtl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <UserPlus className="text-emerald-400" size={16} />
                افزودن همکار به کادر اثر: {selectedSeries.title}
              </h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSeriesContributor} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300">انتخاب همکار از لیست پرسنل:</label>
                <select
                  value={selectedStaffUser}
                  onChange={e => setSelectedStaffUser(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                  required
                >
                  <option value="">-- انتخاب پرسنل --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || s.email} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300">نقش در این اثر:</label>
                <select
                  value={selectedStaffRole}
                  onChange={e => setSelectedStaffRole(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                >
                  <option value="translator">مترجم</option>
                  <option value="editor">ادیتور</option>
                  <option value="cleaner">کلینر</option>
                  {roles.filter(r => !["website", "translator", "editor", "cleaner"].includes(r.id)).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors disabled:opacity-50"
                >
                  {submittingStaff ? "در حال ثبت..." : "افزودن به کادر اثر"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 3: Immutable Financial Ledger & Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* System Activity Logs */}
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-white/5 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Activity className="text-amber-400" size={16} />
              ویجت لاگ فعالیت‌های اخیر سیستم
            </h3>
            <button
              onClick={fetchActivityLogs}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw size={12} className={loadingLogs ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">فعالیتی به تازگی ثبت نشده است.</p>
            ) : (
              activityLogs.map((log, idx) => (
                <div key={log.id || idx} className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    {log.type === 'upload' && <FileText size={15} className="text-blue-400" />}
                    {log.type === 'payout' && <DollarSign size={15} className="text-amber-400" />}
                    <div>
                      <span className="font-bold text-white block">{log.title}</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">{log.description}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Website Ledger */}
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <History className="text-emerald-400" size={16} />
              دفتر کل و سابقه تسویه‌حساب‌ها
            </h3>
          </div>

          <div className="overflow-x-auto bg-black/20 border border-white/5 rounded-xl max-h-[280px] overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-white/5 text-zinc-400 bg-black/40">
                  <th className="p-3 font-black">مبلغ</th>
                  <th className="p-3 font-black">توضیحات</th>
                  <th className="p-3 font-black">تاریخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {revenueTransactions.filter(t => t.amount < 0).map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-mono font-black text-red-400">
                      {Math.abs(tx.amount).toLocaleString("fa-IR")} تومان
                    </td>
                    <td className="p-3 text-white font-bold">{tx.description}</td>
                    <td className="p-3 text-zinc-400 font-mono text-[10px]">
                      {new Date(tx.createdAt).toLocaleDateString("fa-IR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
