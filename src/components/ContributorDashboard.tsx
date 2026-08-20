import React, { useState, useEffect, useMemo } from "react";
import { apiClient, getSocketInstance } from "../lib/apiClient";
import {
  Briefcase,
  FileText,
  FileArchive,
  UploadCloud,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  BookOpen,
  Layers,
  Sparkles,
  Download,
  Eye,
  Check,
  X,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Trash2,
  Send,
  Calendar,
  Wallet,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  CheckSquare,
  Plus,
  Edit,
  List,
  ExternalLink
} from "lucide-react";
import { Series, Chapter } from "../lib/types";

interface ContributorDashboardProps {
  seriesList: Series[];
  user: any;
  profile: any;
  isSuperAdmin: boolean;
  roleMode?: "all" | "translator" | "cleaner" | "editor" | "approval";
  onUpdateSeries?: (updated: Series) => void;
}

export default function ContributorDashboard({
  seriesList,
  user,
  profile,
  isSuperAdmin,
  roleMode = "all",
  onUpdateSeries
}: ContributorDashboardProps) {
  const isGlobalAdmin = isSuperAdmin || profile?.role === "admin" || (profile?.roles && profile.roles.includes("admin"));
  
  // Dashboard Sub-tabs
  const [activeTab, setActiveTab] = useState<"stats" | "workspace" | "manage_chapters" | "approval" | "settlement">(
    roleMode === "approval" ? "approval" : "stats"
  );

  // Filter & Period
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [statsData, setStatsData] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");

  // Series selection in Workspace & Chapter Management
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>("");
  const [seriesChapters, setSeriesChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");

  // Chapter Management Specific States
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [chapterStatusFilter, setChapterStatusFilter] = useState<"all" | "pending" | "published">("all");
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [modalSeriesId, setModalSeriesId] = useState<string>("");
  const [chapterNumberInput, setChapterNumberInput] = useState<string>("");
  const [chapterTitleInput, setChapterTitleInput] = useState<string>("");
  const [chapterPriceInput, setChapterPriceInput] = useState<string>("0");
  const [chapterPagesText, setChapterPagesText] = useState<string>("");
  const [uploadingChapterPages, setUploadingChapterPages] = useState(false);
  const [chapterModalError, setChapterModalError] = useState("");
  const [chapterModalSuccess, setChapterModalSuccess] = useState("");
  const [savingChapter, setSavingChapter] = useState(false);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);

  // Submission Form States
  const [submittingRole, setSubmittingRole] = useState<"translator" | "cleaner" | "editor">(
    roleMode === "cleaner" ? "cleaner" : roleMode === "editor" ? "editor" : "translator"
  );
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitFileUrl, setSubmitFileUrl] = useState<string>("");
  const [submitNote, setSubmitNote] = useState<string>("");
  const [isAlsoCleaner, setIsAlsoCleaner] = useState(false);
  const [isAlsoEditor, setIsAlsoEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Admin Pending Chapters state
  const [pendingChapters, setPendingChapters] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvingChapterId, setApprovingChapterId] = useState<string | null>(null);
  const [approvalMessage, setApprovalMessage] = useState("");

  // Settlements state
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(profile?.walletBalance || 0);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCardOrSheba, setSettleCardOrSheba] = useState("");
  const [settleAccountHolder, setSettleAccountHolder] = useState(profile?.displayName || "");
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [settleMsg, setSettleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search in stats
  const [searchSeries, setSearchSeries] = useState("");
  const [expandedSeriesMap, setExpandedSeriesMap] = useState<Record<string, boolean>>({});

  // Generate Month Options
  const monthOptions = useMemo(() => {
    const opts = [{ value: "all", label: "کل دوره‌ها (All Time)" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().slice(0, 7);
      opts.push({ value: val, label: `ماه ${val}` });
    }
    return opts;
  }, []);

  // Fetch Contributor Stats
  const fetchMyStats = async () => {
    if (!user?.uid) return;
    setLoadingStats(true);
    setStatsError("");
    try {
      const url = isGlobalAdmin
        ? `/api/admin/contributor-earnings/${user.uid}?month=${selectedMonth}`
        : `/api/contributor/my-stats?month=${selectedMonth}&uid=${user.uid}`;
      const data = await apiClient.get(url);
      if (data && !data.error) {
        setStatsData(data);
        if (data.user?.walletBalance !== undefined) {
          setWalletBalance(data.user.walletBalance);
        }
      } else {
        setStatsError(data?.error || "خطا در بارگذاری اطلاعات کارنامه همکار");
      }
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      setStatsError(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Admin Pending Chapters
  const fetchPendingChapters = async () => {
    if (!isGlobalAdmin) return;
    setLoadingPending(true);
    try {
      const data = await apiClient.get("/api/admin/pending-chapters");
      if (Array.isArray(data)) {
        setPendingChapters(data);
      }
    } catch (err) {
      console.error("Failed to load pending chapters:", err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Fetch Settlements
  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const res = await apiClient.getSettlementRequests(isGlobalAdmin ? undefined : user?.uid);
      if (Array.isArray(res)) {
        setSettlements(res);
      }
    } catch (err) {
      console.error("Failed to fetch settlements:", err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  useEffect(() => {
    fetchMyStats();
  }, [user?.uid, selectedMonth]);

  useEffect(() => {
    if (activeTab === "approval" && isGlobalAdmin) {
      fetchPendingChapters();
    }
    if (activeTab === "settlement") {
      fetchSettlements();
    }
  }, [activeTab, isGlobalAdmin]);

  // Real-time live listener
  useEffect(() => {
    const socket = getSocketInstance();
    const handleUpdate = () => {
      fetchMyStats();
      if (isGlobalAdmin) fetchPendingChapters();
    };
    socket.on("chapters:updated", handleUpdate);
    socket.on("revenue:updated", handleUpdate);
    socket.on("wallet:any_update", handleUpdate);

    return () => {
      socket.off("chapters:updated", handleUpdate);
      socket.off("revenue:updated", handleUpdate);
      socket.off("wallet:any_update", handleUpdate);
    };
  }, [user?.uid, selectedMonth, isGlobalAdmin]);

  // Fetch chapters when series selected in workspace
  useEffect(() => {
    if (!selectedSeriesId) {
      setSeriesChapters([]);
      setSelectedChapterId("");
      return;
    }
    const loadChapters = async () => {
      setLoadingChapters(true);
      try {
        const chs = await apiClient.getChapters(selectedSeriesId);
        if (Array.isArray(chs)) {
          setSeriesChapters(chs);
          if (chs.length > 0) {
            setSelectedChapterId(chs[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch chapters for series:", err);
      } finally {
        setLoadingChapters(false);
      }
    };
    loadChapters();
  }, [selectedSeriesId]);

  // Filter series where the user is an assigned contributor or admin
  const userAssignedSeries = useMemo(() => {
    if (isGlobalAdmin) return seriesList;
    const uid = user?.uid;
    const email = user?.email?.toLowerCase();
    return seriesList.filter((s: Series) => {
      if (!Array.isArray(s.contributors)) return false;
      return s.contributors.some((c: any) => {
        const cId = c.userId || c.id;
        const cEmail = c.email?.toLowerCase();
        return (cId === uid || (email && cEmail === email)) && (!c.status || c.status === "approved");
      });
    });
  }, [seriesList, user?.uid, user?.email, isGlobalAdmin]);

  // Auto select first series if available
  useEffect(() => {
    if (userAssignedSeries.length > 0 && !selectedSeriesId) {
      setSelectedSeriesId(userAssignedSeries[0].id);
    }
  }, [userAssignedSeries, selectedSeriesId]);

  // Handle Direct File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extensions
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (submittingRole === "translator") {
      if (!["docx", "doc", "txt", "rtf"].includes(ext)) {
        setSubmitError("برای بخش ترجمه، لطفاً فایل Word (.docx / .doc) یا فایل متنی (.txt) بارگذاری فرمایید.");
        return;
      }
    } else {
      if (!["zip", "rar", "7z", "tar"].includes(ext)) {
        setSubmitError("برای بخش کلینر / ادیتور، لطفاً فایل آرشیو فشرده (.zip یا .rar) شامل تصاویر صفحات را بارگذاری فرمایید.");
        return;
      }
    }

    setSubmitFile(file);
    setUploading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("file", file);
      const res = await apiClient.uploadFile(formData, user?.uid);
      const finalUrl = res?.url || (Array.isArray(res?.urls) ? res.urls[0] : "");
      if (finalUrl) {
        setSubmitFileUrl(finalUrl);
        setSubmitSuccess(`فایل «${file.name}» با موفقیت در سرور آپلود شد.`);
      } else {
        setSubmitError("خطا در ذخیره‌سازی فایل روی سرور.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setSubmitError(err.message || "خطا در آپلود فایل");
    } finally {
      setUploading(false);
    }
  };

  // Submit Chapter Work
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeriesId || !selectedChapterId) {
      setSubmitError("لطفاً اثر و چپتر مورد نظر را انتخاب فرمایید.");
      return;
    }
    if (!submitFileUrl && !submitNote.trim()) {
      setSubmitError("لطفاً ابتدا فایل کار انجام شده را آپلود کنید یا لینک فایل را قرار دهید.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const payload = {
        userId: user?.uid,
        userName: profile?.displayName || user?.email || "همکار",
        role: submittingRole,
        fileUrl: submitFileUrl,
        note: submitNote.trim(),
        isAlsoCleaner,
        isAlsoEditor
      };

      const res = await apiClient.post(`/api/series/${selectedSeriesId}/chapters/${selectedChapterId}/submit`, payload);
      if (res && res.id) {
        setSubmitSuccess("کار شما با موفقیت ثبت شد و در سیستم قرار گرفت. سهم درآمدی این چپتر نیز برای شما فعال گردید.");
        setSubmitFile(null);
        setSubmitFileUrl("");
        setSubmitNote("");
        fetchMyStats();
        // Refresh chapter list
        const updated = await apiClient.getChapters(selectedSeriesId);
        setSeriesChapters(updated);
      } else {
        setSubmitError(res?.error || "خطا در ثبت کار.");
      }
    } catch (err: any) {
      console.error("Submit work error:", err);
      setSubmitError(err.message || "خطا در ارسال اطلاعات به سرور");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add Chapter Modal
  const handleOpenAddChapter = () => {
    setEditingChapter(null);
    const targetSerId = selectedSeriesId || (userAssignedSeries[0]?.id || "");
    setModalSeriesId(targetSerId);
    
    // Auto increment chapter number
    let nextNum = 1;
    if (seriesChapters.length > 0) {
      const maxNum = Math.max(...seriesChapters.map(c => Number(c.number) || 0));
      nextNum = isFinite(maxNum) ? maxNum + 1 : seriesChapters.length + 1;
    }
    setChapterNumberInput(String(nextNum));
    setChapterTitleInput("");
    setChapterPriceInput("0");
    setChapterPagesText("");
    setChapterModalError("");
    setChapterModalSuccess("");
    setShowChapterModal(true);
  };

  // Open Edit Chapter Modal
  const handleOpenEditChapter = (ch: any) => {
    setEditingChapter(ch);
    setModalSeriesId(selectedSeriesId);
    setChapterNumberInput(String(ch.number));
    setChapterTitleInput(ch.title || "");
    setChapterPriceInput(String(ch.price || 0));
    setChapterPagesText(Array.isArray(ch.images) ? ch.images.join("\n") : (ch.images || ""));
    setChapterModalError("");
    setChapterModalSuccess("");
    setShowChapterModal(true);
  };

  // Upload Chapter Pages (Images / Zip)
  const handleChapterPagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingChapterPages(true);
    setChapterModalError("");
    setChapterModalSuccess("");

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      
      const foundSeries = seriesList.find(s => s.id === (modalSeriesId || selectedSeriesId));
      if (foundSeries) {
        formData.append("seriesTitle", foundSeries.title);
        formData.append("seriesId", foundSeries.id);
      }
      if (chapterNumberInput) {
        formData.append("chapterNumber", chapterNumberInput.trim());
      }
      formData.append("folderType", "chapters");

      const res = await apiClient.uploadFile(formData, user?.uid);
      if (res && (res.urls || res.url)) {
        const newUrls: string[] = Array.isArray(res.urls) ? res.urls : (res.url ? [res.url] : []);
        setChapterPagesText(prev => {
          const existing = prev.split("\n").map(s => s.trim()).filter(Boolean);
          const combined = [...existing, ...newUrls];
          return combined.join("\n");
        });
        setChapterModalSuccess(`تعداد ${newUrls.length} تصویر با موفقیت آپلود و اضافه شد.`);
      } else {
        setChapterModalError("خطا در پردازش و ذخیره تصاویر بر روی سرور.");
      }
    } catch (err: any) {
      console.error("Chapter pages upload error:", err);
      setChapterModalError(err.message || "خطا در آپلود صفحات");
    } finally {
      setUploadingChapterPages(false);
    }
  };

  // Save Chapter Submit
  const handleSaveChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSeriesId) {
      setChapterModalError("لطفا یک اثر را انتخاب کنید.");
      return;
    }
    if (!chapterNumberInput.trim()) {
      setChapterModalError("شماره چپتر الزامی است.");
      return;
    }

    const pages = chapterPagesText.split("\n").map(s => s.trim()).filter(Boolean);
    if (pages.length === 0) {
      setChapterModalError("حداقل یک صفحه یا تصویر برای چپتر الزامی است.");
      return;
    }

    setSavingChapter(true);
    setChapterModalError("");
    setChapterModalSuccess("");

    try {
      const parsedPrice = parseInt(chapterPriceInput) || 0;
      const parsedNum = parseFloat(chapterNumberInput) || chapterNumberInput;
      
      const chapterData: any = {
        ...(editingChapter || {}),
        id: editingChapter?.id || `${modalSeriesId}-ch-${chapterNumberInput.trim()}`,
        number: parsedNum,
        title: chapterTitleInput.trim(),
        price: parsedPrice,
        images: pages,
        // Contributors default to pending approval unless global admin
        isPending: isGlobalAdmin ? (editingChapter?.isPending ?? false) : true,
        createdAt: editingChapter?.createdAt || new Date().toISOString()
      };

      const res = await apiClient.saveChapter(modalSeriesId, chapterData);
      if (res && res.id) {
        setChapterModalSuccess(
          isGlobalAdmin
            ? "چپتر با موفقیت ذخیره شد."
            : "چپتر با موفقیت ثبت شد و در صف تایید مدیریت قرار گرفت."
        );
        // Refresh chapters
        const chs = await apiClient.getChapters(modalSeriesId);
        if (Array.isArray(chs)) {
          setSeriesChapters(chs);
        }
        fetchMyStats();
        if (onUpdateSeries) {
          const found = seriesList.find(s => s.id === modalSeriesId);
          if (found) onUpdateSeries(found);
        }
        setTimeout(() => {
          setShowChapterModal(false);
        }, 1200);
      } else {
        setChapterModalError(res?.error || "خطا در ذخیره چپتر");
      }
    } catch (err: any) {
      console.error("Save chapter error:", err);
      setChapterModalError(err.message || "خطا در برقراری ارتباط با سرور");
    } finally {
      setSavingChapter(false);
    }
  };

  // Delete Chapter
  const handleDeleteChapter = async (chapterId: string, chapterNum: string | number) => {
    if (!window.confirm(`آیا از حذف کامل چپتر ${chapterNum} اطمینان دارید؟`)) {
      return;
    }
    try {
      await apiClient.deleteChapter(selectedSeriesId, chapterId, user?.uid);
      const chs = await apiClient.getChapters(selectedSeriesId);
      setSeriesChapters(chs);
      fetchMyStats();
    } catch (err: any) {
      alert("خطا در حذف چپتر: " + err.message);
    }
  };

  // Admin Approve & Publish Chapter + Auto Cleanup Intermediate Files
  const handleApproveAndPublish = async (seriesId: string, chapterId: string, chapterNum: string | number) => {
    if (!window.confirm(`آیا از تایید و انتشار عمومی چپتر ${chapterNum} اطمینان دارید؟ فایل‌های میانی ترجمه و کلین به صورت خودکار از فضای هاست پاکسازی خواهند شد.`)) {
      return;
    }

    setApprovingChapterId(chapterId);
    setApprovalMessage("");

    try {
      const res = await apiClient.post(`/api/series/${seriesId}/chapters/${chapterId}/approve-publish`, {});
      if (res && res.success) {
        setApprovalMessage(`چپتر ${chapterNum} با موفقیت تایید و عمومی شد. (${res.cleanedFilesCount || 0} فایل میانی موقت از هاست پاکسازی گردید).`);
        fetchPendingChapters();
        fetchMyStats();
      } else {
        setApprovalMessage(res?.error || "خطا در تایید و انتشار چپتر");
      }
    } catch (err: any) {
      console.error("Approval error:", err);
      setApprovalMessage(err.message || "خطا در عملیات تایید");
    } finally {
      setApprovingChapterId(null);
    }
  };

  // Submit Settlement Request
  const handleRequestSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleMsg(null);

    const amt = Number(settleAmount);
    if (!amt || amt < 10000) {
      setSettleMsg({ type: "error", text: "حداقل مبلغ قابل تسویه 10,000 تومان می‌باشد." });
      return;
    }
    if (amt > walletBalance) {
      setSettleMsg({ type: "error", text: `مبلغ درخواستی (${amt.toLocaleString()} تومان) از موجودی شما (${walletBalance.toLocaleString()} تومان) بیشتر است.` });
      return;
    }
    if (!settleCardOrSheba.trim() || !settleAccountHolder.trim()) {
      setSettleMsg({ type: "error", text: "لطفاً شماره کارت/شبا و نام صاحب حساب را وارد فرمایید." });
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
        setSettleMsg({ type: "success", text: "درخواست تسویه با موفقیت ثبت شد و در صف بررسی مالی قرار گرفت." });
        setSettleAmount("");
        fetchSettlements();
        fetchMyStats();
      } else {
        setSettleMsg({ type: "error", text: res?.error || "خطا در ثبت درخواست تسویه" });
      }
    } catch (err: any) {
      console.error("Settlement error:", err);
      setSettleMsg({ type: "error", text: err.message || "خطا در ثبت درخواست" });
    } finally {
      setSettleSubmitting(false);
    }
  };

  const toggleSeriesAccordion = (sId: string) => {
    setExpandedSeriesMap(prev => ({ ...prev, [sId]: !prev[sId] }));
  };

  // Filter breakdown series
  const filteredSeriesBreakdown = useMemo(() => {
    if (!statsData?.seriesBreakdown) return [];
    if (!searchSeries.trim()) return statsData.seriesBreakdown;
    return statsData.seriesBreakdown.filter((s: any) =>
      s.seriesTitle.toLowerCase().includes(searchSeries.toLowerCase())
    );
  }, [statsData, searchSeries]);

  return (
    <div id="contributor-dashboard-container" className="space-y-6">
      {/* Top Banner / Header Card */}
      <div id="contributor-header-banner" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
              roleMode === 'translator' ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400' :
              roleMode === 'cleaner' ? 'bg-amber-600/20 border border-amber-500/30 text-amber-400' :
              roleMode === 'editor' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400' :
              roleMode === 'approval' ? 'bg-purple-600/20 border border-purple-500/30 text-purple-400' :
              'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
            }`}>
              {roleMode === 'translator' ? <FileText className="w-7 h-7" /> :
               roleMode === 'cleaner' ? <FileArchive className="w-7 h-7" /> :
               roleMode === 'editor' ? <Sparkles className="w-7 h-7" /> :
               roleMode === 'approval' ? <ShieldCheck className="w-7 h-7" /> :
               <Briefcase className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white">
                  {roleMode === 'translator' ? 'پنل اختصاصی مترجمین و ارسال ترجمه چپترها' :
                   roleMode === 'cleaner' ? 'پنل اختصاصی کلینرها و تمیزکاری صفحات' :
                   roleMode === 'editor' ? 'پنل اختصاصی ادیتورها و تایپ‌ست نهایی' :
                   roleMode === 'approval' ? 'پنل مدیریت تایید و انتشار عمومی چپترها' :
                   'میز کار اختصاصی دست‌اندرکاران (مترجمین، کلینرها، ادیتورها)'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  roleMode === 'translator' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                  roleMode === 'cleaner' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  roleMode === 'editor' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                  roleMode === 'approval' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                }`}>
                  {roleMode === 'translator' ? 'بخش ترجمه' :
                   roleMode === 'cleaner' ? 'بخش کلین' :
                   roleMode === 'editor' ? 'بخش ادیت' :
                   roleMode === 'approval' ? 'مدیریت کل' :
                   (profile?.role === "admin" ? "مدیریت کل" : "همکار رسمی")}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {roleMode === 'translator' ? 'مشاهده ریز درآمدها، تعداد فروش چپترهای ترجمه‌شده و ارسال فایل Word ترجمه برای ادامه کار کلینرها و ادیتورها' :
                 roleMode === 'cleaner' ? 'مشاهده کارنامه مالی، دانلود فایل ترجمه مترجم و ارسال فایل فشرده Zip صفحات تمیزکاری شده' :
                 roleMode === 'editor' ? 'دانلود فایل‌های ترجمه و کلین، ارسال فایل نهایی Zip و ارسال به صف تایید مدیریت کل جهت انتشار' :
                 roleMode === 'approval' ? 'بررسی چپترهای تکمیل‌شده توسط ادیتورها، تایید انتشار عمومی و پاکسازی خودکار فایل‌های موقت هاست' :
                 'مشاهده ریز دقیق آمار فروش، درآمد لحظه‌ای به تفکیک چپتر و اثر، ارسال فایل ترجمه و کلین و مدیریت گردش کار'}
              </p>
            </div>
          </div>

          {/* Quick Wallet & Refresh */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2 text-right">
              <span className="text-xs text-slate-400 block font-medium">موجودی کیف پول شما</span>
              <span className="text-lg font-black text-emerald-400">
                {walletBalance.toLocaleString("fa-IR")} <span className="text-xs text-slate-400 font-normal">تومان</span>
              </span>
            </div>
            <button
              id="refresh-stats-btn"
              onClick={() => fetchMyStats()}
              disabled={loadingStats}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
              title="بروزرسانی داده‌ها"
            >
              <RefreshCw className={`w-5 h-5 ${loadingStats ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div id="contributor-tabs" className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            id="tab-stats"
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "stats"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            کارنامه مالی و ریز درآمدها
          </button>

          <button
            id="tab-workspace"
            onClick={() => setActiveTab("workspace")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "workspace"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            میز ارسال کار (Word / Zip)
          </button>

          <button
            id="tab-manage-chapters"
            onClick={() => setActiveTab("manage_chapters")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "manage_chapters"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <List className="w-4 h-4 text-purple-300" />
            مدیریت و آپلود مستقیم چپترها
            {seriesChapters.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-200 font-bold border border-purple-500/30">
                {seriesChapters.length}
              </span>
            )}
          </button>

          {isGlobalAdmin && (
            <button
              id="tab-approval"
              onClick={() => setActiveTab("approval")}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === "approval"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                  : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              صف تایید و انتشار مدیریت
              {pendingChapters.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-slate-950 font-black">
                  {pendingChapters.length}
                </span>
              )}
            </button>
          )}

          <button
            id="tab-settlement"
            onClick={() => setActiveTab("settlement")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === "settlement"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            درخواست تسویه حساب
          </button>
        </div>
      </div>

      {/* TAB 1: DETAILED STATS & REVENUE BREAKDOWN */}
      {activeTab === "stats" && (
        <div id="stats-tab-content" className="space-y-6">
          {/* Filter Period & Search Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-bold text-slate-200">بازه محاسباتی:</span>
              <select
                id="period-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-stats-series"
                type="text"
                value={searchSeries}
                onChange={(e) => setSearchSeries(e.target.value)}
                placeholder="جستجو در بین آثار..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">مجموع درآمد کسب‌شده</span>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">
                  {(statsData?.totalEarnings || 0).toLocaleString("fa-IR")}
                </span>
                <span className="text-xs text-slate-400 mr-1.5 font-medium">تومان</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">سهم خالص از فروش مستقیم چپترها</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">تعداد کل فروش‌ها</span>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">
                  {(statsData?.totalSalesCount || 0).toLocaleString("fa-IR")}
                </span>
                <span className="text-xs text-slate-400 mr-1.5 font-medium">بار خرید</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">تعداد خرید کاربران در چپترهای شما</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">تعداد چپترهای مشارکت‌شده</span>
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">
                  {(statsData?.totalChaptersContributed || 0).toLocaleString("fa-IR")}
                </span>
                <span className="text-xs text-slate-400 mr-1.5 font-medium">چپتر</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">در تمام آثار تحت همکاری</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">تعداد آثار (مانگا/مانهوا)</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">
                  {(statsData?.seriesBreakdown?.length || 0).toLocaleString("fa-IR")}
                </span>
                <span className="text-xs text-slate-400 mr-1.5 font-medium">عنوان اثر</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">پروژه‌های فعال در سیستم</p>
            </div>
          </div>

          {/* Series Breakdown Detailed List */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              ریز کارنامه و درآمد به تفکیک هر اثر و چپتر
            </h2>

            {loadingStats ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">در حال محاسبه دقیق آمار و درآمدهای همکار...</p>
              </div>
            ) : filteredSeriesBreakdown.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">اطلاعاتی در این بازه یافت نشد</h3>
                <p className="text-sm text-slate-500 mt-1">
                  شما هنوز در اثری به عنوان مترجم، کلینر یا ادیتور ثبت نشده‌اید یا فروشی برای چپترهای شما ثبت نگردیده است.
                </p>
              </div>
            ) : (
              filteredSeriesBreakdown.map((seriesItem: any) => {
                const isExpanded = expandedSeriesMap[seriesItem.seriesId] !== false; // expanded by default
                return (
                  <div
                    key={seriesItem.seriesId}
                    id={`series-card-${seriesItem.seriesId}`}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition"
                  >
                    {/* Series Header Card */}
                    <div
                      onClick={() => toggleSeriesAccordion(seriesItem.seriesId)}
                      className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={seriesItem.cover || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150"}
                          alt={seriesItem.seriesTitle}
                          className="w-14 h-20 object-cover rounded-xl border border-slate-700 shadow-md flex-shrink-0"
                        />
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                            {seriesItem.seriesTitle}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                            <span>
                              کل چپترهای اثر: <strong className="text-slate-200">{seriesItem.totalChapters}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              چپترهای مشارکت شما: <strong className="text-indigo-400">{seriesItem.userContributedChaptersCount}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              تعداد فروش کل اثر: <strong className="text-slate-200">{seriesItem.totalSeriesSalesCount.toLocaleString("fa-IR")} بار</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Series Earnings Summary */}
                      <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">درآمد شما از این اثر</span>
                          <span className="text-lg font-black text-emerald-400">
                            {seriesItem.userSeriesEarnings.toLocaleString("fa-IR")} <span className="text-xs text-slate-400 font-normal">تومان</span>
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Chapter Breakdown Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/80 bg-slate-950/50 p-4 sm:p-5">
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 font-bold">
                                <th className="pb-3 pr-2">شماره چپتر</th>
                                <th className="pb-3 px-3">نقش و درصد شما</th>
                                <th className="pb-3 px-3">تعداد فروش</th>
                                <th className="pb-3 px-3">فروش ناخالص چپتر</th>
                                <th className="pb-3 px-3">درآمد خالص شما</th>
                                <th className="pb-3 pl-2">وضعیت انتشار</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {seriesItem.chapters.map((ch: any) => (
                                <tr key={ch.chapterId} className="hover:bg-slate-900/60 transition">
                                  <td className="py-3 pr-2 font-bold text-white">
                                    {ch.chapterTitle || `چپتر ${ch.chapterNumber}`}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      {ch.userRoles.map((ur: any, idx: number) => (
                                        <span
                                          key={idx}
                                          className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                            ur.roleId === "translator"
                                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                              : ur.roleId === "cleaner"
                                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                          }`}
                                        >
                                          {ur.roleName} ({ur.userPercentage ? Math.round(ur.userPercentage) : ur.rolePercentage}٪)
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-semibold text-slate-300">
                                    {ch.salesCount.toLocaleString("fa-IR")} بار
                                  </td>
                                  <td className="py-3 px-3 font-semibold text-slate-400">
                                    {ch.chapterTotalSalesAmount.toLocaleString("fa-IR")} تومان
                                  </td>
                                  <td className="py-3 px-3 font-black text-emerald-400">
                                    {ch.userEarnings.toLocaleString("fa-IR")} تومان
                                  </td>
                                  <td className="py-3 pl-2">
                                    {ch.isPending ? (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        در انتظار تایید مدیریت
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max">
                                        <Check className="w-3 h-3" />
                                        منتشر شده در سایت
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WORKSPACE & FILE SUBMISSION (WORD / ZIP) */}
      {activeTab === "workspace" && (
        <div id="workspace-tab-content" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-black text-white flex items-center gap-2 mb-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              ارسال فایل کار (ترجمه / کلین / ادیت نهایی)
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              مترجمین گرامی فایل Word (.docx) و کلینرها و ادیتورها فایل فشرده (.zip) خود را در این بخش ارسال نمایند.
            </p>

            <form onSubmit={handleSubmitWork} className="space-y-6">
              {/* Step 1 & 2: Select Series and Chapter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    ۱. انتخاب اثر (مانگا/مانهوا) *
                  </label>
                  <select
                    id="submit-series-select"
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- انتخاب اثر --</option>
                    {userAssignedSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.status || "در حال پخش"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    ۲. انتخاب شماره چپتر *
                  </label>
                  <select
                    id="submit-chapter-select"
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    disabled={loadingChapters || seriesChapters.length === 0}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                    required
                  >
                    <option value="">-- انتخاب چپتر --</option>
                    {seriesChapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        چپتر {ch.number} {ch.title ? `(${ch.title})` : ""} {ch.isPending ? "[در انتظار تایید]" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Download Files from Previous Roles (Translator Word, Cleaner Zip, Editor Zip) */}
              {selectedChapterId && (() => {
                const currentCh = seriesChapters.find(c => c.id === selectedChapterId);
                const chapterSubs = currentCh?.submissions || [];
                if (chapterSubs.length === 0) return null;

                return (
                  <div className="bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-indigo-300 flex items-center gap-2">
                        <Download className="w-4 h-4 text-indigo-400" />
                        فایل‌های ثبت‌شده همکاران برای چپتر {currentCh?.number} (دانلود جهت شروع کلین / ادیت):
                      </h4>
                      <span className="text-[11px] text-slate-400 font-bold">{chapterSubs.length} فایل ثبت‌شده</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {chapterSubs.map((sub: any, sIdx: number) => (
                        <div key={sIdx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                sub.role === 'translator' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                sub.role === 'cleaner' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}>
                                {sub.role === 'translator' ? 'فایل ترجمه (Word)' : sub.role === 'cleaner' ? 'فایل کلین (Zip)' : 'فایل ادیت (Zip)'}
                              </span>
                              <span className="text-xs font-bold text-white">{sub.userName || 'همکار'}</span>
                            </div>
                          </div>

                          {sub.note && (
                            <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800 line-clamp-2">
                              {sub.note}
                            </p>
                          )}

                          {sub.fileUrl ? (
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="mt-1 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              دانلود فایل ({sub.role === 'translator' ? 'متن Word' : 'آرشیو Zip'})
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">بدون فایل پیوست</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Step 3: Select Role */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  ۳. بخش و نقش شما در این ارسال *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSubmittingRole("translator")}
                    className={`p-4 rounded-xl border text-right transition flex items-center gap-3 ${
                      submittingRole === "translator"
                        ? "bg-emerald-500/15 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                    }`}
                  >
                    <FileText className={`w-5 h-5 ${submittingRole === "translator" ? "text-emerald-400" : "text-slate-400"}`} />
                    <div>
                      <span className="font-bold text-sm block">مترجم (فایل Word / Docx)</span>
                      <span className="text-xs text-slate-400">ارسال متن ترجمه شده چپتر</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmittingRole("cleaner")}
                    className={`p-4 rounded-xl border text-right transition flex items-center gap-3 ${
                      submittingRole === "cleaner"
                        ? "bg-amber-500/15 border-amber-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                    }`}
                  >
                    <FileArchive className={`w-5 h-5 ${submittingRole === "cleaner" ? "text-amber-400" : "text-slate-400"}`} />
                    <div>
                      <span className="font-bold text-sm block">کلینر (فایل Zip صفحات خام)</span>
                      <span className="text-xs text-slate-400">ارسال صفحات تمیزکاری‌شده</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmittingRole("editor")}
                    className={`p-4 rounded-xl border text-right transition flex items-center gap-3 ${
                      submittingRole === "editor"
                        ? "bg-blue-500/15 border-blue-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                    }`}
                  >
                    <Sparkles className={`w-5 h-5 ${submittingRole === "editor" ? "text-blue-400" : "text-slate-400"}`} />
                    <div>
                      <span className="font-bold text-sm block">ادیتور (فایل نهایی Zip)</span>
                      <span className="text-xs text-slate-400">تایپ و ادیت نهایی صفحات</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 4: File Upload / Drag & Drop */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  ۴. آپلود مستقیم فایل {submittingRole === "translator" ? "Word (.docx / .doc / .txt)" : "فشرده (.zip / .rar)"} *
                </label>

                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-2xl p-6 text-center bg-slate-950/40 transition relative">
                  <input
                    type="file"
                    id="contributor-file-input"
                    accept={
                      submittingRole === "translator"
                        ? ".docx,.doc,.txt,.rtf"
                        : ".zip,.rar,.7z"
                    }
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <UploadCloud className="w-10 h-10 text-indigo-400 mb-2" />
                    <span className="text-sm font-bold text-white">
                      {uploading ? "در حال بارگذاری فایل بر روی سرور..." : "برای انتخاب یا کشیدن فایل اینجا کلیک کنید"}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      {submittingRole === "translator"
                        ? "پشتیبانی از فرمت‌های .docx, .doc, .txt"
                        : "پشتیبانی از فایل‌های فشرده .zip و .rar شامل تصاویر صفحات"}
                    </span>
                  </div>
                </div>

                {/* File URL or Manual Link */}
                {submitFileUrl && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                      <CheckCircle className="w-4 h-4" />
                      <span>لینک فایل آماده: {submitFileUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubmitFileUrl("")}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>

              {/* Step 5: Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  ۵. یادداشت یا توضیحات برای سایر همکاران / مدیریت (اختیاری)
                </label>
                <textarea
                  id="submit-work-note"
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  placeholder="مثال: ترجمه کامل است، اسامی خاص طبق پانویس صفحه ۵ تنظیم شده..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Feedback Alerts */}
              {submitError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
              {submitSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-work-btn"
                disabled={submitting || uploading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>در حال ثبت اطلاعات...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>ثبت نهایی و اختصاص سهم درآمدی چپتر</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRATED CHAPTER MANAGEMENT & UPLOAD */}
      {activeTab === "manage_chapters" && (
        <div id="manage-chapters-tab-content" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <List className="w-5 h-5 text-purple-400" />
                  مدیریت، ویرایش و آپلود چپترها
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  در این بخش می‌توانید چپترهای مانهوا را مدیریت نموده، چپتر جدید آپلود کنید یا صفحات را ویرایش فرمایید.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="add-new-chapter-btn"
                  onClick={handleOpenAddChapter}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-purple-600/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>آپلود و افزودن چپتر جدید</span>
                </button>
              </div>
            </div>

            {/* Series Filter and Chapter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Series Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">انتخاب مانهوا / کمیک:</label>
                <select
                  id="filter-series-select"
                  value={selectedSeriesId}
                  onChange={(e) => setSelectedSeriesId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                >
                  {userAssignedSeries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Chapter */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">جستجو در چپترها:</label>
                <div className="relative">
                  <input
                    type="text"
                    id="search-chapters-input"
                    value={chapterSearchQuery}
                    onChange={(e) => setChapterSearchQuery(e.target.value)}
                    placeholder="شماره چپتر یا عنوان..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">وضعیت انتشار:</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setChapterStatusFilter("all")}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      chapterStatusFilter === "all" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    همه ({seriesChapters.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChapterStatusFilter("published")}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      chapterStatusFilter === "published" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    منتشر شده ({seriesChapters.filter((c) => !c.isPending).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChapterStatusFilter("pending")}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      chapterStatusFilter === "pending" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    در انتظار ({seriesChapters.filter((c) => c.isPending).length})
                  </button>
                </div>
              </div>
            </div>

            {/* Chapters List Table */}
            <div className="mt-6">
              {loadingChapters ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                  <span className="text-sm text-slate-400">در حال بارگذاری لیست چپترها...</span>
                </div>
              ) : seriesChapters.length === 0 ? (
                <div className="p-12 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                  <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300">چپتری برای این اثر یافت نشد.</h3>
                  <p className="text-xs text-slate-500 mt-1">با زدن دکمه «آپلود و افزودن چپتر جدید» نخستین چپتر را اضافه فرمایید.</p>
                  <button
                    type="button"
                    onClick={handleOpenAddChapter}
                    className="mt-4 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    افزودن اولین چپتر
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-bold text-slate-400">
                        <th className="py-3.5 px-4">شماره چپتر</th>
                        <th className="py-3.5 px-4">عنوان</th>
                        <th className="py-3.5 px-4">صفحات</th>
                        <th className="py-3.5 px-4">قیمت</th>
                        <th className="py-3.5 px-4">بازدید</th>
                        <th className="py-3.5 px-4">وضعیت</th>
                        <th className="py-3.5 px-4">فایل‌های ارسالی</th>
                        <th className="py-3.5 px-4 text-center">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {seriesChapters
                        .filter((c) => {
                          if (chapterStatusFilter === "pending") return !!c.isPending;
                          if (chapterStatusFilter === "published") return !c.isPending;
                          return true;
                        })
                        .filter((c) => {
                          if (!chapterSearchQuery.trim()) return true;
                          const q = chapterSearchQuery.toLowerCase();
                          return (
                            String(c.number).includes(q) ||
                            (c.title && c.title.toLowerCase().includes(q))
                          );
                        })
                        .sort((a, b) => (Number(b.number) || 0) - (Number(a.number) || 0))
                        .map((ch) => {
                          const pageCount = Array.isArray(ch.images) ? ch.images.length : (ch.images ? 1 : 0);
                          const submissionsCount = Array.isArray(ch.submissions) ? ch.submissions.length : 0;
                          return (
                            <tr key={ch.id} className="hover:bg-slate-800/30 transition">
                              <td className="py-3.5 px-4 font-black text-white flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-mono">
                                  {ch.number}
                                </span>
                                <span>چپتر {ch.number}</span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-300">
                                {ch.title ? ch.title : <span className="text-slate-600 text-xs">-</span>}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-mono text-slate-300">
                                  {pageCount} صفحه
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                {ch.price && ch.price > 0 ? (
                                  <span className="text-amber-400 font-bold text-xs">
                                    {ch.price.toLocaleString("fa-IR")} ت
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-bold text-xs">رایگان</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                                {((ch as any).views || 0).toLocaleString("fa-IR")}
                              </td>
                              <td className="py-3.5 px-4">
                                {ch.isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <Clock className="w-3 h-3" />
                                    در انتظار تایید
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle className="w-3 h-3" />
                                    منتشر شده
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {submissionsCount > 0 ? (
                                  <div className="flex items-center gap-1">
                                    {ch.submissions?.map((sub: any, idx: number) => (
                                      <a
                                        key={idx}
                                        href={sub.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs inline-flex items-center gap-1"
                                        title={`${sub.userName} (${sub.role})`}
                                      >
                                        <Download className="w-3 h-3" />
                                        <span>{sub.role === "translator" ? "Word" : "Zip"}</span>
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  {/* Preview */}
                                  <button
                                    type="button"
                                    onClick={() => setPreviewChapter(ch)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                    title="پیش‌نمایش چپتر"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>

                                  {/* Edit */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditChapter(ch)}
                                    className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition"
                                    title="ویرایش چپتر"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChapter(ch.id, ch.number)}
                                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                    title="حذف چپتر"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
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
        </div>
      )}

      {/* TAB 4: ADMIN APPROVAL & AUTO DISK CLEANUP (Admin only) */}
      {activeTab === "approval" && isGlobalAdmin && (
        <div id="approval-tab-content" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  صف تایید، انتشار عمومی و بهینه‌سازی هاست
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  چپترهایی که توسط ادیتورها یا تیم تولید تکمیل شده‌اند به صورت پیش‌نویس (Private) ذخیره می‌شوند. پس از تایید مدیریت کل، چپتر روی سایت منتشر شده و فایل‌های میانی ترجمه و کلین به صورت خودکار از فضای دیسک هاست حذف می‌شوند.
                </p>
              </div>
              <button
                onClick={() => fetchPendingChapters()}
                disabled={loadingPending}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
                title="بروزرسانی لیست"
              >
                <RefreshCw className={`w-5 h-5 ${loadingPending ? "animate-spin text-amber-400" : ""}`} />
              </button>
            </div>

            {approvalMessage && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{approvalMessage}</span>
              </div>
            )}

            {loadingPending ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">در حال دریافت لیست چپترهای در انتظار...</p>
              </div>
            ) : pendingChapters.length === 0 ? (
              <div className="p-12 text-center bg-slate-950/40 rounded-2xl border border-slate-800">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">صف تایید خالی است</h3>
                <p className="text-sm text-slate-500 mt-1">تمامی چپترهای ارسالی تایید و منتشر شده‌اند.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingChapters.map((item: any) => (
                  <div
                    key={item.chapterId}
                    id={`pending-chapter-${item.chapterId}`}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={item.seriesCover || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150"}
                        alt={item.seriesTitle}
                        className="w-16 h-22 object-cover rounded-xl border border-slate-700 shadow-md flex-shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white">{item.seriesTitle}</h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            چپتر {item.chapterNumber}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          تعداد تصاویر نهایی: {item.imagesCount} صفحه • تعداد ارسالی‌های تیم: {item.submissions?.length || 0} فایل
                        </p>

                        {/* Submissions List */}
                        {item.submissions && item.submissions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {item.submissions.map((sub: any, sIdx: number) => (
                              <div
                                key={sIdx}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 flex items-center gap-2"
                              >
                                <span className="font-bold text-indigo-400">
                                  {sub.role === "translator" ? "مترجم" : sub.role === "cleaner" ? "کلینر" : "ادیتور"}:
                                </span>
                                <span>{sub.userName}</span>
                                {sub.fileUrl && (
                                  <a
                                    href={sub.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-400 hover:underline flex items-center gap-1"
                                    title="دریافت فایل"
                                  >
                                    <Download className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleApproveAndPublish(item.seriesId, item.chapterId, item.chapterNumber)}
                        disabled={approvingChapterId === item.chapterId}
                        className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                      >
                        {approvingChapterId === item.chapterId ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>در حال انتشار و پاکسازی...</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4" />
                            <span>تایید و انتشار عمومی + پاکسازی خودکار هاست</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SETTLEMENT REQUESTS */}
      {activeTab === "settlement" && (
        <div id="settlement-tab-content" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settlement Request Form */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit">
              <h2 className="text-base font-black text-white flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-emerald-400" />
                ثبت درخواست تسویه مالی
              </h2>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 mb-5">
                <span className="text-xs text-slate-400 block font-medium">موجودی قابل تسویه:</span>
                <span className="text-xl font-black text-emerald-400">
                  {walletBalance.toLocaleString("fa-IR")} <span className="text-xs text-slate-400 font-normal">تومان</span>
                </span>
                <p className="text-xs text-slate-500 mt-1">حداقل مبلغ جهت درخواست تسویه: ۱۰,۰۰۰ تومان</p>
              </div>

              <form onSubmit={handleRequestSettlement} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">مبلغ درخواستی (تومان) *</label>
                  <input
                    id="settle-amount-input"
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="مثال: 50000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">شماره کارت یا شبا *</label>
                  <input
                    id="settle-card-input"
                    type="text"
                    value={settleCardOrSheba}
                    onChange={(e) => setSettleCardOrSheba(e.target.value)}
                    placeholder="شماره ۱۶ رقمی کارت یا شبا IR..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500 text-left dir-ltr"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">نام و نام خانوادگی صاحب حساب *</label>
                  <input
                    id="settle-holder-input"
                    type="text"
                    value={settleAccountHolder}
                    onChange={(e) => setSettleAccountHolder(e.target.value)}
                    placeholder="نام درج شده روی کارت"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {settleMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      settleMsg.type === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {settleMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{settleMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  id="submit-settle-btn"
                  disabled={settleSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  {settleSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>ارسال درخواست تسویه</span>
                </button>
              </form>
            </div>

            {/* Settlements History */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-base font-black text-white flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-indigo-400" />
                سوابق درخواست‌های تسویه حساب
              </h2>

              {loadingSettlements ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
                  <span className="text-xs text-slate-400">در حال بارگذاری سوابق...</span>
                </div>
              ) : settlements.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                  <Info className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">تاکنون درخواست تسویه‌ای ثبت نشده است.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">
                            {req.amount.toLocaleString("fa-IR")} تومان
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              req.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : req.status === "rejected"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {req.status === "approved" ? "تایید و واریز شد" : req.status === "rejected" ? "رد شده" : "در انتظار واریز"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          حساب: {req.accountHolder} ({req.cardOrSheba})
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString("fa-IR") : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CHAPTER */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-base">
                  {editingChapter ? `ویرایش چپتر ${editingChapter.number}` : "افزودن و آپلود چپتر جدید"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveChapterSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Series Select */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">انتخاب مانهوا / اثر:</label>
                <select
                  value={modalSeriesId}
                  onChange={(e) => setModalSeriesId(e.target.value)}
                  disabled={!!editingChapter}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none disabled:opacity-60"
                >
                  {userAssignedSeries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Number and Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">شماره چپتر (مثلاً 1 یا 1.5):</label>
                  <input
                    type="text"
                    required
                    value={chapterNumberInput}
                    onChange={(e) => setChapterNumberInput(e.target.value)}
                    placeholder="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">قیمت چپتر (تومان - 0 برای رایگان):</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={chapterPriceInput}
                    onChange={(e) => setChapterPriceInput(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">عنوان چپتر (اختیاری):</label>
                <input
                  type="text"
                  value={chapterTitleInput}
                  onChange={(e) => setChapterTitleInput(e.target.value)}
                  placeholder="مثال: آغاز نبرد"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>

              {/* Page Images Upload Box */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  آپلود صفحات چپتر (تصاویر مستقیم یا فایل ZIP):
                </label>
                <div className="border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-950/40 rounded-xl p-5 text-center transition relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.zip,.rar"
                    onChange={handleChapterPagesUpload}
                    disabled={uploadingChapterPages}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                  />
                  {uploadingChapterPages ? (
                    <div className="py-3 flex flex-col items-center">
                      <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                      <span className="text-xs text-purple-300 font-bold">در حال بارگذاری و بهینه‌سازی تصاویر...</span>
                    </div>
                  ) : (
                    <div className="py-2 flex flex-col items-center">
                      <UploadCloud className="w-8 h-8 text-purple-400 mb-2" />
                      <span className="text-xs font-bold text-white mb-1">
                        برای انتخاب یا کشیدن فایل‌ها (چندین عکس یا فایل زیپ) اینجا کلیک کنید
                      </span>
                      <span className="text-[11px] text-slate-500">
                        فرمت‌های مجاز: JPG, PNG, WEBP, ZIP, RAR (ترتیب تصاویر به صورت هوشمند و طبیعی مرتب خواهد شد)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* URLs Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-400">لینک‌های صفحات (هر خط یک آدرس):</label>
                  <span className="text-[11px] text-purple-400 font-mono">
                    {chapterPagesText.split("\n").filter(s => s.trim()).length} صفحه درج شده
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={chapterPagesText}
                  onChange={(e) => setChapterPagesText(e.target.value)}
                  placeholder="https://.../page1.webp&#10;https://.../page2.webp"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono focus:border-purple-500 outline-none resize-y"
                  dir="ltr"
                />
              </div>

              {/* Thumbnail Strip */}
              {chapterPagesText.split("\n").filter(s => s.trim()).length > 0 && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400 mb-2 block">پیش‌نمایش بندانگشتی صفحات:</span>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {chapterPagesText
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 15)
                      .map((url, idx) => (
                        <div key={idx} className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 border border-slate-800 relative group">
                          <img
                            src={url}
                            alt={`page-${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <span className="absolute bottom-0 right-0 bg-black/80 text-[10px] text-white px-1 font-mono">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    {chapterPagesText.split("\n").filter(s => s.trim()).length > 15 && (
                      <div className="w-14 h-20 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-mono text-slate-400 flex-shrink-0">
                        +{chapterPagesText.split("\n").filter(s => s.trim()).length - 15}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Notice */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-xs">
                {isGlobalAdmin ? (
                  <span>به عنوان مدیر کل، این چپتر مستقیماً ثبت و منتشر خواهد شد.</span>
                ) : (
                  <span>پس از ثبت، چپتر در صف تایید مدیریت قرار گرفته و پس از بررسی منتشر خواهد شد.</span>
                )}
              </div>

              {/* Error and Success Alerts */}
              {chapterModalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{chapterModalError}</span>
                </div>
              )}

              {chapterModalSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{chapterModalSuccess}</span>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChapterModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingChapter || uploadingChapterPages}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {savingChapter ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingChapter ? "ذخیره تغییرات چپتر" : "ثبت و ارسال چپتر"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW CHAPTER */}
      {previewChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-mono font-bold">
                  {previewChapter.number}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    پیش‌نمایش چپتر {previewChapter.number} {previewChapter.title ? `- ${previewChapter.title}` : ""}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {Array.isArray(previewChapter.images) ? previewChapter.images.length : 1} صفحه
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewChapter(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Reader */}
            <div className="flex-1 overflow-y-auto bg-black p-4 space-y-2 flex flex-col items-center">
              {Array.isArray(previewChapter.images) && previewChapter.images.length > 0 ? (
                previewChapter.images.map((imgUrl: string, idx: number) => (
                  <div key={idx} className="w-full max-w-xl relative flex flex-col items-center">
                    <img
                      src={imgUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-auto rounded shadow-lg"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-slate-500 font-mono py-1">
                      صفحه {idx + 1} از {previewChapter.images.length}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-slate-500 text-sm">
                  هیچ صفحه‌ای برای این چپتر ثبت نشده است.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
