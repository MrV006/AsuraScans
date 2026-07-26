import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  Clock, 
  Activity, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Circle,
  Briefcase,
  Sparkles,
  RefreshCw,
  MessageSquare
} from "lucide-react";
import { apiClient, getSocketInstance } from "../lib/apiClient";

interface StaffMember {
  id: string;
  displayName: string;
  email: string;
  role?: string;
  roles?: string[];
  melliCode?: string;
  workStatus: "available" | "busy" | "leave" | string;
  statusMessage?: string;
  lastActiveAt?: string;
  isOnline: boolean;
}

export default function StaffStatusWidget({ user, profile }: { user: any; profile?: any }) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Self status toggle state
  const [myStatus, setMyStatus] = useState<"available" | "busy" | "leave">("available");
  const [myMessage, setMyMessage] = useState("");
  const [updatingSelf, setUpdatingSelf] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState("");

  const fetchStaff = async () => {
    try {
      const res = await apiClient.get("/api/staff/list");
      if (Array.isArray(res)) {
        setStaffList(res);
        const currentSelf = res.find(s => s.id === user?.uid);
        if (currentSelf) {
          setMyStatus((currentSelf.workStatus as any) || "available");
          setMyMessage(currentSelf.statusMessage || "");
        }
      }
    } catch (e) {
      console.error("Failed to load staff status list:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();

    const socket = getSocketInstance();
    const handleStatusUpdate = () => {
      fetchStaff();
    };

    socket.on("staff:status_updated", handleStatusUpdate);
    return () => {
      socket.off("staff:status_updated", handleStatusUpdate);
    };
  }, [user?.uid]);

  const handleUpdateMyStatus = async (status: "available" | "busy" | "leave") => {
    setMyStatus(status);
    setUpdatingSelf(true);
    setStatusSuccess("");
    try {
      await apiClient.post("/api/user/status", {
        userId: user?.uid,
        workStatus: status,
        statusMessage: myMessage
      }, {
        headers: { 'x-user-uid': user?.uid }
      });
      setStatusSuccess("وضعیت کاری شما با موفقیت بروزرسانی شد.");
      fetchStaff();
      setTimeout(() => setStatusSuccess(""), 3000);
    } catch (e) {
      console.error("Failed to update status:", e);
    } finally {
      setUpdatingSelf(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateMyStatus(myStatus);
  };

  return (
    <div className="space-y-6">
      {/* Self Status Controller */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-400" size={18} />
            <h3 className="text-sm font-black text-white">تنظیم وضعیت آنلاین و آمادگی کاری شما</h3>
          </div>
          <span className="text-[10px] text-zinc-400 font-bold bg-white/5 px-2.5 py-1 rounded-full">
            نمایش زنده به همکاران و ادیتورها
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleUpdateMyStatus("available")}
            className={`p-3.5 rounded-xl border text-xs font-black flex items-center justify-between transition-all ${
              myStatus === "available" 
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10" 
                : "bg-black/30 border-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>آماده دریافت کار (Available)</span>
            </div>
            {myStatus === "available" && <CheckCircle2 size={16} />}
          </button>

          <button
            onClick={() => handleUpdateMyStatus("busy")}
            className={`p-3.5 rounded-xl border text-xs font-black flex items-center justify-between transition-all ${
              myStatus === "busy" 
                ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10" 
                : "bg-black/30 border-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>مشغول به کار (Busy)</span>
            </div>
            {myStatus === "busy" && <CheckCircle2 size={16} />}
          </button>

          <button
            onClick={() => handleUpdateMyStatus("leave")}
            className={`p-3.5 rounded-xl border text-xs font-black flex items-center justify-between transition-all ${
              myStatus === "leave" 
                ? "bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/10" 
                : "bg-black/30 border-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
              <span>مرخصی / در دسترس نیستم</span>
            </div>
            {myStatus === "leave" && <CheckCircle2 size={16} />}
          </button>
        </div>

        <form onSubmit={handleSaveNote} className="flex gap-2">
          <input
            type="text"
            placeholder="یادداشت وضعیت اختیاری (مثلاً: در حال ترجمه چپتر ۱۰ مانهوای سولو لولینگ)..."
            value={myMessage}
            onChange={(e) => setMyMessage(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
          />
          <button
            type="submit"
            disabled={updatingSelf}
            className="px-4 py-2 bg-[var(--color-asura-accent)] hover:opacity-90 text-white rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5"
          >
            {updatingSelf ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
            ذخیره متن
          </button>
        </form>

        {statusSuccess && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 size={14} />
            {statusSuccess}
          </div>
        )}
      </div>

      {/* Staff Directory with Live Online/Offline & Availability Indicators */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="text-[var(--color-asura-accent-light)]" size={18} />
            <h3 className="text-sm font-black text-white">وضعیت زنده و آمادگی کادر تیم ({staffList.length} نفر)</h3>
          </div>
          <button
            onClick={fetchStaff}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-all"
            title="بروزرسانی وضعیت"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-zinc-500 text-xs font-bold">
            در حال دریافت وضعیت اعضای تیم...
          </div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs font-bold">
            هیچ همکاری در حال حاضر ثبت نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {staffList.map((member) => {
              const rolesList = member.roles || [member.role || "user"];
              const formattedRole = rolesList.includes("translator") ? "مترجم" : rolesList.includes("cleaner") ? "کلینر" : rolesList.includes("editor") ? "ادیتور" : "مدیریت/همکار";

              return (
                <div key={member.id} className="p-3.5 bg-black/40 border border-white/5 rounded-xl space-y-2.5 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Online / Offline indicator dot */}
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-white/10 text-white font-black text-xs flex items-center justify-center font-mono">
                          {member.displayName?.substring(0, 2) || "U"}
                        </div>
                        <span 
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${
                            member.isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                          }`}
                          title={member.isOnline ? "آنلاین در سیستم" : "آفلاین"}
                        ></span>
                      </div>

                      <div>
                        <span className="text-xs font-black text-white block">{member.displayName}</span>
                        <span className="text-[10px] text-zinc-400 font-bold block">{formattedRole}</span>
                      </div>
                    </div>

                    {/* Online state text badge */}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      member.isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500"
                    }`}>
                      {member.isOnline ? "آنلاین" : "آفلاین"}
                    </span>
                  </div>

                  {/* Work Availability Status Pill */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                    <span className="text-zinc-500 font-bold">وضعیت کاری:</span>
                    {member.workStatus === "busy" ? (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        مشغول به کار
                      </span>
                    ) : member.workStatus === "leave" ? (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        مرخصی
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        آماده دریافت کار
                      </span>
                    )}
                  </div>

                  {/* Custom status message if set */}
                  {member.statusMessage && (
                    <div className="p-2 bg-white/5 rounded-lg text-[10px] text-zinc-300 font-bold flex items-center gap-1.5">
                      <MessageSquare size={11} className="text-[var(--color-asura-accent-light)] shrink-0" />
                      <span className="truncate">{member.statusMessage}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
