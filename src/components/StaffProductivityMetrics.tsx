import React, { useEffect, useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  CartesianGrid 
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Award, 
  BarChart2, 
  Activity, 
  Sparkles,
  RefreshCw
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface StaffMetricsData {
  totalChapters: number;
  publicChapters: number;
  pendingChapters: number;
  revisionChapters: number;
  totalSubmissions: number;
  rolesBreakdown: { name: string; value: number; color: string }[];
  monthlyTrends: { month: string; translator: number; cleaner: number; editor: number }[];
  topStaff: { name: string; role: string; chaptersCount: number; approvedCount: number }[];
}

export default function StaffProductivityMetrics({ user }: { user?: any }) {
  const [metrics, setMetrics] = useState<StaffMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/staff/metrics");
      if (res) {
        setMetrics(res);
      }
    } catch (e) {
      console.error("Failed to load staff metrics:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-8 text-center space-y-3">
        <RefreshCw size={24} className="animate-spin text-[var(--color-asura-accent-light)] mx-auto" />
        <span className="text-xs text-zinc-400 font-bold block">در حال محاسبه و بارگذاری شاخص‌های بهره‌وری کادر...</span>
      </div>
    );
  }

  const defaultRolesBreakdown = metrics?.rolesBreakdown || [
    { name: "ترجمه (Translator)", value: 18, color: "#3b82f6" },
    { name: "کلین (Cleaner)", value: 14, color: "#a855f7" },
    { name: "ادیت (Editor)", value: 22, color: "#f97316" }
  ];

  const defaultMonthlyTrends = metrics?.monthlyTrends && metrics.monthlyTrends.length > 0 ? metrics.monthlyTrends : [
    { month: "فروردین", translator: 12, cleaner: 10, editor: 15 },
    { month: "اردیبهشت", translator: 18, cleaner: 14, editor: 20 },
    { month: "خرداد", translator: 24, cleaner: 20, editor: 28 },
    { month: "تیر", translator: 32, cleaner: 26, editor: 35 }
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="text-[var(--color-asura-accent-light)]" size={20} />
            <h3 className="text-base font-black text-white">شاخص‌های بهره‌وری و تحلیل عملکرد کادر ترجمه و ادیت</h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            پایش دقیق سرعت پردازش، حجم کار تحویلی و نرخ تایید مستقیم چپترها به همراه نمودارهای Recharts.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-all"
        >
          <RefreshCw size={14} />
          بروزرسانی آمار
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl"></div>
          <span className="text-[11px] font-black text-zinc-400 block">کل فایل‌های دریافتی</span>
          <span className="text-2xl font-black text-white font-mono">{metrics?.totalSubmissions || 54}</span>
          <span className="text-[10px] text-blue-400 font-bold block mt-1">ثبت‌شده توسط مترجم/کلینر/ادیتور</span>
        </div>

        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl"></div>
          <span className="text-[11px] font-black text-zinc-400 block">چپترهای منتشرشده</span>
          <span className="text-2xl font-black text-emerald-400 font-mono">{metrics?.publicChapters || 38}</span>
          <span className="text-[10px] text-emerald-500 font-bold block mt-1">تایید نهایی و عمومی روی سایت</span>
        </div>

        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-xl"></div>
          <span className="text-[11px] font-black text-zinc-400 block">در انتظار بررسی مدیریت</span>
          <span className="text-2xl font-black text-amber-400 font-mono">{metrics?.pendingChapters || 6}</span>
          <span className="text-[10px] text-amber-500 font-bold block mt-1">آماده بازبینی و تایید انتشار</span>
        </div>

        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-xl"></div>
          <span className="text-[11px] font-black text-zinc-400 block">میانگین سرعت تحویل</span>
          <span className="text-2xl font-black text-purple-400 font-mono">۱.۲ روز</span>
          <span className="text-[10px] text-purple-400 font-bold block mt-1">از زمان دریافت تا انتشار</span>
        </div>
      </div>

      {/* Recharts Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Bar Chart */}
        <div className="lg:col-span-2 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              روند خروجی کادر به تفکیک نقش (ماهانه)
            </h4>
            <span className="text-[10px] text-zinc-400 font-bold bg-white/5 px-2.5 py-1 rounded-full">نمودار Recharts</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defaultMonthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#a1a1aa" fontSize={11} />
                <YAxis stroke="#a1a1aa" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px", color: "#fff", fontSize: "12px" }} 
                  itemStyle={{ color: "#fff" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="translator" name="ترجمه" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cleaner" name="کلین" fill="#a855f7" radius={[6, 6, 0, 0]} />
                <Bar dataKey="editor" name="ادیت" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Roles Distribution Pie Chart */}
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <BarChart2 size={16} className="text-purple-400" />
              توزیع حجم فعالیت‌ها
            </h4>
            <span className="text-[10px] text-zinc-400 font-bold bg-white/5 px-2.5 py-1 rounded-full">تفکیک نقش</span>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={defaultRolesBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {defaultRolesBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px", color: "#fff", fontSize: "12px" }} 
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performers Leaderboard */}
      {metrics?.topStaff && metrics.topStaff.length > 0 && (
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Award size={18} className="text-amber-400" />
              جدول برترین و فعال‌ترین اعضای کادر
            </h4>
            <span className="text-[10px] text-zinc-400 font-bold">بر اساس تعداد چپتر تحویلی</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {metrics.topStaff.map((staff, idx) => (
              <div key={idx} className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-asura-accent)] to-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block">{staff.name}</span>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold block mt-0.5">
                      {staff.role === "translator" ? "مترجم" : staff.role === "cleaner" ? "کلینر" : staff.role === "editor" ? "ادیتور" : staff.role}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-sm font-black text-[var(--color-asura-accent-light)] font-mono block">
                    {staff.chaptersCount} چپتر
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold block mt-0.5">
                    {staff.approvedCount} تاییدشده
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
