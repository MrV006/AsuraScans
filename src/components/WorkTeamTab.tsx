import React, { useState } from "react";
import { 
  Users, 
  FileText, 
  UploadCloud, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Check, 
  X, 
  MessageSquare, 
  EyeOff, 
  Send, 
  FileUp, 
  Sparkles, 
  RefreshCw,
  FileArchive,
  CheckSquare,
  Square,
  BarChart2,
  UserCheck
} from "lucide-react";
import { Series, Chapter } from "../lib/types";
import { apiClient } from "../lib/apiClient";
import StaffStatusWidget from "./StaffStatusWidget";
import StaffProductivityMetrics from "./StaffProductivityMetrics";

interface WorkTeamTabProps {
  series: Series;
  user: any;
  profile: any;
  isGlobalAdmin: boolean;
  onUpdateSeries: () => void;
}

export default function WorkTeamTab({
  series,
  user,
  profile,
  isGlobalAdmin,
  onUpdateSeries
}: WorkTeamTabProps) {
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<string>("");
  const [chapterTitle, setChapterTitle] = useState<string>("");
  
  // User active role selection for this chapter submission
  const userRoles = profile?.roles || [profile?.role || "user"];
  const defaultRole = userRoles.includes("editor") ? "editor" : userRoles.includes("cleaner") ? "cleaner" : "translator";
  const [activeRole, setActiveRole] = useState<"translator" | "cleaner" | "editor">(defaultRole);

  // Multi-role checkboxes
  const [isAlsoCleaner, setIsAlsoCleaner] = useState(false);
  const [isAlsoEditor, setIsAlsoEditor] = useState(false);
  const [isAlsoTranslator, setIsAlsoTranslator] = useState(false);

  // Form states
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [submitImages, setSubmitImages] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Revision modal state
  const [revisionChapterId, setRevisionChapterId] = useState<string | null>(null);
  const [revisionNoteInput, setRevisionNoteInput] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Bulk action state
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [isBulkRevisionModalOpen, setIsBulkRevisionModalOpen] = useState(false);
  const [bulkRevisionNote, setBulkRevisionNote] = useState("");
  const [processingBulk, setProcessingBulk] = useState(false);

  const approvedContributors = (series.contributors || []).filter((c: any) => c.status === "approved");
  const chaptersList = series.chapters || [];

  // Direct File Upload handler for Word, ZIP, and Image files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    setUploadStatus("در حال بارگذاری فایل روی سرور...");
    setErrorMsg("");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    if (series?.title) {
      formData.append("seriesTitle", series.title);
    }
    if (selectedChapterNumber) {
      formData.append("chapterNumber", selectedChapterNumber);
    }
    formData.append("folderType", "submissions");

    try {
      const res = await apiClient.post("/api/admin/upload", formData, {
        headers: {
          'x-admin-uid': user?.uid,
          'x-user-uid': user?.uid
        }
      });

      if (res && res.urls && res.urls.length > 0) {
        if (activeRole === "translator") {
          setSubmitFileUrl(res.urls[0]);
          setUploadStatus(`فایل ورد ترجمه با موفقیت بارگذاری شد: ${res.urls[0]}`);
        } else if (activeRole === "cleaner") {
          setSubmitFileUrl(res.urls[0]);
          setUploadStatus(`فایل کلین با موفقیت بارگذاری شد: ${res.urls[0]}`);
        } else if (activeRole === "editor") {
          const newUrls = res.urls;
          const currentArr = submitImages.trim() ? submitImages.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [];
          const combined = [...currentArr, ...newUrls];
          setSubmitImages(combined.join("\n"));
          setSubmitFileUrl(res.urls[0]);
          setUploadStatus(`${newUrls.length} فایل/تصویر نهایی بارگذاری گردید.`);
        }
      }
    } catch (e: any) {
      setErrorMsg("بارگذاری فایل با خطا مواجه شد.");
    } finally {
      setUploadingFile(false);
    }
  };

  // Submit chapter work
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapterNumber) {
      setErrorMsg("لطفا شماره چپتر را مشخص کنید.");
      return;
    }

    if (!submitFileUrl.trim() && !submitImages.trim() && !isAlsoCleaner && !isAlsoEditor) {
      setErrorMsg("لطفا فایل موردنظر را بارگذاری یا لینک آن را وارد کنید.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Check if chapter already exists, or create a new chapter ID
      const chapNum = parseFloat(selectedChapterNumber);
      const existingChap = chaptersList.find((c: Chapter) => c.number === chapNum);
      const chapterId = existingChap ? existingChap.id : `ch-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      // If creating new chapter, register it first
      if (!existingChap) {
        await apiClient.post(`/api/series/${series.id}/chapters`, {
          id: chapterId,
          seriesId: series.id,
          number: chapNum,
          title: chapterTitle.trim(),
          images: [],
          isPending: true
        });
      }

      let finalImages: string[] = [];
      if (submitImages.trim()) {
        finalImages = submitImages.split(/[\n,]+/).map(i => i.trim()).filter(Boolean);
      }

      // Compose submission note with multi-role info
      let combinedNote = submitNote.trim();
      const multiRoles: string[] = [];
      if (isAlsoTranslator) multiRoles.push("مترجم همزمان");
      if (isAlsoCleaner) multiRoles.push("کلینر همزمان");
      if (isAlsoEditor) multiRoles.push("ادیتور همزمان");

      if (multiRoles.length > 0) {
        combinedNote = `[نقش‌های همزمان: ${multiRoles.join(" - ")}] ${combinedNote}`;
      }

      await apiClient.post(`/api/series/${series.id}/chapters/${chapterId}/submit`, {
        userId: user?.uid,
        userName: profile?.displayName || user?.email || "همکار",
        role: activeRole,
        fileUrl: submitFileUrl.trim(),
        note: combinedNote,
        images: finalImages
      });

      setSuccessMsg(`کار چپتر ${chapNum} با موفقیت ثبت شد و به همکاران اطلاع‌رسانی گردید.`);
      setSubmitFileUrl("");
      setSubmitImages("");
      setSubmitNote("");
      setSelectedChapterNumber("");
      setChapterTitle("");
      onUpdateSeries();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || "خطا در ثبت کار.");
    } finally {
      setSubmitting(false);
    }
  };

  // Chapter Review Actions (Admin)
  const handleApprove = async (chapterId: string, chapNum: number) => {
    if (!confirm(`آیا از انتشار عمومی و تایید نهایی چپتر ${chapNum} روی سایت اطمینان دارید؟`)) return;
    try {
      await apiClient.put(`/api/series/${series.id}/chapters/${chapterId}/approve`, {}, {
        headers: { 'x-admin-uid': user?.uid, 'x-user-uid': user?.uid }
      });
      alert(`چپتر ${chapNum} تایید شد و روی سایت قرار گرفت.`);
      onUpdateSeries();
    } catch (e) {
      alert("خطا در تایید چپتر");
    }
  };

  const handlePrivate = async (chapterId: string, chapNum: number) => {
    try {
      await apiClient.put(`/api/series/${series.id}/chapters/${chapterId}/private`, {}, {
        headers: { 'x-admin-uid': user?.uid, 'x-user-uid': user?.uid }
      });
      alert(`چپتر ${chapNum} در حالت پرایوت (پیش‌نویس) باقی ماند.`);
      onUpdateSeries();
    } catch (e) {
      alert("خطا در تغییر وضعیت به پرایوت");
    }
  };

  const handleSendRevision = async () => {
    if (!revisionChapterId || !revisionNoteInput.trim()) return;
    setSubmittingRevision(true);
    try {
      await apiClient.post(`/api/series/${series.id}/chapters/${revisionChapterId}/revision`, {
        note: revisionNoteInput.trim()
      }, {
        headers: { 'x-admin-uid': user?.uid, 'x-user-uid': user?.uid }
      });
      alert("پیام تصحیح برای ادیتور و کادر تولید ارسال گردید.");
      setRevisionChapterId(null);
      setRevisionNoteInput("");
      onUpdateSeries();
    } catch (e) {
      alert("خطا در ثبت پیام تصحیح");
    } finally {
      setSubmittingRevision(false);
    }
  };

  const pendingChapters = chaptersList.filter((ch: Chapter) => ch.isPending || ch.status === "needs_revision");

  // Bulk selection handlers
  const handleToggleSelectChapter = (id: string) => {
    setSelectedChapterIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPending = () => {
    if (selectedChapterIds.length === pendingChapters.length) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(pendingChapters.map((c: Chapter) => c.id));
    }
  };

  const handleExecuteBulkAction = async (action: 'approve' | 'private' | 'revision', customNote?: string) => {
    if (selectedChapterIds.length === 0) return;
    if (action === 'approve' && !confirm(`آیا از تایید نهایی و انتشار عمومی ${selectedChapterIds.length} چپتر انتخاب‌شده اطمینان دارید؟`)) {
      return;
    }

    setProcessingBulk(true);
    try {
      await apiClient.post(`/api/series/${series.id}/chapters/bulk-action`, {
        chapterIds: selectedChapterIds,
        action,
        revisionNote: customNote || bulkRevisionNote
      }, {
        headers: { 'x-admin-uid': user?.uid, 'x-user-uid': user?.uid }
      });

      alert(`عملیات گروهی با موفقیت روی ${selectedChapterIds.length} چپتر اعمال شد.`);
      setSelectedChapterIds([]);
      setIsBulkRevisionModalOpen(false);
      setBulkRevisionNote("");
      onUpdateSeries();
    } catch (e: any) {
      alert("خطا در اجرای عملیات دسته جمعی.");
    } finally {
      setProcessingBulk(false);
    }
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-black p-6 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-48 h-48 bg-[var(--color-asura-accent)]/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase text-[var(--color-asura-accent-light)] bg-white/5 px-2.5 py-1 rounded-full border border-white/5 inline-block mb-2">
              فضای اختصاصی دست‌اندرکاران
            </span>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Users className="text-[var(--color-asura-accent)]" size={20} />
              پنل همکاران و گردش‌کار تولید چپترها
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              ثبت و بارگذاری فایل‌های ترجمه (Word)، کلین (ZIP) و ادیت نهایی چپترهای {series.title}
            </p>
          </div>
          <button 
            onClick={onUpdateSeries}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            بروزرسانی داده‌ها
          </button>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-lg">
        <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
          <Sparkles className="text-amber-400" size={16} />
          اعضای تیم فعال در پروژه ({approvedContributors.length} نفر)
        </h3>
        {approvedContributors.length === 0 ? (
          <p className="text-xs text-zinc-500">هنوز عضو تاییدشده‌ای برای این اثر ثبت نشده است.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {approvedContributors.map((c: any) => (
              <div key={c.userId} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-white block">{c.displayName}</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 font-bold">
                    {c.role === "translator" ? "مترجم رسمی" : c.role === "cleaner" ? "کلینر" : c.role === "editor" ? "ادیتور و تایپیست" : c.role}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded">
                  {c.melliCode || "عضو تیم"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chapter Work Submission Form */}
      <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <UploadCloud className="text-[var(--color-asura-accent)]" size={18} />
            ارسال فایل کار چپتر جدید یا موجود
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            توجه: فایل‌های ترجمه (Word) و کلین صرفاً جهت اطلاع و استفاده ادیتور قرار می‌گیرند و روی سایت عمومی منتشر نمی‌شوند.
          </p>
        </div>

        <form onSubmit={handleSubmitWork} className="space-y-5">
          {/* Chapter Selector & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-zinc-300 mb-2">شماره چپتر *</label>
              <input 
                type="number"
                step="any"
                required
                placeholder="مثلا: 10 یا 10.5"
                value={selectedChapterNumber}
                onChange={(e) => setSelectedChapterNumber(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-zinc-300 mb-2">عنوان چپتر (اختیاری)</label>
              <input 
                type="text"
                placeholder="مثلا: آغاز نبرد شیاطین"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
              />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs font-black text-zinc-300 mb-2">نقش شما در این ارسال *</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setActiveRole("translator")}
                className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${activeRole === "translator" ? "bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)]" : "bg-black/30 text-zinc-400 border-white/5 hover:text-white"}`}
              >
                <FileText size={16} />
                مترجم (فایل Word)
              </button>
              <button
                type="button"
                onClick={() => setActiveRole("cleaner")}
                className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${activeRole === "cleaner" ? "bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)]" : "bg-black/30 text-zinc-400 border-white/5 hover:text-white"}`}
              >
                <FileArchive size={16} />
                کلینر (فایل Clean)
              </button>
              <button
                type="button"
                onClick={() => setActiveRole("editor")}
                className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${activeRole === "editor" ? "bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)]" : "bg-black/30 text-zinc-400 border-white/5 hover:text-white"}`}
              >
                <Sparkles size={16} />
                ادیتور / تایپیست
              </button>
            </div>
          </div>

          {/* Multi-role checkboxes */}
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
            <span className="block text-xs font-black text-amber-400 mb-1">
              ثبت چند نقشی همزمان (ویژه افرادی که چند مسئولیت دارند):
            </span>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-zinc-300">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input 
                  type="checkbox" 
                  checked={isAlsoCleaner} 
                  onChange={(e) => setIsAlsoCleaner(e.target.checked)}
                  className="rounded border-white/20 bg-black/50 text-[var(--color-asura-accent)] focus:ring-0"
                />
                من کلینر این چپتر هم هستم (عدم نیاز به آپلود مجدد کلین)
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input 
                  type="checkbox" 
                  checked={isAlsoEditor} 
                  onChange={(e) => setIsAlsoEditor(e.target.checked)}
                  className="rounded border-white/20 bg-black/50 text-[var(--color-asura-accent)] focus:ring-0"
                />
                من ادیتور این چپتر هم هستم
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input 
                  type="checkbox" 
                  checked={isAlsoTranslator} 
                  onChange={(e) => setIsAlsoTranslator(e.target.checked)}
                  className="rounded border-white/20 bg-black/50 text-[var(--color-asura-accent)] focus:ring-0"
                />
                من مترجم این چپتر هم هستم
              </label>
            </div>
          </div>

          {/* Upload File Input */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-zinc-300">
              {activeRole === "translator" ? "بارگذاری فایل ترجمه (.doc, .docx, .txt)" : activeRole === "cleaner" ? "بارگذاری فایل کلین (.zip, .rar یا تصاویر)" : "بارگذاری فایل ادیت نهایی (.zip یا لینک تصاویر)"}
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 bg-black/40 hover:bg-black/60 border border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                <FileUp className="text-[var(--color-asura-accent-light)] mb-1" size={20} />
                <span className="text-xs font-bold text-zinc-300">انتخاب و بارگذاری مستقیم فایل از کامپیوتر</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">پشتیبانی از فایل‌های Word، ZIP و تصاویر</span>
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {uploadingFile && (
              <div className="text-xs text-amber-400 font-bold animate-pulse flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                {uploadStatus}
              </div>
            )}

            {submitFileUrl && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-mono text-emerald-400 truncate">
                آدرس فایل ثبت شده: {submitFileUrl}
              </div>
            )}
          </div>

          {/* Images text area for Editor */}
          {activeRole === "editor" && (
            <div>
              <label className="block text-xs font-black text-zinc-300 mb-2">لینک مستقیم صفحات ادیت شده (هر لینک در یک سطر)</label>
              <textarea 
                rows={3}
                placeholder="https://.../page1.jpg&#10;https://.../page2.jpg"
                value={submitImages}
                onChange={(e) => setSubmitImages(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[var(--color-asura-accent)]"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-zinc-300 mb-2">یادداشت یا توضیحات برای کادر تولید (اختیاری)</label>
            <input 
              type="text"
              placeholder="مثلا: فونت صفحات ۵ تا ۸ تغییر کرده است."
              value={submitNote}
              onChange={(e) => setSubmitNote(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
            />
          </div>

          {/* Error / Success messages */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle size={15} />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle size={15} />
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[var(--color-asura-accent)] to-[#ff843a] hover:opacity-90 active:scale-98 text-white py-3 rounded-xl font-black text-xs transition-all shadow-lg shadow-[var(--color-asura-accent)]/20 flex items-center justify-center gap-2"
          >
            {submitting ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
            ثبت و ارسال فایل برای همکاران
          </button>
        </form>
      </div>

      {/* STAFF ONLINE / AVAILABILITY STATUS WIDGET */}
      <StaffStatusWidget user={user} profile={profile} />

      {/* ADMIN REVIEW TAB (ویژه مدیریت کل و بررسی چپترها + سیستم عملیات دسته جمعی) */}
      {(isGlobalAdmin || userRoles.includes("super_admin") || userRoles.includes("admin")) && (
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-white/5 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <CheckCircle className="text-emerald-400" size={18} />
                صف تایید و بررسی چپترها (مدیریت کل)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                چپترهایی که توسط ادیتور ارسال شده‌اند و نیازمند انتشار عمومی، پرایوت ماندن یا بازبینی مجدد هستند.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {pendingChapters.length > 0 && (
                <button
                  onClick={handleSelectAllPending}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-all"
                >
                  {selectedChapterIds.length === pendingChapters.length ? <CheckSquare size={14} className="text-[var(--color-asura-accent-light)]" /> : <Square size={14} />}
                  {selectedChapterIds.length === pendingChapters.length ? "لغو انتخاب همه" : `انتخاب همه (${pendingChapters.length})`}
                </button>
              )}
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black px-3 py-1 rounded-full">
                {pendingChapters.length} چپتر در انتظار
              </span>
            </div>
          </div>

          {/* BULK ACTION BAR (ظاهر می‌شود هنگامی که حداقل یک چپتر انتخاب شده باشد) */}
          {selectedChapterIds.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-[var(--color-asura-accent)]/20 via-black to-zinc-900 border border-[var(--color-asura-accent)]/40 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckSquare size={18} className="text-[var(--color-asura-accent-light)]" />
                <span className="text-xs font-black text-white">
                  {selectedChapterIds.length} چپتر انتخاب گردیده است
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleExecuteBulkAction('approve')}
                  disabled={processingBulk}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <Check size={14} />
                  تایید و انتشار دسته جمعی ({selectedChapterIds.length})
                </button>

                <button
                  onClick={() => handleExecuteBulkAction('private')}
                  disabled={processingBulk}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all border border-white/10 flex items-center gap-1.5"
                >
                  <EyeOff size={14} />
                  پرایوت دسته جمعی ({selectedChapterIds.length})
                </button>

                <button
                  onClick={() => {
                    setIsBulkRevisionModalOpen(true);
                    setBulkRevisionNote("");
                  }}
                  disabled={processingBulk}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-red-500/20 flex items-center gap-1.5"
                >
                  <MessageSquare size={14} />
                  ارسال دسته جمعی جهت تصحیح ({selectedChapterIds.length})
                </button>
              </div>
            </div>
          )}

          {pendingChapters.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs font-bold">
              هیچ چپتری در حال حاضر در انتظار تایید یا تصحیح نیست.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingChapters.map((ch: Chapter) => {
                const isSelected = selectedChapterIds.includes(ch.id);

                return (
                  <div 
                    key={ch.id} 
                    className={`bg-black/40 border rounded-2xl p-5 space-y-4 transition-all ${
                      isSelected ? "border-[var(--color-asura-accent)] ring-1 ring-[var(--color-asura-accent)]/50" : "border-white/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        {/* Checkbox for Bulk Actions */}
                        <button
                          onClick={() => handleToggleSelectChapter(ch.id)}
                          className={`p-1 rounded-lg transition-colors ${
                            isSelected ? "text-[var(--color-asura-accent-light)]" : "text-zinc-500 hover:text-white"
                          }`}
                          title="انتخاب جهت عملیات دسته جمعی"
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>

                        <div>
                          <span className="text-sm font-black text-white">
                            چپتر {ch.number} {ch.title ? `- ${ch.title}` : ""}
                          </span>
                          {ch.status === "needs_revision" ? (
                            <span className="mr-3 bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                              نیازمند تصحیح
                            </span>
                          ) : (
                            <span className="mr-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                              در انتظار تایید انتشار
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] text-zinc-500 font-mono">
                        تعداد تصاویر: {ch.images ? ch.images.length : 0}
                      </span>
                    </div>

                    {/* Submission logs/files */}
                    {Array.isArray(ch.submissions) && ch.submissions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-black text-zinc-400 block">سابقه فایل‌های دریافتی:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ch.submissions.map((sub: any, idx: number) => (
                            <div key={sub.id || idx} className="p-2.5 bg-white/5 rounded-xl text-xs border border-white/5 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-zinc-200 block">
                                  {sub.role === "translator" ? "فایل ترجمه" : sub.role === "cleaner" ? "فایل کلین" : "فایل ادیت"} (توسط {sub.userName})
                                </span>
                                {sub.note && <span className="text-[10px] text-zinc-400 block mt-0.5">{sub.note}</span>}
                              </div>
                              {sub.fileUrl && (
                                <a 
                                  href={sub.fileUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-[var(--color-asura-accent)]/20 hover:bg-[var(--color-asura-accent)] text-[var(--color-asura-accent-light)] hover:text-white rounded-lg text-[10px] font-bold transition-all shrink-0"
                                >
                                  دریافت فایل
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Revision note if any */}
                    {ch.revisionNote && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold">
                        علت ارجاع جهت تصحیح: {ch.revisionNote}
                      </div>
                    )}

                    {/* Action Controls for Admin */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleApprove(ch.id, ch.number)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        تایید و انتشار عمومی روی سایت
                      </button>

                      <button
                        onClick={() => handlePrivate(ch.id, ch.number)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all border border-white/10 flex items-center gap-1.5"
                      >
                        <EyeOff size={14} />
                        پرایوت بماند
                      </button>

                      <button
                        onClick={() => {
                          setRevisionChapterId(ch.id);
                          setRevisionNoteInput("");
                        }}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-red-500/20 flex items-center gap-1.5"
                      >
                        <MessageSquare size={14} />
                        نیازمند تصحیح
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STAFF PRODUCTIVITY METRICS (RECHARTS VISUALIZATION) */}
      <StaffProductivityMetrics user={user} />

      {/* BULK REVISION MODAL */}
      {isBulkRevisionModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] max-w-lg w-full rounded-2xl p-6 text-right space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <AlertCircle className="text-red-400" size={18} />
              ارجاع دسته جمعی جهت تصحیح ({selectedChapterIds.length} چپتر)
            </h3>
            <p className="text-xs text-zinc-400">
              پیام ایراد به صورت همزمان برای ادیتورها و دست‌اندرکاران تمامی چپترهای انتخاب‌شده صادر و نوتیفیکیشن همزمان ارسال می‌شود.
            </p>
            <textarea
              rows={4}
              placeholder="پیام یا توضیحات مشترک جهت تصحیح چپترهای انتخاب‌شده..."
              value={bulkRevisionNote}
              onChange={(e) => setBulkRevisionNote(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsBulkRevisionModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl"
              >
                انصراف
              </button>
              <button
                onClick={() => handleExecuteBulkAction('revision')}
                disabled={processingBulk}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-lg"
              >
                ارسال دسته جمعی تصحیح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVISION NOTE MODAL */}
      {revisionChapterId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] max-w-lg w-full rounded-2xl p-6 text-right space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <AlertCircle className="text-red-400" size={18} />
              ثبت توضیحات و ایرادات جهت تصحیح
            </h3>
            <p className="text-xs text-zinc-400">
              این پیام مستقیماً برای ادیتور و دست‌اندرکاران این چپتر ارسال شده و نوتیفیکیشن همزمان صادر خواهد گردید.
            </p>
            <textarea
              rows={4}
              placeholder="مثلا: تایپوی صفحه ۴ را اصلاح کنید و فونت دیالوگ‌ها را ۱ سایز بزرگتر نمایید."
              value={revisionNoteInput}
              onChange={(e) => setRevisionNoteInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRevisionChapterId(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl"
              >
                انصراف
              </button>
              <button
                onClick={handleSendRevision}
                disabled={submittingRevision}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-lg"
              >
                ارسال پیام تصحیح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
