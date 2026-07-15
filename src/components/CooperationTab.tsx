import React, { useState, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import { 
  Users as UsersIcon, 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  UploadCloud, 
  Send, 
  FileText, 
  Image as ImageIcon,
  Check,
  X,
  FileCheck,
  Plus
} from "lucide-react";
import { Series, Chapter } from "../lib/types";

interface CooperationTabProps {
  seriesList: Series[];
  user: any;
  profile: any;
  isSuperAdmin: boolean;
  onUpdateSeries: (updatedSeries: Series) => void;
}

export default function CooperationTab({ 
  seriesList, 
  user, 
  profile, 
  isSuperAdmin,
  onUpdateSeries 
}: CooperationTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"all_series" | "my_projects" | "admin_requests">("all_series");
  const [requestingSeriesId, setRequestingSeriesId] = useState<string | null>(null);
  
  // Request Collaboration form state
  const [reqRole, setReqRole] = useState<"translator" | "cleaner" | "editor">("translator");
  const [reqMelliCode, setReqMelliCode] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  // Chapters of selected series for active work
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  // Submit work form state
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitImages, setSubmitImages] = useState("");
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Admin approval processing state
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);

  // New chapter fast creation inside cooperation
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [newChapterNumber, setNewChapterNumber] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [creatingChapter, setCreatingChapter] = useState(false);

  // Handle active sub-tab for admin vs normal contributor
  useEffect(() => {
    const isGlobalAdmin = isSuperAdmin || profile?.role === "admin";
    if (isGlobalAdmin) {
      setActiveSubTab("admin_requests");
    } else {
      setActiveSubTab("all_series");
    }
  }, [profile, isSuperAdmin]);

  // Load chapters for active work
  const loadChaptersForSeries = async (seriesId: string) => {
    setLoadingChapters(true);
    setSelectedSeriesId(seriesId);
    setExpandedChapterId(null);
    try {
      const res = await apiClient.get(`/api/series/${seriesId}/chapters`);
      setChaptersList(res.data || []);
    } catch (e) {
      console.error("Failed to load chapters:", e);
    } finally {
      setLoadingChapters(false);
    }
  };

  const handleRequestCollaboration = async (seriesId: string) => {
    const code = profile?.melliCode || '';
    if (!code) {
      setReqError("شناسه اختصاصی کاربری شما یافت نشد. لطفا ابتدا آن را در پروفایل دریافت کنید.");
      return;
    }

    setSubmittingReq(true);
    setReqError("");
    setReqSuccess("");

    try {
      const res = await apiClient.post(`/api/series/${seriesId}/request-contributor`, {
        userId: user?.uid,
        email: user?.email,
        displayName: profile?.displayName || user?.email,
        role: reqRole,
        melliCode: code
      });
      onUpdateSeries(res.data);
      setReqSuccess("درخواست همکاری شما با موفقیت ثبت شد و در انتظار تایید مدیریت است.");
      setTimeout(() => {
        setRequestingSeriesId(null);
        setReqMelliCode("");
        setReqSuccess("");
      }, 3000);
    } catch (err: any) {
      setReqError(err.response?.data?.error || "ثبت درخواست با خطا مواجه شد.");
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleApproveContributor = async (seriesId: string, userId: string, action: "approve" | "reject") => {
    setProcessingActionId(`${seriesId}-${userId}`);
    try {
      const res = await apiClient.post(`/api/series/${seriesId}/approve-contributor`, {
        userId,
        action
      });
      onUpdateSeries(res.data);
    } catch (e) {
      console.error("Failed to process contributor:", e);
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleCreatePendingChapter = async () => {
    if (!newChapterNumber.trim() || isNaN(parseFloat(newChapterNumber))) {
      alert("لطفا شماره معتبری برای چپتر وارد کنید.");
      return;
    }
    if (!selectedSeriesId) return;

    setCreatingChapter(true);
    try {
      const chapterId = `ch-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const payload = {
        id: chapterId,
        seriesId: selectedSeriesId,
        number: parseFloat(newChapterNumber),
        title: newChapterTitle.trim(),
        images: [],
        publishAt: null
      };

      const res = await apiClient.post(`/api/series/${selectedSeriesId}/chapters`, payload, {
        headers: {
          'x-admin-uid': user?.uid,
          'x-user-uid': user?.uid
        }
      });
      
      setChaptersList(prev => [res.data, ...prev]);
      setShowCreateChapter(false);
      setNewChapterNumber("");
      setNewChapterTitle("");
      setExpandedChapterId(res.data.id);
    } catch (e: any) {
      alert(e.response?.data?.error || "خطا در ایجاد چپتر");
    } finally {
      setCreatingChapter(false);
    }
  };

  const handleSubmitChapterWork = async (chapter: Chapter) => {
    if (!submitFileUrl.trim() && !submitImages.trim()) {
      setSubmitError("لطفا لینک کار یا تصاویر نهایی را وارد کنید.");
      return;
    }

    setSubmittingWork(true);
    setSubmitError("");
    setSubmitSuccess("");

    // Determine role of active user in this series
    const activeSeries = seriesList.find(s => s.id === chapter.seriesId);
    const userRoleObj = activeSeries?.contributors?.find((c: any) => c.userId === user?.uid && c.status === "approved");
    const role = userRoleObj?.role || "translator";

    let finalImages: string[] = [];
    if (submitImages.trim()) {
      finalImages = submitImages.split(/[\n,]+/).map(img => img.trim()).filter(img => img.length > 0);
    }

    try {
      const res = await apiClient.post(`/api/series/${chapter.seriesId}/chapters/${chapter.id}/submit`, {
        userId: user?.uid,
        userName: profile?.displayName || user?.email,
        role,
        fileUrl: submitFileUrl.trim(),
        note: submitNote.trim(),
        images: finalImages
      });

      // Update chapters local list
      setChaptersList(prev => prev.map(ch => ch.id === chapter.id ? res.data : ch));
      setSubmitSuccess("کار شما با موفقیت ارسال شد و در سابقه این چپتر ثبت گردید.");
      setSubmitFileUrl("");
      setSubmitNote("");
      setSubmitImages("");
      setTimeout(() => setSubmitSuccess(""), 3000);
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || "ارسال کار با خطا مواجه شد.");
    } finally {
      setSubmittingWork(false);
    }
  };

  const handleApproveChapter = async (chapter: Chapter) => {
    if (!confirm(`آیا از انتشار عمومی و تایید نهایی چپتر ${chapter.number} اطمینان دارید؟`)) return;

    try {
      const res = await apiClient.put(`/api/series/${chapter.seriesId}/chapters/${chapter.id}/approve`, {}, {
        headers: {
          'x-admin-uid': user?.uid,
          'x-user-uid': user?.uid
        }
      });
      // update chapter status
      setChaptersList(prev => prev.map(ch => ch.id === chapter.id ? { ...ch, isPending: false } : ch));
      alert("چپتر تایید و با موفقیت روی سایت منتشر گردید.");
    } catch (e) {
      console.error(e);
      alert("خطا در تایید چپتر");
    }
  };

  // Roles translations
  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'translator': return 'مترجم';
      case 'cleaner': return 'کلینر';
      case 'editor': return 'ادیتور';
      case 'typesetter': return 'تایپستر';
      default: return role;
    }
  };

  const isGlobalAdmin = isSuperAdmin || profile?.role === "admin";

  // Filter series where user is approved contributor
  const myProjects = seriesList.filter(s => 
    s.contributors?.some((c: any) => c.userId === user?.uid && c.status === "approved")
  );

  // Gather all pending contributor requests for admin
  const pendingRequests: { series: Series; req: any }[] = [];
  seriesList.forEach(s => {
    s.contributors?.forEach((c: any) => {
      if (c.status === "pending") {
        pendingRequests.push({ series: s, req: c });
      }
    });
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Briefcase className="text-[var(--color-asura-accent)]" /> 
            میز کار کارهای تیمی و همکاری کادر فنی
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            در این بخش، مترجمان، کلینرها و ادیتورها کارهای گروهی وبسایت را دریافت کرده و هماهنگ جلو می‌برند.
          </p>
        </div>
      </div>

      {/* Sub-tabs selection */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
        {isGlobalAdmin && (
          <button
            onClick={() => setActiveSubTab("admin_requests")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors ${activeSubTab === "admin_requests" ? "bg-amber-500 text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <Clock size={15} /> بررسی درخواست‌های عضویت ({pendingRequests.length})
          </button>
        )}
        
        <button
          onClick={() => setActiveSubTab("all_series")}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors ${activeSubTab === "all_series" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
        >
          <UsersIcon size={15} /> کل آثار ساخته شده و درخواست عضویت
        </button>

        <button
          onClick={() => setActiveSubTab("my_projects")}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors ${activeSubTab === "my_projects" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
        >
          <FileCheck size={15} /> کارهای من ({myProjects.length})
        </button>
      </div>

      {/* Contents based on active subtab */}
      {activeSubTab === "admin_requests" && (
        <div className="space-y-4">
          <h3 className="text-sm font-black text-white mb-2">درخواست‌های عضویت تیم فنی در کارهای مختلف</h3>
          {pendingRequests.length === 0 ? (
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-zinc-500 text-xs font-bold">
              هیچ درخواست عضویت در حال انتظاری یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map(({ series, req }, idx) => (
                <div key={`${series.id}-${req.userId}-${idx}`} className="bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex gap-4 transition-all group">
                  <img src={series.cover} alt={series.title} className="w-16 h-24 object-cover rounded-xl shadow-lg shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-black text-white text-sm truncate">{series.title}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-zinc-400 font-bold text-xs">عضو:</span>
                        <span className="text-zinc-200 font-black text-xs">{req.displayName}</span>
                        <span className="text-zinc-500 text-[10px] font-mono">({req.email})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-zinc-400 font-bold text-xs">سمت درخواستی:</span>
                        <span className="bg-[var(--color-asura-accent)]/15 border border-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] font-black text-[10px] px-2 py-0.5 rounded-md">{getRoleLabel(req.role)}</span>
                        {req.melliCode && (
                          <span className="text-zinc-500 font-mono text-[10px] mr-2">کد ملی: {req.melliCode}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => handleApproveContributor(series.id, req.userId, "approve")}
                        disabled={processingActionId !== null}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-black text-[11px] px-4 py-2 rounded-xl transition-all"
                      >
                        {processingActionId === `${series.id}-${req.userId}` ? "در حال پردازش..." : "تایید درخواست"}
                      </button>
                      <button
                        onClick={() => handleApproveContributor(series.id, req.userId, "reject")}
                        disabled={processingActionId !== null}
                        className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold text-[11px] px-4 py-2 rounded-xl transition-all"
                      >
                        رد درخواست
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "all_series" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">لیست تمامی آثار ساخته شده وبسایت</h3>
            <span className="text-xs text-zinc-500 font-bold">{seriesList.length} اثر موجود</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {seriesList.map(s => {
              const myReq = s.contributors?.find((c: any) => c.userId === user?.uid);
              const approvedTeam = s.contributors?.filter((c: any) => c.status === "approved") || [];

              return (
                <div key={s.id} className="bg-black/30 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex gap-4 transition-all duration-300 relative overflow-hidden group">
                  <img src={s.cover} alt={s.title} className="w-20 h-28 object-cover rounded-xl shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300" />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-black text-white text-xs truncate group-hover:text-[var(--color-asura-accent-light)] transition-colors">{s.title}</h4>
                      <p className="text-[10px] text-zinc-500 mt-1 font-bold">نوع: {s.type}</p>
                      
                      <div className="mt-3 flex flex-wrap gap-1">
                        {approvedTeam.length === 0 ? (
                          <span className="text-[10px] text-zinc-600 italic">تیم فنی هنوز عضو این کار نشده است.</span>
                        ) : (
                          approvedTeam.map((c: any, index: number) => (
                            <span key={index} className="bg-white/5 border border-white/5 text-zinc-300 font-medium text-[9px] px-1.5 py-0.5 rounded" title={c.displayName}>
                              {getRoleLabel(c.role)}: {c.displayName.substring(0, 10)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      {myReq ? (
                        myReq.status === "approved" ? (
                          <div className="flex items-center gap-1 text-emerald-400 text-xs font-black">
                            <Check size={14} /> شما عضو تایید شده هستید ({getRoleLabel(myReq.role)})
                          </div>
                        ) : (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black px-3 py-1.5 rounded-xl text-center">
                            در انتظار تایید درخواست ({getRoleLabel(myReq.role)})
                          </div>
                        )
                      ) : (
                        requestingSeriesId === s.id ? (
                          <div className="bg-black/40 border border-white/5 rounded-xl p-3 mt-2 space-y-2 text-right" dir="rtl">
                            <div>
                              <label className="block text-[10px] text-zinc-400 font-bold mb-1">سمت شما در این پروژه:</label>
                              <select
                                value={reqRole}
                                onChange={(e: any) => setReqRole(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/5 text-white rounded-lg p-1.5 text-xs font-black focus:outline-none focus:border-[var(--color-asura-accent)]"
                              >
                                <option value="translator">مترجم (Translator) - ۲۰٪</option>
                                <option value="cleaner">کلینر (Cleaner) - ۳۰٪</option>
                                <option value="editor">ادیتور (Editor) - ۳۰٪</option>
                              </select>
                            </div>
                            <div className="bg-zinc-950 border border-white/5 rounded-lg p-2 text-center">
                              <span className="block text-[10px] text-zinc-400 font-bold mb-1">کد اختصاصی کاربری شما:</span>
                              <strong className="text-xs text-white font-mono tracking-wider">{profile?.melliCode || "ثبت نشده (ابتدا از پروفایل دریافت کنید)"}</strong>
                            </div>

                            {reqError && <p className="text-red-400 text-[10px] font-bold">{reqError}</p>}
                            {reqSuccess && <p className="text-emerald-400 text-[10px] font-black">{reqSuccess}</p>}

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleRequestCollaboration(s.id)}
                                disabled={submittingReq}
                                className="flex-1 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-[10px] py-1.5 rounded-lg transition-colors"
                              >
                                {submittingReq ? "ارسال..." : "ثبت نهایی"}
                              </button>
                              <button
                                onClick={() => setRequestingSeriesId(null)}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] rounded-lg transition-colors"
                              >
                                لغو
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setRequestingSeriesId(s.id);
                              setReqError("");
                              setReqSuccess("");
                            }}
                            className="w-full bg-white/5 border border-white/5 hover:bg-white/10 text-white font-black text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1"
                          >
                            <Plus size={14} /> درخواست عضویت در این کار
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === "my_projects" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Projects sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-black text-white">پروژه‌هایی که عضو تایید شده آن‌ها هستید</h3>
            {myProjects.length === 0 ? (
              <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-zinc-500 text-xs font-bold">
                شما هنوز عضو تایید شده هیچ کار تیمی نشده‌اید. از تب "کل آثار ساخته شده" درخواست عضویت ارسال کنید.
              </div>
            ) : (
              <div className="space-y-3">
                {myProjects.map(s => {
                  const roleObj = s.contributors?.find((c: any) => c.userId === user?.uid && c.status === "approved");
                  const isActive = selectedSeriesId === s.id;

                  return (
                    <button
                      key={s.id}
                      onClick={() => loadChaptersForSeries(s.id)}
                      className={`w-full text-right p-3.5 rounded-2xl border flex items-center gap-4 transition-all duration-300 ${isActive ? 'bg-[var(--color-asura-accent)]/10 border-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/5' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                    >
                      <img src={s.cover} alt={s.title} className="w-10 h-14 object-cover rounded-lg shrink-0 shadow-md" />
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-black text-xs truncate ${isActive ? 'text-[var(--color-asura-accent-light)]' : 'text-zinc-200'}`}>{s.title}</h4>
                        <span className="mt-1 bg-white/5 border border-white/10 text-zinc-400 font-bold text-[9px] px-1.5 py-0.5 rounded inline-block">
                          سمت شما: {getRoleLabel(roleObj?.role || "")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Chapters Workspace */}
          <div className="lg:col-span-8 bg-black/40 border border-white/5 rounded-2xl p-6">
            {!selectedSeriesId ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-500 text-xs font-bold min-h-[300px]">
                <Briefcase size={40} className="text-zinc-600 mb-3 animate-pulse" />
                یک پروژه را از سایدبار سمت راست انتخاب کنید تا لیست چپترها و فرم‌های ارسال کار نمایش داده شوند.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Series Title and New Chapter action */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="font-black text-white text-sm">
                     چپترهای فعال پروژه: <span className="text-[var(--color-asura-accent-light)]">{seriesList.find(s => s.id === selectedSeriesId)?.title}</span>
                  </h3>
                  
                  <button
                    onClick={() => setShowCreateChapter(!showCreateChapter)}
                    className="bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-[11px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} /> ایجاد چپتر جدید
                  </button>
                </div>

                {/* Chapter fast create form */}
                {showCreateChapter && (
                  <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-black text-white">ایجاد چپتر جدید برای همکاری تیمی</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-bold mb-1">شماره چپتر:</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="مثلاً 1 یا 15.5"
                          value={newChapterNumber}
                          onChange={(e) => setNewChapterNumber(e.target.value)}
                          className="w-full bg-black border border-white/5 text-white rounded-lg p-2 text-xs font-black focus:outline-none focus:border-[var(--color-asura-accent)] text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-bold mb-1">عنوان چپتر (اختیاری):</label>
                        <input
                          type="text"
                          placeholder="مثلاً شروع نبرد"
                          value={newChapterTitle}
                          onChange={(e) => setNewChapterTitle(e.target.value)}
                          className="w-full bg-black border border-white/5 text-white rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={handleCreatePendingChapter}
                        disabled={creatingChapter}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-black text-xs px-4 py-2 rounded-xl transition-all"
                      >
                        {creatingChapter ? "در حال ساخت..." : "تایید و ساخت"}
                      </button>
                      <button
                        onClick={() => setShowCreateChapter(false)}
                        className="bg-white/5 hover:bg-white/10 text-zinc-400 text-xs px-4 py-2 rounded-xl transition-all"
                      >
                        لغو
                      </button>
                    </div>
                  </div>
                )}

                {/* Chapters workflow list */}
                {loadingChapters ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-bold">در حال بارگذاری چپترها...</div>
                ) : chaptersList.length === 0 ? (
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center text-zinc-500 text-xs font-bold">
                    هیچ چپتری هنوز ثبت نشده است. اولین چپتر را ایجاد کنید!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chaptersList.map(ch => {
                      const isExpanded = expandedChapterId === ch.id;
                      const hasSubmissions = ch.submissions && ch.submissions.length > 0;
                      
                      // Active role in selected series
                      const activeSeries = seriesList.find(s => s.id === ch.seriesId);
                      const myRoleObj = activeSeries?.contributors?.find((c: any) => c.userId === user?.uid && c.status === "approved");
                      const myRole = myRoleObj?.role || "translator";

                      // Submissions filtered by role
                      const transSubs = ch.submissions?.filter((s: any) => s.role === "translator") || [];
                      const cleanSubs = ch.submissions?.filter((s: any) => s.role === "cleaner" || s.role === "typesetter") || [];
                      const editSubs = ch.submissions?.filter((s: any) => s.role === "editor") || [];

                      return (
                        <div key={ch.id} className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-zinc-950/80 border-[var(--color-asura-accent)]/50' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                          {/* Chapter row header */}
                          <div 
                            onClick={() => setExpandedChapterId(isExpanded ? null : ch.id)}
                            className="p-4 flex items-center justify-between cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-black/40 border border-white/5 rounded-xl flex items-center justify-center shrink-0">
                                <span className="font-black text-white text-sm">{ch.number}</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-xs">{ch.title || `چپتر ${ch.number}`}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {ch.isPending ? (
                                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                                      پرایوت (در انتظار تایید انتشار)
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                                      منتشر شده عمومی
                                    </span>
                                  )}
                                  
                                  <span className="text-[10px] text-zinc-500 font-bold">
                                    تعداد سابمیشن‌ها: {ch.submissions?.length || 0}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Workflow mini indicators */}
                              <div className="hidden sm:flex items-center gap-1.5 ml-4">
                                <span className={`w-2.5 h-2.5 rounded-full ${transSubs.length > 0 ? "bg-emerald-500" : "bg-zinc-800"}`} title="ترجمه" />
                                <span className={`w-2.5 h-2.5 rounded-full ${cleanSubs.length > 0 ? "bg-emerald-500" : "bg-zinc-800"}`} title="کلین" />
                                <span className={`w-2.5 h-2.5 rounded-full ${editSubs.length > 0 ? "bg-emerald-500" : "bg-zinc-800"}`} title="ادیت" />
                              </div>
                              {isExpanded ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                            </div>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="p-4 border-t border-white/5 bg-black/20 space-y-6 text-right">
                              {/* Progress Map / Workflow steps */}
                              <div className="bg-zinc-950 p-4 rounded-xl border border-white/5">
                                <h5 className="text-[11px] font-black text-zinc-400 mb-3 uppercase tracking-wider">نقشه راه و روند چپتر {ch.number}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                                  <div className={`p-2.5 rounded-xl border ${transSubs.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-black/30 border-white/5 text-zinc-500"}`}>
                                    <div className="text-[10px] font-bold">مرحله ۱: ترجمه</div>
                                    <div className="text-[9px] mt-1 font-black">{transSubs.length > 0 ? `ارسال شده توسط ${transSubs[transSubs.length-1].userName}` : "منتظر مترجم"}</div>
                                  </div>
                                  <div className={`p-2.5 rounded-xl border ${cleanSubs.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-black/30 border-white/5 text-zinc-500"}`}>
                                    <div className="text-[10px] font-bold">مرحله ۲: کلین</div>
                                    <div className="text-[9px] mt-1 font-black">{cleanSubs.length > 0 ? `ارسال شده توسط ${cleanSubs[cleanSubs.length-1].userName}` : "منتظر کلینر"}</div>
                                  </div>
                                  <div className={`p-2.5 rounded-xl border ${editSubs.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-black/30 border-white/5 text-zinc-500"}`}>
                                    <div className="text-[10px] font-bold">مرحله ۳: ادیت و تایپ</div>
                                    <div className="text-[9px] mt-1 font-black">{editSubs.length > 0 ? `ارسال شده توسط ${editSubs[editSubs.length-1].userName}` : "منتظر ادیتور"}</div>
                                  </div>
                                  <div className={`p-2.5 rounded-xl border ${!ch.isPending ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-black/30 border-white/5 text-zinc-500"}`}>
                                    <div className="text-[10px] font-bold">مرحله ۴: تایید نهایی</div>
                                    <div className="text-[9px] mt-1 font-black">{!ch.isPending ? "انتشار عمومی" : "منتظر تایید مدیریت"}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Chapter images preview for checking */}
                              {ch.images && ch.images.length > 0 && (
                                <div className="bg-zinc-950 p-4 rounded-xl border border-white/5">
                                  <h5 className="text-[11px] font-black text-zinc-400 mb-2">تصاویر نهایی بارگذاری شده ({ch.images.length} تصویر)</h5>
                                  <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin">
                                    {ch.images.map((imgUrl, i) => (
                                      <div key={i} className="relative w-12 h-16 bg-black rounded border border-white/10 shrink-0 overflow-hidden">
                                        <img src={imgUrl} alt={`p${i}`} className="w-full h-full object-cover" />
                                        <span className="absolute bottom-0 right-0 bg-black/80 text-[8px] font-sans text-white px-1">{i + 1}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Submissions Feed / Workspace history */}
                              <div className="space-y-3">
                                <h5 className="text-xs font-black text-white">سابقه ارسال‌های این چپتر</h5>
                                {!hasSubmissions ? (
                                  <p className="text-[10px] text-zinc-500 italic">هیچ ارسالی تاکنون برای این چپتر ثبت نشده است.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {ch.submissions?.map((sub: any, sIdx: number) => (
                                      <div key={sub.id || sIdx} className="bg-zinc-950 border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-zinc-200">{sub.userName}</span>
                                            <span className="bg-white/5 text-zinc-400 font-bold text-[9px] px-1.5 py-0.5 rounded">{getRoleLabel(sub.role)}</span>
                                            <span className="text-zinc-600 font-mono text-[9px]">{new Date(sub.createdAt).toLocaleDateString('fa-IR')}</span>
                                          </div>
                                          {sub.note && <p className="text-zinc-400 text-xs mt-1 font-medium">{sub.note}</p>}
                                        </div>
                                        {sub.fileUrl && (
                                          <a 
                                            href={sub.fileUrl} 
                                            target="_blank" 
                                            referrerPolicy="no-referrer"
                                            rel="noopener noreferrer" 
                                            className="bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg border border-white/10 flex items-center justify-center gap-1 self-start sm:self-auto"
                                          >
                                            <ExternalLink size={12} /> باز کردن لینک کار
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Submit work Form */}
                              <div className="bg-zinc-950 p-5 rounded-2xl border border-white/5 space-y-4">
                                <h5 className="text-xs font-black text-white flex items-center gap-1">
                                  <Send size={14} className="text-[var(--color-asura-accent)]" /> 
                                  میز ارسال کار به عنوان <span className="text-[var(--color-asura-accent-light)] font-black">{getRoleLabel(myRole)}</span>
                                </h5>

                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-[10px] text-zinc-400 font-bold mb-1">لینک مستقیم فایل کار (گوگل درایو، مگا یا مدیافایر):</label>
                                    <input
                                      type="text"
                                      placeholder="https://drive.google.com/..."
                                      value={submitFileUrl}
                                      onChange={(e) => setSubmitFileUrl(e.target.value)}
                                      className="w-full bg-black border border-white/5 text-white rounded-xl p-2.5 text-xs font-bold text-left focus:outline-none focus:border-[var(--color-asura-accent)]"
                                    />
                                  </div>

                                  {myRole === "editor" && (
                                    <div>
                                      <label className="block text-[10px] text-zinc-400 font-bold mb-1">
                                        تصاویر نهایی چپتر (مخصوص ادیتور - لینک مستقیم تصاویر را با کاما یا خط جدید جدا کنید):
                                      </label>
                                      <textarea
                                        rows={3}
                                        placeholder="https://site.com/img1.jpg&#10;https://site.com/img2.jpg"
                                        value={submitImages}
                                        onChange={(e) => setSubmitImages(e.target.value)}
                                        className="w-full bg-black border border-white/5 text-white rounded-xl p-2.5 text-xs font-bold text-left focus:outline-none focus:border-[var(--color-asura-accent)] font-sans"
                                      />
                                      <span className="text-[9px] text-zinc-500 block mt-1">با بارگذاری و ارسال این لینک‌ها، تصاویر چپتر روی سایت مستقیماً آپدیت خواهند شد (به صورت پرایوت).</span>
                                    </div>
                                  )}

                                  <div>
                                    <label className="block text-[10px] text-zinc-400 font-bold mb-1">توضیحات یا یادداشت برای همکاران و مدیریت:</label>
                                    <textarea
                                      rows={2}
                                      placeholder="مثلاً: ترجمه این چپتر انجام شد. خسته نباشید."
                                      value={submitNote}
                                      onChange={(e) => setSubmitNote(e.target.value)}
                                      className="w-full bg-black border border-white/5 text-white rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                                    />
                                  </div>

                                  {submitError && <p className="text-red-400 text-xs font-bold">{submitError}</p>}
                                  {submitSuccess && <p className="text-emerald-400 text-xs font-black">{submitSuccess}</p>}

                                  <div className="flex gap-2 justify-end pt-2">
                                    <button
                                      onClick={() => handleSubmitChapterWork(ch)}
                                      disabled={submittingWork}
                                      className="bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] disabled:opacity-50 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                                    >
                                      <Send size={13} />
                                      {submittingWork ? "در حال ارسال..." : "ارسال نهایی گزارش کار"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Admin approval panel for pending chapters */}
                              {isGlobalAdmin && ch.isPending && (
                                <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div>
                                    <h5 className="text-xs font-black text-amber-400 flex items-center gap-1">
                                      <AlertCircle size={14} /> تایید و انتشار عمومی این چپتر (مخصوص مدیریت)
                                    </h5>
                                    <p className="text-[10px] text-zinc-400 mt-1">این چپتر توسط کادر فنی آماده شده است. با زدن دکمه زیر، چپتر فوراً عمومی شده و اعلان آن برای کاربران ارسال می‌شود.</p>
                                  </div>
                                  <button
                                    onClick={() => handleApproveChapter(ch)}
                                    className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-5 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-1"
                                  >
                                    <Check size={14} /> تایید و انتشار چپتر
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
