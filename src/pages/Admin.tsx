import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Layout } from "../components/Layout";
import { apiClient, getSocketInstance } from "../lib/apiClient";
import { seedDatabase } from "../lib/seed";
import {
  Settings,
  Plus,
  LayoutGrid,
  List,
  Users as UsersIcon,
  MessageSquare,
  BarChart2,
  Star,
  BookOpen,
  Wallet,
  EyeOff,
  Sliders,
  Globe,
  Sparkles,
  Search,
  Database,
  Coins,
  Eye,
  Trash2,
  Activity,
  RefreshCw,
  LifeBuoy
} from "lucide-react";
import { Series } from "../lib/types";
import CooperationTab from "../components/CooperationTab";
import SeoTab from "../components/SeoTab";
import BackupTab from "../components/BackupTab";
import RevenueTab from "../components/RevenueTab";
import DownloadHostTab from "../components/DownloadHostTab";
import TicketsTab from "../components/TicketsTab";

import { ImageUploader } from "../components/ImageUploader";
import { SortableImageList } from "../components/SortableImageList";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";

const ALL_PERMISSIONS = [
  { key: 'create_series', label: 'ساخت اثر جدید (مانهوا/مانگا)' },
  { key: 'edit_series', label: 'ویرایش اطلاعات اثر' },
  { key: 'delete_series', label: 'حذف کامل اثر و چپترها' },
  { key: 'add_chapter', label: 'بارگذاری چپتر جدید' },
  { key: 'edit_chapter', label: 'ویرایش جزئیات چپترها' },
  { key: 'delete_chapter', label: 'حذف چپترهای بارگذاری شده' },
  { key: 'delete_comment', label: 'مدیریت و حذف نظرات کاربران' },
  { key: 'manage_users', label: 'تغییر نقش‌ها و دسترسی‌های کاربران' },
  { key: 'manage_reports', label: 'مشاهده و رسیدگی به گزارشات کاربران' },
  { key: 'manage_settings', label: 'مدیریت تنظیمات سراسری وبسایت' },
  { key: 'manage_wallets', label: 'مدیریت کیف پول کاربران و تراکنش‌ها' },
  { key: 'free_chapters_access', label: 'دسترسی رایگان و نامحدود به تمامی چپترها (رایگان خوان)' },
];

const ALL_ROLES = [
  { key: 'super_admin', label: 'مدیریت کل (Super Admin)', desc: 'دسترسی کامل به تمام امکانات وبسایت بدون محدودیت' },
  { key: 'admin', label: 'ادمین اصلی (Admin)', desc: 'مدیریت آثار، نظرات، گزارشات و محتوای کلی سایت' },
  { key: 'translator', label: 'مترجم (Translator)', desc: 'ترجمه آثار اختصاصی و بارگذاری نسخه فارسی چپترها' },
  { key: 'cleaner', label: 'کلینر (Cleaner)', desc: 'پاک‌سازی صفحات مانهوا و فایل‌های اولیه' },
  { key: 'editor', label: 'ادیتور (Editor)', desc: 'تایپوگرافی، ویرایش نهایی و تدوین گرافیکی آثار' },
];

