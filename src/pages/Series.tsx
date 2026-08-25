import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSeriesOverview } from '../hooks/useSeries';
import { useBookmarks, useHistory } from '../hooks/useUserActivity';
import { useRatings } from '../hooks/useRatings';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Star, Clock, Heart, Play, Edit2, Trash2, Check, X, ShieldAlert, UserCheck, Plus, Settings, BookOpen, Users, MessageSquare, UserPlus, Sparkles, BarChart2, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Comments } from '../components/Comments';
import WorkTeamTab from '../components/WorkTeamTab';
import { formatDistanceToNow } from 'date-fns';
import { SeriesDetailSkeleton } from '../components/Skeletons';
import { apiClient } from '../lib/apiClient';
import { ImageUploader } from '../components/ImageUploader';
import { useSettings } from '../contexts/SettingsContext';
import { SEOHead } from '../components/SEOHead';

export default function Series() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialSeriesFromNav = (location.state as any)?.initialSeries;
  const { user, profile, isSimulatingUser } = useAuth();
  const { series, loading, mutate } = useSeriesOverview(id, initialSeriesFromNav);
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { getHistoryForSeries } = useHistory();
  const { averageRating, userRating, submitRating, loading: ratingsLoading, totalRatings, starCounts, refetch: refetchRatings } = useRatings(series?.id || id);

  const [hoverRating, setHoverRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRatingScore, setSelectedRatingScore] = useState(5);
  const [ratingReviewText, setRatingReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isAdminEditMode, setIsAdminEditMode] = useState(false);
  const [showAdminRatingPanel, setShowAdminRatingPanel] = useState(false);
  const [showRatingBreakdown, setShowRatingBreakdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [seriesTab, setSeriesTab] = useState<'chapters' | 'team' | 'comments'>('chapters');
  
  // Admin star adjustment state
  const [adminStarCounts, setAdminStarCounts] = useState<{ 1: number; 2: number; 3: number; 4: number; 5: number }>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
  });
  const [isSavingRatingStats, setIsSavingRatingStats] = useState(false);

  // Contributor Request Fields
  const [joinRole, setJoinRole] = useState('translator');
  const [joinMelliCode, setJoinMelliCode] = useState(profile?.melliCode || '');

  // Edit Series Fields
  const { settings } = useSettings();

  const [editForm, setEditForm] = useState({
    title: '',
    alternativeTitles: '',
    cover: '',
    banner: '',
    author: '',
    artist: '',
    synopsis: '',
    genres: '',
    tags: '',
    status: '',
    type: ''
  });

  // Direct Contributor Addition state for admins
  const [showAddContribModal, setShowAddContribModal] = useState(false);
  const [addContribName, setAddContribName] = useState("");
  const [addContribEmail, setAddContribEmail] = useState("");
  const [addContribRole, setAddContribRole] = useState("translator");
  const [addContribMelli, setAddContribMelli] = useState("");
  const [addContribUserId, setAddContribUserId] = useState("");
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    if (series?.title) {
      document.title = `${series.title} - ${settings?.siteName || 'Mangata'}`;
    }
  }, [series?.title, settings?.siteName]);

  useEffect(() => {
    if (profile?.melliCode) {
      setJoinMelliCode(profile.melliCode);
    }
  }, [profile]);

  useEffect(() => {
    if (starCounts) {
      setAdminStarCounts({
        1: starCounts[1] ?? (series?.ratingStats?.[1] || 0),
        2: starCounts[2] ?? (series?.ratingStats?.[2] || 0),
        3: starCounts[3] ?? (series?.ratingStats?.[3] || 0),
        4: starCounts[4] ?? (series?.ratingStats?.[4] || 0),
        5: starCounts[5] ?? (series?.ratingStats?.[5] || 0),
      });
    }
  }, [starCounts, series?.ratingStats]);

  if (loading) {
    return (
      <Layout>
        <SeriesDetailSkeleton />
      </Layout>
    );
  }

  if (!series || !id) {
    return (
      <Layout>
        <div className="flex justify-center flex-col items-center h-[60vh] text-white gap-4">
          <p className="text-xl font-bold uppercase tracking-widest text-red-500">مجموعه یافت نشد</p>
          <Link to="/" className="text-sm text-zinc-400 hover:text-white underline">بازگشت به خانه</Link>
        </div>
      </Layout>
    );
  }

  const bookmarked = isBookmarked(id);
  const history = getHistoryForSeries(id);

  const handleBookmarkToggle = () => {
    if (!user) {
      alert("لطفا برای نشاندار کردن ابتدا وارد حساب کاربری شوید.");
      return;
    }
    if (bookmarked) {
      removeBookmark(id);
    } else {
      addBookmark(id);
    }
  };

  const handleDirectStarVote = async (star: number) => {
    setSelectedRatingScore(star);
    if (user) {
      try {
        await submitRating(star);
      } catch (e) {}
    }
    setShowRatingModal(true);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      alert("لطفا برای ثبت نظر وارد شوید.");
      return;
    }
    setIsSubmittingReview(true);
    try {
      await submitRating(selectedRatingScore);
      if (ratingReviewText.trim()) {
        const commentScopeId = `series-${series.id}`;
        const randomId = 'comment_' + Math.random().toString(36).substr(2, 9);
        await apiClient.addComment(commentScopeId, {
          id: randomId,
          userId: user.uid,
          userName: profile?.displayName || user.displayName || 'کاربر',
          userAvatar: profile?.avatarUrl || user.photoURL || '',
          content: ratingReviewText.trim(),
          parentId: ''
        });
        setRatingReviewText("");
      }
      alert("امتیاز و نظر شما با موفقیت ثبت شد و میانگین بروزرسانی گردید.");
      setShowRatingModal(false);
    } catch (err: any) {
      alert("خطا در ثبت: " + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Filter out scheduled chapters
  // Admin and Contributor Authorization
  const userRoles = profile?.roles || (user as any)?.roles || [profile?.role || 'user'];
  const isOwnerEmail = [
    profile?.email?.toLowerCase(),
    user?.email?.toLowerCase()
  ].some(e => e === "amirrezaveisi45@gmail.com" || e === "mr.v@admin.com");

  const isSuperAdmin = (
    userRoles.includes('super_admin') || 
    profile?.role === 'super_admin' ||
    user?.uid === 'admin' ||
    isOwnerEmail
  );
  const isGlobalAdmin = (isSuperAdmin || userRoles.includes('admin') || profile?.role === 'admin') && !isSimulatingUser;
  const isApprovedContributor = series.contributors?.some((c: any) => c.userId === user?.uid && c.status === 'approved');
  const isStaffOrAdmin = isGlobalAdmin || isApprovedContributor;
  const isStaffMember = userRoles.some((r: string) => ['translator', 'cleaner', 'editor', 'typesetter', 'proofreader', 'admin', 'super_admin'].includes(r)) || isApprovedContributor || isGlobalAdmin;

  const now = new Date();
  const chaptersList = series.chapters || [];

  const visibleChapters = chaptersList.filter(ch => {
    if (ch.isPending && !isStaffOrAdmin) return false;
    if (ch.publishAt && new Date(ch.publishAt) > now) return false;
    return true;
  });

  const publishedChapters = chaptersList.filter(ch => {
    if (ch.isPending) return false;
    if (ch.publishAt && new Date(ch.publishAt) > now) return false;
    return true;
  });

  const getReadLink = (chIdentifier: string) => {
    const rawId = series.slug || series.id;
    let cleanId = rawId;
    try {
      cleanId = decodeURIComponent(rawId).trim();
    } catch (e) {}
    const sId = encodeURIComponent(cleanId);
    const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    return `/reader/${sId}/${encodeURIComponent(chIdentifier)}?sec=${token}`;
  };

  // Find the first chapter to read, or the last read chapter if history exists
  const firstChapter = publishedChapters.length > 0 ? publishedChapters[publishedChapters.length - 1] : null;
  const readLink = history ? getReadLink(history.chapterId) : (firstChapter ? getReadLink(`chapter-${firstChapter.number}`) : '#');
  const readText = history ? `ادامه مطالعه (چپتر ${history.chapterNumber})` : 'شروع به خواندن';

  // Edit / Delete logic
  const openEditModal = () => {
    setEditForm({
      title: series.title || '',
      alternativeTitles: series.alternativeTitles?.join(', ') || '',
      cover: series.cover || '',
      banner: series.banner || '',
      author: series.author || '',
      artist: series.artist || '',
      synopsis: series.synopsis || '',
      genres: series.genres?.join(', ') || '',
      tags: series.tags?.join(', ') || '',
      status: series.status || 'Ongoing',
      type: series.type || 'Manhwa'
    });
    setShowEditModal(true);
  };

  const handleSaveSeries = async () => {
    try {
      const genresArray = editForm.genres.split(',').map(g => g.trim()).filter(Boolean);
      const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const altTitlesArray = editForm.alternativeTitles.split(',').map(t => t.trim()).filter(Boolean);

      await apiClient.saveSeries({
        ...series,
        title: editForm.title,
        alternativeTitles: altTitlesArray,
        cover: editForm.cover,
        banner: editForm.banner,
        author: editForm.author,
        artist: editForm.artist,
        synopsis: editForm.synopsis,
        genres: genresArray,
        tags: tagsArray,
        status: editForm.status,
        type: editForm.type
      });

      alert("اطلاعات مانهوا با موفقیت بروزرسانی شد!");
      setShowEditModal(false);
      mutate();
    } catch (err: any) {
      alert("خطا در ثبت اطلاعات: " + err.message);
    }
  };

  const handleDeleteSeries = async () => {
    if (!user) return;
    if (!window.confirm("آیا از حذف کامل این صفحه مانهوا مطمئن هستید؟ این عمل غیرقابل بازگشت است.")) {
      return;
    }
    try {
      await apiClient.deleteSeries(series.id, user.uid);
      alert("صفحه مانهوا با موفقیت حذف شد.");
      navigate("/");
    } catch (err: any) {
      alert("خطا در حذف مانهوا: " + err.message);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!user) return;
    if (!window.confirm("آیا از حذف این چپتر مطمئن هستید؟")) {
      return;
    }
    try {
      await apiClient.deleteChapter(series.id, chapterId, user.uid);
      alert("چپتر با موفقیت حذف شد.");
      mutate();
    } catch (err: any) {
      alert("خطا در حذف چپتر: " + err.message);
    }
  };

  const handleApproveChapter = async (chapterId: string) => {
    if (!user) return;
    try {
      await apiClient.approveChapter(series.id, chapterId, user.uid);
      alert("چپتر با موفقیت تایید و منتشر شد!");
      mutate();
    } catch (err: any) {
      alert("خطا در تایید چپتر: " + err.message);
    }
  };

  const handleAdjustRatings = async (score: number, action: 'increment' | 'decrement', step: number = 1) => {
    const adminUid = user?.uid || (user as any)?.id || localStorage.getItem('asura_user_uid') || localStorage.getItem('asura_user_id') || 'amirrezaveisi45@gmail.com';
    
    // Optimistic update
    setAdminStarCounts(prev => {
      const cur = prev[score as 1|2|3|4|5] || 0;
      const next = action === 'increment' ? cur + step : Math.max(0, cur - step);
      return { ...prev, [score]: next };
    });

    try {
      await apiClient.adjustRatings(series.id, score, action, adminUid, step);
      await Promise.all([refetchRatings(), mutate()]);
    } catch (err: any) {
      alert("خطا در ویرایش آمار امتیازدهی: " + err.message);
      refetchRatings();
    }
  };

  const handleSaveAdminRatingStats = async () => {
    const adminUid = user?.uid || (user as any)?.id || localStorage.getItem('asura_user_uid') || localStorage.getItem('asura_user_id') || 'amirrezaveisi45@gmail.com';
    setIsSavingRatingStats(true);
    try {
      await apiClient.adjustRatingStats(series.id, { counts: adminStarCounts }, adminUid);
      alert("✅ آمار ستاره‌ها با موفقیت ذخیره و میانگین بروزرسانی شد!");
      await Promise.all([refetchRatings(), mutate()]);
    } catch (err: any) {
      alert("خطا در ذخیره آمار: " + (err.message || 'خطای سرور'));
    } finally {
      setIsSavingRatingStats(false);
    }
  };

  // Contributor Join request
  const handleRequestJoin = async () => {
    if (!user) {
      alert("برای ثبت درخواست ابتدا وارد شوید.");
      return;
    }
    const code = profile?.melliCode || '';
    if (!code) {
      alert("شناسه اختصاصی کاربری شما یافت نشد. لطفا ابتدا آن را در پروفایل خود دریافت کنید.");
      return;
    }
    try {
      await apiClient.requestContributor(series.id, {
        userId: user.uid,
        email: user.email || '',
        displayName: profile?.displayName || user.email?.split('@')[0] || 'Unknown User',
        role: joinRole,
        melliCode: code
      });
      alert("درخواست همکاری شما ثبت شد و پس از بررسی مدیر تایید خواهد شد.");
      setShowJoinModal(false);
      mutate();
    } catch (err: any) {
      alert("خطا در ثبت درخواست: " + err.message);
    }
  };

  const handleOpenAddContribModal = async () => {
    setShowAddContribModal(true);
    try {
      const list = await apiClient.getStaffList();
      setStaffList(list || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddContribSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!addContribName.trim() && !addContribUserId) return alert("لطفا نام همکار یا کاربر را مشخص کنید.");

    try {
      await apiClient.addContributor(series.id, {
        userId: addContribUserId || `custom_${Date.now()}`,
        displayName: addContribName,
        email: addContribEmail,
        role: addContribRole,
        melliCode: addContribMelli || 'DIRECT_ADDED'
      }, user.uid);

      alert("همکار جدید با موفقیت به تیم اضافه شد!");
      setShowAddContribModal(false);
      setAddContribName("");
      setAddContribEmail("");
      setAddContribMelli("");
      setAddContribUserId("");
      mutate();
    } catch (err: any) {
      alert("خطا در افزودن همکار: " + err.message);
    }
  };

  // Dynamic breakdown values
  const activeStarCounts = {
    1: starCounts[1] ?? (series.ratingStats?.[1] || 0),
    2: starCounts[2] ?? (series.ratingStats?.[2] || 0),
    3: starCounts[3] ?? (series.ratingStats?.[3] || 0),
    4: starCounts[4] ?? (series.ratingStats?.[4] || 0),
    5: starCounts[5] ?? (series.ratingStats?.[5] || 0),
  };
  const activeTotalRatings = totalRatings || (activeStarCounts[1] + activeStarCounts[2] + activeStarCounts[3] + activeStarCounts[4] + activeStarCounts[5]) || series.ratingCount || 0;
  const currentAverageScore = averageRating > 0 ? averageRating : (series.rating ? Number(series.rating) : 0);

  // Admin live preview calculation
  const adminCalcTotal = adminStarCounts[1] + adminStarCounts[2] + adminStarCounts[3] + adminStarCounts[4] + adminStarCounts[5];
  const adminCalcScore = (1 * adminStarCounts[1]) + (2 * adminStarCounts[2]) + (3 * adminStarCounts[3]) + (4 * adminStarCounts[4]) + (5 * adminStarCounts[5]);
  const adminCalcAvg = adminCalcTotal > 0 ? Math.round((adminCalcScore / adminCalcTotal) * 10) / 10 : 0;

  const handleApproveContributor = async (contributorUserId: string, action: 'approve' | 'reject' | 'remove' | 'update_role', newRole?: string) => {
    if (!user) return;
    try {
      await apiClient.approveContributor(series.id, contributorUserId, action, user.uid, newRole);
      if (action === 'approve') alert("درخواست کاربر با موفقیت تایید شد.");
      else if (action === 'remove' || action === 'reject') alert("همکار با موفقیت از پروژه حذف گردید.");
      else if (action === 'update_role') alert("نقش همکار با موفقیت بروزرسانی شد.");
      mutate();
    } catch (err: any) {
      alert("خطا در مدیریت دست‌اندرکار: " + err.message);
    }
  };

  // Group contributors by approval status
  const approvedContributors = series.contributors?.filter((c: any) => c.status === 'approved') || [];
  const pendingContributors = series.contributors?.filter((c: any) => c.status === 'pending') || [];

  const getChapterContributorsText = (ch: any) => {
    if (!ch.contributors) return null;
    const items: string[] = [];
    const rolesMap: { [key: string]: string } = {
      translator: 'مترجم',
      cleaner: 'کلینر',
      typesetter: 'تایپستر',
      editor: 'ادیتور'
    };

    Object.entries(ch.contributors).forEach(([role, uids]: [string, any]) => {
      if (Array.isArray(uids) && uids.length > 0) {
        const names = uids.map(uid => {
          const found = series.contributors?.find((c: any) => c.userId === uid);
          return found ? found.displayName : 'همکار';
        });
        const roleLabel = rolesMap[role] || role;
        items.push(`${roleLabel}: ${names.join(' و ')}`);
      }
    });

    if (items.length === 0) return null;
    return items.join(' | ');
  };

  return (
    <Layout>
      <SEOHead 
        title={series.seoTitle || `${series.type === 'Manga' ? 'مانگا' : series.type === 'Manhua' ? 'مانها' : 'مانهوا'} ${series.title}${series.alternativeTitles?.length ? ' (' + series.alternativeTitles.slice(0, 2).join(', ') + ')' : ''} با ترجمه فارسی | ${settings?.siteName || 'مانگاتا'}`}
        description={series.seoDescription || `دانلود و خواندن آنلاین ${series.type === 'Manga' ? 'مانگا' : series.type === 'Manhua' ? 'مانها' : 'مانهوا'} ${series.title} با کیفیت عالی و ترجمه فارسی اختصاصی. ${series.synopsis ? series.synopsis.slice(0, 160) + '...' : ''} مرجع اصلی مانهوا در ${settings?.siteName || 'مانگاتا'}.`}
        keywords={series.seoKeywords || `${series.title}, دانلود مانهوا ${series.title}, خواندن آنلاین ${series.title}, ${series.genres?.join(', ')}, ${series.tags?.join(', ')}, مانهوا, مانگا, مانها, کمیک, ${settings?.siteName || 'مانگاتا'}`}
        image={series.banner || series.cover}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ComicSeries",
          "name": series.title,
          "alternateName": series.alternativeTitles || [],
          "description": series.synopsis,
          "image": series.cover,
          "genre": series.genres || [],
          "author": series.author ? { "@type": "Person", "name": series.author } : undefined,
          "publisher": {
            "@type": "Organization",
            "name": settings?.siteName || "مانگاتا",
            "url": window.location.origin
          }
        }}
      />
      {/* Banner Area */}
      <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden bg-[var(--color-asura-dark)]">
        <img 
          src={series.banner} 
          alt={series.title} 
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-105"
          onError={(e) => {
            e.currentTarget.src = "https://placehold.co/1200x400/18181b/ffffff?text=No+Banner";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-asura-dark)] via-[var(--color-asura-dark)]/80 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-asura-dark)] via-transparent to-transparent"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-32 md:-mt-48 relative z-10 pb-12 text-right" dir="rtl">
        {/* Admin floating control bar */}
        {isGlobalAdmin && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-xs font-black text-yellow-400 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>شما وارد حساب کاربری مدیریت کل شده‌اید. کنترل پنل ویرایش و حذف صفحه کار برای شما فعال است.</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsAdminEditMode(!isAdminEditMode)}
                className={`px-4 py-2 rounded-xl transition-all ${isAdminEditMode ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
              >
                {isAdminEditMode ? 'غیرفعال‌سازی حالت ویرایش' : 'فعال‌سازی حالت ویرایش'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column - Poster & CTA */}
          <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black border border-white/10"
            >
              <img 
                src={series.cover} 
                alt={series.title} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.currentTarget.src = "https://placehold.co/400x600/18181b/ffffff?text=No+Cover";
                }}
              />
              <div className="absolute top-2 right-2 bg-[var(--color-asura-accent)] text-white text-xs font-bold px-2 py-1 rounded shadow">
                {series.type === 'manhwa' ? 'مانهوا' : series.type === 'manga' ? 'مانگا' : series.type === 'manhua' ? 'مانها' : series.type}
              </div>

              {/* Trash button for whole series */}
              {isGlobalAdmin && isAdminEditMode && (
                <button 
                  onClick={handleDeleteSeries}
                  className="absolute bottom-2 left-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-transform hover:scale-105 shadow-xl"
                  title="حذف کامل این مانهوا"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </motion.div>
            
            <div className="mt-6 flex flex-col gap-3">
              <Link to={readLink} className="w-full py-2.5 bg-white text-black rounded-xl font-bold text-xs uppercase text-center flex justify-center items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg">
                <Play size={14} fill="currentColor" className="scale-x-[-1]" />
                {readText}
              </Link>
              <button 
                onClick={handleBookmarkToggle}
                className={`w-full py-2.5 backdrop-blur-md rounded-xl font-bold text-xs uppercase text-center flex justify-center items-center gap-2 transition-colors border ${bookmarked ? 'bg-[var(--color-asura-accent)]/20 hover:bg-[var(--color-asura-accent)]/30 text-[var(--color-asura-accent-light)] border-[var(--color-asura-accent)]/50' : 'bg-white/10 hover:bg-white/20 text-white border-white/5'}`}
              >
                <Heart size={14} className={bookmarked ? 'fill-current' : ''} />
                {bookmarked ? 'نشان‌گذاری شده' : 'نشان‌گذاری مانهوا'}
              </button>

              {/* Admin Edit Trigger */}
              {isGlobalAdmin && isAdminEditMode && (
                <button 
                  onClick={openEditModal}
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl font-black text-xs uppercase text-center flex justify-center items-center gap-2 transition-all shadow-lg"
                >
                  <Edit2 size={14} />
                  ویرایش کل اطلاعات مانهوا
                </button>
              )}
            </div>

            {/* Contributor Request Button */}
            {user && !isApprovedContributor && !pendingContributors.some((c: any) => c.userId === user.uid) && (
              <button
                onClick={() => {
                  if (!profile?.melliCode) {
                    alert("لطفا ابتدا شناسه اختصاصی (کد کاربری) خود را در صفحه تنظیمات حساب کاربری ثبت کنید.");
                    return;
                  }
                  setShowJoinModal(true);
                }}
                className="w-full mt-4 py-2.5 bg-[var(--color-asura-accent)]/10 hover:bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/30 rounded-xl font-black text-xs transition-colors flex justify-center items-center gap-2"
              >
                <Plus size={14} />
                درخواست عضویت در دست‌اندرکاران
              </button>
            )}

            {pendingContributors.some((c: any) => c.userId === user?.uid) && (
              <div className="w-full mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-[11px] font-black text-amber-400">
                درخواست عضویت شما در حال بررسی است
              </div>
            )}
          </div>

          {/* Right Column - Info */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 pt-4 md:pt-16"
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {(Array.isArray(series.genres) ? series.genres : (typeof series.genres === 'string' ? series.genres.split(',') : [])).map(g => (
                <span key={g} className="text-[10px] font-bold text-zinc-300 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded uppercase tracking-wider">
                  {g.trim()}
                </span>
              ))}
              {(Array.isArray(series.tags) ? series.tags : (typeof series.tags === 'string' ? series.tags.split(',') : [])).map(t => (
                <span key={t} className="text-[10px] font-bold text-[var(--color-asura-accent-light)] bg-[var(--color-asura-accent)]/10 border border-[var(--color-asura-accent)]/20 px-2.5 py-0.5 rounded tracking-wider italic">
                  #{t.trim()}
                </span>
              ))}
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 leading-none">{series.title}</h1>
            {series.alternativeTitles && series.alternativeTitles.length > 0 && (
              <h2 className="text-sm text-zinc-500 mb-6 font-medium tracking-wide">{series.alternativeTitles.join(', ')}</h2>
            )}

            <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10 shadow-sm">
                    <Star className="text-amber-400 fill-amber-400" size={16} />
                    <span className="font-black text-white text-base">
                      {ratingsLoading ? '...' : (currentAverageScore > 0 ? currentAverageScore.toFixed(1) : '0.0')}
                    </span>
                    <span className="text-zinc-500 font-bold text-xs">/ ۵</span>
                    <span className="text-[11px] text-zinc-400 font-medium mr-1.5 border-r border-white/10 pr-2">
                      ({activeTotalRatings.toLocaleString('fa-IR')} رای)
                    </span>
                  </div>

                  {/* Star Rating Interactive Selector */}
                  <div className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          setSelectedRatingScore(star);
                          setShowRatingModal(true);
                        }}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                        title={`امتیاز ${star} ستاره`}
                      >
                        <Star 
                          size={18} 
                          fill={star <= (hoverRating || userRating || Math.round(currentAverageScore)) ? "currentColor" : "none"} 
                          className={star <= (hoverRating || userRating || Math.round(currentAverageScore)) ? "text-amber-400" : "text-zinc-600"} 
                        />
                      </button>
                    ))}
                    {userRating ? (
                      <span className="text-[10px] text-amber-400 font-bold mr-1">رای شما: {userRating}★</span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-medium mr-1">امتیاز دهید</span>
                    )}
                  </div>

                  {/* Toggle Rating Breakdown button */}
                  <button
                    type="button"
                    onClick={() => setShowRatingBreakdown(!showRatingBreakdown)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5"
                  >
                    <BarChart2 size={14} className="text-indigo-400" />
                    <span>تفکیک آرا</span>
                    {showRatingBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* Admin Star Adjustment Toggle Button (Global Admin only) */}
                  {isGlobalAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAdminRatingPanel(!showAdminRatingPanel)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        showAdminRatingPanel
                          ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      <Settings size={14} />
                      <span>تغییر ستاره‌ها (مدیریت)</span>
                      {showAdminRatingPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>

                {!user && (
                  <span className="text-[11px] text-zinc-500 font-medium">
                    برای ثبت رای و نظر خود وارد حساب کاربری شوید.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-zinc-400 mr-auto">
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">وضعیت انتشار</span>
                  <span className="font-bold text-[var(--color-asura-accent-light)] text-xs uppercase">
                    {series.status === 'Ongoing' ? 'درحال انتشار' : series.status === 'Completed' ? 'پایان یافته' : series.status}
                  </span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">نویسنده</span>
                  <span className="font-bold text-white text-xs">{series.author || 'نامشخص'}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">طراح</span>
                  <span className="font-bold text-white text-xs">{series.artist || 'نامشخص'}</span>
                </div>
              </div>
            </div>

            {/* Rating Breakdown Section */}
            <AnimatePresence>
              {showRatingBreakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-zinc-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl"
                  dir="rtl"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <BarChart2 size={15} className="text-indigo-400" />
                      تفکیک و جزئیات آرای کاربران
                    </h4>
                    <span className="text-[11px] text-zinc-400 font-bold">
                      مجموع: <span className="text-amber-400 font-black">{activeTotalRatings.toLocaleString('fa-IR')}</span> رای
                    </span>
                  </div>

                  <div className="space-y-2.5 max-w-lg">
                    {[5, 4, 3, 2, 1].map((starNum) => {
                      const count = activeStarCounts[starNum as 1|2|3|4|5] || 0;
                      const percentage = activeTotalRatings > 0 ? Math.round((count / activeTotalRatings) * 100) : 0;
                      return (
                        <div key={starNum} className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 w-14 shrink-0 font-bold text-zinc-300">
                            <span>{starNum}</span>
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                          </div>
                          
                          <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between w-24 shrink-0 text-[11px]">
                            <span className="font-bold text-white">{count.toLocaleString('fa-IR')} رای</span>
                            <span className="text-zinc-500 font-mono">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Working Admin Star Adjustment Studio (Global Admin only) */}
            <AnimatePresence>
              {isGlobalAdmin && showAdminRatingPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-amber-950/40 via-zinc-900/90 to-zinc-900 border-2 border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl"
                  dir="rtl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                        <Settings size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-amber-400">
                          پنل مدیریت تغییر و تنظیم ستاره‌ها
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          می‌توانید تعداد آرای هر ستاره را مستقیماً وارد کرده یا با دکمه‌ها کم و زیاد کنید.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/10 text-xs">
                      <span className="text-zinc-400 font-bold">
                        مجموع جدید: <span className="text-white font-black">{adminCalcTotal.toLocaleString('fa-IR')}</span>
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-400 font-bold">
                        میانگین جدید: <span className="text-amber-400 font-black">{adminCalcAvg.toFixed(1)} ★</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
                    {[5, 4, 3, 2, 1].map((score) => {
                      const count = adminStarCounts[score as 1|2|3|4|5] ?? 0;
                      return (
                        <div key={score} className="bg-black/50 p-3 rounded-xl flex flex-col items-center border border-white/10 relative group">
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-xs font-black text-white">{score}</span>
                            <Star size={13} className="text-amber-400 fill-amber-400" />
                          </div>

                          {/* Direct Numeric Input for precise editing */}
                          <div className="w-full mb-2.5">
                            <label className="text-[10px] text-zinc-400 block text-center mb-1">تعداد آرا:</label>
                            <input
                              type="number"
                              min="0"
                              value={count}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setAdminStarCounts(prev => ({ ...prev, [score]: val }));
                              }}
                              className="w-full bg-zinc-800 text-center text-white font-black text-sm py-1.5 px-2 rounded-lg border border-white/10 focus:border-amber-500 focus:outline-none"
                            />
                          </div>

                          {/* Quick Step Buttons */}
                          <div className="grid grid-cols-2 gap-1 w-full">
                            <button
                              type="button"
                              onClick={() => handleAdjustRatings(score, 'increment', 1)}
                              className="px-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-xs font-black transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
                              title="افزایش ۱ رای"
                            >
                              +۱
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustRatings(score, 'decrement', 1)}
                              className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-xs font-black transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
                              title="کاهش ۱ رای"
                            >
                              -۱
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdminStarCounts(prev => ({ ...prev, [score]: (prev[score as 1|2|3|4|5] || 0) + 10 }));
                              }}
                              className="px-1 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 rounded text-[10px] font-bold text-center cursor-pointer"
                              title="افزودن ۱۰ به پیش‌نویس"
                            >
                              +۱۰
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdminStarCounts(prev => ({ ...prev, [score]: Math.max(0, (prev[score as 1|2|3|4|5] || 0) - 10) }));
                              }}
                              className="px-1 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 rounded text-[10px] font-bold text-center cursor-pointer"
                              title="کاهش ۱۰ از پیش‌نویس"
                            >
                              -۱۰
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminStarCounts({
                          1: starCounts[1] ?? (series.ratingStats?.[1] || 0),
                          2: starCounts[2] ?? (series.ratingStats?.[2] || 0),
                          3: starCounts[3] ?? (series.ratingStats?.[3] || 0),
                          4: starCounts[4] ?? (series.ratingStats?.[4] || 0),
                          5: starCounts[5] ?? (series.ratingStats?.[5] || 0),
                        });
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      بازنشانی به مقادیر فعلی
                    </button>

                    <button
                      type="button"
                      disabled={isSavingRatingStats}
                      onClick={handleSaveAdminRatingStats}
                      className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>{isSavingRatingStats ? 'در حال ذخیره‌سازی...' : 'ذخیره کل تغییرات ستاره‌ها'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-asura-accent)]/5 rounded-full blur-3xl"></div>
              <h3 className="text-xs font-black mb-3 text-white uppercase tracking-widest">خلاصه داستان</h3>
              <p className="text-zinc-400 leading-relaxed max-w-4xl text-xs md:text-sm">
                {series.synopsis}
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/10 mb-6 gap-2 sm:gap-4 overflow-x-auto">
              <button
                onClick={() => setSeriesTab('chapters')}
                className={`pb-3 text-xs sm:text-sm font-black transition-all border-b-2 flex items-center gap-2 ${seriesTab === 'chapters' ? 'border-[var(--color-asura-accent)] text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
              >
                <BookOpen size={16} />
                چپترهای منتشر شده ({visibleChapters.length})
              </button>

              <button
                onClick={() => setSeriesTab('comments')}
                className={`pb-3 text-xs sm:text-sm font-black transition-all border-b-2 flex items-center gap-2 ${seriesTab === 'comments' ? 'border-[var(--color-asura-accent)] text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
              >
                <MessageSquare size={16} />
                نظرات کاربران
              </button>
            </div>

            {/* TAB CONTENT: Chapters List */}
            {seriesTab === 'chapters' && (
              <div>
                {settings?.globalFreeMode && (
                  <div className="mb-4 p-3.5 bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-emerald-950/80 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-300 text-xs font-bold shadow-lg shadow-emerald-950/30 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-400 shrink-0 animate-pulse" />
                      <span>
                        {settings.globalFreeBannerText || '🎉 جشنواره دسترسی رایگان سراسری فعال است!'}
                        {!user && ' (جهت مطالعه رایگان کافیست وارد حساب کاربری خود شوید یا ثبت‌نام کنید)'}
                      </span>
                    </div>
                    {!user ? (
                      <Link
                        to="/profile"
                        className="bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black px-3 py-1 rounded-lg shrink-0 transition-colors shadow"
                      >
                        ورود / ثبت‌نام رایگان
                      </Link>
                    ) : (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 border border-emerald-500/30">
                        دسترسی رایگان برای شما فعال است
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                    <span className="w-1 h-5 bg-[var(--color-asura-accent)] rounded-full"></span>چپترهای منتشر شده
                  </h2>
                  <span className="text-xs font-bold text-zinc-500">{visibleChapters.length} چپتر قابل مشاهده</span>
                </div>
                
                <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl divide-y divide-white/5 overflow-hidden max-h-[600px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                  {visibleChapters.map((ch) => (
                    <div 
                      key={ch.id} 
                      className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                    >
                      <Link 
                        to={getReadLink(`chapter-${ch.number}`)}
                        className="flex-1 flex items-center gap-4"
                      >
                        <div className="w-12 h-12 bg-black/40 border border-white/5 rounded flex items-center justify-center shrink-0 group-hover:border-[var(--color-asura-accent)]/30 transition-colors">
                          <span className="font-black text-white text-lg">{ch.number}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-200 group-hover:text-[var(--color-asura-accent)] transition-colors flex items-center">
                            {ch.title || `چپتر ${ch.number}`}
                            {ch.isPending && (
                              <span className="mr-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                                در انتظار تایید
                              </span>
                            )}
                            {settings?.globalFreeMode && (
                              <span className="mr-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles size={10} />
                                رایگان
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                             <span className="text-[10px] text-zinc-500 italic">
                               {(() => {
                                 if (!ch.createdAt) return 'به تازگی';
                                 try {
                                   const d = typeof ch.createdAt === 'string' || typeof ch.createdAt === 'number' || ch.createdAt instanceof Date ? new Date(ch.createdAt) : (ch.createdAt.toDate ? ch.createdAt.toDate() : new Date(ch.createdAt));
                                   if (isNaN(d.getTime())) return 'به تازگی';
                                   return formatDistanceToNow(d, { addSuffix: true });
                                 } catch (e) {
                                   return 'به تازگی';
                                 }
                               })()}
                             </span>
                             {getChapterContributorsText(ch) && (
                               <>
                                 <span className="text-zinc-700 text-[10px]">•</span>
                                 <span className="text-[10px] text-[var(--color-asura-accent-light)] font-bold">
                                   {getChapterContributorsText(ch)}
                                 </span>
                               </>
                             )}
                          </div>
                        </div>
                      </Link>

                      {/* Chapter action controls for Admins */}
                      {isGlobalAdmin && isAdminEditMode && (
                        <div className="flex items-center gap-2 mr-4">
                          {ch.isPending && (
                            <button
                              onClick={() => handleApproveChapter(ch.id)}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 shadow"
                            >
                              <Check size={12} />
                              تایید انتشار
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteChapter(ch.id)}
                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-red-500/20"
                            title="حذف چپتر"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Work Team & Submissions (Staff only) */}
            {seriesTab === 'team' && isStaffMember && (
              <WorkTeamTab 
                series={series}
                user={user}
                profile={profile}
                isGlobalAdmin={isGlobalAdmin}
                onUpdateSeries={mutate}
              />
            )}

            {/* TAB CONTENT: Comments */}
            {seriesTab === 'comments' && (
              <Comments seriesId={series.id} />
            )}

          </motion.div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] w-full max-w-2xl rounded-2xl p-6 text-right max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white mb-6 border-b border-white/5 pb-3">ویرایش اطلاعات مانهوا</h3>
            
            <div className="space-y-4 text-xs font-black">
              <div>
                <label className="block text-zinc-400 mb-1.5">عنوان فارسی / اصلی</label>
                <input 
                  type="text" 
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">عناوین فرعی (جدا شده با کاما)</label>
                <input 
                  type="text" 
                  value={editForm.alternativeTitles}
                  onChange={(e) => setEditForm({ ...editForm, alternativeTitles: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-zinc-400 mb-1.5">تصویر کاور (URL)</label>
                  <input 
                    type="text" 
                    value={editForm.cover}
                    onChange={(e) => setEditForm({ ...editForm, cover: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                  />
                  <div className="bg-black/20 p-2 border border-white/5 border-dashed rounded-xl">
                    <span className="block text-[10px] text-zinc-500 mb-1">آپلود مستقیم کاور:</span>
                    <ImageUploader 
                      multiple={false}
                      seriesTitle={series.title}
                      folderType="cover"
                      onUpload={(urls) => {
                        if (urls && urls.length > 0) {
                          setEditForm(prev => ({ ...prev, cover: urls[0] }));
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-zinc-400 mb-1.5">تصویر بنر پس‌زمینه (URL)</label>
                  <input 
                    type="text" 
                    value={editForm.banner}
                    onChange={(e) => setEditForm({ ...editForm, banner: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                  />
                  <div className="bg-black/20 p-2 border border-white/5 border-dashed rounded-xl">
                    <span className="block text-[10px] text-zinc-500 mb-1">آپلود مستقیم بنر:</span>
                    <ImageUploader 
                      multiple={false}
                      seriesTitle={series.title}
                      folderType="banner"
                      onUpload={(urls) => {
                        if (urls && urls.length > 0) {
                          setEditForm(prev => ({ ...prev, banner: urls[0] }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1.5">نویسنده</label>
                  <input 
                    type="text" 
                    value={editForm.author}
                    onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1.5">طراح</label>
                  <input 
                    type="text" 
                    value={editForm.artist}
                    onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 mb-1.5">وضعیت</label>
                  <select 
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                  >
                    <option value="Ongoing">در حال انتشار (Ongoing)</option>
                    <option value="Completed">پایان یافته (Completed)</option>
                    <option value="Hiatus">وقفه (Hiatus)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1.5">نوع اثر</label>
                  <select 
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                  >
                    <option value="Manhwa">مانهوا (Manhwa)</option>
                    <option value="Manga">مانگا (Manga)</option>
                    <option value="Manhua">مانها (Manhua)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">ژانرها (جدا شده با کاما)</label>
                <input 
                  type="text" 
                  value={editForm.genres}
                  onChange={(e) => setEditForm({ ...editForm, genres: e.target.value })}
                  placeholder="اکشن, فانتزی, ماجراجویی"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">تگ‌ها / کلمات کلیدی (جدا شده با کاما)</label>
                <input 
                  type="text" 
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="تناسخ, سیاهچال, سیستم"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">خلاصه داستان مانهوا</label>
                <textarea 
                  rows={4}
                  value={editForm.synopsis}
                  onChange={(e) => setEditForm({ ...editForm, synopsis: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-white/5 pt-4">
              <button 
                onClick={handleSaveSeries}
                className="px-6 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-xl font-black text-xs transition-colors"
              >
                ذخیره تغییرات
              </button>
              <button 
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl font-black text-xs transition-colors"
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOIN REQUEST MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-right" dir="rtl">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] w-full max-w-md rounded-2xl p-6">
            <h3 className="text-lg font-black text-white mb-4">درخواست عضویت در تیم دست‌اندرکاران</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              با فرستادن این درخواست، شما آمادگی خود را برای ترجمه یا ادیت این مانهوا اعلام می‌کنید. پس از تایید مدیریت، نقش شما به مانهوا پیوست داده شده و دسترسی آپلود چپترها فعال می‌گردد.
            </p>

            <div className="space-y-4 text-xs font-black mb-6">
              <div>
                <label className="block text-zinc-300 mb-2">نقش شما</label>
                <select 
                  value={joinRole}
                  onChange={(e) => setJoinRole(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                >
                  <option value="translator">مترجم (Translator)</option>
                  <option value="editor">ادیتور/کلینر (Editor)</option>
                  <option value="typesetter">تایپیست (Typesetter)</option>
                  <option value="proofreader">ویراستار (Proofreader)</option>
                </select>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                <span className="text-[10px] text-zinc-400 block mb-1">کد اختصاصی کاربری شما (به‌صورت خودکار ضمیمه می‌شود)</span>
                <strong className="text-xs font-mono text-white tracking-widest">{profile?.melliCode || 'ثبت نشده (ابتدا از پروفایل دریافت کنید)'}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              <button 
                onClick={handleRequestJoin}
                className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-xl font-black text-xs transition-colors"
              >
                ارسال درخواست
              </button>
              <button 
                onClick={() => setShowJoinModal(false)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl font-black text-xs transition-colors"
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING & REVIEW MODAL */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-right" dir="rtl">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] w-full max-w-md rounded-2xl p-6">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Star className="text-yellow-500" fill="currentColor" size={20} />
              ثبت امتیاز و دیدگاه برای مانهوا
            </h3>
            
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              لطفا تعداد ستاره‌های امتیاز خود را مشخص کرده و در صورت تمایل نقد یا دیدگاه کوتاه خود را بنویسید. نظر شما بلافاصله در میانگین واقعی کل امتیازات اثر تاثیر خواهد گذاشت.
            </p>

            <div className="space-y-6">
              {/* Star selector */}
              <div className="flex flex-col items-center justify-center bg-black/20 p-4 rounded-xl border border-white/5 gap-2">
                <span className="text-xs font-bold text-zinc-400">امتیاز شما: {selectedRatingScore} از ۵</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRatingScore(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star 
                        size={32} 
                        fill={star <= selectedRatingScore ? "currentColor" : "none"} 
                        className={star <= selectedRatingScore ? "text-yellow-500" : "text-zinc-600"} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300">دیدگاه یا نقد شما درباره این اثر (اختیاری)</label>
                <textarea
                  id="series-review-textarea"
                  value={ratingReviewText}
                  onChange={(e) => setRatingReviewText(e.target.value)}
                  placeholder="نظرتان را درباره گرافیک، داستان یا ترجمه این مانهوا بنویسید..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors resize-none h-28 text-right"
                  dir="rtl"
                />
                <div className="flex justify-between items-center mt-1">
                  <button 
                    type="button" 
                    onClick={() => {
                      const el = document.getElementById("series-review-textarea") as HTMLTextAreaElement;
                      if (el) {
                        const start = el.selectionStart;
                        const end = el.selectionEnd;
                        const selected = ratingReviewText.substring(start, end);
                        const replacement = `[spoiler]${selected}[/spoiler]`;
                        const newValue = ratingReviewText.substring(0, start) + replacement + ratingReviewText.substring(end);
                        setRatingReviewText(newValue);
                        
                        setTimeout(() => {
                          el.focus();
                          const newCursorPos = start + 9 + selected.length;
                          el.setSelectionRange(newCursorPos, newCursorPos);
                        }, 10);
                      } else {
                        setRatingReviewText(prev => prev + "[spoiler][/spoiler]");
                      }
                    }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-bold uppercase rounded-lg border border-white/10 transition-colors"
                  >
                    + Spoiler Tag
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4 mt-6">
              <button 
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-xl font-black text-xs transition-colors disabled:opacity-50"
              >
                {isSubmittingReview ? "در حال ثبت..." : "ثبت دیدگاه و امتیاز"}
              </button>
              <button 
                onClick={() => setShowRatingModal(false)}
                disabled={isSubmittingReview}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl font-black text-xs transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CONTRIBUTOR MODAL (ADMIN) */}
      {showAddContribModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] max-w-md w-full rounded-2xl p-6 text-right space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <UserPlus className="text-[var(--color-asura-accent-light)]" size={18} />
              افزودن همکار به تیم
            </h3>
            <form onSubmit={handleAddContribSubmit} className="space-y-3">
              {staffList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">انتخاب از اعضای کادر سایت:</label>
                  <select
                    value={addContribUserId}
                    onChange={(e) => {
                      const selected = staffList.find(s => s.id === e.target.value);
                      setAddContribUserId(e.target.value);
                      if (selected) {
                        setAddContribName(selected.displayName || '');
                        setAddContribEmail(selected.email || '');
                        setAddContribMelli(selected.melliCode || '');
                      }
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                  >
                    <option value="">-- انتخاب از لیست کاربران کادر --</option>
                    {staffList.map((st: any) => (
                      <option key={st.id} value={st.id}>
                        {st.displayName} ({st.role || 'عضو کادر'}) - {st.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">نام همکار *</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: علی محمدی (مترجم)"
                  value={addContribName}
                  onChange={(e) => setAddContribName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">نقش همکار *</label>
                <select
                  value={addContribRole}
                  onChange={(e) => setAddContribRole(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                >
                  <option value="translator">مترجم</option>
                  <option value="cleaner">کلینر</option>
                  <option value="editor">ادیتور</option>
                  <option value="typesetter">تایپیست</option>
                  <option value="proofreader">ویراستار</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">ایمیل (اختیاری)</label>
                <input
                  type="email"
                  placeholder="translator@example.com"
                  value={addContribEmail}
                  onChange={(e) => setAddContribEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">کد کاربری اختصاصی (اختیاری)</label>
                <input
                  type="text"
                  placeholder="0012345678"
                  value={addContribMelli}
                  onChange={(e) => setAddContribMelli(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] dir-ltr text-right"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddContribModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white text-xs font-black rounded-xl shadow-lg"
                >
                  افزودن به تیم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
