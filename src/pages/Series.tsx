import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSeriesOverview } from '../hooks/useSeries';
import { useBookmarks, useHistory } from '../hooks/useUserActivity';
import { useRatings } from '../hooks/useRatings';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Star, Clock, Heart, Play, Edit2, Trash2, Check, X, ShieldAlert, UserCheck, Plus, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { Comments } from '../components/Comments';
import { formatDistanceToNow } from 'date-fns';
import { SeriesDetailSkeleton } from '../components/Skeletons';
import { apiClient } from '../lib/apiClient';
import { ImageUploader } from '../components/ImageUploader';
import { useSettings } from '../contexts/SettingsContext';

export default function Series() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isSimulatingUser } = useAuth();
  const { series, loading, mutate } = useSeriesOverview(id);
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { getHistoryForSeries } = useHistory();
  const { averageRating, userRating, submitRating, loading: ratingsLoading } = useRatings(id);

  const [hoverRating, setHoverRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRatingScore, setSelectedRatingScore] = useState(5);
  const [ratingReviewText, setRatingReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isAdminEditMode, setIsAdminEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
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

  const handleSubmitReview = async () => {
    if (!user) return;
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
  const userRoles = profile?.roles || [profile?.role || 'user'];
  const isSuperAdmin = userRoles.includes('super_admin') || 
                       profile?.email === "amirrezaveisi45@gmail.com" || 
                       profile?.email === "Mr.V@admin.com";
  const isGlobalAdmin = (userRoles.includes('super_admin') || userRoles.includes('admin') || isSuperAdmin) && !isSimulatingUser;
  const isApprovedContributor = series.contributors?.some((c: any) => c.userId === user?.uid && c.status === 'approved');
  const isStaffOrAdmin = isGlobalAdmin || isApprovedContributor;

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
    const sId = series.slug || series.id;
    const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    return `/reader/${sId}/${chIdentifier}?sec=${token}`;
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

  const handleAdjustRatings = async (score: number, action: 'increment' | 'decrement') => {
    if (!user) return;
    try {
      await apiClient.adjustRatings(series.id, score, action, user.uid);
      alert(`امتیاز ${score} ستاره ${action === 'increment' ? 'افزایش' : 'کاهش'} یافت.`);
      mutate();
    } catch (err: any) {
      alert("خطا در ویرایش آمار امتیازدهی: " + err.message);
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

  const handleApproveContributor = async (contributorUserId: string, action: 'approve' | 'reject') => {
    if (!user) return;
    try {
      await apiClient.approveContributor(series.id, contributorUserId, action, user.uid);
      alert(`درخواست کاربر با موفقیت ${action === 'approve' ? 'تایید' : 'رد'} شد.`);
      mutate();
    } catch (err: any) {
      alert("خطا در مدیریت درخواست دست‌اندرکار: " + err.message);
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
                    alert("لطفا ابتدا شناسه ۶ رقمی (کد ملی سایت) خود را در صفحه تنظیمات حساب کاربری ثبت کنید.");
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

            <div className="flex flex-wrap items-center gap-6 mb-8 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                    <Star className="text-yellow-500" fill="currentColor" size={14} />
                    <span className="font-bold text-white text-sm">
                      {ratingsLoading ? '...' : (averageRating > 0 ? averageRating.toFixed(1) : series.rating)}
                    </span>
                  </div>
                  {user && (
                    <div className="flex items-center gap-1 ml-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => {
                            setSelectedRatingScore(star);
                            setShowRatingModal(true);
                          }}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star 
                            size={18} 
                            fill={star <= (hoverRating || userRating || Math.round(averageRating || series.rating || 0)) ? "currentColor" : "none"} 
                            className={star <= (hoverRating || userRating || Math.round(averageRating || series.rating || 0)) ? "text-[var(--color-asura-accent-light)]" : "text-zinc-600"} 
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!user && <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">برای ثبت رای وارد شوید</span>}
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <div className="flex flex-col">
                  <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">وضعیت انتشار</span>
                  <span className="font-bold text-[var(--color-asura-accent-light)] text-xs uppercase">
                    {series.status === 'Ongoing' ? 'درحال انتشار' : series.status === 'Completed' ? 'پایان یافته' : series.status}
                  </span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">نویسنده</span>
                  <span className="font-bold text-white text-xs">{series.author}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">طراح</span>
                  <span className="font-bold text-white text-xs">{series.artist}</span>
                </div>
              </div>
            </div>

            {/* Manual Rating Adjustment Count Panel (Admin only) */}
            {isGlobalAdmin && isAdminEditMode && (
              <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                <h4 className="text-xs font-black text-yellow-400 mb-3 flex items-center gap-1.5">
                  <Settings size={13} />
                  تنظیم دستی تعداد آمار آرا (ویژه مدیریت)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <div key={score} className="bg-black/30 p-2 rounded-xl flex flex-col items-center border border-white/5">
                      <span className="text-[11px] font-black text-zinc-400 mb-2">{score} ستاره</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleAdjustRatings(score, 'increment')}
                          className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded text-[10px] font-bold transition-all"
                        >
                          +۱
                        </button>
                        <button 
                          onClick={() => handleAdjustRatings(score, 'decrement')}
                          className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded text-[10px] font-bold transition-all"
                        >
                          -۱
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-asura-accent)]/5 rounded-full blur-3xl"></div>
              <h3 className="text-xs font-black mb-3 text-white uppercase tracking-widest">خلاصه داستان</h3>
              <p className="text-zinc-400 leading-relaxed max-w-4xl text-xs md:text-sm">
                {series.synopsis}
              </p>
            </div>

            {/* Contributors Section */}
            <div className="bg-black/20 border border-[var(--color-asura-border)] rounded-2xl p-6 mb-8">
              <h3 className="text-xs font-black mb-4 text-white uppercase tracking-widest flex items-center gap-2">
                <UserCheck size={14} className="text-[var(--color-asura-accent-light)]" />
                تیم دست‌اندرکاران (مترجمان و ادیتورها)
              </h3>

              {approvedContributors.length === 0 ? (
                <p className="text-xs text-zinc-500">هنوز دست‌اندرکاری برای این مانهوا ثبت نشده است.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {approvedContributors.map((c: any) => (
                    <div key={c.userId} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                      <div className="text-right">
                        <span className="block text-xs font-black text-white">{c.displayName}</span>
                        <span className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">
                          {c.role === 'translator' ? 'مترجم' : c.role === 'editor' ? 'ادیتور' : c.role === 'typesetter' ? 'تایپیست/کلینر' : c.role === 'proofreader' ? 'ویراستار' : c.role}
                        </span>
                      </div>
                      <div className="bg-[var(--color-asura-accent)]/10 px-2.5 py-1 rounded-lg text-left">
                        <span className="block text-[8px] text-[var(--color-asura-accent-light)] font-bold">کد کاربری</span>
                        <span className="block text-[10px] font-mono text-zinc-300 font-bold">{c.melliCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending contributors for Global Admin approval */}
              {isGlobalAdmin && pendingContributors.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/5">
                  <h4 className="text-xs font-black text-yellow-500 mb-3 flex items-center gap-1.5">
                    <ShieldAlert size={13} />
                    درخواست‌های عضویت در انتظار تایید ({pendingContributors.length})
                  </h4>
                  <div className="space-y-2">
                    {pendingContributors.map((c: any) => (
                      <div key={c.userId} className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-right">
                          <span className="block text-xs font-black text-white">{c.displayName} ({c.email})</span>
                          <span className="block text-[10px] text-zinc-400 mt-0.5">
                            نقش درخواستی: <strong className="text-yellow-400">{c.role === 'translator' ? 'مترجم' : c.role === 'editor' ? 'ادیتور' : c.role === 'typesetter' ? 'تایپیست/کلینر' : c.role === 'proofreader' ? 'ویراستار' : c.role}</strong> | کد کاربری: <strong className="text-yellow-400 font-mono">{c.melliCode}</strong>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleApproveContributor(c.userId, 'approve')}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-[10px] font-black transition-colors flex items-center gap-1"
                          >
                            <Check size={12} />
                            تایید
                          </button>
                          <button 
                            onClick={() => handleApproveContributor(c.userId, 'reject')}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black transition-colors flex items-center gap-1"
                          >
                            <X size={12} />
                            رد درخواست
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

             {/* Chapters List */}
            <div>
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
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                           <span className="text-[10px] text-zinc-500 italic">
                             {ch.createdAt?.toDate ? formatDistanceToNow(ch.createdAt.toDate(), { addSuffix: true }) : 'به تازگی'}
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

            {/* Comments Section */}
            <Comments seriesId={series.id} />

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
                  value={ratingReviewText}
                  onChange={(e) => setRatingReviewText(e.target.value)}
                  placeholder="نظرتان را درباره گرافیک، داستان یا ترجمه این مانهوا بنویسید..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors resize-none h-28"
                />
                <div className="flex justify-between items-center mt-1">
                  <button 
                    type="button" 
                    onClick={() => setRatingReviewText(prev => prev + " [spoiler][/spoiler] ")}
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
    </Layout>
  );
}