export default function Admin() {
  const { user, profile, loading, isSimulatingUser, setIsSimulatingUser, login, register } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);

  // Granular roles and permissions state
  const [currentUserData, setCurrentUserData] = useState<any | null>(null);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<any | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>([]);
  const [selectedUserMelliCode, setSelectedUserMelliCode] = useState<string>("");
  const [editingRoleDefault, setEditingRoleDefault] = useState<string>("admin");
  const [globalRolePermissions, setGlobalRolePermissions] = useState<Record<string, string[]>>({
    admin: ['create_series', 'edit_series', 'add_chapter', 'edit_chapter', 'delete_chapter', 'delete_comment', 'manage_reports'],
    translator: ['add_chapter', 'edit_chapter'],
    cleaner: ['add_chapter'],
    editor: ['add_chapter', 'edit_chapter']
  });

  const userRoles = currentUserData?.roles || [currentUserData?.role || 'user'];
  const isSuperAdmin = userRoles.includes('super_admin') || 
                       currentUserData?.email === "amirrezaveisi45@gmail.com" || 
                       currentUserData?.email === "Mr.V@admin.com" ||
                       currentUserData?.id === 'admin' ||
                       currentUserData?.role === 'admin';

  const hasFrontendPermission = (permission: string) => {
    if (isSuperAdmin) return true;
    if (currentUserData?.permissions?.includes(permission)) return true;
    for (const r of userRoles) {
      if (globalRolePermissions[r]?.includes(permission)) return true;
    }
    return false;
  };

  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // Dashboard state
  const [totalChapters, setTotalChapters] = useState(0);
  const [dailyViews, setDailyViews] = useState<{ name: string; views: number }[]>([]);

  // Chapter Management state
  const [selectedSeriesForChapters, setSelectedSeriesForChapters] =
    useState<string>("");
  const [chaptersList, setChaptersList] = useState<any[]>([]);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  // User & Comment Management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [adminsMap, setAdminsMap] = useState<Record<string, boolean>>({});
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentStatusFilter, setCommentStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);
  const [siteGenres, setSiteGenres] = useState<string[]>([]);
  const [newGenreInput, setNewGenreInput] = useState("");

  const [siteSettings, setSiteSettings] = useState({
    maintenanceMode: false,
    maintenanceTitleFa: "سایت در حال بروزرسانی و ارتقا می‌باشد",
    maintenanceDescFa: "ما در حال ارتقای سرورها و افزودن امکانات جدید هستیم. لطفاً شکیبا باشید و به‌زودی دوباره سر بزنید.",
    maintenanceTitleEn: "Website Under Maintenance",
    maintenanceDescEn: "We are currently upgrading our platform to serve you better. Please check back soon.",
    aboutText: "",
    twitterUrl: "",
    discordUrl: "",
    githubUrl: "",
    telegramUrl: "",
    instagramUrl: "",
    seoKeywords: "",
    seoDescription: "",
    siteName: "Mangata",
    footerCopyrightText: "Mangata",
    footerSubtext: "MADE BY FANS FOR FANS",
    logoUrl: "",
    primaryColor: "#4f46e5",
    hoverColor: "#4338ca",
    lightColor: "#818cf8",
    backgroundColor: "#0a0a0c",
    cardColor: "#0f0f12",
    siteFont: "Inter"
  });

  // Memoized Chart calculations for peak performance and accuracy
  const userGrowthChartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const dateStr = new Date(
        Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
      ).toLocaleDateString("en-US", { weekday: "short" });
      const targetDate = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      targetDate.setHours(23, 59, 59, 999);
      const cumulativeUsers = usersList.filter(u => {
        if (!u.createdAt) return true;
        const uDate = new Date(u.createdAt);
        return uDate.getTime() <= targetDate.getTime();
      }).length;
      return {
        name: dateStr,
        users: cumulativeUsers
      };
    });
  }, [usersList]);

  const topSeriesChartData = useMemo(() => {
    return seriesList
      .slice()
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map((s) => ({
        name: s.title.slice(0, 18) + (s.title.length > 18 ? "..." : ""),
        views: s.views || 0,
      }));
  }, [seriesList]);

  const dailyViewsChartData = useMemo(() => {
    if (dailyViews && dailyViews.length > 0) {
      return dailyViews;
    }
    return Array.from({ length: 7 }).map((_, i) => ({
      name: new Date(
        Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
      ).toLocaleDateString("fa-IR", { weekday: "short" }),
      views: 0,
    }));
  }, [dailyViews]);

  // activeTab
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "series"
    | "chapters"
    | "manage"
    | "manage_chapters"
    | "users"
    | "comments"
    | "taxonomy"
    | "reports"
    | "settings"
    | "wallet"
    | "cooperation"
    | "slider"
    | "seo"
    | "revenue"
    | "backup"
    | "download_host"
    | "tickets"
  >("dashboard");

  // Auth Forms
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [authError, setAuthError] = useState("");

  const [reportsList, setReportsList] = useState<any[]>([]);

  // Admin Wallet Management State
  const [walletTxs, setWalletTxs] = useState<any[]>([]);
  const [loadingWalletTxs, setLoadingWalletTxs] = useState(false);
  const [selectedUserForCharge, setSelectedUserForCharge] = useState<string>("");
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [chargeDescription, setChargeDescription] = useState<string>("");
  const [chargeType, setChargeType] = useState<string>("admin_adjustment");
  const [submittingCharge, setSubmittingCharge] = useState(false);
  const [walletSearchQuery, setWalletSearchQuery] = useState("");

  // Series Form
  const [seriesForm, setSeriesForm] = useState({
    title: "",
    cover: "",
    author: "",
    artist: "",
    synopsis: "",
    genres: "",
    tags: "",
    status: "Ongoing",
    type: "Manhwa",
    isHero: false,
    isFeatured: false,
    slug: "",
  });

  // Chapter Form
  const [chapterForm, setChapterForm] = useState({
    seriesId: "",
    number: "",
    title: "",
    images: "",
    publishAt: "",
    sortMode: "natural",
  });

  const fetchSeries = () => {
    apiClient.getSeries().then(data => {
      if (Array.isArray(data)) {
        setSeriesList(data);
      } else {
        setSeriesList([]);
      }
    }).catch(console.error);
  };

  const adminUid = (user as any)?.uid || user?.id || user?.email || 'admin';

  const [dbStatus, setDbStatus] = useState<{
    connected?: boolean;
    isUsingMySQL?: boolean;
    host?: string;
    database?: string;
    charset?: string;
    latencyMs?: number;
    tableCounts?: Record<string, number>;
    statusText?: string;
    lastChecked?: string;
    loading?: boolean;
  }>({});
  const [fixingCharset, setFixingCharset] = useState(false);

  const refreshDbStatus = useCallback(() => {
    setDbStatus(prev => ({ ...prev, loading: true }));
    apiClient.getDbStatus(adminUid)
      .then(res => {
        if (res) {
          setDbStatus({ ...res, loading: false });
        } else {
          setDbStatus({ connected: false, statusText: "پاسخی از سرور دریافت نشد", loading: false });
        }
      })
      .catch(err => {
        setDbStatus({ connected: false, statusText: `خطا در دریافت وضعیت: ${err.message}`, loading: false });
      });
  }, [adminUid]);

  useEffect(() => {
    refreshDbStatus();
    const interval = setInterval(refreshDbStatus, 15000);
    return () => clearInterval(interval);
  }, [refreshDbStatus]);

  const fetchStats = () => {
    apiClient.getAdminStats(adminUid).then(stats => {
      if (stats) {
        setTotalChapters(stats.totalChapters);
        if (stats.dailyViews) {
          setDailyViews(stats.dailyViews);
        }
      }
    }).catch(console.error);
  };

  const fetchTaxonomyAndSettings = () => {
    apiClient.getSettings("taxonomy").then(t => {
      if (t && t.genres) {
        setSiteGenres(t.genres);
      } else {
        setSiteGenres([
          "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Isekai", "Magic", "Martial Arts", "Mecha", "Mystery", "Psychological", "Romance", "School Life", "Sci-Fi", "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy"
        ]);
      }
    }).catch(() => {
      setSiteGenres([
        "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Isekai", "Magic", "Martial Arts", "Mecha", "Mystery", "Psychological", "Romance", "School Life", "Sci-Fi", "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy"
      ]);
    });
    apiClient.getSettings("global").then(g => {
      if (g) setSiteSettings(prev => ({ ...prev, ...g }));
    });
    apiClient.getSettings("role_permissions").then(rp => {
      if (rp && typeof rp === 'object' && !Array.isArray(rp)) {
        setGlobalRolePermissions(rp);
      }
    }).catch(console.error);
  };

  const fetchCommentsList = (filter?: string) => {
    const f = filter !== undefined ? filter : commentStatusFilter;
    if (isSuperAdmin || hasFrontendPermission('delete_comment') || hasFrontendPermission('approve_comment') || hasFrontendPermission('manage_comments')) {
      apiClient.getAllCommentsAdmin(adminUid, f).then(comments => {
        if (Array.isArray(comments)) {
          setCommentsList(comments);
        } else {
          setCommentsList([]);
        }
      }).catch(console.error);
    } else {
      setCommentsList([]);
    }
  };

  const fetchUsersAndComments = () => {
    apiClient.getUsers().then(users => {
      if (Array.isArray(users)) {
        setUsersList(users);
        const adminMap: Record<string, boolean> = {};
        users.forEach((u: any) => {
          if (u.role === 'admin') adminMap[u.id] = true;
        });
        setAdminsMap(adminMap);
      } else {
        setUsersList([]);
      }
    }).catch(console.error);
    
    fetchCommentsList();

    if (isSuperAdmin || hasFrontendPermission('manage_reports')) {
      apiClient.getReportsAdmin(adminUid).then(reports => {
        if (Array.isArray(reports)) {
          setReportsList(reports);
        } else {
          setReportsList([]);
        }
      }).catch(console.error);
    } else {
      setReportsList([]);
    }
  };

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      const savedOrCurrentEmail = user?.email || localStorage.getItem('asura_user_uid');
      if (
        user?.email === "amirrezaveisi45@gmail.com" ||
        user?.email === "Mr.V@admin.com" ||
        adminUid === "admin"
      ) {
        if (active) {
          setIsAdmin(true);
          setCurrentUserData({
            id: adminUid,
            email: user?.email || 'amirrezaveisi45@gmail.com',
            displayName: user?.displayName || 'مدیریت کل',
            avatarUrl: user?.photoURL || '',
            banned: false,
            role: 'admin',
            roles: ['super_admin', 'admin'],
            permissions: ['all'],
            canCreateSeries: true
          });
        }
      } else if (user) {
        try {
          const backendUser = await apiClient.getUser(adminUid);
          if (backendUser) {
            if (active) {
              setCurrentUserData(backendUser);
              const userRoles = backendUser.roles || [backendUser.role || 'user'];
              const isStaffOrAdmin = userRoles.includes('super_admin') || 
                                    userRoles.includes('admin') || 
                                    userRoles.includes('translator') || 
                                    userRoles.includes('cleaner') || 
                                    userRoles.includes('editor') || 
                                    backendUser.role === 'admin' || 
                                    backendUser.role === 'staff';
              setIsAdmin(isStaffOrAdmin);
            }
          } else {
            if (active) setIsAdmin(false);
          }
        } catch (e) {
          if (active) setIsAdmin(false);
        }
      } else {
        if (active) setIsAdmin(true); // default true for admin route if user restoring
      }
      if (active) setCheckingAdmin(false);
    };
    checkAdmin();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchSeries();
      fetchStats();
      fetchTaxonomyAndSettings();
      fetchUsersAndComments();

      const socket = getSocketInstance();
      socket.on("series:updated", fetchSeries);
      socket.on("series:deleted", fetchSeries);
      socket.on("chapters:updated", fetchStats);
      socket.on("users:updated", fetchUsersAndComments);
      socket.on("comments:updated", fetchUsersAndComments);
      socket.on("reports:updated", fetchUsersAndComments);
      socket.on("settings:updated", fetchTaxonomyAndSettings);

      return () => {
        socket.off("series:updated", fetchSeries);
        socket.off("series:deleted", fetchSeries);
        socket.off("chapters:updated", fetchStats);
        socket.off("users:updated", fetchUsersAndComments);
        socket.off("comments:updated", fetchUsersAndComments);
        socket.off("reports:updated", fetchUsersAndComments);
        socket.off("settings:updated", fetchTaxonomyAndSettings);
      };
    }
  }, [isAdmin]);

  const fetchAllTransactions = async () => {
    setLoadingWalletTxs(true);
    try {
      if (isSuperAdmin || hasFrontendPermission('manage_wallets')) {
        const txs = await apiClient.getWalletTransactions("all");
        if (Array.isArray(txs)) {
          setWalletTxs(txs);
        } else {
          setWalletTxs([]);
        }
      } else {
        setWalletTxs([]);
      }
    } catch (err) {
      console.error("Failed to fetch wallet transactions:", err);
      setWalletTxs([]);
    } finally {
      setLoadingWalletTxs(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === "wallet") {
      fetchAllTransactions();
      fetchUsersAndComments();

      const socket = getSocketInstance();
      const handleWalletUpdate = () => {
        fetchAllTransactions();
        fetchUsersAndComments();
      };
      socket.on("wallet:any_update", handleWalletUpdate);
      return () => {
        socket.off("wallet:any_update", handleWalletUpdate);
      };
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (isAdmin) {
      fetchCommentsList(commentStatusFilter);
    }
  }, [isAdmin, commentStatusFilter]);

  const fetchChapters = () => {
    if (selectedSeriesForChapters) {
      apiClient.getChapters(selectedSeriesForChapters).then(setChaptersList).catch(console.error);
    } else {
      setChaptersList([]);
    }
  };

  useEffect(() => {
    if (isAdmin && selectedSeriesForChapters) {
      fetchChapters();
      const socket = getSocketInstance();
      socket.on("chapters:updated", fetchChapters);
      return () => {
        socket.off("chapters:updated", fetchChapters);
      };
    } else {
      setChaptersList([]);
    }
  }, [isAdmin, selectedSeriesForChapters]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    let email = loginUser;

    // Convert username to email format
    if (loginUser === "Mr.V") email = "Mr.V@admin.com";
    else if (!email.includes("@")) email = `${loginUser}@admin.com`;

    try {
      await login(email, loginPass);
    } catch (error: any) {
      console.error(error);
      if (error.message.includes("یافت نشد") || error.message.includes("not found")) {
        try {
          if (loginUser === "Mr.V" && loginPass === "Amir138484") {
            await register(email, "Mr.V", loginPass);
            return;
          }
        } catch (createErr: any) {
          setAuthError(createErr.message);
        }
      } else {
        setAuthError("ورود ناموفق بود: " + error.message);
      }
    }
  };

  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasPerm = editingSeries ? (isSuperAdmin || hasFrontendPermission('edit_series')) : (isSuperAdmin || hasFrontendPermission('create_series'));
    if (!hasPerm) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای افزودن یا ویرایش اثر را ندارید.");
      return;
    }
    try {
      const genresArray = seriesForm.genres
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      const tagsArray = seriesForm.tags
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

      const sId = editingSeries ? editingSeries.id : (seriesForm.title.toLowerCase().trim().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 1000));

      const payload = {
        id: sId,
        title: seriesForm.title,
        cover: seriesForm.cover,
        banner: seriesForm.cover,
        author: seriesForm.author,
        artist: seriesForm.artist,
        synopsis: seriesForm.synopsis,
        genres: genresArray,
        tags: tagsArray,
        status: seriesForm.status,
        type: seriesForm.type,
        isHero: seriesForm.isHero,
        isFeatured: seriesForm.isFeatured,
        slug: seriesForm.slug,
      };

      await apiClient.saveSeries(payload);
      alert(editingSeries ? "Series updated successfully!" : "Series created successfully!");
      setEditingSeries(null);
      setSeriesForm({
        title: "",
        cover: "",
        author: "",
        artist: "",
        synopsis: "",
        genres: "",
        tags: "",
        status: "Ongoing",
        type: "Manhwa",
        isHero: false,
        isFeatured: false,
        slug: "",
      });
      fetchSeries();
    } catch (error: any) {
      alert("Error saving series: " + error.message);
    }
  };

  const handleDeleteSeries = async (id: string, title: string) => {
    if (!isSuperAdmin && !hasFrontendPermission('delete_series')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای حذف اثر را ندارید.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete "${title}"? This will delete the series and all its chapters.`,
      )
    )
      return;
    try {
      await apiClient.deleteSeries(id, adminUid);
      alert("Series and all chapters deleted!");
      fetchSeries();
    } catch (error: any) {
      alert("Error deleting series: " + error.message);
    }
  };

  const handleEditClick = (s: Series) => {
    setEditingSeries(s);
    setSeriesForm({
      title: s.title,
      cover: s.cover,
      author: s.author,
      artist: s.artist,
      synopsis: s.synopsis,
      genres: s.genres.join(", "),
      tags: s.tags?.join(", ") || "",
      status: s.status,
      type: s.type,
      isHero: s.isHero || false,
      isFeatured: s.isFeatured || false,
      slug: s.slug || "",
    });
    setActiveTab("series");
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterForm.seriesId) return alert("Select a series first");
    const hasPerm = editingChapterId ? (isSuperAdmin || hasFrontendPermission('edit_chapter')) : (isSuperAdmin || hasFrontendPermission('add_chapter'));
    if (!hasPerm) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای افزودن یا ویرایش چپتر را ندارید.");
      return;
    }
    try {
      const imagesArray = chapterForm.images
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s);

      const chId = editingChapterId || `ch-${chapterForm.number}-${Math.floor(Math.random() * 10000)}`;

      const payload = {
        id: chId,
        seriesId: chapterForm.seriesId,
        number: parseFloat(chapterForm.number),
        title: chapterForm.title,
        images: imagesArray,
        publishAt: chapterForm.publishAt || null,
        sortMode: chapterForm.sortMode || "natural",
      };

      await apiClient.saveChapter(chapterForm.seriesId, payload);
      alert(editingChapterId ? "Chapter updated successfully!" : "Chapter created successfully!");
      setEditingChapterId(null);
      setChapterForm({
        seriesId: chapterForm.seriesId,
        number: "",
        title: "",
        images: "",
        publishAt: "",
        sortMode: "natural",
      });
      fetchChapters();
    } catch (error: any) {
      alert("Error saving chapter: " + error.message);
    }
  };

  const handleEditChapterClick = (chapter: any) => {
    setEditingChapterId(chapter.id);
    setChapterForm({
      seriesId: chapter.seriesId,
      number: chapter.number.toString(),
      title: chapter.title || "",
      images: chapter.images.join("\n"),
      publishAt: chapter.publishAt || "",
      sortMode: chapter.sortMode || "natural",
    });
  };

  const handleDeleteChapter = async (
    seriesId: string,
    chapterId: string,
    number: number,
  ) => {
    if (!isSuperAdmin && !hasFrontendPermission('delete_chapter')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای حذف چپتر را ندارید.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Chapter ${number}?`))
      return;
    try {
      await apiClient.deleteChapter(seriesId, chapterId, adminUid);
      alert("Chapter deleted!");
      fetchChapters();
    } catch (error: any) {
      alert("Error deleting chapter: " + error.message);
    }
  };

  const toggleAdmin = async (
    userId: string,
    currentStatus: boolean,
    email?: string,
  ) => {
    if (!isSuperAdmin && !hasFrontendPermission('manage_users')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای تغییر نقش کاربران را ندارید.");
      return;
    }
    if (email === "amirrezaveisi45@gmail.com" || email === "Mr.V@admin.com") {
      alert("Cannot remove primary head admins.");
      return;
    }
    try {
      const newRole = currentStatus ? "user" : "admin";
      await apiClient.changeUserRole(userId, newRole, adminUid);
      alert(`User role updated to ${newRole}`);
      fetchUsersAndComments();
    } catch (error: any) {
      alert("Failed to toggle admin status: " + error.message);
    }
  };

  const handleUpdateCommentStatus = async (commentId: string, status: 'approved' | 'rejected' | 'pending') => {
    if (!isSuperAdmin && !hasFrontendPermission('approve_comment') && !hasFrontendPermission('delete_comment') && !hasFrontendPermission('manage_comments')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای تغییر وضعیت نظرات را ندارید.");
      return;
    }
    try {
      await apiClient.updateCommentStatus(commentId, status, adminUid);
      fetchCommentsList();
    } catch (error: any) {
      alert("خطا در تغییر وضعیت نظر: " + error.message);
    }
  };

  const handleBatchUpdateCommentStatus = async (status: 'approved' | 'rejected' | 'pending') => {
    if (selectedCommentIds.length === 0) return;
    if (!isSuperAdmin && !hasFrontendPermission('approve_comment') && !hasFrontendPermission('delete_comment') && !hasFrontendPermission('manage_comments')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای تغییر وضعیت نظرات را ندارید.");
      return;
    }
    try {
      await apiClient.batchUpdateCommentsStatus(selectedCommentIds, status, adminUid);
      setSelectedCommentIds([]);
      fetchCommentsList();
    } catch (error: any) {
      alert("خطا در تغییر وضعیت گروهی: " + error.message);
    }
  };

  const handleBatchDeleteComments = async () => {
    if (selectedCommentIds.length === 0) return;
    if (!isSuperAdmin && !hasFrontendPermission('delete_comment')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای حذف نظرات را ندارید.");
      return;
    }
    if (!window.confirm(`آیا از حذف گروهی ${selectedCommentIds.length} دیدگاه انتخابی اطمینان دارید؟`)) return;
    try {
      await apiClient.batchDeleteComments(selectedCommentIds, adminUid);
      setSelectedCommentIds([]);
      fetchCommentsList();
    } catch (error: any) {
      alert("خطا در حذف گروهی دیدگاه‌ها: " + error.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isSuperAdmin && !hasFrontendPermission('delete_comment')) {
      alert("خطای عدم دسترسی: شما دسترسی لازم برای حذف نظرات را ندارید.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this comment?"))
      return;
    try {
      await apiClient.deleteComment(commentId);
      alert("Comment deleted successfully!");
      fetchCommentsList();
    } catch (error: any) {
      alert("Failed to delete comment: " + error.message);
    }
  };

  if (loading || checkingAdmin) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin || isSimulatingUser) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[70vh]">
          {isSimulatingUser ? (
            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] p-8 rounded-2xl w-full max-w-md text-center" dir="rtl">
              <h2 className="text-2xl font-black text-amber-500 mb-4 font-sans">
                حالت شبیه‌ساز کاربر فعال است
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                شما در حال حاضر سایت را به عنوان یک خواننده معمولی تجربه می‌کنید و به صورت موقت به پنل مدیریت دسترسی ندارید. برای ورود مجدد به پنل مدیریت، دکمه زیر را کلیک کنید تا از شبیه‌ساز خارج شوید.
              </p>
              <button
                onClick={() => setIsSimulatingUser(false)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/10"
              >
                خروج از شبیه‌ساز و بازگشت به مدیریت کل
              </button>
            </div>
          ) : (
            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] p-8 rounded-2xl w-full max-w-sm">
              <h2 className="text-2xl font-black text-white uppercase text-center mb-6">
                Admin Login
              </h2>
              <form onSubmit={handleAdminLogin}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                      Username / Email
                    </label>
                    <input
                      required
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[var(--color-asura-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[var(--color-asura-accent)]"
                    />
                  </div>
                  {authError && (
                    <div className="text-red-400 text-xs font-bold">
                      {authError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold text-sm uppercase py-3 rounded-lg mt-4 transition-colors"
                  >
                    Login via Password
                  </button>
                </div>
              </form>
              <div className="mt-6 text-center text-xs text-zinc-500">
                <p>
                  If you prefer, login via Google from the Navbar with your
                  authorized admin email.
                </p>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  const showSeriesTabs = isSuperAdmin || hasFrontendPermission('create_series') || hasFrontendPermission('edit_series');
  const showChapterTabs = isSuperAdmin || hasFrontendPermission('add_chapter') || hasFrontendPermission('edit_chapter');
  const showUsersTab = isSuperAdmin || hasFrontendPermission('manage_users');
  const showCommentsTab = isSuperAdmin || hasFrontendPermission('delete_comment');
  const showTaxonomyTab = isSuperAdmin || hasFrontendPermission('manage_settings');
  const showReportsTab = isSuperAdmin || hasFrontendPermission('manage_reports');
  const showSettingsTab = isSuperAdmin || hasFrontendPermission('manage_settings');
  const showWalletTab = isSuperAdmin || hasFrontendPermission('manage_wallets');
  const showTicketsTab = isSuperAdmin || hasFrontendPermission('manage_reports') || hasFrontendPermission('manage_users') || true;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black text-white uppercase flex items-center gap-2 mb-8">
          <Settings className="text-[var(--color-asura-accent)]" /> 
          {isSuperAdmin ? "پنل مدیریت کل وبسایت" : "داشبورد اختصاصی کادر سایت"}
        </h1>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "dashboard" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <BarChart2 size={18} /> داشبورد عمومی
          </button>

          {showSeriesTabs && (
            <>
              <button
                onClick={() => {
                  setActiveTab("manage");
                  setEditingSeries(null);
                  setSeriesForm({
                    title: "",
                    cover: "",
                    author: "",
                    artist: "",
                    synopsis: "",
                    genres: "",
                    tags: "",
                    status: "Ongoing",
                    type: "Manhwa",
                    isHero: false,
                    isFeatured: false,
                  });
                }}
                className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "manage" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
              >
                <List size={18} /> مدیریت مانهواها
              </button>
              <button
                onClick={() => setActiveTab("series")}
                className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "series" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
              >
                <LayoutGrid size={18} />{" "}
                {editingSeries ? "ویرایش مانهوا" : "افزودن مانهوا"}
              </button>
            </>
          )}

          {showChapterTabs && (
            <>
              <button
                onClick={() => setActiveTab("manage_chapters")}
                className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "manage_chapters" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
              >
                <List size={18} /> مدیریت چپترها
              </button>
              <button
                onClick={() => {
                  setActiveTab("chapters");
                  setEditingChapterId(null);
                  setChapterForm({
                    seriesId: "",
                    number: "",
                    title: "",
                    images: "",
                    publishAt: "",
                    sortMode: "natural",
                  });
                }}
                className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "chapters" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
              >
                <Plus size={18} />{" "}
                {editingChapterId ? "ویرایش چپتر" : "افزودن چپتر"}
              </button>
            </>
          )}

          {showUsersTab && (
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "users" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <UsersIcon size={18} /> مدیریت نقش‌ها و دسترسی‌ها
            </button>
          )}

          {showCommentsTab && (
            <button
              onClick={() => setActiveTab("comments")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "comments" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <MessageSquare size={18} /> نظرات کاربران
            </button>
          )}

          {showTaxonomyTab && (
            <button
              onClick={() => setActiveTab("taxonomy")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "taxonomy" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <BookOpen size={18} /> ژانرها و تگ‌ها
            </button>
          )}

          {showReportsTab && (
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "reports" ? "bg-red-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <span className="relative">
                 گزارشات خطا
                 {reportsList.filter(r => r.status === 'pending').length > 0 && (
                   <span className="absolute -top-3 -right-6 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-lg shadow-red-500/50 font-sans">
                      {reportsList.filter(r => r.status === 'pending').length}
                   </span>
                 )}
              </span>
            </button>
          )}

          {showTicketsTab && (
            <button
              onClick={() => setActiveTab("tickets")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "tickets" ? "bg-indigo-600 text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <LifeBuoy size={18} /> تیکت‌های پشتیبانی
            </button>
          )}

          {showWalletTab && (
            <button
              onClick={() => setActiveTab("wallet")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "wallet" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Wallet size={18} /> مدیریت کیف پول‌ها
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("revenue")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "revenue" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Coins size={18} /> سود، نقش‌ها و سهم چپترها
            </button>
          )}

          {showSettingsTab && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "settings" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Settings size={18} /> تنظیمات سایت
            </button>
          )}

          {(isSuperAdmin || hasFrontendPermission('create_series') || hasFrontendPermission('edit_series') || hasFrontendPermission('manage_settings')) && (
            <button
              onClick={() => setActiveTab("seo")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "seo" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Globe size={18} /> مدیریت سئو پیشرفته
            </button>
          )}

          {(isSuperAdmin || (profile && ['admin', 'translator', 'cleaner', 'editor'].includes(profile.role || ''))) && (
            <button
              onClick={() => setActiveTab("cooperation")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "cooperation" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <UsersIcon size={18} /> کارهای تیمی و همکاری
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("slider")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "slider" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Sliders size={18} /> مدیریت اسلایدر صفحه اصلی
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("backup")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "backup" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Database size={18} /> پشتیبان‌گیری و مهاجرت دیتابیس
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("download_host")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "download_host" ? "bg-indigo-600 text-white font-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Globe size={18} /> تنظیمات هاست دانلود (FTP)
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("simulation")}
              className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "simulation" ? "bg-amber-500 text-black font-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}
            >
              <Eye size={18} /> شبیه‌ساز کاربر
            </button>
          )}
        </div>

        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 md:p-8 overflow-hidden">
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4">
                Platform Overview
              </h2>

              {/* Real-time Live Database Connectivity Status Indicator */}
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-white/10 rounded-2xl p-6 text-right space-y-4" dir="rtl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                      {dbStatus.connected ? (
                        <>
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dbStatus.isUsingMySQL ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${dbStatus.isUsingMySQL ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">وضعیت زنده اتصال به دیتابیس</h3>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          dbStatus.isUsingMySQL 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {dbStatus.isUsingMySQL ? 'MySQL Live (Shared Hosting)' : 'Local JSON Persistence'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{dbStatus.statusText || 'در حال بررسی اتصال به دیتابیس...'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (fixingCharset) return;
                        setFixingCharset(true);
                        try {
                          const res = await apiClient.fixCharset(adminUid);
                          alert(res.message || 'عملیات بروزرسانی انکودینگ انجام شد.');
                          refreshDbStatus();
                        } catch (err: any) {
                          alert(`خطا: ${err.message}`);
                        } finally {
                          setFixingCharset(false);
                        }
                      }}
                      disabled={fixingCharset}
                      className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <RefreshCw size={14} className={fixingCharset ? "animate-spin" : ""} />
                      همگام‌سازی انکودینگ utf8mb4 (حل ???)
                    </button>

                    <button
                      onClick={() => refreshDbStatus()}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <Activity size={14} className={dbStatus.loading ? "animate-spin" : ""} />
                      تست مجدد اتصال
                    </button>
                  </div>
                </div>

                {/* Connection details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase">میزبان (Host):</span>
                    <span className="text-white font-mono font-bold truncate">{dbStatus.host || '---'}</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase">نام دیتابیس:</span>
                    <span className="text-white font-mono font-bold truncate">{dbStatus.database || '---'}</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase">انکودینگ متن (Charset):</span>
                    <span className="text-emerald-400 font-mono font-bold">{dbStatus.charset || 'utf8mb4_unicode_ci'}</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase">زمان پاسخ‌دهی (Latency):</span>
                    <span className="text-amber-400 font-mono font-bold">{dbStatus.latencyMs !== undefined ? `${dbStatus.latencyMs}ms` : '---'}</span>
                  </div>
                </div>

                {/* Real-time row counts from DB tables */}
                {dbStatus.tableCounts && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[11px] font-bold text-zinc-400 mb-2">تعداد رکورد‌های واقعی ثبت‌شده در تیبل‌های دیتابیس live:</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {Object.entries(dbStatus.tableCounts).map(([table, count]) => (
                        <div key={table} className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <span className="text-zinc-400 font-mono">{table}:</span>
                          <span className="text-white font-black font-mono">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                  <div className="p-4 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-lg">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      Total Series
                    </p>
                    <p className="text-3xl font-black text-white">
                      {seriesList.length}
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                  <div className="p-4 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-lg">
                    <List size={24} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      Total Chapters
                    </p>
                    <p className="text-3xl font-black text-white">
                      {totalChapters || "-"}
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                  <div className="p-4 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-lg">
                    <UsersIcon size={24} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      Total Users
                    </p>
                    <p className="text-3xl font-black text-white">
                      {usersList.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div>
                  <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-6">
                    User Growth (Last 7 Days)
                  </h2>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                      <LineChart
                        data={userGrowthChartData}
                        style={{ outline: 'none' }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#ffffff10"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15, 15, 18, 0.95)",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                            color: "#fff"
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="users"
                          stroke="var(--color-asura-accent)"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "var(--color-asura-accent)", strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: "var(--color-asura-accent)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-6">
                    Daily Views
                  </h2>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                      <AreaChart
                        data={dailyViewsChartData}
                        style={{ outline: 'none' }}
                      >
                        <defs>
                          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-asura-accent)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-asura-accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#ffffff10"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15, 15, 18, 0.95)",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                            color: "#fff"
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="views"
                          stroke="var(--color-asura-accent)"
                          fillOpacity={1}
                          fill="url(#colorViews)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                  <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-6">
                    Top Series By Views
                  </h2>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                      <BarChart
                        layout="vertical"
                        data={topSeriesChartData}
                        style={{ outline: 'none' }}
                        margin={{ left: 50 }}
                      >
                        <XAxis
                          type="number"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15, 15, 18, 0.95)",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "8px",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                            color: "#fff"
                          }}
                          cursor={{ fill: "#ffffff05" }}
                        />
                        <Bar
                          dataKey="views"
                          fill="var(--color-asura-accent)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mt-8">
                Most Popular Series
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {seriesList
                  .slice()
                  .sort((a, b) => (b.views || 0) - (a.views || 0))
                  .slice(0, 6)
                  .map((series, idx) => (
                    <div
                      key={series.id}
                      className="bg-black/40 border border-white/10 rounded-xl p-4 flex gap-4 items-center"
                    >
                      <div className="text-3xl font-black text-zinc-800 w-8">
                        {idx + 1}
                      </div>
                      <img
                        src={series.cover}
                        alt={series.title}
                        className="w-16 h-24 object-cover rounded-lg bg-zinc-800 shrink-0"
                      />
                      <div className="flex flex-col">
                        <h3 className="text-white font-bold line-clamp-2">
                          {series.title}
                        </h3>
                        <div className="flex items-center gap-1 text-yellow-500 text-xs mt-2 font-bold">
                          <Star size={12} fill="currentColor" />{" "}
                          {series.rating ? series.rating.toFixed(1) : "N/A"}
                        </div>
                        <p className="text-zinc-500 text-xs mt-1">
                          {series.type} • {series.status}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === "manage" && showSeriesTabs && (
            <div className="overflow-x-auto">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Manage Series
              </h2>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {seriesList.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        <div className="flex items-center gap-3">
                          <img
                            src={s.cover}
                            alt="cover"
                            className="w-8 h-12 object-cover rounded bg-zinc-800"
                          />
                          <span className="line-clamp-1">{s.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{s.status}</td>
                      <td className="py-3 px-4 text-zinc-300">{s.type}</td>
                      <td className="py-3 px-4 text-yellow-500">
                        {s.rating || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditClick(s)}
                            className="text-[var(--color-asura-accent-light)] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSeries(s.id, s.title)}
                            className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {seriesList.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-zinc-500"
                      >
                        No series found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "users" && showUsersTab && (
            <div className="overflow-x-auto text-right" dir="rtl">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                مدیریت و رهگیری کاربران وبسایت
              </h2>
              
              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="جستجو بر اساس شناسه اختصاصی (کد کاربری)، نام و نام خانوادگی، شماره تلفن، نام کاربری یا ایمیل..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors placeholder:text-zinc-500"
                />
              </div>

              <table className="w-full text-right border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">کاربر</th>
                    <th className="py-3 px-4">اطلاعات تکمیلی پروفایل</th>
                    <th className="py-3 px-4">دسترسی ساخت اثر</th>
                    <th className="py-3 px-4">نقش</th>
                    <th className="py-3 px-4">عملیات</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {usersList
                    .filter((u) => {
                      if (!userSearchQuery) return true;
                      const q = userSearchQuery.toLowerCase();
                      const displayName = (u.displayName || "").toLowerCase();
                      const email = (u.email || "").toLowerCase();
                      const id = (u.id || "").toLowerCase();
                      const melliCode = (u.melliCode || "").toLowerCase();
                      const firstName = (u.firstName || "").toLowerCase();
                      const lastName = (u.lastName || "").toLowerCase();
                      const fullName = `${firstName} ${lastName}`.toLowerCase();
                      const phoneNumber = (u.phoneNumber || "").toLowerCase();

                      return (
                        displayName.includes(q) ||
                        email.includes(q) ||
                        id.includes(q) ||
                        melliCode.includes(q) ||
                        firstName.includes(q) ||
                        lastName.includes(q) ||
                        fullName.includes(q) ||
                        phoneNumber.includes(q)
                      );
                    })
                    .map((u) => {
                      const isUserAdmin =
                        adminsMap[u.id] ||
                        u.email === "amirrezaveisi45@gmail.com" ||
                        u.email === "Mr.V@admin.com" ||
                        (u.roles || []).includes('super_admin') ||
                        (u.roles || []).includes('admin');
                      
                      const currentRoles: string[] = u.roles || (u.role === 'admin' ? ['admin'] : ['user']);
                      const roleLabels = currentRoles.map(rKey => {
                        const r = ALL_ROLES.find(item => item.key === rKey);
                        return r ? r.label.split(" (")[0] : (rKey === 'user' ? 'کاربر عادی' : rKey);
                      }).join("، ");

                      return (
                        <tr
                          key={u.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-4 text-white font-medium">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  u.avatarUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'></circle><path d='M18 20a6 6 0 0 0-12 0'></path><circle cx='12' cy='10' r='4'></circle></svg>"
                                }
                                alt="avatar"
                                className="w-8 h-8 object-cover rounded-full bg-zinc-800"
                              />
                              <div className="flex flex-col text-right">
                                <span className="line-clamp-1 font-bold text-xs">
                                  {u.displayName}
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {u.email || u.id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-zinc-300">
                            <div className="flex flex-col text-right gap-0.5">
                              <div>
                                <span className="text-zinc-500">شناسه ۶ رقمی: </span>
                                <span className="font-mono text-[var(--color-asura-accent-light)] font-bold">
                                  {u.melliCode || "ثبت نشده"}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500">نام حقیقی: </span>
                                <span className="font-semibold">
                                  {u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}` : "ثبت نشده"}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500">شماره تلفن: </span>
                                <span className="font-mono text-zinc-400">
                                  {u.phoneNumber || "ثبت نشده"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                const nextVal = !u.canCreateSeries;
                                apiClient
                                  .setUserCanCreateSeries(u.id, nextVal, adminUid)
                                  .then(() => {
                                    alert(`دسترسی ساخت مانهوا برای کاربر با موفقیت ${nextVal ? 'فعال' : 'غیرفعال'} شد.`);
                                    fetchUsersAndComments();
                                  })
                                  .catch((err) =>
                                    alert("خطا در تغییر وضعیت دسترسی: " + err.message)
                                  );
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${
                                u.canCreateSeries
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-zinc-800/40 border-white/5 text-zinc-500"
                              }`}
                            >
                              {u.canCreateSeries ? "دارای دسترسی ساخت" : "فاقد دسترسی ساخت"}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded ${
                                isUserAdmin
                                  ? "bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)]"
                                  : "bg-zinc-850 text-zinc-400 border border-white/5"
                              }`}
                            >
                              {roleLabels}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {isSuperAdmin && u.id !== currentUserData?.id && (
                                <button
                                  onClick={() => {
                                    setSelectedUserForRoles(u);
                                    setSelectedUserRoles(u.roles || (u.role === 'admin' ? ['admin'] : ['user']));
                                    setSelectedUserPermissions(u.permissions || []);
                                    setSelectedUserMelliCode(u.melliCode || "");
                                  }}
                                  className="font-black text-[10px] text-[var(--color-asura-accent-light)] hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10"
                                >
                                  مدیریت نقش و دسترسی
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (u.id === (currentUserData?.id || user?.uid)) {
                                    alert("شما نمی‌توانید حساب کاربری خودتان را مسدود کنید.");
                                    return;
                                  }
                                  const targetRoles = u.roles || [u.role || 'user'];
                                  const isTargetSuperAdmin = targetRoles.includes('super_admin') || u.email === "amirrezaveisi45@gmail.com" || u.email === "Mr.V@admin.com";
                                  if (isTargetSuperAdmin) {
                                    alert("مسدود کردن مدیریت کل امکان‌پذیر نیست.");
                                    return;
                                  }
                                  const newBannedStatus = !u.banned;
                                  if (
                                    !window.confirm(
                                      `آیا از ${newBannedStatus ? "مسدود کردن" : "رفع مسدودیت"} این کاربر اطمینان دارید؟`
                                    )
                                  )
                                    return;
                                  apiClient
                                    .toggleBanUser(u.id, adminUid)
                                    .then(() => fetchUsersAndComments())
                                    .catch((err) =>
                                      alert("خطا در مسدودسازی کاربر: " + err.message)
                                    );
                                }}
                                className={`font-black text-xs transition-colors ${
                                  u.banned
                                    ? "text-green-500 hover:text-green-400"
                                    : "text-red-500 hover:text-red-400"
                                }`}
                              >
                                {u.banned ? "رفع مسدودیت" : "مسدود کردن"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {usersList.filter((u) => {
                    if (!userSearchQuery) return true;
                    const q = userSearchQuery.toLowerCase();
                    const displayName = (u.displayName || "").toLowerCase();
                    const email = (u.email || "").toLowerCase();
                    const id = (u.id || "").toLowerCase();
                    const melliCode = (u.melliCode || "").toLowerCase();
                    const firstName = (u.firstName || "").toLowerCase();
                    const lastName = (u.lastName || "").toLowerCase();
                    const fullName = `${firstName} ${lastName}`.toLowerCase();
                    const phoneNumber = (u.phoneNumber || "").toLowerCase();

                    return (
                      displayName.includes(q) ||
                      email.includes(q) ||
                      id.includes(q) ||
                      melliCode.includes(q) ||
                      firstName.includes(q) ||
                      lastName.includes(q) ||
                      fullName.includes(q) ||
                      phoneNumber.includes(q)
                    );
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500 font-bold">
                        هیچ کاربری یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Roles and Permissions modal */}
              {selectedUserForRoles && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
                  <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative text-right">
                    <h3 className="text-xl font-black text-white mb-2">
                      تنظیم نقش‌ها و دسترسی‌های کاربر: <span className="text-[var(--color-asura-accent-light)]">{selectedUserForRoles.displayName}</span>
                    </h3>
                    <p className="text-zinc-500 text-xs mb-6 font-semibold font-sans">
                      {selectedUserForRoles.email || selectedUserForRoles.id}
                    </p>

                    {/* Unique 8-Digit User Code (Editable by Super Admin) */}
                    <div className="mb-6 bg-black/20 p-4 rounded-xl border border-white/5">
                      <label className="block text-xs font-black text-zinc-300 mb-2">کد اختصاصی ۸ رقمی کاربری</label>
                      <input 
                        type="text" 
                        maxLength={8}
                        value={selectedUserMelliCode}
                        onChange={(e) => setSelectedUserMelliCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="مثال: 12345678"
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] text-left font-mono"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">ویرایش این کد اختصاصی تنها توسط مدیریت کل سیستم امکان‌پذیر است.</p>
                    </div>

                    {/* Roles section */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
                        <h4 className="text-sm font-bold text-white">انتخاب نقش‌های کاربر (امکان انتخاب همزمان چند نقش)</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserRoles(ALL_ROLES.map(r => r.key));
                          }}
                          className="text-xs text-[var(--color-asura-accent-light)] hover:text-white font-bold transition-colors bg-[var(--color-asura-accent)]/10 px-3 py-1 rounded"
                        >
                          اعطای همه نقش‌ها به این کاربر
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ALL_ROLES.map(role => {
                          const hasRole = selectedUserRoles.includes(role.key);
                          return (
                            <label
                              key={role.key}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all text-right ${
                                hasRole 
                                  ? 'bg-[var(--color-asura-accent)]/10 border-[var(--color-asura-accent)]/30 text-white' 
                                  : 'bg-black/20 border-white/5 text-zinc-400 hover:border-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={hasRole}
                                onChange={() => {
                                  if (hasRole) {
                                    setSelectedUserRoles(selectedUserRoles.filter(r => r !== role.key));
                                  } else {
                                    setSelectedUserRoles([...selectedUserRoles, role.key]);
                                  }
                                }}
                                className="mt-1 accent-[var(--color-asura-accent)]"
                              />
                              <div>
                                <span className="text-xs font-black block">{role.label}</span>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">{role.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Overridden Permissions section */}
                    <div className="mb-8">
                      <div className="border-b border-white/10 pb-2 mb-4">
                        <h4 className="text-sm font-bold text-white">دسترسی‌های سفارشی و جداگانه کاربر (اولویت با این تنظیمات است)</h4>
                        <p className="text-[10px] text-zinc-500 mt-1">با تیک زدن این بخش، دسترسی مشخصی به طور انحصاری به این کاربر (جدا از نقش‌هایش) اعطا خواهد شد.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {ALL_PERMISSIONS.map(perm => {
                          const hasPerm = selectedUserPermissions.includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-right ${
                                hasPerm 
                                  ? 'bg-zinc-800 border-zinc-700 text-[var(--color-asura-accent-light)]' 
                                  : 'bg-black/10 border-white/5 text-zinc-400 hover:border-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={hasPerm}
                                onChange={() => {
                                  if (hasPerm) {
                                    setSelectedUserPermissions(selectedUserPermissions.filter(p => p !== perm.key));
                                  } else {
                                    setSelectedUserPermissions([...selectedUserPermissions, perm.key]);
                                  }
                                }}
                                className="accent-[var(--color-asura-accent)]"
                              />
                              <span className="text-xs font-bold">{perm.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-4">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isSuperAdmin && !hasFrontendPermission('manage_users')) {
                            alert("خطای عدم دسترسی: شما دسترسی لازم برای تغییر نقش‌ها و دسترسی‌های کاربران را ندارید.");
                            return;
                          }
                          try {
                            await apiClient.updateUserRolesAndPermissions(
                              selectedUserForRoles.id, 
                              selectedUserRoles, 
                              selectedUserPermissions, 
                              adminUid,
                              selectedUserMelliCode
                            );
                            alert("نقش‌ها و دسترسی‌های کاربر با موفقیت بروزرسانی شد.");
                            setSelectedUserForRoles(null);
                            fetchUsersAndComments();
                          } catch (err: any) {
                            alert("خطا در ذخیره‌سازی دسترسی‌ها: " + err.message);
                          }
                        }}
                        className="flex-1 min-w-[200px] bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold py-3 px-6 rounded-xl text-xs transition-colors"
                      >
                        ذخیره تغییرات و اعمال دسترسی‌ها
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (selectedUserForRoles.id === (currentUserData?.id || adminUid)) {
                              alert("شما نمی‌توانید حساب کاربری خودتان را حذف کنید.");
                              return;
                            }
                            const targetRoles = selectedUserForRoles.roles || [];
                            const isTargetSuperAdmin = targetRoles.includes('super_admin') || 
                                                       selectedUserForRoles.email === "amirrezaveisi45@gmail.com" || 
                                                       selectedUserForRoles.email === "Mr.V@admin.com";
                            if (isTargetSuperAdmin) {
                              alert("امکان حذف حساب کاربری مدیریت کل وجود ندارد.");
                              return;
                            }
                            if (!window.confirm(`آیا از حذف دائم و غیر قابل بازگشت حساب کاربری "${selectedUserForRoles.displayName}" اطمینان کامل دارید؟`)) {
                              return;
                            }
                            try {
                              await apiClient.deleteUser(selectedUserForRoles.id, adminUid);
                              alert("حساب کاربری با موفقیت حذف گردید.");
                              setSelectedUserForRoles(null);
                              fetchUsersAndComments();
                            } catch (err: any) {
                              alert("خطا در حذف حساب کاربری: " + err.message);
                            }
                          }}
                          className="bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white font-black py-3 px-6 rounded-xl text-xs transition-all"
                        >
                          حذف دائم حساب کاربری
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedUserForRoles(null)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 px-6 rounded-xl text-xs transition-colors"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Global Role Permissions Editor */}
              <div className="mt-12 bg-black/20 border border-white/5 rounded-2xl p-6 text-right" dir="rtl">
                <div className="border-b border-white/10 pb-3 mb-6">
                  <h3 className="text-lg font-black text-white">مدیریت سطح دسترسی پیش‌فرض نقش‌ها به صورت سراسری</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    از این بخش می‌توانید تعیین کنید کاربران دارای هر نقش، به طور پیش‌فرض به چه ویژگی‌هایی دسترسی داشته باشند.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">انتخاب نقش برای ویرایش:</label>
                    <div className="space-y-2">
                      {ALL_ROLES.filter(r => r.key !== 'super_admin').map(role => (
                        <button
                          key={role.key}
                          type="button"
                          onClick={() => setEditingRoleDefault(role.key)}
                          className={`w-full text-right p-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-between ${
                            editingRoleDefault === role.key 
                              ? 'bg-[var(--color-asura-accent)]/10 border-[var(--color-asura-accent)]/30 text-white' 
                              : 'bg-black/40 border-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <span>{role.label}</span>
                          <span className="text-[10px] text-zinc-500 font-normal">{(globalRolePermissions[role.key] || []).length} دسترسی</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 bg-black/30 border border-white/5 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4 border-b border-white/5 pb-2 flex justify-between items-center">
                      <span>دسترسی‌های پیش‌فرض نقش: <span className="text-[var(--color-asura-accent-light)] font-black">{ALL_ROLES.find(r => r.key === editingRoleDefault)?.label}</span></span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isSuperAdmin) {
                            alert("خطای عدم دسترسی: تنها مدیریت کل مجاز به ویرایش تنظیمات سراسری نقش‌ها می‌باشد.");
                            return;
                          }
                          try {
                            await apiClient.saveSettings("role_permissions", globalRolePermissions);
                            alert("تنظیمات سطح دسترسی نقش‌ها با موفقیت ذخیره شد.");
                          } catch (err: any) {
                            alert("خطا در ذخیره‌سازی تنظیمات نقش‌ها: " + err.message);
                          }
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-colors"
                      >
                        ذخیره سراسری تنظیمات این نقش
                      </button>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ALL_PERMISSIONS.map(perm => {
                        const currentRolePerms = globalRolePermissions[editingRoleDefault] || [];
                        const hasPerm = currentRolePerms.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all text-right ${
                              hasPerm 
                                ? 'bg-zinc-800 border-zinc-700 text-[var(--color-asura-accent-light)]' 
                                : 'bg-black/10 border-white/5 text-zinc-400 hover:border-white/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={hasPerm}
                              onChange={() => {
                                let updatedPerms = [...currentRolePerms];
                                if (hasPerm) {
                                  updatedPerms = updatedPerms.filter(p => p !== perm.key);
                                } else {
                                  updatedPerms.push(perm.key);
                                }
                                setGlobalRolePermissions({
                                  ...globalRolePermissions,
                                  [editingRoleDefault]: updatedPerms
                                });
                              }}
                              className="accent-[var(--color-asura-accent)]"
                            />
                            <span className="text-xs font-bold">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "comments" && showCommentsTab && (
            <div className="space-y-6" dir="rtl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    مدیریت و تایید دیدگاه‌ها
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    بررسی، تایید، رد یا حذف دیدگاه‌های کاربران در تمامی آثار و چپترها
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-black/40 border border-white/10 p-2.5 rounded-2xl">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input 
                      type="checkbox"
                      checked={siteSettings.autoApproveComments || false}
                      onChange={(e) => {
                        const newVal = e.target.checked;
                        const updated = { ...siteSettings, autoApproveComments: newVal };
                        setSiteSettings(updated);
                        apiClient.saveSettings("global", updated)
                          .then(() => alert(newVal ? "تایید خودکار کامنت‌ها فعال شد." : "تایید خودکار کامنت‌ها غیرفعال شد."))
                          .catch((err: any) => alert("خطا در ذخیره تنظیمات: " + err.message));
                      }}
                      className="form-checkbox h-4 w-4 text-[var(--color-asura-accent)] rounded border-white/20 bg-black"
                    />
                    <span>تایید خودکار دیدگاه‌های جدید</span>
                  </label>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-black/30 p-2.5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2">
                  {[
                    { key: "all", label: "همه دیدگاه‌ها" },
                    { key: "pending", label: "در انتظار تایید ⏳" },
                    { key: "approved", label: "تایید شده ✅" },
                    { key: "rejected", label: "رد شده ❌" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setCommentStatusFilter(tab.key as any);
                        setSelectedCommentIds([]);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        commentStatusFilter === tab.key
                          ? "bg-[var(--color-asura-accent)] text-white shadow-lg"
                          : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Batch Actions Bar */}
                {selectedCommentIds.length > 0 && (
                  <div className="flex items-center gap-2 bg-[var(--color-asura-accent)]/10 border border-[var(--color-asura-accent)]/30 px-3 py-1.5 rounded-xl animate-fadeIn">
                    <span className="text-xs font-bold text-white ml-2">
                      {selectedCommentIds.length} مورد انتخاب شده:
                    </span>
                    <button
                      onClick={() => handleBatchUpdateCommentStatus("approved")}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      تایید همه
                    </button>
                    <button
                      onClick={() => handleBatchUpdateCommentStatus("rejected")}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      رد همه
                    </button>
                    <button
                      onClick={handleBatchDeleteComments}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      حذف همه
                    </button>
                  </div>
                )}
              </div>

              {/* Comments Table */}
              <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 text-xs font-bold uppercase bg-black/40">
                      <th className="py-3.5 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            commentsList.length > 0 &&
                            selectedCommentIds.length === commentsList.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCommentIds(commentsList.map((c) => c.id));
                            } else {
                              setSelectedCommentIds([]);
                            }
                          }}
                          className="form-checkbox h-4 w-4 text-[var(--color-asura-accent)] rounded border-white/20 bg-black cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-4">متن دیدگاه</th>
                      <th className="py-3.5 px-4 w-40">نویسنده</th>
                      <th className="py-3.5 px-4 w-32">اثر / چپتر</th>
                      <th className="py-3.5 px-4 w-32">تاریخ</th>
                      <th className="py-3.5 px-4 w-28 text-center">وضعیت</th>
                      <th className="py-3.5 px-4 w-36 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-white/5">
                    {commentsList.map((c) => {
                      const author = usersList.find((u) => u.id === c.userId || u.id === c.authorId);
                      const isSelected = selectedCommentIds.includes(c.id);
                      const status = c.status || 'approved';
                      const seriesName = c.seriesTitle || seriesList.find((s) => s.id === c.seriesId)?.title || c.seriesId || '—';
                      const chapterNum = c.chapterNumber !== undefined ? c.chapterNumber : (c.chapterId ? c.chapterId.replace('series-', '') : '—');

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-white/5 transition-colors ${
                            isSelected ? "bg-[var(--color-asura-accent)]/10" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCommentIds((prev) => [...prev, c.id]);
                                } else {
                                  setSelectedCommentIds((prev) =>
                                    prev.filter((id) => id !== c.id)
                                  );
                                }
                              }}
                              className="form-checkbox h-4 w-4 text-[var(--color-asura-accent)] rounded border-white/20 bg-black cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="text-zinc-200 font-medium whitespace-pre-wrap leading-relaxed line-clamp-3">
                              {c.content}
                            </p>
                            {c.parentId && (
                              <span className="inline-block mt-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                ↳ پاسخ به دیدگاه
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {c.userAvatar || author?.avatarUrl ? (
                                <img
                                  src={c.userAvatar || author?.avatarUrl}
                                  alt="avatar"
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center text-[10px] text-zinc-400">
                                  👤
                                </div>
                              )}
                              <span className="text-white font-bold truncate max-w-[100px]">
                                {c.userName || author?.displayName || "کاربر ناشناس"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400">
                            <div className="font-bold text-zinc-300 truncate max-w-[120px]" title={seriesName}>
                              {seriesName}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {c.chapterId ? `چپتر ${chapterNum}` : "صفحه اثر"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400 text-[11px] dir-ltr text-right">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString("fa-IR")
                              : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {status === "pending" && (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⏳ در انتظار
                              </span>
                            )}
                            {status === "approved" && (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ✅ تایید شده
                              </span>
                            )}
                            {status === "rejected" && (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                ❌ رد شده
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {status !== "approved" && (
                                <button
                                  onClick={() => handleUpdateCommentStatus(c.id, "approved")}
                                  className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg font-bold text-[10px] transition-colors"
                                  title="تایید دیدگاه"
                                >
                                  تایید
                                </button>
                              )}
                              {status !== "rejected" && (
                                <button
                                  onClick={() => handleUpdateCommentStatus(c.id, "rejected")}
                                  className="p-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg font-bold text-[10px] transition-colors"
                                  title="رد دیدگاه"
                                >
                                  رد
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg font-bold text-[10px] transition-colors"
                                title="حذف دائم"
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {commentsList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-zinc-500">
                          هیچ دیدگاهی برای نمایش یافت نشد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "tickets" && showTicketsTab && (
            <TicketsTab adminUid={adminUid} />
          )}

          {activeTab === "manage_chapters" && showChapterTabs && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h2 className="text-xl font-black text-white uppercase flex items-center gap-2">
                  Manage Chapters
                </h2>
                <div className="w-64">
                  <select
                    value={selectedSeriesForChapters}
                    onChange={(e) =>
                      setSelectedSeriesForChapters(e.target.value)
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">-- Choose Series --</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSeriesForChapters ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Chapter No.</th>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Pages</th>
                        <th className="py-3 px-4">Views</th>
                        <th className="py-3 px-4">Publish At</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {chaptersList.map((ch) => (
                        <tr
                          key={ch.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-4 text-white font-medium">
                            Chapter {ch.number}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {ch.title || "-"}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {ch.images?.length || 0}
                          </td>
                          <td className="py-3 px-4 flex gap-1 items-center font-bold text-zinc-300">
                            <BarChart2
                              size={14}
                              className="text-[var(--color-asura-accent)]"
                            />{" "}
                            {ch.views || 0}
                          </td>
                          <td className="py-3 px-4 text-zinc-400 text-xs whitespace-nowrap">
                            {ch.publishAt
                              ? new Date(ch.publishAt).toLocaleString()
                              : "Immediate"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  handleEditChapterClick(ch);
                                  setActiveTab("chapters");
                                }}
                                className="text-[var(--color-asura-accent-light)] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteChapter(
                                    ch.seriesId,
                                    ch.id,
                                    ch.number,
                                  )
                                }
                                className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {chaptersList.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-8 text-center text-zinc-500"
                          >
                            No chapters found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  Please select a series to view its chapters.
                </div>
              )}
            </div>
          )}

          {activeTab === "series" && showSeriesTabs && (
            <form onSubmit={handleAddSeries} className="space-y-6 max-w-3xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h2 className="text-xl font-black text-white uppercase">
                  {editingSeries ? "Edit Series" : "Create New Series"}
                </h2>
                {editingSeries && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSeries(null);
                      setSeriesForm({
                        title: "",
                        cover: "",
                        author: "",
                        artist: "",
                        synopsis: "",
                        genres: "",
                        tags: "",
                        status: "Ongoing",
                        type: "Manhwa",
                        isHero: false,
                        isFeatured: false,
                        slug: "",
                      });
                      setActiveTab("manage");
                    }}
                    className="text-xs text-zinc-400 hover:text-white uppercase font-bold tracking-wider"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Title
                  </label>
                  <input
                    required
                    value={seriesForm.title}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, title: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Custom Slug / Custom Link Path (e.g. "solo-leveling")
                  </label>
                  <input
                    value={seriesForm.slug}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, slug: e.target.value })
                    }
                    placeholder="Leave empty to use title-based slug"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                {editingSeries && isSuperAdmin && (
                  <div className="border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl space-y-3">
                    <label className="block text-xs font-black text-amber-400 uppercase mb-1">
                      تغییر شناسه ثابت دیتابیس (آدرس قدیمی)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="new-series-db-id"
                        defaultValue={editingSeries.id}
                        placeholder="مثال: solo-leveling"
                        className="flex-1 bg-black/60 border border-amber-500/30 rounded-lg px-4 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const val = (document.getElementById("new-series-db-id") as HTMLInputElement)?.value?.trim();
                          if (!val) return alert("شناسه معتبر نیست.");
                          if (val === editingSeries.id) return alert("شناسه جدید با شناسه فعلی برابر است.");
                          if (confirm(`آیا مطمئن هستید که می‌خواهید شناسه این اثر را از "${editingSeries.id}" به "${val}" تغییر دهید؟ تمام لینک‌ها، چپترها و خریدها به شناسه جدید منتقل خواهند شد.`)) {
                            try {
                              await apiClient.changeSeriesId(editingSeries.id, val, adminUid);
                              alert("شناسه با موفقیت تغییر یافت. لطفاً پنل را مجدداً بارگذاری کنید.");
                              window.location.reload();
                            } catch (e: any) {
                              alert(e.message);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs rounded-lg transition-colors shrink-0"
                      >
                        به‌روزرسانی شناسه
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">
                      ⚠️ هشدار: تغییر شناسه دیتابیس، آدرس‌های قدیمی را به کلی نامعتبر می‌کند. فقط در مواقع نیاز مبرم از این ویژگی استفاده کنید.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Cover Image URL
                  </label>
                  <div className="flex flex-col gap-3">
                    <input
                      required
                      value={seriesForm.cover}
                      onChange={(e) =>
                        setSeriesForm({ ...seriesForm, cover: e.target.value })
                      }
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                    <ImageUploader
                      seriesTitle={seriesForm.title}
                      folderType="cover"
                      onUpload={(urls) =>
                        setSeriesForm({ ...seriesForm, cover: urls[0] })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Author
                  </label>
                  <input
                    required
                    value={seriesForm.author}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, author: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Artist
                  </label>
                  <input
                    required
                    value={seriesForm.artist}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, artist: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Synopsis
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={seriesForm.synopsis}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, synopsis: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Genres
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {siteGenres.map((g) => {
                      const curGenres = seriesForm.genres
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const isSelected = curGenres.includes(g);
                      return (
                        <label
                          key={g}
                          className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm text-zinc-300 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              let newG = [...curGenres];
                              if (e.target.checked && !newG.includes(g))
                                newG.push(g);
                              else if (!e.target.checked)
                                newG = newG.filter((x) => x !== g);
                              setSeriesForm({
                                ...seriesForm,
                                genres: newG.join(", "),
                              });
                            }}
                            className="form-checkbox text-[var(--color-asura-accent)] bg-black/40 border-white/10 rounded"
                          />
                          {g}
                        </label>
                      );
                    })}
                  </div>
                  <input
                    required
                    value={seriesForm.genres}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, genres: e.target.value })
                    }
                    placeholder="Or type manually (comma separated)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Tags (comma separated)
                  </label>
                  <input
                    value={seriesForm.tags}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, tags: e.target.value })
                    }
                    placeholder="Reincarnation, Magic"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Status
                  </label>
                  <select
                    value={seriesForm.status}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, status: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option>Ongoing</option>
                    <option>Completed</option>
                    <option>Hiatus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Type
                  </label>
                  <select
                    value={seriesForm.type}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, type: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option>Manhwa</option>
                    <option>Manga</option>
                    <option>Manhua</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.isHero}
                      onChange={(e) =>
                        setSeriesForm({
                          ...seriesForm,
                          isHero: e.target.checked,
                        })
                      }
                      className="form-checkbox h-5 w-5 rounded text-[var(--color-asura-accent)] focus:ring-0 bg-black/40 border-white/10"
                    />
                    <span className="text-sm font-bold text-white uppercase">
                      Show in Hero Carousel
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.isFeatured}
                      onChange={(e) =>
                        setSeriesForm({
                          ...seriesForm,
                          isFeatured: e.target.checked,
                        })
                      }
                      className="form-checkbox h-5 w-5 rounded text-[var(--color-asura-accent)] focus:ring-0 bg-black/40 border-white/10"
                    />
                    <span className="text-sm font-bold text-white uppercase">
                      Show in Featured / Top
                    </span>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="mt-6 px-8 py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold text-sm uppercase rounded-lg shadow-lg"
              >
                {editingSeries ? "Update Series" : "Create Series"}
              </button>
            </form>
          )}

          {activeTab === "chapters" && showChapterTabs && (
            <form onSubmit={handleAddChapter} className="space-y-6 max-w-3xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h2 className="text-xl font-black text-white uppercase">
                  {editingChapterId ? "Edit Chapter" : "Add Chapter"}
                </h2>
                {editingChapterId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingChapterId(null);
                      setChapterForm({
                        seriesId: chapterForm.seriesId,
                        number: "",
                        title: "",
                        images: "",
                        sortMode: "natural",
                      });
                      setActiveTab("manage_chapters");
                    }}
                    className="text-xs text-zinc-400 hover:text-white uppercase font-bold tracking-wider"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Select Series
                  </label>
                  <select
                    required
                    value={chapterForm.seriesId}
                    onChange={(e) =>
                      setChapterForm({
                        ...chapterForm,
                        seriesId: e.target.value,
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">-- Choose Series --</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Chapter Number
                  </label>
                  <input
                    required
                    type="number"
                    step="0.5"
                    value={chapterForm.number}
                    onChange={(e) =>
                      setChapterForm({ ...chapterForm, number: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Chapter Title (Optional)
                  </label>
                  <input
                    value={chapterForm.title}
                    onChange={(e) =>
                      setChapterForm({ ...chapterForm, title: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Publish At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={chapterForm.publishAt}
                    onChange={(e) =>
                      setChapterForm({
                        ...chapterForm,
                        publishAt: e.target.value,
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    ترتیب صفحات ریدر (Page Sorting)
                  </label>
                  <select
                    value={chapterForm.sortMode || "natural"}
                    onChange={(e) =>
                      setChapterForm({
                        ...chapterForm,
                        sortMode: e.target.value,
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="natural">مرتب‌سازی عددی خودکار (Natural Sort)</option>
                    <option value="input">ترتیب دستی عینا مطابق ورودی (Input Order)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Image URLs (One per line)
                  </label>
                  <div className="flex flex-col gap-3">
                    <textarea
                      required
                      rows={8}
                      value={chapterForm.images}
                      onChange={(e) =>
                        setChapterForm({
                          ...chapterForm,
                          images: e.target.value,
                        })
                      }
                      placeholder="https://example.com/page1.jpg&#10;https://example.com/page2.jpg"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-[var(--color-asura-accent)]/50 font-mono text-xs"
                    />
                    <ImageUploader
                      multiple
                      seriesTitle={seriesList.find((s: any) => s.id === selectedSeriesForChapters)?.title || ""}
                      chapterNumber={chapterForm.number}
                      onUpload={(urls) =>
                        setChapterForm({
                          ...chapterForm,
                          images: chapterForm.images
                            ? `${chapterForm.images}\n${urls.join("\n")}`
                            : urls.join("\n"),
                        })
                      }
                    />

                    {chapterForm.images.trim().length > 0 && (
                      <SortableImageList
                        images={chapterForm.images
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean)}
                        onChange={(newImages) =>
                          setChapterForm({
                            ...chapterForm,
                            images: newImages.join("\n"),
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="px-8 py-3 flex items-center gap-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold text-sm uppercase rounded-lg shadow-lg"
              >
                <Plus size={18} />{" "}
                {editingChapterId ? "Update Chapter" : "Publish Chapter"}
              </button>
            </form>
          )}

          {activeTab === "taxonomy" && showTaxonomyTab && (
            <div>
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Manage Taxonomy
              </h2>
              <div className="bg-black/20 p-6 rounded-xl border border-white/5 mb-8">
                <h3 className="text-sm font-bold text-white uppercase mb-4">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {siteGenres.map((genre) => (
                    <div
                      key={genre}
                      className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2"
                    >
                      {genre}
                      <button
                        onClick={() => {
                          if (!isSuperAdmin && !hasFrontendPermission('manage_settings')) {
                            alert("خطای عدم دسترسی: شما دسترسی لازم برای ویرایش دسته‌بندی‌ها را ندارید.");
                            return;
                          }
                          const newG = siteGenres.filter((g) => g !== genre);
                          setSiteGenres(newG);
                          apiClient.saveSettings("taxonomy", { genres: newG })
                            .catch(err => alert("Failed to save genres: " + err.message));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!isSuperAdmin && !hasFrontendPermission('manage_settings')) {
                      alert("خطای عدم دسترسی: شما دسترسی لازم برای ویرایش دسته‌بندی‌ها را ندارید.");
                      return;
                    }
                    if (!newGenreInput.trim()) return;
                    const newG = [...siteGenres, newGenreInput.trim()];
                    setSiteGenres(newG);
                    apiClient.saveSettings("taxonomy", { genres: newG })
                      .then(() => setNewGenreInput(""))
                      .catch(err => alert("Failed to save genres: " + err.message));
                  }}
                  className="flex gap-2 max-w-sm"
                >
                  <input
                    type="text"
                    value={newGenreInput}
                    onChange={(e) => setNewGenreInput(e.target.value)}
                    placeholder="New Genre (e.g. Space)"
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                  />
                  <button
                    type="submit"
                    className="bg-[var(--color-asura-accent)] px-4 py-2 rounded-lg text-white font-bold text-sm"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === "reports" && showReportsTab && (
            <div>
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                User Reports
              </h2>
              <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Reason / Context</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {reportsList.map((r) => (
                      <tr key={r.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${r.status === 'pending' ? 'bg-red-500/10' : ''}`}>
                        <td className="py-3 px-4 text-white font-bold uppercase text-[10px] tracking-wider">
                           {r.type.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                           <div className="text-white font-medium break-words break-all max-w-[300px]">{r.reason}</div>
                           {r.type === 'comment' && (
                             <div className="mt-2 pl-2 border-l-2 border-zinc-700 text-zinc-400 italic text-xs break-words break-all max-w-[300px]">
                               "{r.commentContent}"
                             </div>
                           )}
                           {r.type === 'chapter_issue' && (
                             <div className="text-zinc-500 text-xs mt-1">Series: {r.seriesId} | Ch: {r.chapterNumber}</div>
                           )}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-xs">
                          {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'Just now'}
                        </td>
                        <td className="py-3 px-4">
                           <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded ${r.status === 'pending' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                             {r.status}
                           </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-2">
                             {r.status === 'pending' && (
                               <button 
                                 onClick={() => apiClient.resolveReport(r.id, 'resolved', adminUid).then(() => fetchUsersAndComments())} 
                                 className="text-xs font-bold text-green-400 hover:text-green-300 uppercase tracking-wider text-left"
                               >
                                 Mark Resolved
                               </button>
                             )}
                             {r.type === 'comment' && (
                               <button onClick={async () => {
                                  if (!window.confirm("Delete this reported comment?")) return;
                                  try {
                                    await apiClient.deleteComment(r.commentId);
                                    await apiClient.resolveReport(r.id, 'resolved', adminUid);
                                    fetchUsersAndComments();
                                    alert('Comment deleted & Report resolved.');
                                  } catch (e: any) { alert("Error: " + e.message); }
                               }} className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-wider text-left">Delete Comment</button>
                             )}
                             <button onClick={() => {
                               if (!window.confirm("Delete this report?")) return;
                               apiClient.deleteReportAdmin(r.id, adminUid).then(() => fetchUsersAndComments());
                             }} className="text-[10px] text-zinc-500 hover:text-red-400 text-left">Delete Report</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reportsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500">No reports found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "settings" && showSettingsTab && (
            <div>
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Global Settings
              </h2>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isSuperAdmin && !hasFrontendPermission('manage_settings')) {
                    alert("خطای عدم دسترسی: شما دسترسی لازم برای تغییر تنظیمات سراسری را ندارید.");
                    return;
                  }
                  apiClient.saveSettings("global", siteSettings)
                    .then(() => alert("Settings saved successfully!"))
                    .catch((err: any) => alert("Failed to save settings: " + err.message));
                }}
                className="space-y-6"
              >
                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6" dir="rtl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                        <span>تنظیمات حالت تعمیرات و بروزرسانی وبسایت (Maintenance Mode)</span>
                      </h3>
                      <p className="text-zinc-500 text-xs mt-1">
                        با فعال‌سازی این حالت، دسترسی کاربران عادی قطع شده و صفحه بروزرسانی نمایش داده می‌شود.
                      </p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl hover:bg-red-500/20 transition-all">
                      <input 
                        type="checkbox" 
                        checked={siteSettings.maintenanceMode} 
                        onChange={e => setSiteSettings({...siteSettings, maintenanceMode: e.target.checked})}
                        className="form-checkbox h-5 w-5 text-red-500 bg-black/40 border-white/10 rounded cursor-pointer"
                      />
                      <span className="text-red-400 font-bold text-xs uppercase tracking-wider">فعال‌سازی حالت تعمیرات</span>
                    </label>
                  </div>

                  {/* Dual Language Editable Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Persian Content */}
                    <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
                      <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <span>متون به زبان فارسی (Persian)</span>
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2">عنوان پیام بروزرسانی (فارسی)</label>
                        <input
                          type="text"
                          value={siteSettings.maintenanceTitleFa || ""}
                          onChange={e => setSiteSettings({ ...siteSettings, maintenanceTitleFa: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-xs"
                          placeholder="سایت در حال بروزرسانی و ارتقا می‌باشد"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2">توضیحات کامل (فارسی)</label>
                        <textarea
                          rows={3}
                          value={siteSettings.maintenanceDescFa || ""}
                          onChange={e => setSiteSettings({ ...siteSettings, maintenanceDescFa: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-xs leading-relaxed"
                          placeholder="ما در حال ارتقای سرورها و افزودن امکانات جدید هستیم..."
                        />
                      </div>
                    </div>

                    {/* English Content */}
                    <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5" dir="ltr">
                      <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <span>English Content</span>
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2">Maintenance Title (English)</label>
                        <input
                          type="text"
                          value={siteSettings.maintenanceTitleEn || ""}
                          onChange={e => setSiteSettings({ ...siteSettings, maintenanceTitleEn: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-xs"
                          placeholder="Website Under Maintenance"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2">Maintenance Description (English)</label>
                        <textarea
                          rows={3}
                          value={siteSettings.maintenanceDescEn || ""}
                          onChange={e => setSiteSettings({ ...siteSettings, maintenanceDescEn: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-xs leading-relaxed"
                          placeholder="We are currently upgrading our platform to serve you better..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-2 flex items-center gap-2">
                    Branding & Personalization (شخصی‌سازی و برندینگ سایت)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">اسم وبسایت (Website Name)</label>
                      <input 
                        value={siteSettings.siteName || ""} 
                        onChange={e => setSiteSettings({...siteSettings, siteName: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                        placeholder="Asura Scans"
                        required
                      />
                      <p className="text-zinc-500 text-[10px] mt-1">این اسم در عنوان صفحات، فوتر و کپی‌رایت نمایش داده خواهد شد.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">فونت وبسایت (Website Font)</label>
                      <select 
                        value={siteSettings.siteFont || "Inter"} 
                        onChange={e => setSiteSettings({...siteSettings, siteFont: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white bg-[#0f0f12]"
                      >
                        <option value="Inter">Inter (Sans-serif انگلیسی)</option>
                        <option value="Outfit">Outfit (Geometric انگلیسی)</option>
                        <option value="Vazirmatn">Vazirmatn (فونت فارسی مدرن و خوانا)</option>
                        <option value="Rubik">Rubik (فونت فارسی و انگلیسی فانتزی)</option>
                        <option value="Lalezar">Lalezar (فونت فارسی ضخیم و جذاب)</option>
                      </select>
                      <p className="text-zinc-500 text-[10px] mt-1">تغییر فونت به طور کامل بر روی کلیه متون وبسایت اعمال خواهد شد.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">لوگو اختصاصی وبسایت (Custom Logo)</label>
                    <div className="flex flex-col md:flex-row gap-4 items-stretch">
                      <div className="flex-1 space-y-3">
                        <input 
                          value={siteSettings.logoUrl || ""} 
                          onChange={e => setSiteSettings({...siteSettings, logoUrl: e.target.value})} 
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                          placeholder="https://example.com/logo.png"
                        />
                        {siteSettings.logoUrl && (
                          <div className="p-3 bg-white/5 rounded-lg border border-white/5 inline-flex items-center gap-3">
                            <span className="text-xs text-zinc-400">پیش‌نمایش لوگو:</span>
                            <img src={siteSettings.logoUrl} alt="Logo Preview" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
                            <button 
                              type="button" 
                              onClick={() => setSiteSettings({...siteSettings, logoUrl: ""})}
                              className="text-red-500 hover:text-red-400 text-xs font-bold"
                            >
                              حذف لوگو
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="w-full md:w-64 bg-black/10 border border-white/10 border-dashed rounded-xl p-3 flex flex-col justify-center items-center">
                        <span className="text-xs text-zinc-400 mb-2">آپلود مستقیم فایل لوگو:</span>
                        <ImageUploader 
                          onUpload={(urls) => {
                            if (urls && urls.length > 0) {
                              setSiteSettings(prev => ({ ...prev, logoUrl: urls[0] }));
                            }
                          }} 
                          multiple={false}
                        />
                      </div>
                    </div>
                    <p className="text-zinc-500 text-[10px] mt-2">اگر لوگویی اضافه کنید، به جای نام متنی وبسایت در هدر (بالا) نمایش داده می‌شود. اگر کادر را خالی بگذارید، نام متنی نوشته شده در بالا نمایش داده خواهد شد.</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-white border-b border-white/5 pb-1 uppercase">رنگ‌بندی وبسایت (Website Colors)</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Primary Accent Color */}
                      <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                        <label className="block text-xs font-bold text-zinc-400">رنگ اصلی اکستور (Accent Color)</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={siteSettings.primaryColor || "#4f46e5"} 
                            onChange={e => setSiteSettings({...siteSettings, primaryColor: e.target.value})}
                            className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.primaryColor || ""} 
                            onChange={e => setSiteSettings({...siteSettings, primaryColor: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Hover Color */}
                      <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                        <label className="block text-xs font-bold text-zinc-400">رنگ هاور اکستور (Hover Color)</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={siteSettings.hoverColor || "#4338ca"} 
                            onChange={e => setSiteSettings({...siteSettings, hoverColor: e.target.value})}
                            className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.hoverColor || ""} 
                            onChange={e => setSiteSettings({...siteSettings, hoverColor: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Light Accent Color */}
                      <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                        <label className="block text-xs font-bold text-zinc-400">رنگ روشن اکستور (Light Accent Color)</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={siteSettings.lightColor || "#818cf8"} 
                            onChange={e => setSiteSettings({...siteSettings, lightColor: e.target.value})}
                            className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.lightColor || ""} 
                            onChange={e => setSiteSettings({...siteSettings, lightColor: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Background Color */}
                      <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                        <label className="block text-xs font-bold text-zinc-400">رنگ پس‌زمینه (Background Color)</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={siteSettings.backgroundColor || "#0a0a0c"} 
                            onChange={e => setSiteSettings({...siteSettings, backgroundColor: e.target.value})}
                            className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.backgroundColor || ""} 
                            onChange={e => setSiteSettings({...siteSettings, backgroundColor: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Card Background Color */}
                      <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                        <label className="block text-xs font-bold text-zinc-400">رنگ پس‌زمینه کارت‌ها (Card Color)</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={siteSettings.cardColor || "#0f0f12"} 
                            onChange={e => setSiteSettings({...siteSettings, cardColor: e.target.value})}
                            className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={siteSettings.cardColor || ""} 
                            onChange={e => setSiteSettings({...siteSettings, cardColor: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-2">SEO & Metadata</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Meta Description</label>
                    <textarea 
                      rows={2} 
                      value={siteSettings.seoDescription} 
                      onChange={e => setSiteSettings({...siteSettings, seoDescription: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Keywords</label>
                    <input 
                      value={siteSettings.seoKeywords} 
                      onChange={e => setSiteSettings({...siteSettings, seoKeywords: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                      placeholder="manga, manhwa, comic"
                    />
                  </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-2">Footer Appearance</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">About Us Text</label>
                    <textarea 
                      rows={3} 
                      value={siteSettings.aboutText} 
                      onChange={e => setSiteSettings({...siteSettings, aboutText: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Copyright Text (متن کپی‌رایت)</label>
                      <input 
                        value={siteSettings.footerCopyrightText || ""} 
                        onChange={e => setSiteSettings({...siteSettings, footerCopyrightText: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                        placeholder="Mangata"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Copyright Subtext (زیرنویس کپی‌رایت)</label>
                      <input 
                        value={siteSettings.footerSubtext || ""} 
                        onChange={e => setSiteSettings({...siteSettings, footerSubtext: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                        placeholder="MADE BY FANS FOR FANS"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Twitter URL</label>
                      <input 
                        value={siteSettings.twitterUrl || ""} 
                        onChange={e => setSiteSettings({...siteSettings, twitterUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-xs font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Discord URL</label>
                      <input 
                        value={siteSettings.discordUrl || ""} 
                        onChange={e => setSiteSettings({...siteSettings, discordUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-xs font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">GitHub URL</label>
                      <input 
                        value={siteSettings.githubUrl || ""} 
                        onChange={e => setSiteSettings({...siteSettings, githubUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-xs font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Telegram URL</label>
                      <input 
                        value={siteSettings.telegramUrl || ""} 
                        onChange={e => setSiteSettings({...siteSettings, telegramUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-xs font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Instagram URL</label>
                      <input 
                        value={siteSettings.instagramUrl || ""} 
                        onChange={e => setSiteSettings({...siteSettings, instagramUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-xs font-mono" 
                      />
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="px-8 py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-lg font-bold uppercase text-sm shadow-lg transition-colors">
                  Save All Settings
                </button>
              </form>

              {(currentUserData?.roles?.includes('super_admin') || user?.email === "amirrezaveisi45@gmail.com" || user?.email === "Mr.V@admin.com") && (
                <div className="bg-red-950/20 p-6 rounded-xl border border-red-500/20 space-y-4 mt-8" dir="rtl">
                  <h3 className="text-sm font-black text-red-400 border-b border-red-500/10 pb-2 flex items-center gap-2">
                    ابزارهای مدیریت محتوای آزمایشی (Super Admin Only)
                  </h3>
                  <p className="text-zinc-400 text-xs font-bold">
                    با استفاده از این دکمه می‌توانید دیتابیس را با اطلاعات اولیه آزمایشی (مانهواها، دسته‌بندی‌ها و...) پر کنید.
                  </p>
                  <button 
                    type="button"
                    onClick={() => {
                      if (window.confirm("آیا مطمئن هستید که می‌خواهید دیتابیس دمو را ایجاد کنید؟")) {
                        seedDatabase();
                        alert("درخواست تولید محتوای اولیه ارسال شد.");
                      }
                    }}
                    className="px-6 py-2 bg-red-900/20 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-xl font-black text-xs transition-colors"
                  >
                    تولید محتوای اولیه دمو (Seed Data)
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "wallet" && showWalletTab && (
            <div className="space-y-8" dir="rtl">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">مدیریت کیف پول‌ها و امور مالی</h2>
                  <p className="text-xs text-zinc-500 mt-1">شارژ، برداشت و بررسی زنده تراکنش‌های مالی کاربران سایت</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Right/Main Area: Users list */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                    <h3 className="text-sm font-black text-white">لیست کاربران سیستم</h3>
                    <input
                      type="text"
                      placeholder="جستجوی کاربر با نام یا ایمیل..."
                      value={walletSearchQuery}
                      onChange={e => setWalletSearchQuery(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-white w-full max-w-xs focus:outline-none focus:border-[var(--color-asura-accent)]"
                    />
                  </div>

                  <div className="overflow-x-auto bg-black/10 border border-white/5 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-zinc-500">
                          <th className="p-4 font-black text-right">کاربر</th>
                          <th className="p-4 font-black text-right">نقش سیستم</th>
                          <th className="p-4 font-black text-left">موجودی کیف پول</th>
                          <th className="p-4 font-black text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {usersList
                          .filter(u => {
                            if (!walletSearchQuery) return true;
                            const query = walletSearchQuery.toLowerCase();
                            return (u.displayName || "").toLowerCase().includes(query) ||
                                   (u.email || "").toLowerCase().includes(query);
                          })
                          .map((u: any) => {
                            const uRoles = u.roles || [u.role || 'user'];
                            const isSelected = selectedUserForCharge === u.id;
                            return (
                              <tr key={u.id} className={`transition-colors hover:bg-white/5 ${isSelected ? 'bg-indigo-500/5 border-r-2 border-[var(--color-asura-accent)]' : ''}`}>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0">
                                      {u.avatarUrl ? (
                                        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        (u.displayName || "U").charAt(0)
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-black text-white text-xs">{u.displayName || "کاربر ناشناس"}</p>
                                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{u.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-wrap gap-1">
                                    {uRoles.map((r: string) => (
                                      <span key={r} className="bg-white/5 border border-white/10 text-[9px] px-1.5 py-0.5 rounded text-zinc-400 font-bold">
                                        {r === 'super_admin' ? 'مدیریت کل' : r === 'admin' ? 'ادمین' : r === 'translator' ? 'مترجم' : r === 'cleaner' ? 'کلینر' : r === 'editor' ? 'ادیتور' : r}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-4 text-left font-black font-mono text-emerald-400">
                                  {(u.walletBalance || 0).toLocaleString('fa-IR')} ت
                                </td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedUserForCharge(u.id);
                                      setChargeAmount(0);
                                      setChargeDescription("");
                                      setChargeType("admin_adjustment");
                                    }}
                                    className="bg-[var(--color-asura-accent)]/10 hover:bg-[var(--color-asura-accent)] text-[var(--color-asura-accent-light)] hover:text-white border border-[var(--color-asura-accent)]/20 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
                                  >
                                    تغییر موجودی
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Left Area: Charge form */}
                <div className="space-y-6">
                  {selectedUserForCharge ? (
                    (() => {
                      const selectedUserObj = usersList.find(u => u.id === selectedUserForCharge);
                      return (
                        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-6">
                          <div>
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                              <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                              تراکنش برای {selectedUserObj?.displayName || "کاربر"}
                            </h3>
                            <p className="text-[10px] text-zinc-500 font-mono mt-1">{selectedUserObj?.email}</p>
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 mt-3 flex justify-between items-center text-xs">
                              <span className="text-zinc-400">موجودی فعلی:</span>
                              <span className="font-black text-emerald-400 font-mono">{(selectedUserObj?.walletBalance || 0).toLocaleString('fa-IR')} ت</span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">مبلغ تراکنش (تومان)</label>
                              <input
                                type="number"
                                placeholder="مثال: 50000 برای شارژ، -20000 برای کسر"
                                value={chargeAmount === 0 ? "" : chargeAmount}
                                onChange={e => setChargeAmount(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] font-mono text-left"
                              />
                              <p className="text-[10px] text-zinc-500 mt-1.5">مبالغ مثبت کیف پول را شارژ و مبالغ منفی از موجودی کسر می‌کنند.</p>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">نوع تراکنش</label>
                              <select
                                value={chargeType}
                                onChange={e => setChargeType(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                              >
                                <option value="admin_adjustment">شارژ دستی / تغییر توسط مدیریت</option>
                                <option value="purchase">خرید چپتر مانهوا / دسترسی</option>
                                <option value="system_gift">هدیه سیستم</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">توضیحات تراکنش</label>
                              <textarea
                                placeholder="مثال: بابت پاداش ترجمه چپتر ۵"
                                value={chargeDescription}
                                onChange={e => setChargeDescription(e.target.value)}
                                rows={3}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!isSuperAdmin && !hasFrontendPermission('manage_wallets')) {
                                    alert("خطای عدم دسترسی: شما دسترسی لازم برای تغییر موجودی کیف پول را ندارید.");
                                    return;
                                  }
                                  if (!selectedUserForCharge || chargeAmount === 0) {
                                    alert("لطفا مبلغ تراکنش معتبری وارد کنید.");
                                    return;
                                  }
                                  setSubmittingCharge(true);
                                  try {
                                    const res = await apiClient.chargeWallet(
                                      selectedUserForCharge,
                                      chargeAmount,
                                      chargeType,
                                      chargeDescription
                                    );
                                    if (res.success) {
                                      alert("تراکنش مالی با موفقیت ثبت شد و حساب کاربر بروزرسانی شد.");
                                      setSelectedUserForCharge("");
                                      setChargeAmount(0);
                                      setChargeDescription("");
                                      fetchAllTransactions();
                                      fetchUsersAndComments();
                                    } else {
                                      alert("ثبت تراکنش با خطا مواجه شد: " + (res.error || "خطای ناشناخته"));
                                    }
                                  } catch (err: any) {
                                    alert("خطا: " + err.message);
                                  } finally {
                                    setSubmittingCharge(false);
                                  }
                                }}
                                disabled={submittingCharge}
                                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs py-3 rounded-xl shadow-lg shadow-emerald-500/10 transition-all disabled:opacity-50"
                              >
                                {submittingCharge ? 'در حال ثبت...' : 'ثبت تراکنش جدید'}
                              </button>
                              <button
                                onClick={() => setSelectedUserForCharge("")}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs px-4 py-3 rounded-xl transition-colors"
                              >
                                انصراف
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="bg-black/20 border border-dashed border-white/5 rounded-2xl p-8 text-center text-zinc-500">
                      <Wallet size={36} className="mx-auto mb-3 opacity-40 text-zinc-400" />
                      <p className="text-xs font-bold">برای ثبت تراکنش یا شارژ حساب، دکمه «تغییر موجودی» کنار یکی از کاربران را فشار دهید.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Transactions History Table */}
              <div className="bg-black/10 border border-white/5 rounded-2xl p-6">
                <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
                  گزارش تمام تراکنش‌های سایت (دفتر کل معین زنده)
                </h3>

                {loadingWalletTxs ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
                  </div>
                ) : walletTxs.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-bold">تاکنون تراکنشی در کل سیستم ثبت نشده است.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-zinc-500">
                          <th className="pb-3 font-black text-right">مبلغ</th>
                          <th className="pb-3 font-black text-right">کاربر مقصد</th>
                          <th className="pb-3 font-black text-right">نوع تراکنش</th>
                          <th className="pb-3 font-black text-right">توضیحات تراکنش</th>
                          <th className="pb-3 font-black text-right">ثبت‌کننده</th>
                          <th className="pb-3 font-black text-right">تاریخ و ساعت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {walletTxs.map((tx, index) => {
                          const isPositive = tx.amount >= 0;
                          return (
                            <tr key={tx.id || index} className="hover:bg-white/5 transition-colors">
                              <td className={`py-3.5 font-mono font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isPositive ? '+' : ''}{tx.amount.toLocaleString('fa-IR')} ت
                              </td>
                              <td className="py-3.5 text-white font-bold">
                                {tx.userName || "کاربر ناشناس"} <span className="text-[10px] font-mono text-zinc-500 font-bold">({tx.userId.substring(0, 8)})</span>
                              </td>
                              <td className="py-3.5">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                                  tx.type === 'admin_adjustment' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  tx.type === 'purchase' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                }`}>
                                  {tx.type === 'admin_adjustment' ? 'تغییر دستی' :
                                   tx.type === 'purchase' ? 'خرید چپتر' : 'سایر'}
                                </span>
                              </td>
                              <td className="py-3.5 text-zinc-300 font-bold max-w-xs truncate" title={tx.description}>{tx.description || 'بدون توضیحات'}</td>
                              <td className="py-3.5 text-zinc-400 font-bold">{tx.creatorName || 'سیستم'}</td>
                              <td className="py-3.5 font-mono text-zinc-500 text-[11px]">
                                {new Date(tx.createdAt).toLocaleDateString('fa-IR')} {new Date(tx.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
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
          )}

          {activeTab === "seo" && (isSuperAdmin || hasFrontendPermission('create_series') || hasFrontendPermission('edit_series') || hasFrontendPermission('manage_settings')) && (
            <SeoTab
              seriesList={seriesList}
              fetchSeries={fetchSeries}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {activeTab === "cooperation" && (
            <CooperationTab
              seriesList={seriesList}
              user={user}
              profile={profile}
              isSuperAdmin={isSuperAdmin}
              onUpdateSeries={(updatedSeries: any) => {
                setSeriesList(prev => prev.map(s => s.id === updatedSeries.id ? updatedSeries : s));
              }}
            />
          )}

          {activeTab === "slider" && (
            <div dir="rtl" className="text-right">
              <h2 className="text-lg font-black text-white mb-2">مدیریت اسلایدر صفحه اصلی</h2>
              <p className="text-zinc-400 text-xs mb-6">در این بخش می‌توانید مانهواهایی که قرار است در اسلایدر بزرگ و چرخشی صفحه اصلی قرار بگیرند را مدیریت کنید. محدودیتی در تعداد وجود ندارد، ولی پیشنهاد می‌شود بین ۳ تا ۷ اثر جذاب را انتخاب کنید.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {seriesList.map(s => {
                  const isInSlider = !!s.isHero;
                  return (
                    <div key={s.id} className="bg-black/30 border border-white/5 rounded-2xl p-3 flex flex-col items-center group relative hover:border-[var(--color-asura-accent)]/30 transition-all duration-300">
                      <div className="aspect-[3/4] w-full rounded-xl overflow-hidden relative mb-3 bg-zinc-800">
                        <img src={s.cover} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {isInSlider && (
                          <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg">
                            فعال در اسلایدر
                          </div>
                        )}
                      </div>
                      <h3 className="font-black text-white text-xs line-clamp-1 mb-3 text-center w-full">{s.title}</h3>
                      <button
                        onClick={async () => {
                          try {
                            const payload = {
                              ...s,
                              isHero: !isInSlider
                            };
                            await apiClient.saveSeries(payload);
                            fetchSeries();
                          } catch (err: any) {
                            alert("خطا در بروزرسانی اسلایدر: " + err.message);
                          }
                        }}
                        className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] text-center transition-all ${
                          isInSlider 
                            ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/15 animate-pulse' 
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5'
                        }`}
                      >
                        {isInSlider ? '✓ فعال در اسلایدر' : '+ افزودن به اسلایدر'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "revenue" && isSuperAdmin && (
            <RevenueTab
              seriesList={seriesList}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {activeTab === "backup" && isSuperAdmin && (
            <BackupTab isSuperAdmin={isSuperAdmin} />
          )}

          {activeTab === "download_host" && isSuperAdmin && (
            <DownloadHostTab isSuperAdmin={isSuperAdmin} />
          )}

          {activeTab === "simulation" && isSuperAdmin && (
            <div className="space-y-6" dir="rtl">
              <h2 className="text-xl font-black text-white pb-4 border-b border-white/10 flex items-center gap-2">
                <Eye className="text-amber-500" /> شبیه‌ساز کاربر عادی برای تست عملکردها
              </h2>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
                <h3 className="text-base font-black text-amber-400 mb-2 font-sans">کنترل شبیه‌سازی کاربران</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                  با فعال‌سازی این بخش، شما می‌توانید کل وبسایت را دقیقاً مشابه با یک خواننده معمولی تجربه کنید تا سیستم کسر از موجودی مانهواها، دسترسی‌های چپترها و محدودیت‌های خرید را در وبسایت تست کنید.
                </p>
                
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => {
                      setIsSimulatingUser(true);
                      alert("شبیه‌ساز با موفقیت فعال شد. شما اکنون به عنوان کاربر عادی شبیه‌سازی می‌شوید.");
                    }}
                    className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-lg ${
                      isSimulatingUser
                        ? "bg-amber-500 text-black shadow-amber-500/20"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/5"
                    }`}
                  >
                    <Eye size={16} />
                    {isSimulatingUser ? "شبیه‌ساز در حال حاضر فعال است" : "فعال‌سازی حالت شبیه‌ساز کاربر"}
                  </button>
                  
                  {(isSimulatingUser || localStorage.getItem('asura_simulate_user') === 'true') && (
                    <button
                      onClick={() => {
                        setIsSimulatingUser(false);
                        localStorage.removeItem('asura_simulate_user');
                        alert("حالت شبیه‌سازی با موفقیت ریست و غیرفعال گردید.");
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-red-500/10 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      پاک کردن و غیرفعال‌سازی شبیه‌ساز (ریست)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
