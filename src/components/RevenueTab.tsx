import React, { useState, useEffect } from "react";
import { apiClient, getSocketInstance } from "../lib/apiClient";
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
  ChevronLeft,
  Printer,
  Copy,
  CheckCheck,
  Sparkles,
  Calculator,
  HelpCircle,
  Award,
  Wallet,
  Zap,
  RotateCw
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

  // Contributor Earnings Inspector Modal States
  const [inspectUser, setInspectUser] = useState<{ id: string; name: string; email?: string; role?: string } | null>(null);
  const [inspectMonth, setInspectMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [loadingInspect, setLoadingInspect] = useState<boolean>(false);
  const [inspectViewMode, setInspectViewMode] = useState<"breakdown" | "slip">("breakdown");
  const [inspectSearchQuery, setInspectSearchQuery] = useState<string>("");
  const [copiedSlip, setCopiedSlip] = useState<boolean>(false);

  // Staff Section Filters
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>("all");

  const handleInspectContributor = async (userId: string, userName?: string, month?: string) => {
    const m = month || inspectMonth;
    const foundStaff = staff.find(s => s.id === userId);
    setInspectUser({
      id: userId,
      name: userName || (foundStaff?.displayName || foundStaff?.email || "همکار"),
      email: foundStaff?.email,
      role: foundStaff?.role
    });
    setLoadingInspect(true);
    setCopiedSlip(false);
    try {
      const res = await apiClient.get(`/api/admin/contributor-earnings/${userId}?month=${m}`);
      setInspectData(res);
    } catch (err: any) {
      console.error("Error fetching contributor earnings:", err);
      setInspectData({ error: err.message || "خطا در دریافت اطلاعات" });
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleInspectMonthChange = (newMonth: string) => {
    setInspectMonth(newMonth);
    if (inspectUser) {
      handleInspectContributor(inspectUser.id, inspectUser.name, newMonth);
    }
  };

  const handleCopySlip = () => {
    if (!inspectData || !inspectUser) return;
    const monthLabel = inspectMonth === 'all' ? 'مجموع کل دوره‌ها' : `ماه ${inspectMonth}`;
    const total = (inspectData.totalEarnings || 0).toLocaleString("fa-IR");
    const totalSales = (inspectData.totalSalesCount || 0).toLocaleString("fa-IR");
    
    let text = `📋 فیش تسویه مالی و کارنامه سود همکار:\n`;
    text += `👤 نام: ${inspectUser.name}\n`;
    if (inspectUser.email) text += `📧 ایمیل: ${inspectUser.email}\n`;
    text += `📅 دوره گزارش: ${monthLabel}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 مجموع درآمد خالص: ${total} تومان\n`;
    text += `🛒 تعداد کل فروش‌ها: ${totalSales} بار\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📚 ریز سهم آثار:\n`;

    if (inspectData.seriesBreakdown && inspectData.seriesBreakdown.length > 0) {
      inspectData.seriesBreakdown.forEach((sb: any, idx: number) => {
        text += `${idx + 1}. ${sb.seriesTitle} (${sb.chapters.length} چپتر): ${(sb.seriesEarnings || 0).toLocaleString("fa-IR")} تومان\n`;
      });
    } else {
      text += `هیچ فروشی در این بازه ثبت نشده است.\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⚡ سامانه مدیریت مالی مانگاتا / آسورا`;

    navigator.clipboard.writeText(text);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2500);
  };

  // Settlement Form States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDescription, setSettleDescription] = useState("");
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Smart Revenue Recovery & Auto-Sync States
  const [syncingPurchases, setSyncingPurchases] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success?: boolean;
    totalPurchases?: number;
    repairedPurchases?: number;
    totalDistributedToContributors?: number;
    totalCreditedToWebsite?: number;
    details?: string[];
  } | null>(null);

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

  // Real-time Socket Event Listeners
  useEffect(() => {
    const socket = getSocketInstance();
    const handleLiveRevenueUpdate = () => {
      fetchWebsiteRevenue();
      if (selectedSeries) {
        fetchSalesSummary(selectedSeries.id);
      }
    };
    socket.on("revenue:updated", handleLiveRevenueUpdate);
    socket.on("transactions:updated", handleLiveRevenueUpdate);
    socket.on("wallet:any_update", handleLiveRevenueUpdate);

    return () => {
      socket.off("revenue:updated", handleLiveRevenueUpdate);
      socket.off("transactions:updated", handleLiveRevenueUpdate);
      socket.off("wallet:any_update", handleLiveRevenueUpdate);
    };
  }, [selectedSeries]);

  // Fetch sales summary when selected series changes
  useEffect(() => {
    if (selectedSeries) {
      fetchSalesSummary(selectedSeries.id);
    }
  }, [selectedSeries]);

  const handleSyncPurchases = async () => {
    setSyncingPurchases(true);
    setSyncResult(null);
    try {
      const res = await apiClient.post("/api/admin/revenue/sync-unpaid-purchases", {});
      if (res && res.success) {
        setSyncResult(res);
        fetchWebsiteRevenue();
        if (selectedSeries) {
          fetchSalesSummary(selectedSeries.id);
        }
      } else {
        alert("خطا در همگام‌سازی: " + (res?.error || "خطای ناشناخته"));
      }
    } catch (err: any) {
      alert("خطا در اجرای تسویه خودکار: " + err.message);
    } finally {
      setSyncingPurchases(false);
    }
  };

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
  const handleRolePercentageChange = (id: string, rawVal: number) => {
    const val = Math.max(0, Math.min(100, Math.round(rawVal)));
    setRoles(prev => prev.map(r => r.id === id ? { ...r, percentage: val } : r));
  };

  const handleAutoBalance = () => {
    if (!roles || roles.length === 0) return;
    const currentTotal = roles.reduce((s, r) => s + r.percentage, 0);
    if (currentTotal === 100) return;

    const diff = 100 - currentTotal;
    setRoles(prev => {
      const updated = [...prev];
      // Prefer adjusting 'website' role, or last role
      const targetIdx = updated.findIndex(r => r.id === 'website') !== -1 
        ? updated.findIndex(r => r.id === 'website') 
        : updated.length - 1;
      
      if (targetIdx !== -1) {
        const newPct = Math.max(0, Math.min(100, updated[targetIdx].percentage + diff));
        updated[targetIdx] = { ...updated[targetIdx], percentage: newPct };
      }
      return updated;
    });
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
  const getAvailableMembers = () => {
    const map = new Map<string, { id: string; displayName: string; email?: string; role?: string; seriesRole?: string }>();

    // 1. Series contributors first
    if (selectedSeries && Array.isArray(selectedSeries.contributors)) {
      selectedSeries.contributors.forEach((c: any) => {
        const id = c.userId || c.id;
        if (id) {
          map.set(id, {
            id,
            displayName: c.displayName || c.email || id,
            email: c.email,
            role: c.role,
            seriesRole: c.role
          });
        }
      });
    }

    // 2. Staff and users from server
    staff.forEach((s: any) => {
      if (s.id) {
        if (!map.has(s.id)) {
          map.set(s.id, {
            id: s.id,
            displayName: s.displayName || s.email || s.id,
            email: s.email,
            role: s.role
          });
        }
      }
    });

    // 3. Any assigned users in chapter
    Object.values(chapterAssignments).forEach((ids: any) => {
      if (Array.isArray(ids)) {
        ids.forEach((id: string) => {
          if (id && !map.has(id)) {
            map.set(id, {
              id,
              displayName: id,
              role: 'همکار'
            });
          }
        });
      }
    });

    return Array.from(map.values());
  };

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
      if (res.success || res.id) {
        alert("دست‌اندرکاران و سهم پرداختی چپتر با موفقیت ثبت شد.");
        setEditingChapterId(null);
        fetchSalesSummary(selectedSeries.id);
      } else {
        alert("ثبت تغییرات با خطا مواجه شد: " + (res.error || "خطای ناشناخته"));
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

      {/* SECTION: Smart Auto-Recovery & Revenue Health */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-purple-500/10 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                سیستم هوشمند پایش و تسویه خودکار خریدهای چپتر
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  فعال و بلادرنگ
                </span>
              </h4>
              <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                هر خرید چپتر به صورت خودکار بین مترجم، ادیتور، کلینر و صندوق وبسایت تقسیم و بلافاصله به کیف پول‌ها واریز می‌شود. چنانچه خریدی در گذشته ثبت شده باشد اما به هر دلیل سود آن تقسیم نشده، با کلیک بر روی دکمه مقابل سیستم به صورت خودکار تمام خریدها را بررسی و مبالغ معوق را با دقت ریالی واریز می‌نماید.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncPurchases}
            disabled={syncingPurchases}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs rounded-xl shadow-lg hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            <RotateCw size={15} className={syncingPurchases ? "animate-spin" : ""} />
            {syncingPurchases ? "در حال پایش و تسویه خودکار..." : "پایش و تسویه خریدهای معوق"}
          </button>
        </div>

        {/* Sync Results Box */}
        {syncResult && (
          <div className="mt-4 pt-4 border-t border-amber-500/20 bg-black/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
              <CheckCircle2 size={16} />
              <span>نتیجه پایش و همگام‌سازی:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-300">
              <div className="bg-white/5 p-2.5 rounded-lg">
                <span className="text-[10px] text-zinc-400 block">کل خریدهای ثبت‌شده</span>
                <span className="text-sm font-black text-white font-mono">{syncResult.totalPurchases || 0}</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-lg">
                <span className="text-[10px] text-zinc-400 block">خریدهای تسویه‌شده جدید</span>
                <span className="text-sm font-black text-amber-400 font-mono">{syncResult.repairedPurchases || 0}</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-lg">
                <span className="text-[10px] text-zinc-400 block">واریز شده به اعضای کادر</span>
                <span className="text-sm font-black text-emerald-400 font-mono">{(syncResult.totalDistributedToContributors || 0).toLocaleString("fa-IR")} ت</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-lg">
                <span className="text-[10px] text-zinc-400 block">واریز شده به صندوق وبسایت</span>
                <span className="text-sm font-black text-blue-400 font-mono">{(syncResult.totalCreditedToWebsite || 0).toLocaleString("fa-IR")} ت</span>
              </div>
            </div>
            {syncResult.details && syncResult.details.length > 0 && (
              <div className="mt-2 text-[11px] text-zinc-400 max-h-32 overflow-y-auto space-y-1">
                {syncResult.details.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-zinc-300">
                    <span className="text-emerald-400">•</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION: Staff Members & Monthly Contributor Profit Center */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Award className="text-amber-400" size={18} />
              کادر دست‌اندرکاران و بررسی سود ماهانه اعضا
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              با کلیک روی دکمه یا نام هر همکار، کارنامه مالی، ریز سود ماهانه، فیش تسویه و درآمد کسب‌شده از هر چپتر و اثر را مشاهده نمایید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter Chips */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5 text-xs">
              <button
                type="button"
                onClick={() => setStaffRoleFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${staffRoleFilter === "all" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                همه ({staff.length})
              </button>
              <button
                type="button"
                onClick={() => setStaffRoleFilter("translator")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${staffRoleFilter === "translator" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-zinc-400 hover:text-white"}`}
              >
                مترجمین
              </button>
              <button
                type="button"
                onClick={() => setStaffRoleFilter("editor")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${staffRoleFilter === "editor" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-zinc-400 hover:text-white"}`}
              >
                ادیتورها
              </button>
              <button
                type="button"
                onClick={() => setStaffRoleFilter("cleaner")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${staffRoleFilter === "cleaner" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-zinc-400 hover:text-white"}`}
              >
                کلینرها
              </button>
            </div>

            {/* Staff Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="جستجوی نام یا ایمیل همکار..."
                value={staffSearchQuery}
                onChange={e => setStaffSearchQuery(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 pr-8 w-48 sm:w-56"
              />
              <Search className="absolute right-2.5 top-2 text-zinc-500 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        {/* Staff Members List Cards */}
        {staff.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500 italic bg-black/20 rounded-xl border border-white/5">
            هنوز عضوی در کادر دست‌اندرکاران (با نقش ادیتور، مترجم، کلینر یا ادمین) ثبت نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {staff
              .filter(member => {
                const matchSearch =
                  !staffSearchQuery.trim() ||
                  (member.displayName || "").toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                  (member.email || "").toLowerCase().includes(staffSearchQuery.toLowerCase());
                const matchRole =
                  staffRoleFilter === "all" ||
                  (member.role || "").toLowerCase() === staffRoleFilter.toLowerCase() ||
                  (Array.isArray(member.roles) && member.roles.some((r: string) => r.toLowerCase() === staffRoleFilter.toLowerCase()));
                return matchSearch && matchRole;
              })
              .map(member => {
                const rolesList = Array.isArray(member.roles) && member.roles.length > 0 ? member.roles : [member.role || "user"];

                return (
                  <div
                    key={member.id}
                    className="bg-black/40 hover:bg-black/60 border border-white/5 hover:border-indigo-500/30 rounded-xl p-3.5 space-y-3 transition-all flex flex-col justify-between group shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-white/10 flex items-center justify-center font-black text-xs text-white uppercase shrink-0">
                        {(member.displayName || member.email || "U").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-white text-xs block truncate" title={member.displayName || member.email}>
                          {member.displayName || member.email}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {rolesList.map((r: string) => {
                            const roleFa =
                              r === "translator" ? "مترجم" :
                              r === "editor" ? "ادیتور" :
                              r === "cleaner" ? "کلینر" :
                              r === "admin" ? "مدیر" :
                              r === "superadmin" || r === "super_admin" ? "مدیر ارشد" :
                              r === "staff" ? "کادر تیم" : r;

                            const roleColor =
                              r === "translator" ? "bg-blue-500/10 text-blue-300 border-blue-500/30" :
                              r === "editor" ? "bg-purple-500/10 text-purple-300 border-purple-500/30" :
                              r === "cleaner" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" :
                              "bg-amber-500/10 text-amber-300 border-amber-500/30";

                            return (
                              <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${roleColor}`}>
                                {roleFa}
                              </span>
                            );
                          })}
                          <span className="text-[10px] text-zinc-500 font-mono truncate">{member.email}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInspectContributor(member.id, member.displayName || member.email)}
                      className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 hover:text-white border border-indigo-500/30 rounded-lg py-1.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 group-hover:border-indigo-500/50"
                    >
                      <TrendingUp size={13} className="text-emerald-400" />
                      مشاهده سود و کارنامه ماهانه
                    </button>
                  </div>
                );
              })}
          </div>
        )}
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
          {roles.map((r) => {
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
                        type="button"
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

                <div className="space-y-3 pt-2 border-t border-white/5">
                  {/* Header & Numeric Input */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-400 text-[11px] font-bold">درصد سهم:</span>
                    <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 focus-within:border-[var(--color-asura-accent)]">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={r.percentage}
                        onChange={e => handleRolePercentageChange(r.id, Number(e.target.value) || 0)}
                        className="w-12 bg-transparent text-right text-[var(--color-asura-accent-light)] font-black font-mono text-sm focus:outline-none"
                      />
                      <span className="text-zinc-400 text-xs font-bold">%</span>
                    </div>
                  </div>

                  {/* Stepper Buttons (-5%, -1%, +1%, +5%) */}
                  <div className="flex items-center justify-between gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => handleRolePercentageChange(r.id, r.percentage - 5)}
                      className="px-2 py-1 bg-white/5 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 font-mono text-[10px] font-black rounded-lg transition-colors shrink-0"
                      title="کاهش ۵٪"
                    >
                      -۵٪
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRolePercentageChange(r.id, r.percentage - 1)}
                      className="px-2 py-1 bg-white/5 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 font-mono text-[10px] font-black rounded-lg transition-colors shrink-0"
                      title="کاهش ۱٪"
                    >
                      -۱٪
                    </button>
                    <div className="flex-1 text-center font-mono text-xs font-black text-white/80">
                      {r.percentage}٪
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRolePercentageChange(r.id, r.percentage + 1)}
                      className="px-2 py-1 bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 font-mono text-[10px] font-black rounded-lg transition-colors shrink-0"
                      title="افزایش ۱٪"
                    >
                      +۱٪
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRolePercentageChange(r.id, r.percentage + 5)}
                      className="px-2 py-1 bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 font-mono text-[10px] font-black rounded-lg transition-colors shrink-0"
                      title="افزایش ۵٪"
                    >
                      +۵٪
                    </button>
                  </div>

                  {/* Range Slider in strict LTR container to prevent RTL jump glitches */}
                  <div className="w-full pt-1" dir="ltr">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={r.percentage}
                      onChange={e => handleRolePercentageChange(r.id, Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--color-asura-accent)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total validation & save button */}
        {(() => {
          const total = roles.reduce((sum, r) => sum + r.percentage, 0);
          const isValid = total === 100;
          const diff = 100 - total;

          return (
            <div className="space-y-3 pt-2">
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold ${
                isValid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>
                    {isValid
                      ? "مجموع درصدها دقیقاً برابر با ۱۰۰٪ بوده و آماده تایید است."
                      : `مجموع درصد تمام نقش‌ها باید دقیقاً ۱۰۰٪ باشد. (مجموع فعلی: ${total}٪ | ${diff > 0 ? `${diff}٪ باقی‌مانده` : `${Math.abs(diff)}٪ مازاد`})`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!isValid && (
                    <button
                      type="button"
                      onClick={handleAutoBalance}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-black rounded-lg border border-amber-500/30 transition-colors"
                      title="تنظیم خودکار درصد سهم وبسایت برای رسیدن به مجموع ۱۰۰٪"
                    >
                      ⚡ توازن هوشمند ۱۰۰٪
                    </button>
                  )}
                  <span className="font-mono text-base font-black px-2 py-0.5 bg-black/40 rounded-lg border border-white/10">{total}%</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <button
                  type="button"
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
                    <div key={c.userId} className="bg-black/50 p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs hover:border-indigo-500/30 transition-all">
                      <div>
                        <button
                          type="button"
                          onClick={() => handleInspectContributor(c.userId, c.displayName || c.email)}
                          className="font-bold text-white hover:text-indigo-300 transition-colors flex items-center gap-1.5 text-right group"
                          title="مشاهده کارنامه مالی و سود ماهانه همکار"
                        >
                          <span>{c.displayName || c.email}</span>
                          <TrendingUp size={13} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                        </button>
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
                              const allMembers = getAvailableMembers();

                              return (
                                <div key={r.id} className="bg-black/60 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                                  <span className="text-zinc-400 font-bold">{r.name}:</span>
                                  {assigned.length > 0 ? (
                                    assigned.map((uid: string, idx: number) => {
                                      const member = allMembers.find(s => s.id === uid) || staff.find(s => s.id === uid);
                                      const name = member ? (member.displayName || member.email) : uid;
                                      return (
                                        <button
                                          key={uid}
                                          type="button"
                                          onClick={() => handleInspectContributor(uid, name)}
                                          className="text-indigo-300 hover:text-white font-bold transition-colors hover:underline flex items-center gap-0.5"
                                          title="مشاهده سود ماهانه"
                                        >
                                          {name}
                                          {idx < assigned.length - 1 ? "، " : ""}
                                        </button>
                                      );
                                    })
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
                              {roles.filter(r => r.id !== "website").map(r => {
                                const available = getAvailableMembers();
                                return (
                                  <div key={r.id} className="space-y-1.5">
                                    <span className="text-xs font-bold text-white block">{r.name}:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {available.map(member => {
                                        const isSelected = (chapterAssignments[r.id] || []).includes(member.id);
                                        const isSeriesRole = member.seriesRole === r.id;

                                        return (
                                          <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => handleToggleContributor(r.id, member.id)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                                              isSelected
                                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                                                : isSeriesRole
                                                ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/40"
                                                : "bg-black/40 border-white/10 text-zinc-400 hover:bg-white/5"
                                            }`}
                                          >
                                            <span>{member.displayName || member.email}</span>
                                            {isSeriesRole && !isSelected && (
                                              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 py-0.2 rounded font-normal">تیم اثر</span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
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

      {/* SECTION 2.5: All Staff & Collaborators Directory with Direct Resume & Financial Inspection */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="border-b border-white/5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="text-emerald-400" size={18} />
              جدول کارمندان و دست‌اندرکاران (مترجمین، ادیتورها، کلینرها و مدیران)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              بررسی مستقیم رزومه، عملکرد کاری، درآمدهای کسب‌شده و صدور فیش تسویه حساب برای هر یک از همکاران تیم
            </p>
          </div>

          {/* Search and Role Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Role */}
            <select
              value={staffRoleFilter}
              onChange={e => setStaffRoleFilter(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
            >
              <option value="all">تمام نقش‌ها</option>
              <option value="translator">مترجمین</option>
              <option value="editor">ادیتورها</option>
              <option value="cleaner">کلینرها</option>
              <option value="staff">پرسنل</option>
              <option value="admin">مدیران</option>
            </select>

            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <input
                type="text"
                placeholder="جستجوی نام یا ایمیل..."
                value={staffSearchQuery}
                onChange={e => setStaffSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--color-asura-accent)]"
              />
              <Search className="absolute right-3 top-2.5 text-zinc-500" size={14} />
            </div>

            <button
              onClick={fetchStaff}
              className="p-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl transition-colors"
              title="تازه‌سازی لیست همکاران"
            >
              <RefreshCw size={14} className={loadingStaff ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto bg-black/20 border border-white/5 rounded-xl">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 bg-black/40">
                <th className="p-3 font-black">همکار / پرسنل</th>
                <th className="p-3 font-black">ایمیل</th>
                <th className="p-3 font-black">نقش در سیستم</th>
                <th className="p-3 font-black">تعداد آثار منتسب</th>
                <th className="p-3 font-black">موجودی کیف پول</th>
                <th className="p-3 font-black text-center">عملیات مالی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingStaff ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    در حال بارگذاری لیست پرسنل و همکاران...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                    هیچ پرسنلی در سیستم ثبت نشده است.
                  </td>
                </tr>
              ) : (
                staff
                  .filter(s => {
                    const matchQuery = !staffSearchQuery.trim() ||
                      (s.displayName && s.displayName.toLowerCase().includes(staffSearchQuery.toLowerCase())) ||
                      (s.email && s.email.toLowerCase().includes(staffSearchQuery.toLowerCase()));
                    
                    const matchRole = staffRoleFilter === "all" ||
                      s.role === staffRoleFilter ||
                      (Array.isArray(s.roles) && s.roles.includes(staffRoleFilter));
                    
                    return matchQuery && matchRole;
                  })
                  .map(member => {
                    // Count how many series this user is contributor in
                    const userSeriesCount = seriesList.filter(s => {
                      const cList = Array.isArray(s.contributors) ? s.contributors : [];
                      return cList.some(c => (c.userId === member.id || c.id === member.id || (member.email && c.email === member.email)));
                    }).length;

                    return (
                      <tr key={member.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0 overflow-hidden">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full object-cover" />
                              ) : (
                                (member.displayName || member.email || "U").charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-bold text-white block">
                              {member.displayName || member.email}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 font-mono text-zinc-400 text-[11px]">
                          {member.email || "—"}
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              member.role === 'super_admin' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                              member.role === 'admin' ? 'bg-red-500/10 text-red-300 border-red-500/20' :
                              member.role === 'translator' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              member.role === 'editor' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                              member.role === 'cleaner' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' :
                              'bg-zinc-800 text-zinc-300 border-white/5'
                            }`}>
                              {member.role === 'super_admin' ? 'مدیریت کل' :
                               member.role === 'admin' ? 'مدیر' :
                               member.role === 'translator' ? 'مترجم' :
                               member.role === 'editor' ? 'ادیتور' :
                               member.role === 'cleaner' ? 'کلینر' :
                               member.role === 'staff' ? 'پرسنل' : member.role || 'کاربر'}
                            </span>
                          </div>
                        </td>

                        <td className="p-3 font-mono font-bold text-zinc-300 text-xs">
                          {userSeriesCount > 0 ? (
                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5 text-emerald-400">
                              {userSeriesCount} اثر
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>

                        <td className="p-3 font-mono font-bold text-amber-300 text-xs">
                          {(member.walletBalance || 0).toLocaleString("fa-IR")} تومان
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleInspectContributor(member.id, member.displayName || member.email)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto shadow-sm"
                          >
                            <TrendingUp size={13} />
                            مشاهده رزومه و فیش مالی
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Contributor Monthly Earnings Inspector Modal */}
      {inspectUser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-indigo-500/30 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl dir-rtl max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black shrink-0">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      کارنامه مالی و سود ماهانه: <span className="text-indigo-400">{inspectUser.name}</span>
                    </h3>
                    {inspectUser.role && (
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-md font-bold">
                        {inspectUser.role === 'translator' ? 'مترجم' : inspectUser.role === 'editor' ? 'ادیتور' : inspectUser.role === 'cleaner' ? 'کلینر' : inspectUser.role}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    بررسی تفکیکی درآمد حاصل از فروش چپترها، درصد سهم نقش‌ها و صدور فیش تسویه
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setInspectUser(null);
                  setInspectSearchQuery("");
                }}
                className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
                title="بستن پنجره"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controls Bar: View Mode Switcher + Month Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
              {/* Tab Selector */}
              <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setInspectViewMode("breakdown")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    inspectViewMode === "breakdown"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <BookOpen size={13} />
                  ریز عملکرد و چپترها
                </button>
                <button
                  type="button"
                  onClick={() => setInspectViewMode("slip")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    inspectViewMode === "slip"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <FileText size={13} />
                  فیش و رسید تسویه
                </button>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  <Coins size={13} className="text-amber-400" />
                  دوره:
                </span>
                <select
                  value={inspectMonth}
                  onChange={e => handleInspectMonthChange(e.target.value)}
                  className="bg-zinc-900 border border-white/10 text-xs font-bold text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value={new Date().toISOString().slice(0, 7)}>این ماه (جاری)</option>
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - (idx + 1));
                    const val = d.toISOString().slice(0, 7);
                    return <option key={val} value={val}>ماه {val}</option>;
                  })}
                  <option value="all">کل زمان‌ها (مجموع)</option>
                </select>
                <button
                  onClick={() => handleInspectContributor(inspectUser.id, inspectUser.name)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-colors"
                  title="به‌روزرسانی داده‌ها"
                >
                  <RefreshCw size={13} className={loadingInspect ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Modal Body / Contents */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {loadingInspect ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-9 h-9 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <span className="text-xs text-zinc-400 font-bold">در حال محاسبه و استخراج کارنامه مالی همکار...</span>
                </div>
              ) : inspectData && !inspectData.error ? (
                <>
                  {/* Top KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-right">
                      <span className="text-[11px] font-bold text-emerald-400 block">درآمد و سود خالص همکار</span>
                      <span className="text-xl font-black font-mono text-emerald-300 block mt-1">
                        {(inspectData.totalEarnings || 0).toLocaleString("fa-IR")} <span className="text-xs font-normal">تومان</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-1">قابل تسویه و محاسبه‌شده</span>
                    </div>

                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-right">
                      <span className="text-[11px] font-bold text-indigo-400 block">تعداد کل فروش چپترها</span>
                      <span className="text-xl font-black font-mono text-indigo-300 block mt-1">
                        {(inspectData.totalSalesCount || 0).toLocaleString("fa-IR")} <span className="text-xs font-normal">تراکنش</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-1">در کلیه آثار منتسب</span>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-right">
                      <span className="text-[11px] font-bold text-amber-400 block">تعداد آثار فعال همکار</span>
                      <span className="text-xl font-black font-mono text-amber-300 block mt-1">
                        {(inspectData.seriesBreakdown?.length || 0).toLocaleString("fa-IR")} <span className="text-xs font-normal">اثر</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-1">دارای چپتر درآمدزا</span>
                    </div>
                  </div>

                  {/* VIEW 1: Detailed Breakdown View */}
                  {inspectViewMode === "breakdown" && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <BookOpen size={14} className="text-indigo-400" />
                          جزئیات سهم پرداختی به تفکیک آثار و چپترها:
                        </h4>

                        {inspectData.seriesBreakdown && inspectData.seriesBreakdown.length > 1 && (
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="فیلتر نام اثر یا چپتر..."
                              value={inspectSearchQuery}
                              onChange={e => setInspectSearchQuery(e.target.value)}
                              className="bg-black/50 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 pr-7 w-48"
                            />
                            <Search className="absolute right-2 top-1.5 text-zinc-500 pointer-events-none" size={12} />
                          </div>
                        )}
                      </div>

                      {/* Formula calculation notice */}
                      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 text-[11px] text-zinc-300 flex items-center gap-2">
                        <Calculator size={16} className="text-indigo-400 shrink-0" />
                        <span>
                          <strong>فرمول محاسبه سود همکار:</strong> (تعداد فروش چپتر × ۴۰۰ تومان قیمت پایه) × (درصد سهم نقش ÷ تعداد همکاران منتسب به آن نقش)
                        </span>
                      </div>

                      {inspectData.seriesBreakdown && inspectData.seriesBreakdown.length > 0 ? (
                        inspectData.seriesBreakdown
                          .filter((sb: any) =>
                            !inspectSearchQuery.trim() ||
                            sb.seriesTitle.toLowerCase().includes(inspectSearchQuery.toLowerCase()) ||
                            sb.chapters.some((ch: any) => String(ch.chapterNumber).includes(inspectSearchQuery))
                          )
                          .map((sb: any) => (
                            <div key={sb.seriesId} className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                                <div className="flex items-center gap-3">
                                  {sb.cover ? (
                                    <img src={sb.cover} alt={sb.seriesTitle} className="w-9 h-12 object-cover rounded-md border border-white/10 shadow" />
                                  ) : (
                                    <div className="w-9 h-12 bg-zinc-800 rounded-md border border-white/10 flex items-center justify-center text-zinc-500 text-[10px]">کاور</div>
                                  )}
                                  <div>
                                    <h5 className="text-xs font-black text-white">{sb.seriesTitle}</h5>
                                    <span className="text-[10px] text-zinc-400">تعداد چپترهای درآمدزا: {sb.chapters.length}</span>
                                  </div>
                                </div>
                                <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 font-mono">
                                  سهم کل اثر: {(sb.seriesEarnings || 0).toLocaleString("fa-IR")} تومان
                                </div>
                              </div>

                              {/* Chapters table/list */}
                              <div className="space-y-2">
                                {sb.chapters.map((ch: any) => (
                                  <div key={ch.chapterId} className="bg-zinc-900/80 p-3 rounded-lg border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-2.5">
                                      <span className="bg-indigo-500/20 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                                        چپتر {ch.chapterNumber}
                                      </span>
                                      <span className="text-[11px] text-zinc-400">
                                        فروش: <span className="text-white font-mono">{ch.salesCount}</span> بار ({ch.chapterTotalSales.toLocaleString("fa-IR")} ت)
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      {ch.userRoles.map((ur: any, idx: number) => (
                                        <span key={idx} className="bg-white/5 px-2 py-0.5 rounded border border-white/5 text-[10px] text-zinc-300">
                                          نقش: <strong className="text-indigo-300">{ur.roleName}</strong> ({ur.rolePercentage}٪)
                                          {ur.coWorkersCount > 1 && <span className="text-amber-400 mr-1">(تقسیم بین {ur.coWorkersCount} نفر)</span>}
                                        </span>
                                      ))}
                                      <span className="text-emerald-400 font-mono font-black text-xs mr-auto sm:mr-0 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        +{(ch.chapterUserEarnings || 0).toLocaleString("fa-IR")} تومان
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-8 bg-black/30 rounded-xl border border-white/5 text-xs text-zinc-400 space-y-1">
                          <AlertTriangle size={20} className="mx-auto text-amber-400 mb-2 opacity-60" />
                          <p>هیچ درآمد یا فروش ثبت‌شده‌ای برای این همکار در این بازه زمانی یافت نشد.</p>
                          <p className="text-[11px] text-zinc-500">پس از خرید چپترها توسط کاربران، سود مربوطه به‌صورت خودکار بر اساس درصد نقش‌ها محاسبه خواهد شد.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIEW 2: Printable Pay Slip View */}
                  {inspectViewMode === "slip" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <FileText size={14} className="text-emerald-400" />
                          فیش تسویه حساب و رسید رسمی ماهانه همکار
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopySlip}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              copiedSlip
                                ? "bg-emerald-600 text-white"
                                : "bg-white/10 hover:bg-white/15 text-zinc-200"
                            }`}
                          >
                            {copiedSlip ? <CheckCheck size={13} /> : <Copy size={13} />}
                            {copiedSlip ? "متن فیش کپی شد!" : "کپی متن گزارش برای تلگرام"}
                          </button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <Printer size={13} />
                            چاپ فیش
                          </button>
                        </div>
                      </div>

                      {/* Official Pay Slip Document */}
                      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5 text-right font-sans shadow-lg">
                        {/* Slip Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
                          <div>
                            <span className="text-base font-black text-white flex items-center gap-2">
                              ⚡ مانگاتا / آسورا اسکَن - فیش تسویه مالی همکار
                            </span>
                            <span className="text-[11px] text-zinc-400 block mt-0.5">
                              شناسه سیستم: <span className="font-mono text-zinc-300">{inspectUser.id}</span>
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-bold text-zinc-300 block">
                              دوره مالی: <span className="font-mono text-indigo-300">{inspectMonth === 'all' ? 'کل زمان‌ها' : inspectMonth}</span>
                            </span>
                            <span className="text-[10px] text-zinc-500 block font-mono">
                              تاریخ استخراج: {new Date().toLocaleDateString("fa-IR")}
                            </span>
                          </div>
                        </div>

                        {/* Recipient Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-3.5 rounded-xl border border-white/5 text-xs">
                          <div>
                            <span className="text-zinc-400">نام و نام‌خانوادگی همکار: </span>
                            <strong className="text-white">{inspectUser.name}</strong>
                          </div>
                          {inspectUser.email && (
                            <div>
                              <span className="text-zinc-400">ایمیل ثبت‌شده: </span>
                              <strong className="text-zinc-200 font-mono">{inspectUser.email}</strong>
                            </div>
                          )}
                        </div>

                        {/* Itemized Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-white/10 text-zinc-400 bg-black/50">
                                <th className="p-2.5 font-black">ردیف</th>
                                <th className="p-2.5 font-black">نام اثر</th>
                                <th className="p-2.5 font-black">تعداد چپتر</th>
                                <th className="p-2.5 font-black">مبلغ سهم ناخالص همکار</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {inspectData.seriesBreakdown && inspectData.seriesBreakdown.length > 0 ? (
                                inspectData.seriesBreakdown.map((sb: any, idx: number) => (
                                  <tr key={sb.seriesId} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2.5 font-mono text-zinc-400">{idx + 1}</td>
                                    <td className="p-2.5 font-bold text-white">{sb.seriesTitle}</td>
                                    <td className="p-2.5 font-mono text-zinc-300">{sb.chapters.length} چپتر</td>
                                    <td className="p-2.5 font-mono font-bold text-emerald-400">
                                      {(sb.seriesEarnings || 0).toLocaleString("fa-IR")} تومان
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-zinc-500 italic">
                                    درآمدی در این دوره برای همکار ثبت نشده است.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Grand Total Banner */}
                        <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-300">
                            مجموع کل مبلغ قابل پرداخت به همکار:
                          </span>
                          <span className="text-2xl font-black font-mono text-emerald-400">
                            {(inspectData.totalEarnings || 0).toLocaleString("fa-IR")} <span className="text-xs font-normal">تومان</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-xs text-red-400">
                  {inspectData?.error || "خطا در بارگذاری اطلاعات مالکیتی همکار"}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => {
                  setInspectUser(null);
                  setInspectSearchQuery("");
                }}
                className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-colors"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
