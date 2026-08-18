import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "../lib/apiClient";
import ContributorDashboard from "./ContributorDashboard";
import { 
  Users as UsersIcon, 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
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
  DollarSign,
  UserPlus,
  RefreshCw,
  FileCheck,
  Info,
  Layers,
  FileArchive,
  ArrowLeft,
  Eye,
  CheckSquare
} from "lucide-react";
import { Series, Chapter } from "../lib/types";

interface CooperationTabProps {
  seriesList: Series[];
  user: any;
  profile: any;
  isSuperAdmin: boolean;
  onUpdateSeries: (updatedSeries: Series) => void;
  defaultSubTab?: "contributor_dashboard" | "all_series" | "my_projects" | "settlements" | "admin_requests" | "admin_approval";
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

  const [activeSubTab, setActiveSubTab] = useState<"contributor_dashboard" | "all_series" | "my_projects" | "settlements" | "admin_requests" | "admin_approval">(
    defaultSubTab || "contributor_dashboard"
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

  // Search and filter for Catalog
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Selected series for catalog popup/modal
  const [activeCatalogSeries, setActiveCatalogSeries] = useState<Series | null>(null);

  // Request Collaboration form state inside catalog modal
  const [reqRole, setReqRole] = useState<"translator" | "cleaner" | "editor" | "typesetter" | "proofreader">("translator");
  const [reqUserCode, setReqUserCode] = useState(profile?.melliCode || user?.uid || "");
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  // Active series in "My Projects" or "Admin Management"
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  // Work Submission form state per chapter
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
  const [addStaffUserCode, setAddStaffUserCode] = useState("");

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

  // Filter series list for catalog search view
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

  // Load chapters when selecting a series
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
    setUploadStatus("در حال بارگذاری و پردازش فایل روی سرور...");
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
          setUploadStatus(`فایل با موفقیت بارگذاری شد: ${res.urls[0]}`);
        } else if (targetRole === "editor") {
          const newUrls = res.urls;
          const currentArr = submitImages.trim() ? submitImages.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [];
          const combined = [...currentArr, ...newUrls];
          setSubmitImages(combined.join("\n"));
          setUploadStatus(`${newUrls.length} تصویر با موفقیت بارگذاری شد.`);
        } else {
          setSubmitFileUrl(res.urls[0]);
          setUploadStatus("فایل بارگذاری شد.");
        }
      } else {
        setSubmitError("پاسخی از سرور دریافت نشد.");
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || err.message || "خطا در بارگذاری فایل");
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
        melliCode: reqUserCode || profile?.melliCode || user.uid || ""
      });

      const updatedSeries = res?.series || (res?.id ? res : null);
      if (updatedSeries) {
        onUpdateSeries(updatedSeries);
        if (activeCatalogSeries?.id === series.id) {
          setActiveCatalogSeries(updatedSeries);
        }
        setReqSuccess("درخواست همکاری شما با موفقیت برای مدیریت ارسال شد. پس از بررسی، دسترسی شما فعال خواهد شد.");
      } else if (res?.success) {
        const existing = seriesList.find(s => s.id === series.id);
        if (existing) {
          const newContribs = [...(existing.contributors || [])];
          const exists = newContribs.find(c => c.userId === user.uid);
          if (exists) {
            exists.status = 'pending';
            exists.role = reqRole;
          } else {
            newContribs.push({
              userId: user.uid,
              email: user.email || "",
              displayName: profile?.displayName || user.displayName || user.email || "همکار",
              role: reqRole,
              status: "pending"
            });
          }
          const optim = { ...existing, contributors: newContribs };
          onUpdateSeries(optim);
          if (activeCatalogSeries?.id === series.id) {
            setActiveCatalogSeries(optim);
          }
        }
        setReqSuccess("درخواست همکاری شما با موفقیت برای مدیریت ارسال شد. پس از بررسی، دسترسی شما فعال خواهد شد.");
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
    const actionKey = `${seriesId}-${applicantUserId}`;
    setProcessingActionId(actionKey);
    try {
      const res = await apiClient.approveContributor(seriesId, applicantUserId, action, user?.uid, role);
      const updatedSeries = res?.series || (res?.id ? res : null);
      if (updatedSeries) {
        onUpdateSeries(updatedSeries);
      } else {
        // Optimistic local update fallback
        const existing = seriesList.find(s => s.id === seriesId);
        if (existing) {
          let updatedContribs = [...(existing.contributors || [])];
          if (action === "approve") {
            let found = false;
            updatedContribs = updatedContribs.map(c => {
              if (c.userId === applicantUserId) {
                found = true;
                return { ...c, status: "approved", role: role || c.role };
              }
              return c;
            });
            if (!found) {
              updatedContribs.push({
                userId: applicantUserId,
                displayName: "همکار",
                email: "",
                role: role || "translator",
                status: "approved"
              });
            }
          } else {
            updatedContribs = updatedContribs.filter(c => c.userId !== applicantUserId);
          }
          onUpdateSeries({ ...existing, contributors: updatedContribs });
        }
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
        setSubmitSuccess("فایل با موفقیت ارسال شد و در سیستم ثبت گردید.");
        setSubmitFileUrl("");
        setSubmitNote("");
        setSubmitImages("");
        setUploadStatus("");
        if (selectedSeriesId) {
          loadChaptersForSeries(selectedSeriesId);
        }
      }
    } catch (e: any) {
      setSubmitError(e.message || "خطا در ثبت فایل چپتر");
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
  const handleApproveChapter = async (seriesId: string, chId: string, chNumber: number) => {
    setProcessingActionId(chId);
    try {
      await apiClient.put(`/api/series/${seriesId}/chapters/${chId}/approve`, {}, user?.uid);
      alert(`چپتر ${chNumber} با موفقیت تایید و روی وب‌سایت منتشر شد! فایل‌های موقت Word/Zip پاکسازی گردید.`);
      if (selectedSeriesId === seriesId) {
        loadChaptersForSeries(seriesId);
      }
      if (activeSubTab === "admin_approval") {
        fetchPendingQueue();
      }
    } catch (e: any) {
      alert(`خطا در تایید چپتر: ${e.message}`);
    } finally {
      setProcessingActionId(null);
    }
  };

  // Admin Chapter Rejection
  const handleRejectChapter = async (seriesId: string, chId: string, chNumber: number) => {
    const note = rejectionNoteMap[chId] || "نیازمند اصلاح توسط کادر پروژه";
    setProcessingActionId(chId);
    try {
      await apiClient.rejectChapter(seriesId, chId, note, user?.uid);
      alert(`چپتر ${chNumber} رد شد و پیام علت رد برای کادر ارسالی ثبت گردید.`);
      if (selectedSeriesId === seriesId) {
        loadChaptersForSeries(seriesId);
      }
      if (activeSubTab === "admin_approval") {
        fetchPendingQueue();
      }
    } catch (e: any) {
      alert(`خطا در رد چپتر: ${e.message}`);
    } finally {
      setProcessingActionId(null);
    }
  };

  // All Chapters awaiting Admin Approval across all series
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
      
      {/* Sub-Tab Navigation Header */}
      <div className="bg-zinc-900/95 border border-white/10 rounded-2xl p-2.5 flex flex-wrap gap-2 items-center justify-between shadow-xl">
        <div className="flex flex-wrap gap-2">
          
          <button
            onClick={() => setActiveSubTab("contributor_dashboard")}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              activeSubTab === "contributor_dashboard"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-white/5 text-indigo-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Sparkles size={15} />
            پنل اختصاصی همکاران (آمار، ریز درآمدها، ارسال Word/Zip)
          </button>

          <button
            onClick={() => setActiveSubTab("all_series")}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              activeSubTab === "all_series"
                ? "bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <Search size={15} />
            کاتالوگ آثار و درخواست عضویت
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
            پروژه‌های من و آپلود چپترها
            {myApprovedSeries.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-black">
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
            {isGlobalAdmin ? "تسویه‌حساب‌های مالی کادر" : "تسویه‌حساب و درآمد من"}
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
                مدیریت تیم و درخواست‌ها
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
                مرکز بررسی و تایید چپترها
                {allPendingChaptersQueue.length > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black">
                    {allPendingChaptersQueue.length}
                  </span>
                )}
              </button>
            </>
          )}

        </div>

        <div className="text-[11px] text-zinc-400 font-bold px-3 py-1 bg-black/40 rounded-xl border border-white/5">
          نقش شما: <strong className="text-amber-400">{isSuperAdmin ? "مدیریت کل (Super Admin)" : profile?.role === "admin" ? "ادمین" : profile?.role === "translator" ? "مترجم" : profile?.role === "cleaner" ? "کلینر" : profile?.role === "editor" ? "ادیتور" : "همکار"}</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0: DEDICATED CONTRIBUTOR DASHBOARD (پنل اختصاصی همکاران) */}
      {/* ========================================================================= */}
      {activeSubTab === "contributor_dashboard" && (
        <ContributorDashboard
          seriesList={seriesList}
          user={user}
          profile={profile}
          isSuperAdmin={isSuperAdmin}
          onUpdateSeries={onUpdateSeries}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: CATALOG SEARCH & MEMBERSHIP REQUEST (کاتالوگ آثار و درخواست عضویت) */}
      {/* ========================================================================= */}
      {activeSubTab === "all_series" && (
        <div className="space-y-6">
          
          {/* Search & Filters Bar */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Search size={18} className="text-[var(--color-asura-accent)]" />
                  جستجوی کاتالوگ آثار و ثبت درخواست عضویت در تیم تولید
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  اثر مورد نظر خود را جستجو کرده و جهت دریافت مسئولیت (ترجمه، کلین، ادیت) درخواست عضویت ارسال نمایید.
                </p>
              </div>
              <span className="text-xs text-zinc-400 font-mono bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
                تعداد آثار: <strong className="text-white">{filteredCatalogSeries.length}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="جستجوی نام اثر، نویسنده یا طراح..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--color-asura-accent)]"
                />
                <Search size={16} className="absolute right-3 top-3 text-zinc-500" />
              </div>

              <div>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] font-bold"
                >
                  <option value="all">همه ژانرها</option>
                  {allGenresList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] font-bold"
                >
                  <option value="all">همه انواع (مانهوا، مانگا...)</option>
                  <option value="Manhwa">مانهوا (Manhwa)</option>
                  <option value="Manga">مانگا (Manga)</option>
                  <option value="Manhua">مانhua (Manhua)</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] font-bold"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="Ongoing">در حال انتشار (Ongoing)</option>
                  <option value="Completed">تکمیل شده (Completed)</option>
                  <option value="Hiatus">متوقف شده (Hiatus)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Series Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredCatalogSeries.map((s: any) => {
              const contribs = Array.isArray(s.contributors) ? s.contributors : [];
              const translator = contribs.find((c: any) => c.role === 'translator' && c.status === 'approved');
              const cleaner = contribs.find((c: any) => c.role === 'cleaner' && c.status === 'approved');
              const editor = contribs.find((c: any) => c.role === 'editor' && c.status === 'approved');
              
              const myContrib = contribs.find((c: any) => c.userId === user?.uid);
              const isApproved = myContrib?.status === 'approved';
              const isPending = myContrib?.status === 'pending';

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveCatalogSeries(s);
                    setReqError("");
                    setReqSuccess("");
                  }}
                  className="group bg-zinc-900 border border-white/10 hover:border-[var(--color-asura-accent)]/60 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-[var(--color-asura-accent)]/10"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-black">
                    <img
                      src={s.cover}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      <span className="bg-black/80 backdrop-blur text-[10px] font-mono font-black text-amber-400 px-2 py-0.5 rounded-lg border border-white/10">
                        {s.type || "Manhwa"}
                      </span>
                    </div>

                    {isApproved && (
                      <span className="absolute bottom-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                        <CheckCircle size={10} /> عضو تیم
                      </span>
                    )}

                    {isPending && (
                      <span className="absolute bottom-2 right-2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                        <Clock size={10} /> در انتظار تایید
                      </span>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <h4 className="text-xs font-black text-white group-hover:text-[var(--color-asura-accent-light)] transition-colors truncate">
                      {s.title}
                    </h4>

                    {/* Staff Roles Status Pills */}
                    <div className="space-y-1 text-[10px]">
                      <div className="flex items-center justify-between bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                        <span className="text-zinc-500">🗣️ مترجم:</span>
                        <span className={`font-bold truncate max-w-[80px] ${translator ? "text-emerald-400" : "text-amber-500/60"}`}>
                          {translator ? translator.displayName : "خالی"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                        <span className="text-zinc-500">🧹 کلینر:</span>
                        <span className={`font-bold truncate max-w-[80px] ${cleaner ? "text-teal-400" : "text-amber-500/60"}`}>
                          {cleaner ? cleaner.displayName : "خالی"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                        <span className="text-zinc-500">🎨 ادیتور:</span>
                        <span className={`font-bold truncate max-w-[80px] ${editor ? "text-purple-400" : "text-amber-500/60"}`}>
                          {editor ? editor.displayName : "خالی"}
                        </span>
                      </div>
                    </div>

                    <button className="w-full py-1.5 bg-white/5 group-hover:bg-[var(--color-asura-accent)] group-hover:text-white text-zinc-300 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1">
                      مشاهده و درخواست همکاری
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Series Detail & Team Application Modal */}
          {activeCatalogSeries && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar animate-fadeIn shadow-2xl">
                
                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={activeCatalogSeries.cover}
                      alt=""
                      className="w-16 h-22 object-cover rounded-xl border border-white/10 shrink-0"
                    />
                    <div>
                      <h3 className="text-base font-black text-white">{activeCatalogSeries.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                        نویسنده: {activeCatalogSeries.author || "نامشخص"} | طراح: {activeCatalogSeries.artist || "نامشخص"}
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

                {/* Current Staff Matrix */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <UsersIcon size={16} className="text-amber-400" />
                    کادر فعلی پروژه:
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {['translator', 'cleaner', 'editor'].map(role => {
                      const contrib = (activeCatalogSeries.contributors || []).find((c: any) => c.role === role && c.status === 'approved');
                      const roleLabel = role === 'translator' ? 'مترجم' : role === 'cleaner' ? 'کلینر' : 'ادیتور';

                      return (
                        <div key={role} className="p-3 bg-zinc-900/80 rounded-xl border border-white/5 space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold block">{roleLabel}:</span>
                          {contrib ? (
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-400">{contrib.displayName}</span>
                              {isGlobalAdmin && (
                                <button
                                  onClick={() => handleAdminProcessRequest(activeCatalogSeries.id, contrib.userId, "reject", role)}
                                  className="text-red-400 text-[9px] hover:underline"
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-amber-500/80">بلاتصدی (آماده عضویت)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Application or Access Locking Section */}
                {(() => {
                  const myContribObj = (activeCatalogSeries.contributors || []).find((c: any) => c.userId === user?.uid);
                  const isApproved = myContribObj?.status === "approved";
                  const isPending = myContribObj?.status === "pending";

                  if (isApproved) {
                    return (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-black text-emerald-400 flex items-center gap-2">
                            <CheckCircle size={16} /> شما عضو تایید شده تیم این اثر هستید
                          </h4>
                          <p className="text-[11px] text-zinc-400 mt-1">
                            نقش تایید شده: <strong className="text-white font-bold">{myContribObj.role === 'translator' ? 'مترجم' : myContribObj.role === 'cleaner' ? 'کلینر' : 'ادیتور'}</strong>
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSeriesId(activeCatalogSeries.id);
                            loadChaptersForSeries(activeCatalogSeries.id);
                            setActiveCatalogSeries(null);
                            setActiveSubTab("my_projects");
                          }}
                          className="px-5 py-2.5 bg-emerald-500 text-black font-black text-xs rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          ورود مستقیم به پنل آپلود چپتر
                        </button>
                      </div>
                    );
                  }

                  if (isPending) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl text-center space-y-2">
                        <Lock size={32} className="mx-auto text-amber-400 mb-1" />
                        <h4 className="text-sm font-black text-amber-400">پنل کاری این اثر در انتظار تایید مدیریت قفل می‌باشد</h4>
                        <p className="text-xs text-zinc-300">
                          درخواست همکاری شما برای نقش <strong className="text-white font-black">{myContribObj.role === 'translator' ? 'مترجم' : myContribObj.role === 'cleaner' ? 'کلینر' : 'ادیتور'}</strong> ثبت شده است. پس از تایید توسط مدیریت کل، دسترسی آپلود چپتر برای شما باز خواهد شد.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
                      <h4 className="text-xs font-black text-white flex items-center gap-2">
                        <Plus size={16} className="text-[var(--color-asura-accent)]" />
                        ثبت درخواست عضویت در تیم تولید این اثر
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1.5">انتخاب نقش درخواستی شما:</label>
                          <select
                            value={reqRole}
                            onChange={(e: any) => setReqRole(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                          >
                            <option value="translator">مترجم (Translator) - سهم ۲۰٪</option>
                            <option value="cleaner">کلینر (Cleaner) - سهم ۳۰٪</option>
                            <option value="editor">ادیتور و تایپیست (Editor) - سهم ۳۰٪</option>
                            <option value="proofreader">ویراستار (Proofreader)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1.5">شناسه اختصاصی کاربری:</label>
                          <input
                            type="text"
                            placeholder="شناسه اختصاصی شما..."
                            value={reqUserCode}
                            onChange={(e) => setReqUserCode(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-[var(--color-asura-accent)]"
                          />
                        </div>
                      </div>

                      {reqError && <p className="text-red-400 text-xs font-bold">{reqError}</p>}
                      {reqSuccess && <p className="text-emerald-400 text-xs font-bold">{reqSuccess}</p>}

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleSendRequest(activeCatalogSeries)}
                          disabled={submittingReq}
                          className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-xs rounded-xl transition-all shadow-lg flex items-center gap-2"
                        >
                          <Send size={14} />
                          {submittingReq ? "در حال ارسال..." : "ارسال درخواست عضویت به مدیریت"}
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
      {/* SUB-TAB 2: MY PROJECTS & CHAPTER WORKSTATION (پروژه‌های من و آپلود چپترها) */}
      {/* ========================================================================= */}
      {activeSubTab === "my_projects" && (
        <div className="space-y-6">
          
          {/* Projects Bar */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Briefcase size={18} className="text-[var(--color-asura-accent)]" />
              پروژه‌های فعال و تایید شده شما
            </h3>

            {myApprovedSeries.length === 0 ? (
              <div className="bg-black/30 border border-white/5 rounded-xl p-8 text-center text-zinc-400 space-y-2">
                <AlertCircle size={28} className="mx-auto text-amber-400 mb-1" />
                <p className="text-xs font-bold text-white">شما هنوز در هیچ پروژه‌ای عضو تایید شده نیستید.</p>
                <p className="text-[11px] text-zinc-500">از تب «کاتالوگ آثار و درخواست عضویت» برای ارسال درخواست به مدیریت اقدام فرمایید.</p>
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

          {/* Chapters List and Chapter Workstation */}
          {selectedSeriesId && (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
              
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <FileText size={18} className="text-[var(--color-asura-accent-light)]" />
                    میز کار چپترهای اثر: <span className="text-[var(--color-asura-accent-light)]">{seriesList.find((s: any) => s.id === selectedSeriesId)?.title}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    جهت آپلود ترجمه، کلین یا خروجی نهایی ادیتور، چپتر مورد نظر را باز نمایید.
                  </p>
                </div>

                <button
                  onClick={() => setShowCreateChapter(!showCreateChapter)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow"
                >
                  <Plus size={16} />
                  ایجاد سریع چپتر جدید
                </button>
              </div>

              {/* Fast Chapter Creation */}
              {showCreateChapter && (
                <div className="bg-black/60 border border-indigo-500/30 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-indigo-400">ایجاد چپتر جدید:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-bold mb-1">شماره چپتر (مثلا 1 یا 1.5):</label>
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

              {/* Chapters List Table */}
              {loadingChapters ? (
                <div className="p-8 text-center text-zinc-400 text-xs animate-pulse">در حال دریافت لیست چپترها...</div>
              ) : chaptersList.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs bg-black/30 rounded-xl border border-white/5">
                  هیچ چپتری برای این اثر ثبت نشده است. از دکمه «ایجاد سریع چپتر جدید» استفاده کنید.
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

                    const submissions = ch.submissions || [];
                    const translatorSub = submissions.find((s: any) => s.role === "translator");
                    const cleanerSub = submissions.find((s: any) => s.role === "cleaner");
                    const editorSub = submissions.find((s: any) => s.role === "editor");

                    const isRejected = ch.status === "rejected" || Boolean(ch.rejectionNote);

                    return (
                      <div key={ch.id} className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden shadow">
                        
                        {/* Chapter Summary Header */}
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
                                {isRejected ? (
                                  <span className="text-red-400 font-black bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                                    <AlertCircle size={10} /> رد شده توسط مدیریت (نیازمند اصلاح)
                                  </span>
                                ) : ch.isPending ? (
                                  <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    در انتظار بررسی و تایید مدیریت
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    منتشر شده (Public)
                                  </span>
                                )}

                                {translatorSub && <span className="text-blue-400 font-bold">✓ فایل ترجمه</span>}
                                {cleanerSub && <span className="text-teal-400 font-bold">✓ فایل کلین</span>}
                                {editorSub && <span className="text-purple-400 font-bold">✓ خروجی ادیت</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--color-asura-accent-light)] flex items-center gap-1">
                              {isExpanded ? "بستن پنل" : "ارسال فایل / دانلود فایل‌ها"}
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </div>
                        </div>

                        {/* Chapter Expanded Workstation */}
                        {isExpanded && (
                          <div className="p-5 border-t border-white/10 bg-zinc-900/90 space-y-5 animate-fadeIn">
                            
                            {/* Rejection Warning Banner */}
                            {isRejected && (
                              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-red-400 font-black text-xs">
                                  <AlertCircle size={18} />
                                  علت رد این چپتر توسط مدیریت:
                                </div>
                                <p className="text-xs text-red-200 bg-black/40 p-3 rounded-xl border border-red-500/20 font-bold">
                                  {ch.rejectionNote || "تایپوگرافی یا ترجمه نیازمند بازبینی و اصلاح می‌باشد."}
                                </p>
                                <p className="text-[11px] text-zinc-400">
                                  لطفا فایل اصلاح شده را مجددا از بخش مربوطه آپلود کنید تا وضعیت چپتر بروزرسانی گردد.
                                </p>
                              </div>
                            )}

                            {/* SOURCE FILES DISPLAY SECTION */}
                            <div className="bg-black/60 border border-white/10 rounded-2xl p-4 space-y-3">
                              <h5 className="text-xs font-black text-white flex items-center gap-2">
                                <Layers size={16} className="text-amber-400" />
                                فایل‌های اولیه ثبت شده برای چپتر {ch.number}:
                              </h5>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                
                                {/* 1. Translator File */}
                                <div className="p-3.5 bg-zinc-900 rounded-xl border border-white/5 space-y-2">
                                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">۱. فایل ترجمه (مترجم):</span>
                                  {translatorSub ? (
                                    <div className="space-y-2">
                                      <span className="text-xs font-black text-emerald-400 block">{translatorSub.userName}</span>
                                      {translatorSub.fileUrl ? (
                                        <a
                                          href={translatorSub.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-xl font-bold hover:bg-blue-500/30 transition-all"
                                        >
                                          <Download size={14} />
                                          دانلود فایل Word ترجمه
                                        </a>
                                      ) : (
                                        <span className="text-zinc-500 text-[10px]">بدون فایل پیوست</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-amber-500/70 text-xs font-bold block">هنوز ترجمه آپلود نشده است</span>
                                  )}
                                </div>

                                {/* 2. Cleaner File */}
                                <div className="p-3.5 bg-zinc-900 rounded-xl border border-white/5 space-y-2">
                                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">۲. فایل کلین (کلینر):</span>
                                  {cleanerSub ? (
                                    <div className="space-y-2">
                                      <span className="text-xs font-black text-teal-400 block">{cleanerSub.userName}</span>
                                      {cleanerSub.fileUrl ? (
                                        <a
                                          href={cleanerSub.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-xl font-bold hover:bg-teal-500/30 transition-all"
                                        >
                                          <Download size={14} />
                                          دانلود فایل Zip کلین
                                        </a>
                                      ) : (
                                        <span className="text-zinc-500 text-[10px]">بدون فایل پیوست</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-amber-500/70 text-xs font-bold block">هنوز کلین آپلود نشده است</span>
                                  )}
                                </div>

                              </div>
                            </div>

                            {/* ROLE-SPECIFIC UPLOAD ACTIONS */}
                            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4">
                              <h5 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/10 pb-3">
                                <UploadCloud size={16} className="text-[var(--color-asura-accent)]" />
                                پنل بارگذاری فایل اختصاصی (نقش شما: <span className="text-amber-400">{myRole === 'translator' ? 'مترجم' : myRole === 'cleaner' ? 'کلینر' : 'ادیتور'}</span>)
                              </h5>

                              {submitError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 font-bold">
                                  {submitError}
                                </div>
                              )}

                              {submitSuccess && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-bold">
                                  {submitSuccess}
                                </div>
                              )}

                              {/* FOR TRANSLATOR */}
                              {(myRole === "translator" || isGlobalAdmin) && (
                                <div className="space-y-3">
                                  <h6 className="text-xs font-bold text-zinc-300">📄 بارگذاری فایل Word ترجمه (.docx / .doc):</h6>
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <input
                                      type="file"
                                      accept=".doc,.docx,.txt"
                                      onChange={(e) => handleDirectFileUpload(e, "translator")}
                                      className="text-xs text-zinc-400 bg-black border border-white/10 rounded-xl p-2 file:ml-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white"
                                    />
                                    <button
                                      onClick={() => handleSubmitChapterWork(ch, "translator")}
                                      disabled={submittingWork || uploadingFile || !submitFileUrl}
                                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow flex items-center justify-center gap-1.5 shrink-0"
                                    >
                                      <Send size={14} />
                                      ثبت و ارسال فایل ترجمه
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* FOR CLEANER */}
                              {(myRole === "cleaner" || isGlobalAdmin) && (
                                <div className="space-y-3 pt-2">
                                  <h6 className="text-xs font-bold text-zinc-300">🎨 بارگذاری فایل Zip صفحات پاک‌سازی شده:</h6>
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <input
                                      type="file"
                                      accept=".zip,.rar,.7z"
                                      onChange={(e) => handleDirectFileUpload(e, "cleaner")}
                                      className="text-xs text-zinc-400 bg-black border border-white/10 rounded-xl p-2 file:ml-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white"
                                    />
                                    <button
                                      onClick={() => handleSubmitChapterWork(ch, "cleaner")}
                                      disabled={submittingWork || uploadingFile || !submitFileUrl}
                                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl transition-all shadow flex items-center justify-center gap-1.5 shrink-0"
                                    >
                                      <Send size={14} />
                                      ثبت و ارسال فایل کلین
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* FOR EDITOR (TYPESETTER) */}
                              {(myRole === "editor" || isGlobalAdmin) && (
                                <div className="space-y-4 pt-3 border-t border-white/10">
                                  <div>
                                    <h6 className="text-xs font-bold text-purple-300 mb-1">🖌️ بارگذاری صفحات نهایی تایپوگرافی شده (برای انتشار در سایت):</h6>
                                    <p className="text-[11px] text-zinc-400">
                                      تصاویر نهایی چپتر را انتخاب نمایید (یک یا چند تصویر):
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onChange={(e) => handleDirectFileUpload(e, "editor")}
                                      className="w-full text-xs text-zinc-400 bg-black border border-white/10 rounded-xl p-2 file:ml-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-purple-600 file:text-white"
                                    />

                                    {uploadStatus && <p className="text-xs text-purple-300 font-mono">{uploadStatus}</p>}

                                    <textarea
                                      rows={3}
                                      placeholder="لینک تصاویر صفحات (هر تصویر در یک سطر)..."
                                      value={submitImages}
                                      onChange={(e) => setSubmitImages(e.target.value)}
                                      className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                                    />
                                  </div>

                                  <div className="flex justify-end pt-1">
                                    <button
                                      onClick={() => handleSubmitChapterWork(ch, "editor")}
                                      disabled={submittingWork || uploadingFile || !submitImages.trim()}
                                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                                    >
                                      <Send size={14} />
                                      ثبت خروجی نهایی و ارسال به مدیریت جهت بررسی و انتشار
                                    </button>
                                  </div>
                                </div>
                              )}

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
      {/* SUB-TAB 3: ADMIN CHAPTER REVIEW & PUBLICATION CENTER (مرکز بررسی و تایید چپترها) */}
      {/* ========================================================================= */}
      {activeSubTab === "admin_approval" && isGlobalAdmin && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-black border border-indigo-500/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <FileCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">مرکز بررسی و تایید چپترهای ارسالی کادر</h3>
                  <p className="text-xs text-zinc-400">
                    بررسی خروجی نهایی ادیتورها، پاکسازی فایل‌های موقت Word/Zip پس از انتشار و واریز خودکار سهم درآمد
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={fetchPendingQueue}
              className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-2xl transition-all border border-white/10 flex items-center gap-2"
            >
              <RefreshCw size={16} className={loadingPendingQueue ? "animate-spin" : ""} />
              بروزرسانی صف بررسی ({allPendingChaptersQueue.length})
            </button>
          </div>

          {loadingPendingQueue ? (
            <div className="py-12 text-center text-xs text-zinc-400 animate-pulse">در حال دریافت چپترهای در انتظار بررسی...</div>
          ) : allPendingChaptersQueue.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-bold bg-black/30 rounded-3xl border border-white/5 space-y-2">
              <CheckCircle size={32} className="mx-auto text-emerald-500 mb-1" />
              <p className="text-sm font-black text-white">هیچ چپتری در صف انتظار بررسی وجود ندارد.</p>
              <p className="text-xs text-zinc-500">تمامی چپترهای ارسالی تعیین تکلیف شده‌اند.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allPendingChaptersQueue.map((ch: any) => (
                <div
                  key={ch.id}
                  className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-xl hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-4">
                      {ch.seriesCover && (
                        <img src={ch.seriesCover} alt="" className="w-12 h-16 object-cover rounded-xl border border-white/10" />
                      )}
                      <div>
                        <h4 className="text-sm font-black text-white">{ch.seriesTitle}</h4>
                        <span className="text-xs text-indigo-400 font-mono font-black mt-0.5 block">
                          چپتر {ch.number} ({ch.title})
                        </span>
                      </div>
                    </div>

                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                      <Clock size={14} /> در انتظار تایید مدیریت کل
                    </span>
                  </div>

                  {/* Revenue Share Preview Card */}
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2 text-xs">
                    <h5 className="font-black text-emerald-400 flex items-center gap-2">
                      <DollarSign size={16} /> پیش‌نمایش تقسیم درآمد حاصل از فروش این چپتر:
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-zinc-900 p-2.5 rounded-xl border border-white/5">
                        <span className="text-zinc-400 block">🗣️ مترجم:</span>
                        <strong className="text-emerald-400 font-black">۲۰٪ سهم فروش</strong>
                      </div>
                      <div className="bg-zinc-900 p-2.5 rounded-xl border border-white/5">
                        <span className="text-zinc-400 block">🧹 کلینر:</span>
                        <strong className="text-emerald-400 font-black">۳۰٪ سهم فروش</strong>
                      </div>
                      <div className="bg-zinc-900 p-2.5 rounded-xl border border-white/5">
                        <span className="text-zinc-400 block">🎨 ادیتور:</span>
                        <strong className="text-emerald-400 font-black">۳۰٪ سهم فروش</strong>
                      </div>
                      <div className="bg-zinc-900 p-2.5 rounded-xl border border-white/5">
                        <span className="text-zinc-400 block">🌐 سهم وب‌سایت:</span>
                        <strong className="text-emerald-400 font-black">۲۰٪ سهم فروش</strong>
                      </div>
                    </div>
                  </div>

                  {/* Submitted Pages Preview */}
                  {Array.isArray(ch.images) && ch.images.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-zinc-300 block">
                        پیش‌نمایش صفحات ارسالی ادیتور ({ch.images.length} صفحه):
                      </span>
                      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {ch.images.slice(0, 10).map((imgUrl: string, idx: number) => (
                          <img
                            key={idx}
                            src={imgUrl}
                            alt=""
                            className="w-20 h-28 object-cover rounded-xl border border-white/10 shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        placeholder="علت رد (در صورت عدم تایید)..."
                        value={rejectionNoteMap[ch.id] || ""}
                        onChange={(e) => setRejectionNoteMap({ ...rejectionNoteMap, [ch.id]: e.target.value })}
                        className="bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none w-full max-w-sm font-bold"
                      />
                      <button
                        onClick={() => handleRejectChapter(ch.seriesId, ch.id, ch.number)}
                        disabled={processingActionId === ch.id}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1 shadow shrink-0"
                      >
                        <X size={16} /> رد چپتر
                      </button>
                    </div>

                    <button
                      onClick={() => handleApproveChapter(ch.seriesId, ch.id, ch.number)}
                      disabled={processingActionId === ch.id}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
                    >
                      <Check size={18} /> تایید نهایی و انتشار عمومی (Public)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: SETTLEMENTS & FINANCIAL EARNINGS (تسویه‌حساب و درآمد کادر) */}
      {/* ========================================================================= */}
      {activeSubTab === "settlements" && (
        <div className="space-y-6">
          
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

          {/* New Settlement Form */}
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
      {/* SUB-TAB 5: ADMIN REQUESTS & TEAM MANAGEMENT (مدیریت درخواست‌ها و تیم) */}
      {/* ========================================================================= */}
      {activeSubTab === "admin_requests" && isGlobalAdmin && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Shield size={18} className="text-amber-400" />
                  درخواست‌های عضویت در انتظار تایید مدیریت کل ({pendingRequestsList.length})
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  درخواست‌های ارسال شده توسط همکاران جهت دریافت مسئولیت روی آثار مختلف
                </p>
              </div>
            </div>

            {pendingRequestsList.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs bg-black/30 rounded-xl border border-white/5">
                هیچ درخواستی در صف انتظار وجود ندارد.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequestsList.map((req: any) => (
                  <div
                    key={`${req.seriesId}-${req.userId}`}
                    className="bg-black/60 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <img src={req.seriesCover} alt="" className="w-10 h-14 object-cover rounded-lg" />
                      <div>
                        <h4 className="text-xs font-black text-white">{req.displayName || req.email}</h4>
                        <span className="text-[11px] text-zinc-400 block font-mono">{req.email}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-bold border border-amber-500/30">
                            نقش درخواستی: {req.role === 'translator' ? 'مترجم' : req.role === 'cleaner' ? 'کلینر' : 'ادیتور'}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-bold">
                            اثر: <strong className="text-white">{req.seriesTitle}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        disabled={processingActionId === `${req.seriesId}-${req.userId}`}
                        onClick={() => handleAdminProcessRequest(req.seriesId, req.userId, "approve", req.role)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-black text-xs rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {processingActionId === `${req.seriesId}-${req.userId}` ? (
                          <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : null}
                        تایید و اعطای دسترسی
                      </button>
                      <button
                        disabled={processingActionId === `${req.seriesId}-${req.userId}`}
                        onClick={() => handleAdminProcessRequest(req.seriesId, req.userId, "reject", req.role)}
                        className="flex-1 sm:flex-none px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow cursor-pointer disabled:cursor-not-allowed"
                      >
                        رد درخواست
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
