import React, { useState, useEffect, useMemo } from "react";
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
  Plus,
  Sparkles,
  Search,
  Lock,
  Download,
  Filter,
  Shield,
  Trash2,
  Edit,
  DollarSign,
  UserPlus,
  RefreshCw,
  FileCheck
} from "lucide-react";
import { Series, Chapter } from "../lib/types";

interface CooperationTabProps {
  seriesList: Series[];
  user: any;
  profile: any;
  isSuperAdmin: boolean;
  onUpdateSeries: (updatedSeries: Series) => void;
  defaultSubTab?: "all_series" | "my_projects" | "settlements" | "admin_requests" | "admin_approval";
}

export default function CooperationTab({ 
  seriesList, 
  user, 
  profile, 
  isSuperAdmin,
  onUpdateSeries,
  defaultSubTab
}: CooperationTabProps) {
  const isGlobalAdmin = isSuperAdmin || profile?.role === "admin";

  const [activeSubTab, setActiveSubTab] = useState<"all_series" | "my_projects" | "settlements" | "admin_requests" | "admin_approval">(
    defaultSubTab || (isGlobalAdmin ? "admin_requests" : "all_series")
  );

  // Settlements state
  const [settlementRequests, setSettlementRequests] = useState<any[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [userWalletBalance, setUserWalletBalance] = useState<number>(profile?.walletBalance || 0);
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCardOrSheba, setSettleCardOrSheba] = useState("");
  const [settleAccountHolder, setSettleAccountHolder] = useState(profile?.displayName || "");
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [settleError, setSettleError] = useState("");
  const [settleSuccess, setSettleSuccess] = useState("");
  const [settleFilterStatus, setSettleFilterStatus] = useState<string>("all");
  const [settleRejectNoteMap, setSettleRejectNoteMap] = useState<Record<string, string>>({});

  // Search and filter for Catalog (Search Page format)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Selected series for catalog popup/drawer
  const [activeCatalogSeries, setActiveCatalogSeries] = useState<Series | null>(null);

  // Request Collaboration form state inside catalog modal
  const [reqRole, setReqRole] = useState<"translator" | "cleaner" | "editor" | "typesetter" | "proofreader">("translator");
  const [reqMelliCode, setReqMelliCode] = useState(profile?.melliCode || "");
  const [reqNotes, setReqNotes] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  // Active series in "My Projects" or "Admin Management"
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  // Submit Chapter Work state
  const [submitChapterNumber, setSubmitChapterNumber] = useState("");
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitImages, setSubmitImages] = useState("");
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Direct File Upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // Admin action processing state
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [rejectionNoteMap, setRejectionNoteMap] = useState<Record<string, string>>({});

  // Fast chapter creation in My Works
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [newChapterNumber, setNewChapterNumber] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [creatingChapter, setCreatingChapter] = useState(false);

  // Admin Add Staff Modal inside series
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [addStaffDisplayName, setAddStaffDisplayName] = useState("");
  const [addStaffEmail, setAddStaffEmail] = useState("");
  const [addStaffRole, setAddStaffRole] = useState("translator");
  const [addStaffUserId, setAddStaffUserId] = useState("");
  const [addStaffMelli, setAddStaffMelli] = useState("");

  // Chapter Contributor Attribution Editing Modal (Admin)
  const [editingChapterContribId, setEditingChapterContribId] = useState<string | null>(null);
  const [chapterContribMap, setChapterContribMap] = useState<Record<string, string>>({
    translator: "",
    cleaner: "",
    editor: ""
  });

  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const res = await apiClient.getSettlementRequests(isGlobalAdmin ? undefined : user?.uid);
      if (Array.isArray(res)) {
        setSettlementRequests(res);
      }
      if (user?.uid) {
        const u = await apiClient.get(`/api/users/${user.uid}`);
        if (u && typeof u.walletBalance === 'number') {
          setUserWalletBalance(u.walletBalance);
        }
      }
    } catch (e) {
      console.error("Failed to load settlements:", e);
    } finally {
      setLoadingSettlements(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [user?.uid, isGlobalAdmin]);

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError("");
    setSettleSuccess("");

    const amt = Number(settleAmount);
    if (!amt || amt < 10000) {
      setSettleError("حداقل مبلغ جهت درخواست تسویه 10,000 تومان می‌باشد.");
      return;
    }
    if (amt > userWalletBalance) {
      setSettleError(`مبلغ درخواستی (${amt.toLocaleString()} تومان) از موجودی کیف پول شما بیشتر است.`);
      return;
    }
    if (!settleCardOrSheba.trim() || !settleAccountHolder.trim()) {
      setSettleError("لطفا شماره کارت/شبا و نام صاحب حساب را وارد نمایید.");
      return;
    }

    setSettleSubmitting(true);
    try {
      const res = await apiClient.createSettlementRequest({
        userId: user?.uid,
        userName: profile?.displayName || user?.email,
        userEmail: user?.email || "",
        amount: amt,
        cardOrSheba: settleCardOrSheba.trim(),
        accountHolder: settleAccountHolder.trim()
      });

      if (res && res.id) {
        setSettleSuccess("درخواست تسویه حساب با موفقیت ثبت شد و در صف بررسی مدیریت قرار گرفت.");
        setSettleAmount("");
        setShowSettleForm(false);
        fetchSettlements();
      } else {
        setSettleError(res.error || "خطا در ثبت درخواست تسویه.");
      }
    } catch (err: any) {
      setSettleError(err.message || "خطا در ارتباط با سرور.");
    } finally {
      setSettleSubmitting(false);
    }
  };

  const handleProcessSettlement = async (requestId: string, action: 'approve' | 'reject') => {
    const rejectionNote = settleRejectNoteMap[requestId] || "";
    if (action === 'reject' && !rejectionNote.trim()) {
      alert("لطفا علت رد درخواست تسویه را وارد کنید.");
      return;
    }

    try {
      const res = await apiClient.processSettlementRequest(requestId, action, rejectionNote, user?.uid);
      if (res && res.success) {
        alert(action === 'approve' ? "درخواست تسویه با موفقیت تایید و مبلغ از حساب همکار کسر گردید." : "درخواست تسویه رد شد.");
        fetchSettlements();
      } else {
        alert("خطا: " + (res.error || "عملیات ناموفق بود."));
      }
    } catch (err: any) {
      alert("خطا: " + err.message);
    }
  };

  // Extract all unique genres for filter dropdown
  const allGenresList = useMemo(() => {
    const set = new Set<string>();
    seriesList.forEach((s: any) => {
      const gList = Array.isArray(s.genres) 
        ? s.genres 
        : typeof s.genres === "string" 
        ? s.genres.split(",") 
        : [];
      gList.forEach((g: string) => set.add(g.trim()));
    });
    return Array.from(set).filter(Boolean);
  }, [seriesList]);

  // Filter series list for the catalog search view
  const filteredCatalogSeries = useMemo(() => {
    return seriesList.filter((s: any) => {
      const matchSearch = searchQuery.trim() === "" || 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.author && s.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.artist && s.artist.toLowerCase().includes(searchQuery.toLowerCase()));

      const sGenres = Array.isArray(s.genres) 
        ? s.genres 
        : typeof s.genres === "string" 
        ? s.genres.split(",").map(g => g.trim()) 
        : [];
      const matchGenre = selectedGenre === "all" || sGenres.includes(selectedGenre);
      const matchType = selectedType === "all" || s.type === selectedType;
      const matchStatus = selectedStatus === "all" || s.status === selectedStatus;

      return matchSearch && matchGenre && matchType && matchStatus;
    });
  }, [seriesList, searchQuery, selectedGenre, selectedType, selectedStatus]);

  // Filter series where user is an approved team member
  const myApprovedSeries = useMemo(() => {
    if (isGlobalAdmin) return seriesList;
    return seriesList.filter((s: any) => 
      Array.isArray(s.contributors) && s.contributors.some((c: any) => c.userId === user?.uid && c.status === "approved")
    );
  }, [seriesList, user, isGlobalAdmin]);

  // Gather all pending contributor requests across all series for Admin
  const pendingRequestsList = useMemo(() => {
    const list: any[] = [];
    seriesList.forEach((s: any) => {
      if (Array.isArray(s.contributors)) {
        s.contributors.forEach((c: any) => {
          if (c.status === "pending") {
            list.push({
              ...c,
              seriesId: s.id,
              seriesTitle: s.title,
              seriesCover: s.cover
            });
          }
        });
      }
    });
    return list;
  }, [seriesList]);

  // Load chapters when selecting a series in My Projects or Admin
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

  // Direct File Upload handler
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetRole: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    setUploadStatus("در حال بارگذاری و پردازش فایل روی هاست...");
    setSubmitError("");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    const selectedSeriesObj = seriesList.find((s: any) => s.id === selectedSeriesId);
    if (selectedSeriesObj?.title) {
      formData.append("seriesTitle", selectedSeriesObj.title);
    }
    formData.append("folderType", "cooperation");

    try {
      const res = await apiClient.post("/api/admin/upload", formData, {
        headers: {
          'x-admin-uid': user?.uid,
          'x-user-uid': user?.uid
        }
      });

      if (res && res.urls && res.urls.length > 0) {
        if (targetRole === "translator" || targetRole === "cleaner") {
          setSubmitFileUrl(res.urls[0]);
          setUploadStatus(`فایل با موفقیت آپلود شد: ${res.urls[0]}`);
        } else if (targetRole === "editor") {
          const newUrls = res.urls;
          const currentArr = submitImages.trim() ? submitImages.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [];
          const combined = [...currentArr, ...newUrls];
          setSubmitImages(combined.join("\n"));
          setUploadStatus(`${newUrls.length} تصویر با موفقیت بارگذاری شد.`);
        } else {
          setSubmitFileUrl(res.urls[0]);
          setUploadStatus("فایل آپلود شد.");
        }
      } else {
        setSubmitError("پاسخی از سرور دریافت نشد.");
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || err.message || "خطا در آپلود فایل");
    } finally {
      setUploadingFile(false);
    }
  };

  // Submit Request Collaboration handler
  const handleSendRequest = async (series: Series) => {
    if (!user) {
      setReqError("لطفاً ابتدا وارد حساب کاربری خود شوید.");
      return;
    }
    setSubmittingReq(true);
    setReqError("");
    setReqSuccess("");

    try {
      const res = await apiClient.requestContributor(series.id, {
        userId: user.uid,
        email: user.email || "",
        displayName: profile?.displayName || user.displayName || user.email || "همکار",
        role: reqRole,
        melliCode: reqMelliCode || profile?.melliCode || ""
      });

      if (res.series) {
        onUpdateSeries(res.series);
        if (activeCatalogSeries?.id === series.id) {
          setActiveCatalogSeries(res.series);
        }
        setReqSuccess("درخواست همکاری شما با موفقیت برای مدیریت ارسال شد. پس از بررسی، پیام تایید ارسال خواهد شد.");
      } else {
        setReqError(res.error || "خطا در ثبت درخواست");
      }
    } catch (e: any) {
      setReqError(e.message || "خطا در ارتباط با سرور");
    } finally {
      setSubmittingReq(false);
    }
  };

  // Handle Admin approval/rejection of collaboration requests
  const handleAdminProcessRequest = async (seriesId: string, applicantUserId: string, action: "approve" | "reject", role?: string) => {
    setProcessingActionId(`${seriesId}-${applicantUserId}`);
    try {
      const res = await apiClient.approveContributor(seriesId, applicantUserId, action, user?.uid, role);
      if (res.series) {
        onUpdateSeries(res.series);
      }
    } catch (e: any) {
      alert(`خطا: ${e.message}`);
    } finally {
      setProcessingActionId(null);
    }
  };

  // Handle Chapter Work Submission
  const handleSubmitChapterWork = async (ch: Chapter, userRole: string) => {
    if (!user) return;
    setSubmittingWork(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      let finalImagesArr: string[] = [];
      if (userRole === "editor" && submitImages.trim()) {
        finalImagesArr = submitImages.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      }

      const res = await apiClient.post(`/api/series/${selectedSeriesId}/chapters/${ch.id}/submit`, {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || user.email || "همکار",
        role: userRole,
        fileUrl: submitFileUrl,
        note: submitNote,
        images: finalImagesArr
      });

      if (res && res.id) {
        setSubmitSuccess("فایل با موفقیت ارسال شد و به اطلاع همکاران و مدیریت رسید.");
        setSubmitFileUrl("");
        setSubmitNote("");
        setSubmitImages("");
        setUploadStatus("");
        if (selectedSeriesId) {
          loadChaptersForSeries(selectedSeriesId);
        }
      }
    } catch (e: any) {
      setSubmitError(e.message || "خطا در ثبت کار چپتر");
    } finally {
      setSubmittingWork(false);
    }
  };

  // Create new chapter fast
  const handleCreateFastChapter = async () => {
    if (!selectedSeriesId || !newChapterNumber.trim()) return;
    setCreatingChapter(true);
    try {
      const res = await apiClient.post(`/api/series/${selectedSeriesId}/chapters`, {
        number: newChapterNumber.trim(),
        title: newChapterTitle.trim() || `چپتر ${newChapterNumber.trim()}`,
        images: [],
        isPending: true,
        sortMode: "natural"
      }, user?.uid);

      if (res) {
        setNewChapterNumber("");
        setNewChapterTitle("");
        setShowCreateChapter(false);
        loadChaptersForSeries(selectedSeriesId);
      }
    } catch (e: any) {
      alert(`خطا در ایجاد چپتر: ${e.message}`);
    } finally {
      setCreatingChapter(false);
    }
  };

  // Admin Chapter Approval
  const handleApproveChapter = async (ch: Chapter) => {
    if (!selectedSeriesId) return;
    setProcessingActionId(ch.id);
    try {
      await apiClient.put(`/api/series/${selectedSeriesId}/chapters/${ch.id}/approve`, {}, user?.uid);
      alert(`چپتر ${ch.number} با موفقیت تایید و روی وب‌سایت منتشر شد! نوتیفیکیشن برای نشان‌گذاران و همکاران ارسال گردید.`);
      loadChaptersForSeries(selectedSeriesId);
    } catch (e: any) {
      alert(`خطا در تایید چپتر: ${e.message}`);
    } finally {
      setProcessingActionId(null);
    }
  };

  // Admin Chapter Rejection
  const handleRejectChapter = async (ch: Chapter) => {
    if (!selectedSeriesId) return;
    const note = rejectionNoteMap[ch.id] || "نیازمند اصلاح توسط کادر پروژه";
    setProcessingActionId(ch.id);
    try {
      await apiClient.rejectChapter(selectedSeriesId, ch.id, note, user?.uid);
      alert(`چپتر ${ch.number} رد شد و به اطلاع کادر رسانده شد.`);
      loadChaptersForSeries(selectedSeriesId);
    } catch (e: any) {
      alert(`خطا در رد چپتر: ${e.message}`);
    } finally {
      setProcessingActionId(null);
    }
  };

  // Admin Chapter Revision Request
  const handleRequestRevision = async (ch: Chapter) => {
    if (!selectedSeriesId) return;
    const note = rejectionNoteMap[ch.id] || "نیاز به بازنگری و اصلاح فایل‌های ارسالی دارد.";
    setProcessingActionId(ch.id);
    try {
      await apiClient.requestChapterRevision(selectedSeriesId, ch.id, note, user?.uid);
      alert(`درخواست بازنگری برای چپتر ${ch.number} ثبت گردید.`);
      loadChaptersForSeries(selectedSeriesId);
    } catch (e: any) {
      alert(`خطا در ثبت درخواست بازنگری: ${e.message}`);
    } finally {
      setProcessingActionId(null);
    }
  };

  // Admin Add Staff Member directly
  const handleAddStaffDirectly = async (seriesId: string) => {
    if (!addStaffDisplayName.trim()) {
      alert("لطفاً نام همکار را وارد کنید.");
      return;
    }
    try {
      const res = await apiClient.addContributor(seriesId, {
        userId: addStaffUserId.trim() || `user_${Date.now()}`,
        email: addStaffEmail.trim(),
        displayName: addStaffDisplayName.trim(),
        role: addStaffRole,
        melliCode: addStaffMelli.trim()
      }, user?.uid);

      if (res.series) {
        onUpdateSeries(res.series);
        if (activeCatalogSeries?.id === seriesId) {
          setActiveCatalogSeries(res.series);
        }
        setShowAddStaffModal(false);
        setAddStaffDisplayName("");
        setAddStaffEmail("");
        setAddStaffUserId("");
        setAddStaffMelli("");
      }
    } catch (e: any) {
      alert(`خطا: ${e.message}`);
    }
  };

  // All Chapters awaiting Admin Approval across all series for Admin Approval tab
  const [allPendingChaptersQueue, setAllPendingChaptersQueue] = useState<any[]>([]);
  const [loadingPendingQueue, setLoadingPendingQueue] = useState(false);

  const fetchPendingQueue = async () => {
    if (!isGlobalAdmin) return;
    setLoadingPendingQueue(true);
    try {
      const queue: any[] = [];
      for (const s of seriesList) {
        const res = await apiClient.get(`/api/series/${s.id}/chapters`);
        if (res.data && Array.isArray(res.data)) {
          const pendings = res.data.filter((ch: Chapter) => ch.isPending);
          pendings.forEach((ch: Chapter) => {
            queue.push({
              ...ch,
              seriesTitle: s.title,
              seriesCover: s.cover,
              seriesId: s.id
            });
          });
        }
      }
      setAllPendingChaptersQueue(queue);
    } catch (e) {
      console.error("Failed to load pending chapters queue:", e);
    } finally {
      setLoadingPendingQueue(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "admin_approval") {
      fetchPendingQueue();
    }
  }, [activeSubTab, seriesList]);

  return (
    <div dir="rtl" className="space-y-6 text-right font-sans">
      
      {/* Tab Header Navigation */}
      <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-2.5 flex flex-wrap gap-2 items-center justify-between shadow-xl">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab("all_series")}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              activeSubTab === "all_series"
                ? "bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <Search size={15} />
            جستجوی کارها و درخواست همکاری
          </button>

          <button
            onClick={() => setActiveSubTab("my_projects")}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              activeSubTab === "my_projects"
                ? "bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <Briefcase size={15} />
            کارهای من و ارسال چپتر
            {myApprovedSeries.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                {myApprovedSeries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("settlements")}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              activeSubTab === "settlements"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black"
                : "bg-white/5 text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <DollarSign size={15} />
            {isGlobalAdmin ? "مدیریت تسویه‌حساب‌های مالی" : "تسویه‌حساب و درآمد من"}
            {isGlobalAdmin && settlementRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-black text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {settlementRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>

          {isGlobalAdmin && (
            <>
              <button
                onClick={() => setActiveSubTab("admin_requests")}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                  activeSubTab === "admin_requests"
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black"
                    : "bg-white/5 text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                <Shield size={15} />
                مدیریت درخواست‌ها و تیم کادر
                {pendingRequestsList.length > 0 && (
                  <span className="bg-black text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                    {pendingRequestsList.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSubTab("admin_approval")}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                  activeSubTab === "admin_approval"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-black"
                    : "bg-white/5 text-indigo-300 hover:bg-indigo-600/10"
                }`}
              >
                <FileCheck size={15} />
                تایید و انتشار چپترها
                {allPendingChaptersQueue.length > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black">
                    {allPendingChaptersQueue.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Revenue info note */}
        <div className="hidden lg:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[11px] text-emerald-400 font-bold">
          <DollarSign size={14} />
          تقسیم سود خودکار: مترجم ۲۰٪ | کلینر ۳۰٪ | ادیتور ۳۰٪ | وب‌سایت ۲۰٪
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: CATALOG SEARCH & COLLABORATION REQUEST (جستجوی کارها و درخواست) */}
      {/* ========================================================================= */}
      {activeSubTab === "all_series" && (
        <div className="space-y-6">
          
          {/* Catalog Search & Filters Header */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="جستجوی عنوان مانهوا، مانگا، نویسنده، طراح..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] transition-all font-bold placeholder:text-zinc-500"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                >
                  <option value="all">همه ژانرها</option>
                  {allGenresList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                >
                  <option value="all">همه انواع</option>
                  <option value="Manhwa">مانهوا (Manhwa)</option>
                  <option value="Manhua">مانhua (Manhua)</option>
                  <option value="Manga">مانگا (Manga)</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="Ongoing">درحال انتشار</option>
                  <option value="Completed">پایان یافته</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
              <span>نمایش <strong className="text-white font-mono">{filteredCatalogSeries.length}</strong> اثر در کاتالوگ کارها</span>
              <span className="text-[11px] text-zinc-500">برای مشاهده جزئیات و درخواست همکاری روی هر اثر کلیک کنید</span>
            </div>
          </div>

          {/* Catalog Series Grid (Website Search Page Style) */}
          {filteredCatalogSeries.length === 0 ? (
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-12 text-center text-zinc-400 space-y-3">
              <Search size={36} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-base font-bold text-white">اثری با مشخصات جستجو شده یافت نشد</p>
              <p className="text-xs text-zinc-500">عبارت دیگری را جستجو کنید یا فیلترها را ریست نمایید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredCatalogSeries.map((s: any) => {
                const approvedStaffCount = Array.isArray(s.contributors) 
                  ? s.contributors.filter((c: any) => c.status === "approved").length 
                  : 0;
                const isMember = Array.isArray(s.contributors) && s.contributors.some((c: any) => c.userId === user?.uid && c.status === "approved");
                const isPending = Array.isArray(s.contributors) && s.contributors.some((c: any) => c.userId === user?.uid && c.status === "pending");

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveCatalogSeries(s);
                      setReqError("");
                      setReqSuccess("");
                    }}
                    className={`group bg-zinc-900 border rounded-2xl p-2.5 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1 ${
                      isMember 
                        ? 'border-emerald-500/30 hover:border-emerald-500 shadow-lg shadow-emerald-500/5'
                        : isPending
                        ? 'border-amber-500/30 hover:border-amber-500'
                        : 'border-white/10 hover:border-[var(--color-asura-accent)] shadow-md hover:shadow-xl'
                    }`}
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black mb-3">
                      <img
                        src={s.cover}
                        alt={s.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-2 right-2 flex flex-col gap-1 items-start">
                        <span className="bg-black/80 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-white/10">
                          {s.type || "Manhwa"}
                        </span>
                        {isMember && (
                          <span className="bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                            عضو تیم
                          </span>
                        )}
                        {isPending && (
                          <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow animate-pulse">
                            در انتظار تایید
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md text-zinc-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                        <UsersIcon size={11} className="text-[var(--color-asura-accent-light)]" />
                        <span>{approvedStaffCount} نفر کادر</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white group-hover:text-[var(--color-asura-accent-light)] transition-colors line-clamp-2 leading-snug">
                          {s.title}
                        </h4>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{s.author || "نویسنده نامشخص"}</p>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                        <span className="text-amber-400 font-bold">{s.status === "Ongoing" ? "درحال انتشار" : "پایان یافته"}</span>
                        <span className="text-[var(--color-asura-accent-light)] font-bold flex items-center gap-0.5">
                          درخواست <ChevronDown size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Series Collaboration Request Modal / Drawer */}
          {activeCatalogSeries && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-white/15 rounded-3xl max-w-2xl w-full p-6 text-right space-y-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-4">
                    <img src={activeCatalogSeries.cover} alt="" className="w-16 h-20 object-cover rounded-xl border border-white/10 shadow" />
                    <div>
                      <h3 className="text-lg font-black text-white">{activeCatalogSeries.title}</h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        نویسنده: <span className="text-white font-bold">{activeCatalogSeries.author || 'نامشخص'}</span> | وضعیت: <span className="text-amber-400 font-bold">{activeCatalogSeries.status}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveCatalogSeries(null)}
                    className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Synopsis */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-zinc-300 leading-relaxed">
                  <h4 className="text-[11px] font-black text-zinc-400 uppercase mb-1">خلاصه اثر:</h4>
                  {activeCatalogSeries.synopsis || "توضیحاتی برای این اثر ثبت نشده است."}
                </div>

                {/* Current Staff List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <UsersIcon size={14} className="text-[var(--color-asura-accent)]" />
                    اعضای فعال تیم این اثر:
                  </h4>
                  {(!activeCatalogSeries.contributors || activeCatalogSeries.contributors.filter((c: any) => c.status === "approved").length === 0) ? (
                    <p className="text-xs text-zinc-500 bg-black/20 p-3 rounded-xl border border-white/5">هنوز همکاری برای این اثر ثبت نشده است.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {activeCatalogSeries.contributors.filter((c: any) => c.status === "approved").map((c: any) => (
                        <div key={c.userId} className="p-2.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="block font-black text-white">{c.displayName}</span>
                            <span className="block text-[10px] text-amber-400 font-bold">
                              {c.role === 'translator' ? 'مترجم' : c.role === 'editor' ? 'ادیتور' : c.role === 'cleaner' ? 'کلینر' : c.role === 'typesetter' ? 'تایپیست' : c.role}
                            </span>
                          </div>
                          {isGlobalAdmin && (
                            <button
                              onClick={() => handleAdminProcessRequest(activeCatalogSeries.id, c.userId, "reject")}
                              className="text-red-400 hover:text-red-300 text-[10px] font-bold p-1 bg-red-500/10 rounded-lg"
                            >
                              حذف همکار
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Application / Work Space Locking State */}
                {(() => {
                  const myContribObj = activeCatalogSeries.contributors?.find((c: any) => c.userId === user?.uid);
                  const isApproved = myContribObj?.status === "approved";
                  const isPending = myContribObj?.status === "pending";

                  if (isApproved) {
                    return (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-black text-emerald-400 flex items-center gap-2">
                            <CheckCircle size={16} /> شما عضو تایید شده تیم این اثر هستید
                          </h4>
                          <p className="text-[11px] text-zinc-400 mt-1">
                            نقش شما: <strong className="text-white">{myContribObj.role === 'translator' ? 'مترجم' : myContribObj.role === 'cleaner' ? 'کلینر' : 'ادیتور'}</strong>
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSeriesId(activeCatalogSeries.id);
                            loadChaptersForSeries(activeCatalogSeries.id);
                            setActiveCatalogSeries(null);
                            setActiveSubTab("my_projects");
                          }}
                          className="px-4 py-2 bg-emerald-500 text-black font-black text-xs rounded-xl hover:bg-emerald-600 transition-all shadow"
                        >
                          ورود به پنل ارسال چپتر
                        </button>
                      </div>
                    );
                  }

                  if (isPending) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl space-y-2 text-center">
                        <Lock size={28} className="mx-auto text-amber-400 mb-1" />
                        <h4 className="text-sm font-black text-amber-400">صفحه کاری این اثر در انتظار تایید مدیریت قفل می‌باشد</h4>
                        <p className="text-xs text-zinc-300">
                          درخواست همکاری شما برای نقش <strong className="text-white font-black">{myContribObj.role === 'translator' ? 'مترجم' : myContribObj.role === 'cleaner' ? 'کلینر' : 'ادیتور'}</strong> ثبت شده است. پس از تایید توسط مدیریت، دسترسی ارسال چپتر برای شما فعال خواهد شد.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <Plus size={16} className="text-[var(--color-asura-accent)]" />
                        ثبت درخواست جدید جهت دریافت مسئولیت این اثر
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold mb-1">انتخاب نقش درخواستی:</label>
                          <select
                            value={reqRole}
                            onChange={(e: any) => setReqRole(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                          >
                            <option value="translator">مترجم (Translator)</option>
                            <option value="cleaner">کلینر (Cleaner)</option>
                            <option value="editor">ادیتور و تایپیست (Editor)</option>
                            <option value="typesetter">تایپیست (Typesetter)</option>
                            <option value="proofreader">ویراستار (Proofreader)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold mb-1">کد اختصاصی کاربری:</label>
                          <input
                            type="text"
                            placeholder="مثلاً: 0021345678"
                            value={reqMelliCode}
                            onChange={(e) => setReqMelliCode(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                          />
                        </div>
                      </div>

                      {reqError && <p className="text-red-400 text-xs font-bold">{reqError}</p>}
                      {reqSuccess && <p className="text-emerald-400 text-xs font-bold">{reqSuccess}</p>}

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleSendRequest(activeCatalogSeries)}
                          disabled={submittingReq}
                          className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                        >
                          <Send size={14} />
                          {submittingReq ? "در حال ثبت درخواست..." : "ارسال درخواست همکاری به مدیریت"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: MY ASSIGNED WORKS & CHAPTER SUBMISSIONS (کارهای من و ارسال چپتر) */}
      {/* ========================================================================= */}
      {activeSubTab === "my_projects" && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Briefcase size={18} className="text-[var(--color-asura-accent)]" />
              پروژه‌های تایید شده و فعال شما
            </h3>
            <p className="text-xs text-zinc-400">
              روی هر یک از مانهواهای زیر کلیک کنید تا پنل ارسال فایل‌های ترجمه، کلین یا ادیت برای شما باز شود.
            </p>

            {myApprovedSeries.length === 0 ? (
              <div className="bg-black/30 border border-white/5 rounded-xl p-8 text-center text-zinc-400 space-y-2">
                <AlertCircle size={28} className="mx-auto text-amber-400 mb-1" />
                <p className="text-xs font-bold text-white">شما هنوز در هیچ پروژه‌ای عضو تایید شده نیستید.</p>
                <p className="text-[11px] text-zinc-500">از تب «جستجوی کارها و درخواست همکاری» برای ارسال درخواست به مدیریت اقدام کنید.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {myApprovedSeries.map((s: any) => {
                  const isSelected = selectedSeriesId === s.id;
                  const myRoleObj = Array.isArray(s.contributors) 
                    ? s.contributors.find((c: any) => c.userId === user?.uid && c.status === "approved")
                    : null;
                  const myRoleName = myRoleObj?.role || (isGlobalAdmin ? "مدیریت کل" : "همکار");

                  return (
                    <button
                      key={s.id}
                      onClick={() => loadChaptersForSeries(s.id)}
                      className={`p-2.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                        isSelected 
                          ? "bg-[var(--color-asura-accent)]/15 border-[var(--color-asura-accent)] ring-2 ring-[var(--color-asura-accent)]/30"
                          : "bg-black/40 border-white/10 hover:border-white/20 hover:bg-black/60"
                      }`}
                    >
                      <img src={s.cover} alt="" className="w-full aspect-[3/4] object-cover rounded-xl mb-2" />
                      <div>
                        <h4 className="text-xs font-black text-white truncate">{s.title}</h4>
                        <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                          نقش: {myRoleName === 'translator' ? 'مترجم' : myRoleName === 'cleaner' ? 'کلینر' : myRoleName === 'editor' ? 'ادیتور' : myRoleName}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chapters and Submission Workspace for Selected Series */}
          {selectedSeriesId && (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6">
              
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <FileText size={18} className="text-[var(--color-asura-accent-light)]" />
                    مدیریت چپترهای اثر: <span className="text-[var(--color-asura-accent-light)]">{seriesList.find((s: any) => s.id === selectedSeriesId)?.title}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">جهت ارسال ترجمه، کلین یا خروجی نهایی ادیت، چپتر مورد نظر را انتخاب نمایید.</p>
                </div>

                <button
                  onClick={() => setShowCreateChapter(!showCreateChapter)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow"
                >
                  <Plus size={16} />
                  ایجاد سریع چپتر جدید
                </button>
              </div>

              {/* Fast chapter creation form */}
              {showCreateChapter && (
                <div className="bg-black/60 border border-indigo-500/30 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-indigo-400">ایجاد چپتر جدید برای این پروژه:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-bold mb-1">شماره چپتر (مثلاً 1 یا 10.5):</label>
                      <input
                        type="text"
                        placeholder="1"
                        value={newChapterNumber}
                        onChange={(e) => setNewChapterNumber(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-bold mb-1">عنوان چپتر (اختیاری):</label>
                      <input
                        type="text"
                        placeholder="چپتر 1"
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowCreateChapter(false)}
                      className="px-3 py-1.5 bg-white/5 text-zinc-300 rounded-xl text-xs font-bold"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={handleCreateFastChapter}
                      disabled={creatingChapter || !newChapterNumber.trim()}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all"
                    >
                      {creatingChapter ? "در حال ایجاد..." : "ثبت چپتر"}
                    </button>
                  </div>
                </div>
              )}

              {/* Chapters List */}
              {loadingChapters ? (
                <div className="p-8 text-center text-zinc-400 text-xs animate-pulse">در حال دریافت لیست چپترها...</div>
              ) : chaptersList.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs bg-black/30 rounded-xl border border-white/5">
                  هیچ چپتری برای این اثر تعریف نشده است. از دکمه «ایجاد سریع چپتر جدید» استفاده کنید.
                </div>
              ) : (
                <div className="space-y-3">
                  {chaptersList.map((ch: any) => {
                    const isExpanded = expandedChapterId === ch.id;
                    const activeSeriesObj = seriesList.find((s: any) => s.id === selectedSeriesId);
                    const myRoleObj = Array.isArray(activeSeriesObj?.contributors) 
                      ? activeSeriesObj?.contributors.find((c: any) => c.userId === user?.uid && c.status === "approved")
                      : null;
                    const myRole = myRoleObj?.role || (isGlobalAdmin ? "editor" : "translator");

                    // Submissions inside chapter
                    const submissions = ch.submissions || [];
                    const translatorSub = submissions.find((s: any) => s.role === "translator");
                    const cleanerSub = submissions.find((s: any) => s.role === "cleaner");
                    const editorSub = submissions.find((s: any) => s.role === "editor");

                    return (
                      <div key={ch.id} className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden">
                        
                        {/* Chapter summary row */}
                        <div
                          onClick={() => setExpandedChapterId(isExpanded ? null : ch.id)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-black text-white text-sm font-mono border border-white/10">
                              {ch.number}
                            </span>
                            <div>
                              <h4 className="text-xs font-black text-white">{ch.title || `چپتر ${ch.number}`}</h4>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 mt-1">
                                {ch.isPending ? (
                                  <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    در انتظار بررسی مدیریت
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    منتشر شده پابلیک
                                  </span>
                                )}

                                {translatorSub && <span className="text-blue-400">✓ فایل ترجمه موجود</span>}
                                {cleanerSub && <span className="text-teal-400">✓ فایل کلین موجود</span>}
                                {editorSub && <span className="text-purple-400">✓ خروجی ادیت موجود</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--color-asura-accent-light)] flex items-center gap-1">
                              {isExpanded ? "بستن پنل" : "ارسال فایل / دانلود"}
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </div>
                        </div>

                        {/* Chapter Expanded Submission & Role Area */}
                        {isExpanded && (
                          <div className="p-5 border-t border-white/10 bg-zinc-900/80 space-y-5">
                            
                            {/* Workflow files status table */}
                            <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-xs space-y-3">
                              <h5 className="font-black text-white flex items-center gap-2">
                                <Clock size={14} className="text-amber-400" />
                                وضعیت فایل‌های ارسالی همکاران برای چپتر {ch.number}:
                              </h5>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                
                                {/* Translator File */}
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                                  <span className="block text-[10px] text-zinc-400 font-bold uppercase">۱. فایل ترجمه (مترجم):</span>
                                  {translatorSub ? (
                                    <div className="space-y-1">
                                      <span className="block text-emerald-400 font-bold">{translatorSub.userName}</span>
                                      {translatorSub.fileUrl ? (
                                        <a
                                          href={translatorSub.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold hover:bg-emerald-500/30 transition-all"
                                        >
                                          <Download size={12} />
                                          دانلود فایل Word ترجمه
                                        </a>
                                      ) : (
                                        <span className="text-zinc-500 text-[10px]">بدون فایل پیوست</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-amber-400/70 text-[11px]">هنوز ترجمه ثبت نشده است</span>
                                  )}
                                </div>

                                {/* Cleaner File */}
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                                  <span className="block text-[10px] text-zinc-400 font-bold uppercase">۲. فایل کلین (کلینر):</span>
                                  {cleanerSub ? (
                                    <div className="space-y-1">
                                      <span className="block text-emerald-400 font-bold">{cleanerSub.userName}</span>
                                      {cleanerSub.fileUrl ? (
                                        <a
                                          href={cleanerSub.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-lg font-bold hover:bg-teal-500/30 transition-all"
                                        >
                                          <Download size={12} />
                                          دانلود فایل Zip کلین
                                        </a>
                                      ) : (
                                        <span className="text-zinc-500 text-[10px]">بدون فایل پیوست</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-amber-400/70 text-[11px]">هنوز کلین ثبت نشده است</span>
                                  )}
                                </div>

                                {/* Editor File */}
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                                  <span className="block text-[10px] text-zinc-400 font-bold uppercase">۳. خروجی نهایی (ادیتور):</span>
                                  {editorSub ? (
                                    <div className="space-y-1">
                                      <span className="block text-purple-400 font-bold">{editorSub.userName}</span>
                                      <span className="text-xs text-white font-mono block">
                                        {Array.isArray(ch.images) ? `${ch.images.length} تصویر نهایی` : 'آماده بررسی'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-amber-400/70 text-[11px]">در انتظار بارگذاری نهایی ادیتور</span>
                                  )}
                                </div>

                              </div>
                            </div>

                            {/* Role Submission Form */}
                            <div className="bg-black/60 border border-[var(--color-asura-accent)]/30 rounded-2xl p-5 space-y-4">
                              <h5 className="text-xs font-black text-white flex items-center gap-2">
                                <UploadCloud size={16} className="text-[var(--color-asura-accent)]" />
                                ثبت و آپلود گزارش کار چپتر {ch.number} (به عنوان: <strong className="text-amber-400">{myRole === 'translator' ? 'مترجم' : myRole === 'cleaner' ? 'کلینر' : 'ادیتور'}</strong>)
                              </h5>

                              {/* Direct File Upload Control */}
                              <div className="space-y-2">
                                <label className="block text-[10px] text-zinc-300 font-bold">
                                  {myRole === "translator" && "آپلود فایل Word (.docx / .doc) یا متنی ترجمه:"}
                                  {myRole === "cleaner" && "آپلود آرشیو Zip یا عکس‌های کلین شده:"}
                                  {myRole === "editor" && "آپلود صفحات نهایی فتوشاپ/ادیت شده (Zip یا عکس):"}
                                </label>

                                <div className="flex items-center gap-3">
                                  <input
                                    type="file"
                                    accept={
                                      myRole === "translator" 
                                        ? ".doc,.docx,.txt" 
                                        : ".zip,.rar,image/*"
                                    }
                                    multiple={myRole === "editor" || myRole === "cleaner"}
                                    onChange={(e) => handleDirectFileUpload(e, myRole)}
                                    disabled={uploadingFile}
                                    className="block w-full text-xs text-zinc-400 file:mr-0 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[var(--color-asura-accent)] file:text-white hover:file:bg-[var(--color-asura-accent-hover)] cursor-pointer"
                                  />
                                </div>

                                {uploadingFile && (
                                  <p className="text-[11px] text-amber-400 font-bold animate-pulse">{uploadStatus}</p>
                                )}
                                {!uploadingFile && uploadStatus && (
                                  <p className="text-[11px] text-emerald-400 font-bold">{uploadStatus}</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] text-zinc-400 font-bold mb-1">
                                  یا لینک مستقیم گوگل درایو / مگا (در صورت استفاده از هاست خارجی):
                                </label>
                                <input
                                  type="text"
                                  placeholder="https://drive.google.com/file/d/..."
                                  value={submitFileUrl}
                                  onChange={(e) => setSubmitFileUrl(e.target.value)}
                                  className="w-full bg-black border border-white/10 text-white rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                                />
                              </div>

                              {myRole === "editor" && (
                                <div>
                                  <label className="block text-[10px] text-zinc-400 font-bold mb-1">
                                    لیست آدرس تصاویر خروجی نهایی ادیتور (هر لینک در یک سطر):
                                  </label>
                                  <textarea
                                    rows={3}
                                    placeholder="https://site.com/uploads/ch1_p1.jpg&#10;https://site.com/uploads/ch1_p2.jpg"
                                    value={submitImages}
                                    onChange={(e) => setSubmitImages(e.target.value)}
                                    className="w-full bg-black border border-white/10 text-white rounded-xl p-2.5 text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="block text-[10px] text-zinc-400 font-bold mb-1">یادداشت و توضیحات کار برای مدیریت و همکاران:</label>
                                <textarea
                                  rows={2}
                                  placeholder="توضیحات اختیاری درباره این چپتر..."
                                  value={submitNote}
                                  onChange={(e) => setSubmitNote(e.target.value)}
                                  className="w-full bg-black border border-white/10 text-white rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                                />
                              </div>

                              {submitError && <p className="text-red-400 text-xs font-bold">{submitError}</p>}
                              {submitSuccess && <p className="text-emerald-400 text-xs font-black">{submitSuccess}</p>}

                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={() => handleSubmitChapterWork(ch, myRole)}
                                  disabled={submittingWork || uploadingFile}
                                  className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow"
                                >
                                  <Send size={14} />
                                  {submittingWork ? "در حال ثبت..." : "تایید و ارسال کار به مدیریت"}
                                </button>
                              </div>
                            </div>

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
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB: SETTLEMENTS & FINANCIAL EARNINGS (تسویه‌حساب و درآمد کادر) */}
      {/* ========================================================================= */}
      {activeSubTab === "settlements" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-black border border-emerald-500/20 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <DollarSign size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">مدیریت درآمدها و تسویه‌حساب مالی</h3>
                  <p className="text-xs text-zinc-400">
                    آمار درآمد تجمعی حاصل از سهم مشارکت در فصل‌ها و ثبت درخواست تسویه حساب کاربری
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
              <div className="bg-black/60 border border-white/10 rounded-2xl px-5 py-3 text-right">
                <span className="text-[10px] text-zinc-400 font-bold block mb-0.5">موجودی کیف پول / قابل تسویه:</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  {userWalletBalance.toLocaleString()} <span className="text-xs font-sans text-zinc-400">تومان</span>
                </span>
              </div>

              <button
                onClick={() => setShowSettleForm(!showSettleForm)}
                className="px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Plus size={16} />
                {showSettleForm ? "بستن فرم تسویه" : "ثبت درخواست تسویه جدید"}
              </button>
            </div>
          </div>

          {/* New Settlement Request Form Modal/Card */}
          {showSettleForm && (
            <div className="bg-black/80 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-5 animate-fadeIn shadow-2xl">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-400" />
                  فرم درخواست تسویه حساب مالی
                </h4>
                <span className="text-xs text-zinc-400 font-bold">
                  موجودی شما: <strong className="text-emerald-400 font-mono">{userWalletBalance.toLocaleString()} تومان</strong>
                </span>
              </div>

              {settleError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 font-bold flex items-center gap-2">
                  <AlertCircle size={16} />
                  {settleError}
                </div>
              )}

              {settleSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-bold flex items-center gap-2">
                  <CheckCircle size={16} />
                  {settleSuccess}
                </div>
              )}

              <form onSubmit={handleSubmitSettlement} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    مبلغ درخواستی (تومان):
                  </label>
                  <input
                    type="number"
                    placeholder="مثلا: 100000"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">حداقل 10,000 تومان</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    شماره کارت ۱۶ رقمی یا شبا (IR):
                  </label>
                  <input
                    type="text"
                    placeholder="603799... یا IR..."
                    value={settleCardOrSheba}
                    onChange={(e) => setSettleCardOrSheba(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-left dir-ltr"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    نام و نام خانوادگی صاحب حساب:
                  </label>
                  <input
                    type="text"
                    placeholder="مطابق با صاحب کارت/حساب"
                    value={settleAccountHolder}
                    onChange={(e) => setSettleAccountHolder(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettleForm(false)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={settleSubmitting}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {settleSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        در حال ثبت...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        ارسال درخواست تسویه
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Settlement Requests */}
          <div className="bg-zinc-900/80 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Clock size={16} className="text-emerald-400" />
                  {isGlobalAdmin ? "لیست کامل درخواست‌های تسویه مالی همکاران" : "تاریخچه درخواست‌های تسویه حساب شما"}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  تعداد کل درخواست‌ها: <strong className="text-white font-mono">{settlementRequests.length}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSettlements}
                  className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10"
                  title="بروزرسانی لیست"
                >
                  <RefreshCw size={14} className={loadingSettlements ? "animate-spin" : ""} />
                </button>

                {isGlobalAdmin && (
                  <select
                    value={settleFilterStatus}
                    onChange={(e) => setSettleFilterStatus(e.target.value)}
                    className="bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="pending">در انتظار بررسی</option>
                    <option value="approved">تایید و واریز شده</option>
                    <option value="rejected">رد شده</option>
                  </select>
                )}
              </div>
            </div>

            {loadingSettlements ? (
              <div className="py-12 text-center text-xs text-zinc-400 animate-pulse">در حال دریافت لیست تسویه‌حساب‌ها...</div>
            ) : settlementRequests.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-bold bg-black/30 rounded-2xl border border-white/5 space-y-1">
                <CheckCircle size={28} className="mx-auto text-zinc-600 mb-1" />
                <p>تاکنون هیچ درخواست تسویه‌حسابی ثبت نشده است.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlementRequests
                  .filter(r => settleFilterStatus === 'all' || r.status === settleFilterStatus)
                  .map((req: any) => (
                    <div
                      key={req.id}
                      className="bg-black/60 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-black text-white">{req.userName}</span>
                          <span className="text-xs text-zinc-400 font-mono">({req.userEmail})</span>
                          
                          {req.status === 'pending' && (
                            <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Clock size={12} /> در انتظار بررسی مدیریت
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle size={12} /> تایید و واریز گردید
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <X size={12} /> رد شده
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-zinc-300">
                          <div>
                            مبلغ: <strong className="text-emerald-400 font-mono font-black text-sm">{Number(req.amount).toLocaleString()} تومان</strong>
                          </div>
                          <div>
                            کارت/شبا: <strong className="text-white font-mono dir-ltr inline-block">{req.cardOrSheba}</strong>
                          </div>
                          <div>
                            صاحب حساب: <strong className="text-white font-bold">{req.accountHolder}</strong>
                          </div>
                        </div>

                        {req.rejectionNote && (
                          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
                            علت رد: {req.rejectionNote}
                          </p>
                        )}

                        <span className="text-[10px] text-zinc-500 font-mono block">
                          زمان ثبت: {new Date(req.createdAt).toLocaleString('fa-IR')}
                        </span>
                      </div>

                      {/* Admin Actions */}
                      {isGlobalAdmin && req.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-r border-white/10 pt-3 md:pt-0 md:pr-4">
                          <button
                            onClick={() => handleProcessSettlement(req.id, 'approve')}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow"
                          >
                            <Check size={16} /> تایید و کسر/پرداخت
                          </button>

                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="علت رد..."
                              value={settleRejectNoteMap[req.id] || ""}
                              onChange={(e) => setSettleRejectNoteMap({ ...settleRejectNoteMap, [req.id]: e.target.value })}
                              className="bg-black border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none w-32 font-bold"
                            />
                            <button
                              onClick={() => handleProcessSettlement(req.id, 'reject')}
                              className="px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1 shadow shrink-0"
                            >
                              <X size={15} /> رد
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: SUPER ADMIN REQUESTS & TEAM MANAGEMENT (مدیریت درخواست‌ها و تیم) */}
      {/* ========================================================================= */}
      {activeSubTab === "admin_requests" && isGlobalAdmin && (
        <div className="space-y-6">
          
          {/* Pending Applications Section */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <AlertCircle size={18} />
                درخواست‌های جدید همکاری در انتظار تایید ({pendingRequestsList.length})
              </h3>
              <span className="text-xs text-zinc-400">تمام درخواست‌های کاربران جهت دریافت نقش روی آثار</span>
            </div>

            {pendingRequestsList.length === 0 ? (
              <p className="text-xs text-zinc-500 bg-black/30 p-6 rounded-xl text-center border border-white/5">
                هیچ درخواست جدیدی در انتظار تایید وجود ندارد.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingRequestsList.map((req: any) => (
                  <div key={`${req.seriesId}-${req.userId}`} className="bg-black/50 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-right">
                      <img src={req.seriesCover} alt="" className="w-12 h-16 object-cover rounded-xl border border-white/10 shrink-0" />
                      <div>
                        <h4 className="text-sm font-black text-white">{req.displayName} ({req.email || 'بدون ایمیل'})</h4>
                        <p className="text-xs text-zinc-300 mt-0.5">
                          اثر درخواستی: <strong className="text-[var(--color-asura-accent-light)]">{req.seriesTitle}</strong>
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          نقش: <strong className="text-amber-400">{req.role === 'translator' ? 'مترجم' : req.role === 'cleaner' ? 'کلینر' : 'ادیتور'}</strong> | کد کاربری: <strong className="text-white font-mono">{req.melliCode || 'ثبت نشده'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdminProcessRequest(req.seriesId, req.userId, "approve", req.role)}
                        disabled={processingActionId === `${req.seriesId}-${req.userId}`}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs rounded-xl transition-all flex items-center gap-1 shadow"
                      >
                        <Check size={14} /> تایید عضویت
                      </button>

                      <button
                        onClick={() => handleAdminProcessRequest(req.seriesId, req.userId, "reject")}
                        disabled={processingActionId === `${req.seriesId}-${req.userId}`}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1 shadow"
                      >
                        <X size={14} /> رد درخواست
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Series Staff & Chapter Attribution Management */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <UsersIcon size={18} className="text-[var(--color-asura-accent)]" />
              کاتالوگ آثار و مدیریت دست‌اندرکاران و چپترها
            </h3>
            <p className="text-xs text-zinc-400">برای تغییر، افزودن مستقیم یا حذف همکاران و مشاهده چپترها روی هر کار کلیک کنید.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {seriesList.map((s: any) => {
                const approvedCount = Array.isArray(s.contributors) 
                  ? s.contributors.filter((c: any) => c.status === "approved").length 
                  : 0;
                return (
                  <div key={s.id} className="p-3 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={s.cover} alt="" className="w-10 h-14 object-cover rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-white truncate">{s.title}</h4>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">{approvedCount} عضو فعال</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setActiveCatalogSeries(s);
                        setShowAddStaffModal(false);
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all shrink-0"
                    >
                      مدیریت
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: SUPER ADMIN CHAPTER APPROVAL QUEUE (تایید و انتشار چپترها) */}
      {/* ========================================================================= */}
      {activeSubTab === "admin_approval" && isGlobalAdmin && (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-black text-indigo-400 flex items-center gap-2">
                <FileCheck size={18} />
                صف تایید و انتشار عمومی چپترهای ارسالی ({allPendingChaptersQueue.length})
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                چپترهای آماده شده توسط ادیتورها در این بخش منتظر تایید مدیریت هستند. با کلیک روی تایید، چپتر به همراه نوتیفیکیشن روی سایت منتشر می‌شود.
              </p>
            </div>

            <button
              onClick={fetchPendingQueue}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} className={loadingPendingQueue ? "animate-spin" : ""} />
              بروزرسانی صف
            </button>
          </div>

          {loadingPendingQueue ? (
            <div className="p-12 text-center text-zinc-400 text-xs animate-pulse">در حال دریافت صف چپترهای ارسالی...</div>
          ) : allPendingChaptersQueue.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-black/30 rounded-2xl border border-white/5 space-y-2">
              <CheckCircle size={32} className="mx-auto text-emerald-400 mb-1" />
              <p className="text-sm font-bold text-white">هیچ چپتری در صف تایید مدیریت قرار ندارد</p>
              <p className="text-xs text-zinc-500">تمام چپترهای ارسالی بررسی و منتشر گردیده‌اند.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allPendingChaptersQueue.map((ch: any) => {
                const submissions = ch.submissions || [];
                const translatorSub = submissions.find((s: any) => s.role === "translator");
                const cleanerSub = submissions.find((s: any) => s.role === "cleaner");
                const editorSub = submissions.find((s: any) => s.role === "editor");

                return (
                  <div key={`${ch.seriesId}-${ch.id}`} className="bg-black/60 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-3">
                        <img src={ch.seriesCover} alt="" className="w-12 h-16 object-cover rounded-xl border border-white/10 shrink-0" />
                        <div>
                          <h4 className="text-sm font-black text-white">{ch.seriesTitle} - چپتر {ch.number}</h4>
                          <span className="text-xs text-indigo-300 font-bold block mt-0.5">
                            ارسال شده توسط ادیتور: {editorSub?.userName || 'کادر فنی'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSeriesId(ch.seriesId);
                            handleApproveChapter(ch);
                          }}
                          disabled={processingActionId === ch.id}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                        >
                          <Check size={16} /> تایید و انتشار عمومی روی سایت
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSeriesId(ch.seriesId);
                            handleRejectChapter(ch);
                          }}
                          disabled={processingActionId === ch.id}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1 shadow"
                        >
                          <X size={15} /> رد چپتر
                        </button>
                      </div>
                    </div>

                    {/* Files and Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold block">مترجم: {translatorSub?.userName || 'نامشخص'}</span>
                        {translatorSub?.fileUrl ? (
                          <a href={translatorSub.fileUrl} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                            <Download size={12} /> دانلود فایل Word ترجمه
                          </a>
                        ) : (
                          <span className="text-zinc-500">بدون فایل ترجمه</span>
                        )}
                      </div>

                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold block">کلینر: {cleanerSub?.userName || 'نامشخص'}</span>
                        {cleanerSub?.fileUrl ? (
                          <a href={cleanerSub.fileUrl} target="_blank" rel="noreferrer" className="text-teal-400 font-bold hover:underline flex items-center gap-1">
                            <Download size={12} /> دانلود فایل Zip کلین
                          </a>
                        ) : (
                          <span className="text-zinc-500">بدون فایل کلین</span>
                        )}
                      </div>

                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold block">تعداد تصاویر خروجی نهایی:</span>
                        <span className="text-white font-mono font-bold">
                          {Array.isArray(ch.images) ? `${ch.images.length} تصویر` : 'در دسترس'}
                        </span>
                      </div>

                    </div>

                    {/* Rejection note input */}
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="در صورت رد یا بازنگری، علت یا نکات اصلاحی را اینجا وارد کنید..."
                        value={rejectionNoteMap[ch.id] || ""}
                        onChange={(e) => setRejectionNoteMap({ ...rejectionNoteMap, [ch.id]: e.target.value })}
                        className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
