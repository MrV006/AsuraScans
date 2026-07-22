import React, { useState, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import {
  Coins,
  Percent,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Sliders,
  Settings,
  Users,
  Layers,
  BookOpen,
  DollarSign,
  Plus,
  Trash2,
  ChevronDown,
  AlertTriangle,
  Award,
  Search,
  PieChart as PieChartIcon
} from "lucide-react";
import { Series } from "../lib/types";

interface RevenueRole {
  id: string;
  name: string;
  percentage: number;
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

export default function RevenueTab({ seriesList, isSuperAdmin }: RevenueTabProps) {
  // Website Revenue States
  const [websiteRevenue, setWebsiteRevenue] = useState<number>(0);
  const [revenueTransactions, setRevenueTransactions] = useState<any[]>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  // Roles & Percentages States
  const [roles, setRoles] = useState<RevenueRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  // New Role Form States
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePercentage, setNewRolePercentage] = useState<number>(10);

  // Sales Tracking States
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [seriesSearchQuery, setSeriesSearchQuery] = useState("");
  const [salesSummary, setSalesSummary] = useState<any | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);

  // Staff States
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Assignment Modal/Inline States
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterAssignments, setChapterAssignments] = useState<Record<string, string[]>>({});

  // Settlement Form States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDescription, setSettleDescription] = useState("");
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Initial Fetching
  useEffect(() => {
    fetchWebsiteRevenue();
    fetchRoles();
    fetchStaff();
    if (seriesList.length > 0) {
      setSelectedSeriesId(seriesList[0].id);
    }
  }, [seriesList]);

  // Fetch sales when series selection changes
  useEffect(() => {
    if (selectedSeriesId) {
      fetchSalesSummary(selectedSeriesId);
    }
  }, [selectedSeriesId]);

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

  const getUniqueContributorsForSeries = () => {
    if (!salesSummary || !Array.isArray(salesSummary.byChapter)) return {};
    const map: Record<string, string[]> = {};
    
    roles.forEach(r => {
      if (r.id !== "website") {
        map[r.id] = [];
      }
    });

    salesSummary.byChapter.forEach((ch: any) => {
      if (ch.contributors) {
        Object.entries(ch.contributors).forEach(([roleId, uids]) => {
          if (Array.isArray(uids) && map[roleId]) {
            uids.forEach(uid => {
              if (uid && !map[roleId].includes(uid)) {
                map[roleId].push(uid);
              }
            });
          }
        });
      }
    });

    return map;
  };

  const fetchWebsiteRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const data = await apiClient.get("/api/admin/website-revenue");
      if (data && !data.error) {
        setWebsiteRevenue(data.totalEarned || 0);
        setRevenueTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      } else {
        setWebsiteRevenue(0);
        setRevenueTransactions([]);
      }
    } catch (err) {
      console.error("Error fetching website revenue:", err);
      setWebsiteRevenue(0);
      setRevenueTransactions([]);
    } finally {
      setLoadingRevenue(false);
    }
  };

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const data = await apiClient.get("/api/admin/revenue-roles");
      if (Array.isArray(data)) {
        setRoles(data);
      } else {
        console.error("Revenue roles data is not an array:", data);
        setRoles([]);
      }
    } catch (err) {
      console.error("Error fetching revenue roles:", err);
      setRoles([]);
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
      } else {
        console.error("Staff data is not an array:", data);
        setStaff([]);
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
      setStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchSalesSummary = async (seriesId: string) => {
    setLoadingSales(true);
    try {
      const data = await apiClient.get(`/api/admin/series/${seriesId}/sales-summary`);
      if (data && !data.error && Array.isArray(data.byChapter)) {
        setSalesSummary(data);
      } else {
        console.error("Sales summary invalid or has error:", data);
        setSalesSummary(null);
      }
    } catch (err) {
      console.error("Error fetching sales summary:", err);
      setSalesSummary(null);
    } finally {
      setLoadingSales(false);
    }
  };

  // Roles Editing Handlers
  const handleRolePercentageChange = (id: string, val: number) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, percentage: val } : r));
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      alert("لطفا نام نقش را وارد کنید.");
      return;
    }
    const id = "custom_" + Date.now().toString().substring(8);
    const newRole: RevenueRole = {
      id,
      name: newRoleName.trim(),
      percentage: newRolePercentage
    };
    setRoles(prev => [...prev, newRole]);
    setNewRoleName("");
    setNewRolePercentage(10);
  };

  const handleDeleteRole = (id: string) => {
    if (id === "website" || id === "translator" || id === "editor") {
      alert("نقش‌های پیش‌فرض و اساسی سیستم را نمی‌توان حذف کرد.");
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
        alert("تغییرات درصد سهم و نقش‌ها با موفقیت ذخیره شد.");
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

  // Chapter-level contributors reassignment
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
    try {
      const res = await apiClient.post(
        `/api/series/${selectedSeriesId}/chapters/${chapterId}/contributors`,
        { contributors: chapterAssignments }
      );
      if (res.id) {
        alert("تخصیص سهم دست‌اندرکاران این چپتر با موفقیت ذخیره شد.");
        setEditingChapterId(null);
        if (selectedSeriesId) {
          fetchSalesSummary(selectedSeriesId);
        }
      } else {
        alert("ثبت تغییرات با خطا مواجه شد.");
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    }
  };

  return (
    <div className="space-y-10" dir="rtl">
      {/* 1. Header Section */}
      <div className="border-b border-white/10 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Coins className="text-[var(--color-asura-accent-light)]" size={24} />
            تنظیمات مالی، درصد نقش‌ها و تخصیص سهم چپترها
          </h2>
          <p className="text-xs text-zinc-500 mt-1">مدیریت زنده امور مالی، تعریف و ویرایش درصد همکاران و اختصاص اختصاصی چپترها</p>
        </div>
        <button
          onClick={() => {
            fetchWebsiteRevenue();
            fetchRoles();
            fetchStaff();
            if (selectedSeriesId) fetchSalesSummary(selectedSeriesId);
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 self-start md:self-auto transition-all"
        >
          <RefreshCw size={14} className={loadingRevenue || loadingRoles ? "animate-spin" : ""} />
          بروزرسانی داده‌ها
        </button>
      </div>

      {/* 2. Top Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/15 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between min-h-[160px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <Coins className="text-indigo-400 absolute left-4 bottom-4 opacity-15 animate-pulse" size={72} />
          <div className="z-10">
            <h3 className="text-xs font-bold text-zinc-400 mb-2">موجودی فعلی سود وبسایت (پس از تسویه)</h3>
            <p className="text-3xl font-black text-white font-mono mt-2 flex items-baseline gap-1">
              {websiteRevenue.toLocaleString("fa-IR")}
              <span className="text-xs text-zinc-500 font-bold">تومان</span>
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-4">
              <TrendingUp size={12} className="text-emerald-500" />
              <span>محاسبه زنده بر اساس ۲۰٪ سهم وبسایت</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-indigo-500/10 z-10">
            {!showSettleModal ? (
              <button
                onClick={() => setShowSettleModal(true)}
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-black font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Percent size={14} />
                ثبت تسویه حساب و کسر از درآمد
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
                    placeholder="توضیح (بابت...)"
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

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-lg">
          <Percent className="text-emerald-400 absolute left-4 bottom-4 opacity-15" size={72} />
          <h3 className="text-xs font-bold text-zinc-400 mb-2">تعداد کل نقش‌های مالی فعال</h3>
          <p className="text-3xl font-black text-white font-mono mt-2">
            {roles.length}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-4">
            <span>میانگین سهم هر نقش: {Math.floor(100 / (roles.length || 1))}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-lg">
          <Users className="text-blue-400 absolute left-4 bottom-4 opacity-15" size={72} />
          <h3 className="text-xs font-bold text-zinc-400 mb-2">تعداد کل کادر دست‌اندرکار</h3>
          <p className="text-3xl font-black text-white font-mono mt-2">
            {staff.length}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-4">
            <span>تعداد ادمین‌ها و پرسنل مشارکت‌کننده سیستم</span>
          </div>
        </div>
      </div>

      {/* 3. Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* RIGHT COLUMN (2/3): Financial Dashboard, Roles settings & Website revenue transactions */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Financial Dashboard Chart Card */}
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="border-b border-white/5 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <PieChartIcon className="text-[var(--color-asura-accent-light)]" size={16} />
                  داشبورد نمودار مالی و توزیع درصد سهم‌ها
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">نمایش گرافیکی و تفکیک شده سهم مترجم، ادیتور، کلینر و وبسایت از فروش هر چپتر</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-56 w-full flex items-center justify-center">
                {roles && roles.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roles.map(r => ({ name: r.name, value: r.percentage }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {roles.map((entry, index) => {
                          const colors = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#14b8a6"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                        formatter={(val: any) => [`${val}٪`, "سهم"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-zinc-500">در حال بارگذاری نمودار...</p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 border-b border-white/5 pb-2">تفکیک درصدی نقش‌ها</h4>
                <div className="space-y-2">
                  {roles.map((r, i) => {
                    const colors = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#14b8a6"];
                    const color = colors[i % colors.length];
                    return (
                      <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/30 border border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                          <span className="font-black text-white">{r.name}</span>
                        </div>
                        <span className="font-mono font-bold text-[var(--color-asura-accent-light)]">{r.percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Roles config card */}
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Sliders className="text-[var(--color-asura-accent-light)]" size={16} />
                تنظیم توزیع سهم و درصد نقش‌ها
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">درصدهای دلخواه را برای هر نقش تنظیم کنید. مجموع درصدها باید دقیقا ۱۰۰ باشد.</p>
            </div>

            {loadingRoles ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-8 h-8 border-4 border-zinc-800 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.isArray(roles) && roles.map(r => {
                    const isDefault = r.id === "website" || r.id === "translator" || r.id === "editor";
                    return (
                      <div key={r.id} className="bg-black/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-3 relative group">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white">{r.name}</span>
                          {!isDefault && (
                            <button
                              onClick={() => handleDeleteRole(r.id)}
                              className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10"
                              title="حذف این نقش"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={r.percentage}
                            onChange={e => handleRolePercentageChange(r.id, Number(e.target.value))}
                            className="flex-1 accent-[var(--color-asura-accent)]"
                          />
                          <span className="text-xs font-black text-[var(--color-asura-accent-light)] font-mono w-12 text-left">
                            {r.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status Sum Bar */}
                {(() => {
                  const total = roles.reduce((sum, r) => sum + r.percentage, 0);
                  const isValid = total === 100;
                  return (
                    <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      isValid 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        {isValid 
                          ? "مجموع درصدها برابر با ۱۰۰٪ و کاملاً معتبر است." 
                          : `خطا: مجموع درصدها باید برابر با ۱۰۰٪ باشد. مجموع فعلی: ${total}٪`
                        }
                      </span>
                      <span className="font-mono text-sm font-black">{total}%</span>
                    </div>
                  );
                })()}

                {/* Save button */}
                <button
                  onClick={handleSaveRoles}
                  disabled={savingRoles}
                  className="w-full py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-[var(--color-asura-accent)]/15 transition-all"
                >
                  {savingRoles ? "در حال ذخیره‌سازی..." : "ذخیره تغییرات درصدها و نقش‌ها"}
                </button>
              </div>
            )}
          </div>

          {/* Add custom role card */}
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl">
            <div className="border-b border-white/5 pb-3 mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Plus className="text-emerald-400" size={16} />
                افزودن نقش مالی جدید به وبسایت
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">نقش‌های تخصصی مانند تایپست، کلینر، مترجم دوم و... را اضافه کنید تا درصدی از فروش چپترها به آنان اختصاص یابد.</p>
            </div>

            <form onSubmit={handleAddRole} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase">عنوان نقش فارسی</label>
                <input
                  type="text"
                  placeholder="مثال: کلینر دوم"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase">درصد اولیه سهم سهم</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={newRolePercentage}
                  onChange={e => setNewRolePercentage(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] text-left font-mono"
                />
              </div>

              <button
                type="submit"
                className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/20 py-2.5 rounded-xl font-black text-xs transition-all w-full h-[41px]"
              >
                + افزودن این نقش
              </button>
            </form>
          </div>

          {/* Website accumulated profits transaction table */}
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl">
            <div className="border-b border-white/5 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Award className="text-purple-400" size={16} />
                  ریز تراکنش‌های سود سایت (۲۰٪ یا درصد وبسایت)
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">لیست ۱۰۰ تراکنش نهایی مربوط به سهم وبسایت از فروش چپترها</p>
              </div>
            </div>

            {loadingRevenue ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-8 h-8 border-4 border-zinc-800 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
              </div>
            ) : revenueTransactions.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs font-bold">تاکنون تراکنشی ثبت نگردیده است. با خرید چپتر مانهواها توسط کاربران، سود سایت به صورت خودکار در این جدول ثبت خواهد شد.</div>
            ) : (
              <div className="overflow-x-auto bg-black/10 border border-white/5 rounded-xl max-h-[300px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-zinc-500">
                      <th className="p-3 font-black text-right">سود سایت</th>
                      <th className="p-3 font-black text-right">توضیحات اثر / چپتر</th>
                      <th className="p-3 font-black text-right font-mono">ساعت و تاریخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {revenueTransactions.map((tx, idx) => {
                      const isNegative = tx.amount < 0;
                      return (
                        <tr key={tx.id || idx} className="hover:bg-white/5 transition-colors">
                          <td className={`p-3 font-mono font-black ${isNegative ? "text-red-400" : "text-emerald-400"}`}>
                            {isNegative ? "" : "+"}{tx.amount.toLocaleString("fa-IR")} ت
                          </td>
                          <td className="p-3 text-white font-bold">{tx.description}</td>
                          <td className="p-3 text-zinc-500 font-mono text-[10px]">
                            {new Date(tx.createdAt).toLocaleDateString("fa-IR")} {new Date(tx.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* LEFT COLUMN (1/3): Sales Tracking per Series & Chapter Level Contributor Assignment */}
        <div className="space-y-8">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <BookOpen className="text-indigo-400" size={16} />
                آمار فروش و تخصیص همکاران آثار
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 font-sans">یک اثر را انتخاب کنید تا آمار فروش و جدول تخصیص آن را ویرایش نمایید.</p>
            </div>

            {/* Search and Select Series */}
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase">جستجو و انتخاب اثر (مانهوا/مانگا)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="نام مانهوا یا مانگا را سرچ کنید..."
                  value={seriesSearchQuery}
                  onChange={e => setSeriesSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--color-asura-accent)] text-right"
                  dir="rtl"
                />
                <Search className="absolute right-3.5 top-3.5 text-zinc-500" size={14} />
              </div>

              <div className="border border-white/5 rounded-xl bg-black/40 max-h-[180px] overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                {seriesList
                  .filter(s => s.title.toLowerCase().includes(seriesSearchQuery.toLowerCase()) || (s.alternativeTitles && s.alternativeTitles.some(t => t.toLowerCase().includes(seriesSearchQuery.toLowerCase()))))
                  .map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeriesId(s.id)}
                      className={`w-full text-right p-2.5 text-xs font-bold transition-all flex items-center gap-2 ${
                        selectedSeriesId === s.id 
                          ? "bg-[var(--color-asura-accent)]/15 border-r-2 border-[var(--color-asura-accent)] text-white" 
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {s.cover && (
                        <img src={s.cover} alt="" className="w-6 h-8 rounded object-cover shadow" />
                      )}
                      <span className="truncate">{s.title}</span>
                    </button>
                  ))}
                {seriesList.filter(s => s.title.toLowerCase().includes(seriesSearchQuery.toLowerCase()) || (s.alternativeTitles && s.alternativeTitles.some(t => t.toLowerCase().includes(seriesSearchQuery.toLowerCase())))).length === 0 && (
                  <p className="text-center py-4 text-zinc-600 text-[11px] font-bold">اثری با این نام پیدا نشد.</p>
                )}
              </div>
            </div>

            {/* Selected series overview metrics */}
            {loadingSales ? (
              <div className="flex justify-center items-center py-6">
                <div className="w-6 h-6 border-2 border-zinc-800 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
              </div>
            ) : salesSummary ? (
              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 grid grid-cols-2 gap-3">
                  <div className="text-right">
                    <span className="block text-[10px] text-zinc-500 font-bold">تعداد کل فروش</span>
                    <span className="block text-sm font-black text-white font-mono mt-0.5">{salesSummary.totalPurchasesCount.toLocaleString("fa-IR")} بار</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-zinc-500 font-bold">درآمد کل حاصله</span>
                    <span className="block text-sm font-black text-emerald-400 font-mono mt-0.5">{salesSummary.totalSales.toLocaleString("fa-IR")} ت</span>
                  </div>
                </div>

                {/* Series-level contributors block */}
                <div className="bg-black/30 p-4 rounded-xl border border-indigo-500/10 space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl"></div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <Users size={14} className="text-indigo-400 animate-pulse" />
                    کل دست‌اندرکاران این اثر
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(getUniqueContributorsForSeries()).map(([roleId, uids]: [string, any]) => {
                      const role = roles.find(r => r.id === roleId);
                      if (!role) return null;
                      const members = uids.map((uid: string) => staff.find(s => s.id === uid)).filter(Boolean);
                      return (
                        <div key={roleId} className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-zinc-400">{role.name}:</span>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {members.length > 0 ? (
                              members.map((member: any) => (
                                <span key={member.id} className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/15">
                                  {member.displayName}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-600 font-normal">تعیین نشده</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chapter list table with individual contributor overrides */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Layers size={14} className="text-zinc-500" />
                    لیست چپترها و دست‌اندرکاران فروش
                  </h4>
                  <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                    {salesSummary.byChapter.map((ch: any) => {
                      const isEditing = editingChapterId === ch.id;
                      return (
                        <div key={ch.id} className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-3 transition-colors hover:border-white/10">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-black text-white">چپتر {ch.number}</span>
                              <span className="text-[10px] text-zinc-500 block mt-0.5 font-bold">فروش: {ch.salesCount.toLocaleString("fa-IR")} بار ({ch.totalSalesAmount.toLocaleString("fa-IR")} ت)</span>
                            </div>
                            
                            {!isEditing && (
                              <button
                                onClick={() => startEditingContributors(ch.id, ch.contributors)}
                                className="bg-[var(--color-asura-accent)]/10 hover:bg-[var(--color-asura-accent)] text-[var(--color-asura-accent-light)] hover:text-white px-2.5 py-1 rounded text-[10px] font-black transition-colors"
                              >
                                تغییر دست‌اندرکاران
                              </button>
                            )}
                          </div>

                          {/* Contributor badge view */}
                          {!isEditing && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Array.isArray(roles) && roles.filter(r => r.id !== "website").map(r => {
                                const rawAssigned = ch.contributors?.[r.id];
                                const assignedIds = Array.isArray(rawAssigned) ? rawAssigned : [];
                                return (
                                  <div key={r.id} className="bg-white/5 px-2 py-0.5 rounded text-[9px] text-zinc-400 border border-white/5 flex items-center gap-1 font-bold">
                                    <span className="text-zinc-500">{r.name}:</span>
                                    {assignedIds.length > 0 ? (
                                      assignedIds.map((uid: string) => {
                                        const member = staff.find(s => s.id === uid);
                                        return member ? member.displayName : uid.substring(0, 4);
                                      }).join(", ")
                                    ) : (
                                      <span className="text-amber-500/80 font-sans">پیش‌فرض اثر</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Assignment editor panel */}
                          {isEditing && (
                            <div className="bg-zinc-950 p-3 rounded-lg border border-white/5 space-y-3">
                              <span className="text-[10px] font-bold text-zinc-400 block border-b border-white/5 pb-1 mb-1">انتخاب پرسنل برای سهم فروش چپتر {ch.number}:</span>
                              
                              {Array.isArray(roles) && roles.filter(r => r.id !== "website").map(r => (
                                <div key={r.id} className="space-y-1.5">
                                  <span className="text-[10px] font-black text-zinc-300 block">{r.name}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.isArray(staff) && staff.map(member => {
                                      const isSelected = (chapterAssignments[r.id] || []).includes(member.id);
                                      return (
                                        <button
                                          key={member.id}
                                          type="button"
                                          onClick={() => handleToggleContributor(r.id, member.id)}
                                          className={`px-2 py-1 rounded text-[9px] font-bold transition-all border ${
                                            isSelected
                                              ? "bg-[var(--color-asura-accent)] border-[var(--color-asura-accent)] text-white"
                                              : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"
                                          }`}
                                        >
                                          {member.displayName}
                                        </button>
                                      );
                                    })}
                                    {(!staff || staff.length === 0) && (
                                      <span className="text-[9px] text-zinc-500">هیچ پرسنل فعالی یافت نشد.</span>
                                    )}
                                  </div>
                                </div>
                              ))}

                              <div className="flex gap-1.5 pt-2">
                                <button
                                  onClick={() => handleSaveContributors(ch.id)}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded transition-colors"
                                >
                                  ذخیره تخصیص‌ها
                                </button>
                                <button
                                  onClick={() => setEditingChapterId(null)}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] rounded border border-white/5 transition-colors"
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
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 text-xs font-bold">یک اثر معتبر از لیست بالا انتخاب نمایید.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
