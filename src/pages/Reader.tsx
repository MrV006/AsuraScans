import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSeriesOverview } from '../hooks/useSeries';
import { useSettings } from '../contexts/SettingsContext';
import { useHistory } from '../hooks/useUserActivity';
import { ChevronLeft, ChevronRight, Menu, Home, ArrowUp, Settings as SettingsIcon, Flag, AlertTriangle, X, Check, Send, RefreshCw, Sparkles } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { ReaderSkeleton } from '../components/Skeletons';
import { SEOHead } from '../components/SEOHead';
import { Chapter } from '../lib/types';

// Helper for converting Persian digits to English digits
const convertPersianToEnglishDigits = (str: string): string => {
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(persianDigits[i], i.toString());
  }
  return res;
};

// Extract filename part of URL to prevent path numbers from interfering with sorting
const getCleanFilename = (url: string): string => {
  if (!url) return '';
  try {
    if (url.includes('entry=') || url.includes('file=')) {
      const match = url.match(/[?&](?:entry|file)=([^&#]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        return decoded.split('/').pop() || decoded;
      }
    }
  } catch (e) {}
  const withoutQuery = url.split('?')[0];
  return withoutQuery.split('/').pop() || withoutQuery;
};

// Natural sorting algorithm supporting both English and Persian digits
const naturalCompare = (a: string, b: string): number => {
  const cleanA = convertPersianToEnglishDigits(getCleanFilename(a));
  const cleanB = convertPersianToEnglishDigits(getCleanFilename(b));

  const regex = /(\d+)/g;
  const chunksA = cleanA.split(regex);
  const chunksB = cleanB.split(regex);

  const len = Math.max(chunksA.length, chunksB.length);
  for (let i = 0; i < len; i++) {
    const chunkA = chunksA[i] || "";
    const chunkB = chunksB[i] || "";

    const isDigitA = /^\d+$/.test(chunkA);
    const isDigitB = /^\d+$/.test(chunkB);

    if (isDigitA && isDigitB) {
      const numA = parseInt(chunkA, 10);
      const numB = parseInt(chunkB, 10);
      if (numA !== numB) {
        return numA - numB;
      }
      if (chunkA.length !== chunkB.length) {
        return chunkA.length - chunkB.length;
      }
    } else {
      const comp = chunkA.localeCompare(chunkB, undefined, { numeric: true, sensitivity: 'base' });
      if (comp !== 0) return comp;
    }
  }
  return 0;
};

export const sortMangaImages = (images: string[]): string[] => {
  if (!images) return [];
  return [...images].sort(naturalCompare);
};

interface MangaImageProps {
  key?: React.Key;
  src: string;
  index: number;
  totalImages: number;
  onReportRequest?: (pageNum: number) => void;
  seriesId?: string;
  chapterId?: string;
  chapterNumber?: number;
  seriesTitle?: string;
  reloadKey?: number;
}

// Independent, ultra-resilient image component with watchdog timeout, auto-retry, and non-blocking parallel loading
function MangaImage({
  src,
  index,
  totalImages,
  onReportRequest,
  seriesId,
  chapterId,
  chapterNumber,
  seriesTitle,
  reloadKey
}: MangaImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [autoReported, setAutoReported] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Synchronize with src or forced reload key
  useEffect(() => {
    if (reloadKey && reloadKey > 0) {
      const separator = src.includes('?') ? '&' : '?';
      setCurrentSrc(`${src}${separator}_t=${Date.now()}_${reloadKey}`);
      setStatus('loading');
      setRetryCount(0);
      setAutoReported(false);
    } else {
      setCurrentSrc(src);
      setStatus('loading');
      setRetryCount(0);
      setAutoReported(false);
    }
  }, [src, reloadKey]);

  // Synchronous cache check: If image is already in memory or complete, mark loaded immediately
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setStatus('loaded');
    }
  }, [currentSrc]);

  // Watchdog timer: If an image hangs in 'loading' state for too long on a slow/unstable connection
  useEffect(() => {
    if (status === 'loaded') return;

    const timeoutMs = Math.min(8000 + retryCount * 2500, 20000);
    const timer = setTimeout(() => {
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setStatus('loaded');
        return;
      }
      if (status === 'loading') {
        if (retryCount < 5) {
          const nextRetry = retryCount + 1;
          setRetryCount(nextRetry);
          const separator = src.includes('?') ? '&' : '?';
          setCurrentSrc(`${src}${separator}_retry=${Date.now()}`);
        } else {
          setStatus('error');
        }
      }
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [currentSrc, status, retryCount, src]);

  const handleLoad = () => {
    setStatus('loaded');
  };

  const handleError = () => {
    if (retryCount < 5) {
      const nextRetry = retryCount + 1;
      setRetryCount(nextRetry);
      const separator = src.includes('?') ? '&' : '?';
      const delay = Math.min(1000 + retryCount * 800, 4000);
      setTimeout(() => {
        setCurrentSrc(`${src}${separator}_retry=${Date.now()}`);
      }, delay);
    } else {
      setStatus('error');
      if (!autoReported && seriesId && chapterId) {
        setAutoReported(true);
        const uid = localStorage.getItem('asura_user_id') || 'guest';
        apiClient.submitReport({
          id: `host-err-${seriesId}-${chapterId}-img${index + 1}-${Date.now()}`,
          userId: uid,
          userName: 'سیستم خودمختار ریدر',
          title: `🚨 عدم بارگذاری تصویر ${index + 1} در چپتر ${chapterNumber || ''}`,
          content: `تصویر شماره ${index + 1} از ${totalImages} در اثر "${seriesTitle || ''}" (چپتر ${chapterNumber || ''}) پس از ۵ بار تلاش بارگذاری نشد.\nآدرس تصویر: ${src}`
        }).catch(err => console.error("Auto report error:", err));
      }
    }
  };

  const handleManualRetry = () => {
    setStatus('loading');
    setRetryCount(0);
    const separator = src.includes('?') ? '&' : '?';
    setCurrentSrc(`${src}${separator}_retry=${Date.now()}`);
  };

  return (
    <div 
      className="reader-image-wrapper w-full relative flex flex-col justify-center items-center min-h-[160px]"
    >
      {/* Loading Placeholder Overlay */}
      {status === 'loading' && (
        <div className="w-full flex flex-col items-center justify-center bg-[#111217]/80 border border-white/5 rounded-2xl py-12 px-6 min-h-[300px] my-1 shadow-inner font-sans animate-fade-in" dir="rtl">
          <div className="relative mb-3">
            <div className="w-10 h-10 border-3 border-zinc-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
            <RefreshCw size={14} className="absolute inset-0 m-auto text-[var(--color-asura-accent)] animate-pulse" />
          </div>
          <p className="text-zinc-200 text-xs font-bold mb-1 text-center">
            در حال دریافت و بارگذاری تصویر {(index + 1).toLocaleString('fa-IR')} از {totalImages.toLocaleString('fa-IR')}...
          </p>
          {retryCount > 0 ? (
            <p className="text-[11px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg mt-2 animate-pulse">
              اختلال اینترنت؛ تلاش مجدد خودکار ({retryCount.toLocaleString('fa-IR')} از ۵)...
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500 font-medium">
              بازخوانی هوشمند و خودکار در صورت کندی اینترنت فعال است
            </p>
          )}
          <button
            onClick={handleManualRetry}
            className="mt-4 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-bold text-[11px] rounded-xl border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>بازخوانی فوری این تصویر</span>
          </button>
        </div>
      )}

      {/* Error Card for Failed Image */}
      {status === 'error' && (
        <div className="w-full flex flex-col items-center justify-center bg-red-500/10 border border-red-500/25 rounded-2xl p-6 min-h-[260px] my-1 text-center shadow-xl font-sans" dir="rtl">
          <div className="w-12 h-12 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 mb-3">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xs font-black text-red-300 mb-1">
            خطا در بارگذاری تصویر {(index + 1).toLocaleString('fa-IR')}
          </h3>
          <p className="text-[11px] text-zinc-400 max-w-sm leading-relaxed mb-4">
            تصویر دریافت نشد. می‌توانید با دکمه زیر تصویر را بازخوانی زنده کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleManualRetry}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>تلاش مجدد و بازخوانی تصویر</span>
            </button>
            {onReportRequest && (
              <button
                onClick={() => onReportRequest(index + 1)}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-zinc-300 font-bold text-xs rounded-xl transition-all border border-white/5 flex items-center gap-1.5 cursor-pointer"
              >
                <Flag size={13} />
                <span>گزارش خرابی</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actual HTML Image Element */}
      <div className="relative w-full select-none">
        <img 
          ref={imgRef}
          src={currentSrc} 
          alt={`Page ${index + 1}`} 
          onLoad={handleLoad}
          onError={handleError}
          loading="eager"
          decoding="async"
          className={`object-contain block w-full mx-auto select-none pointer-events-none transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
          referrerPolicy="no-referrer"
        />
        {/* Anti-copy copyright shield */}
        <div 
          className="absolute inset-0 z-20 cursor-default select-none bg-transparent"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
        />
      </div>
    </div>
  );
}

export default function Reader() {
  const navigate = useNavigate();
  const { seriesId, chapterId } = useParams();
  const { settings } = useSettings();
  const { series, loading: seriesLoading, mutate: mutateSeries } = useSeriesOverview(seriesId);
  const { updateHistory } = useHistory();
  const { user, profile, isSimulatingUser, setShowSetupModal } = useAuth();
  
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [imageGap, setImageGap] = useState<number>(0);
  const [readingMode, setReadingMode] = useState<'vertical' | 'single' | 'double'>('vertical');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [globalReloadKey, setGlobalReloadKey] = useState<number>(0);

  const [directChapter, setDirectChapter] = useState<Chapter | null>(null);
  const [directLoading, setDirectLoading] = useState(true);

  const [dbUser, setDbUser] = useState<any>(null);
  const [isPurchased, setIsPurchased] = useState<boolean>(false);
  const [checkingPurchase, setCheckingPurchase] = useState<boolean>(true);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportIssueType, setReportIssueType] = useState('عدم بارگذاری تصویر / تصویر خراب');
  const [reportPageNum, setReportPageNum] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Direct fetch chapter for fast resilience on refresh or direct link
  const fetchDirectChapter = async () => {
    if (!seriesId || !chapterId) return;
    try {
      setDirectLoading(true);
      const ch = await apiClient.getChapterById(seriesId, chapterId);
      if (ch) {
        setDirectChapter(ch);
      }
    } catch (err) {
      console.error("Direct chapter fetch error:", err);
    } finally {
      setDirectLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectChapter();
  }, [seriesId, chapterId]);

  const chapterIdx = series?.chapters ? series.chapters.findIndex(c => {
    if (c.id === chapterId) return true;
    const match = chapterId?.match(/chapter-(\d+(\.\d+)?)/) || chapterId?.match(/^(\d+(\.\d+)?)$/);
    if (match) {
      const num = parseFloat(match[1]);
      return c.number === num;
    }
    return false;
  }) : -1;
  const chapter = (chapterIdx >= 0 && series?.chapters) 
    ? series.chapters[chapterIdx] 
    : (directChapter || null);
  
  // Apply natural sorting unless sortMode is set to 'input'
  const sortedImages = chapter?.images 
    ? (chapter.sortMode === 'input' ? chapter.images : sortMangaImages(chapter.images)) 
    : [];

  // Robust next and previous chapter computation
  let nextChapter: any = null;
  let prevChapter: any = null;
  if (series?.chapters && Array.isArray(series.chapters) && series.chapters.length > 0 && chapter) {
    const sortedChs = [...series.chapters].sort((a, b) => Number(a.number) - Number(b.number));
    const curIdx = sortedChs.findIndex(c => c.id === chapter.id || Number(c.number) === Number(chapter.number));
    if (curIdx >= 0) {
      if (curIdx < sortedChs.length - 1) nextChapter = sortedChs[curIdx + 1];
      if (curIdx > 0) prevChapter = sortedChs[curIdx - 1];
    }
  }

  const nextPage = () => {
    if (sortedImages.length === 0) return;
    if (readingMode === 'single') {
      if (activePageIndex < sortedImages.length - 1) {
        setActivePageIndex(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (readingMode === 'double') {
      if (activePageIndex < sortedImages.length - 2) {
        setActivePageIndex(prev => prev + 2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const prevPage = () => {
    if (readingMode === 'single') {
      if (activePageIndex > 0) {
        setActivePageIndex(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (readingMode === 'double') {
      if (activePageIndex > 0) {
        setActivePageIndex(prev => prev - 2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleBackToSeries = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetId = series?.id || seriesId || (chapter as any)?.seriesId || (directChapter as any)?.seriesId || series?.slug;
    if (targetId && targetId !== 'undefined' && targetId !== 'null') {
      let cleanTarget = targetId;
      try {
        cleanTarget = decodeURIComponent(targetId).trim();
      } catch (err) {}
      navigate(`/series/${encodeURIComponent(cleanTarget)}`);
    } else {
      navigate('/');
    }
  };

  const handleGoHome = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigate('/');
  };

  // Reset scroll position and page index on chapter or series change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setActivePageIndex(0);
  }, [chapterId, seriesId]);

  // Anti-Copy copyright protection keyboard shortcuts
  useEffect(() => {
    const preventActions = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && (
          e.key === 's' || e.key === 'S' || 
          e.key === 'p' || e.key === 'P' || 
          e.key === 'u' || e.key === 'U' || 
          e.key === 'i' || e.key === 'I' || 
          e.key === 'c' || e.key === 'C'
        ))
      ) {
        e.preventDefault();
        alert("حق کپی‌رایت ترجمه و ادیت این اثر محفوظ است. امکان ذخیره‌سازی، چاپ یا کپی کردن تصاویر مجاز نمی‌باشد.");
      }
    };
    window.addEventListener('keydown', preventActions);
    return () => window.removeEventListener('keydown', preventActions);
  }, []);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    setReportMsg(null);
    try {
      const uid = user?.uid || localStorage.getItem('asura_user_id') || 'guest';
      const userName = dbUser?.displayName || user?.displayName || 'کاربر میهمان';
      const title = `[خرابی تصویر] ${series?.title || 'عنوان مانهوا'} - چپتر ${chapter?.number || ''}`;
      const content = `مجموعه: ${series?.title || ''}\nچپتر: ${chapter?.number || ''}\nنوع مشکل: ${reportIssueType}\nشماره صفحات: ${reportPageNum || 'نامشخص'}\nتوضیحات: ${reportDetails || 'بدون توضیح'}`;

      await apiClient.submitReport({
        id: `report-${Date.now()}`,
        userId: uid,
        userName,
        title,
        content
      });

      setReportMsg({ type: 'success', text: 'گزارش شما با موفقیت به ادمین و تیم تحریریه ارسال شد.' });
      setTimeout(() => {
        setShowReportModal(false);
        setReportMsg(null);
        setReportDetails('');
        setReportPageNum('');
      }, 2000);
    } catch (err: any) {
      setReportMsg({ type: 'error', text: err.message || 'خطا در ارسال گزارش' });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readingMode === 'vertical') return;
      if (e.key === 'ArrowLeft') {
        nextPage();
      } else if (e.key === 'ArrowRight') {
        prevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingMode, activePageIndex, sortedImages.length]);

  useEffect(() => {
    if (series?.title && chapter?.number) {
      document.title = `Chapter ${chapter.number} - ${series.title} - ${settings?.siteName || 'Mangata'}`;
    }
  }, [series?.title, chapter?.number, settings?.siteName]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;
      
      if (currentScrollY <= 80) {
        setShowNav(true);
      } else if (diff > 15) {
        setShowNav(false);
      } else if (diff < -15) {
        setShowNav(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check chapter purchase and ownership
  useEffect(() => {
    if (!user) {
      setDbUser(null);
      // When user is not logged in, they must log in to get free access or purchase
      setIsPurchased(false);
      setCheckingPurchase(false);
      return;
    }

    const loadData = async () => {
      setCheckingPurchase(true);
      setPurchaseError(null);
      try {
        const [uData, pResult] = await Promise.all([
          apiClient.getUser(user.uid),
          apiClient.checkChapterPurchase(user.uid, seriesId!, chapterId!)
        ]);

        setDbUser(uData);

        const isSuperAdminOrStaff = uData && (
          uData.role === 'admin' ||
          uData.role === 'super_admin' ||
          uData.role === 'staff' ||
          uData.email === 'amirrezaveisi45@gmail.com' ||
          uData.email === 'Mr.V@admin.com' ||
          (Array.isArray(uData.roles) && (uData.roles.includes('super_admin') || uData.roles.includes('admin') || uData.roles.includes('staff')))
        );

        const hasBypassPermission = uData && (
          uData.permissions && Array.isArray(uData.permissions) && uData.permissions.includes('free_chapters_access')
        );

        const isContributor = uData && (
          (chapter && chapter.contributors && (
            (Array.isArray(chapter.contributors?.translator) && chapter.contributors.translator.includes(uData.id)) ||
            (Array.isArray(chapter.contributors?.editor) && chapter.contributors.editor.includes(uData.id)) ||
            (Array.isArray(chapter.contributors?.cleaner) && chapter.contributors.cleaner.includes(uData.id))
          )) ||
          (series && Array.isArray(series.contributors) && series.contributors.some((c: any) => c.userId === uData.id || c.id === uData.id))
        );

        const isGlobalFree = !!settings?.globalFreeMode || !!pResult?.isGlobalFree || !!pResult?.freeAccess;
        const bypass = !isSimulatingUser && (isSuperAdminOrStaff || hasBypassPermission || isContributor);

        // When logged in: Global free mode grants instant free access
        if (bypass || isGlobalFree || pResult?.purchased) {
          setIsPurchased(true);
        } else {
          setIsPurchased(false);
        }
      } catch (err) {
        console.error("Error checking chapter status:", err);
      } finally {
        setCheckingPurchase(false);
      }
    };

    loadData();
  }, [user, seriesId, chapterId, isSimulatingUser, settings?.globalFreeMode]);

  // Subscribe to live wallet balance updates
  useEffect(() => {
    if (!user) return;
    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data.userId === user.uid) {
        setDbUser((prev: any) => prev ? { ...prev, walletBalance: data.balance } : { walletBalance: data.balance });
      }
    };
    
    const socketEventName = `wallet:updated:${user.uid}`;
    socket.on(socketEventName, handleUpdate);
    return () => {
      socket.off(socketEventName, handleUpdate);
    };
  }, [user]);

  const handlePurchase = async () => {
    if (!user) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const res = await apiClient.purchaseChapter(user.uid, seriesId!, chapterId!);
      if (res && res.success) {
        setIsPurchased(true);
        if (typeof res.balance === 'number') {
          setDbUser((prev: any) => prev ? { ...prev, walletBalance: res.balance } : { walletBalance: res.balance });
        }
      } else {
        setPurchaseError(res?.error || "خطایی در انجام تراکنش رخ داد.");
      }
    } catch (err: any) {
      console.error("Purchase error:", err);
      setPurchaseError(err?.message || "ارتباط با سرور برقرار نشد.");
    } finally {
      setPurchasing(false);
    }
  };

  useEffect(() => {
    if (seriesId && chapterId && chapter && isPurchased) {
      updateHistory(seriesId, chapterId, chapter.number);

      // Deduplicated view increment per chapter per user session
      const viewedKey = `viewed_chap_${seriesId}_${chapterId}`;
      const alreadyViewedLocally = localStorage.getItem(viewedKey);
      if (!alreadyViewedLocally) {
        localStorage.setItem(viewedKey, '1');
        apiClient.incrementChapterViews(seriesId, chapterId, user?.uid)
          .catch(err => console.error("Error incrementing chapter views:", err));
      }
    }
  }, [seriesId, chapterId, chapter?.number, updateHistory, isPurchased, user?.uid]);

  if (((seriesLoading || directLoading) && !chapter) || (user && checkingPurchase)) {
    return <ReaderSkeleton />;
  }

  if (!chapter) {
    return (
      <div className="bg-[#0a0a0c] min-h-screen text-zinc-300 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-md w-full bg-[#111217] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-black text-white mb-2">این صفحه یا چپتر یافت نشد</h2>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            ممکن است این چپتر وجود نداشته باشد یا آدرس ورودی نامعتبر باشد.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleBackToSeries}
              className="flex-1 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronRight size={16} />
              بازگشت به مانهوا
            </button>
            <button
              onClick={handleGoHome}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5 cursor-pointer"
            >
              <Home size={16} />
              صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If chapter is locked
  if (!isPurchased) {
    // If Global Free Mode is active, the ONLY requirement is logging in or registering!
    if (settings?.globalFreeMode && !user) {
      return (
        <div className="bg-[#0a0a0c] min-h-screen text-zinc-300 flex flex-col justify-center items-center px-4 py-12" dir="rtl">
          <div className="max-w-md w-full bg-[#111217] border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl shadow-emerald-950/40 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 blur-3xl rounded-full -z-10"></div>
            
            <div className="w-18 h-18 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-lg shadow-emerald-950/50">
              <Sparkles size={32} className="animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black mb-3">
              <span>🎉 جشنواره دسترسی رایگان سراسری</span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-white mb-3 font-sans">
              مطالعه کاملاً رایگان چپتر {chapter?.number}
            </h2>
            
            <p className="text-sm text-zinc-300 leading-relaxed mb-6">
              تمامی چپترهای اثر <span className="text-emerald-400 font-black">{series?.title}</span> و کل وب‌سایت هم‌اکنون به صورت <span className="text-white font-bold underline decoration-emerald-500 decoration-2">کاملاً رایگان</span> در دسترس قرار دارند.
            </p>

            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl p-4 mb-6 text-right space-y-2.5">
              <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5 border-b border-emerald-500/20 pb-2">
                <Check size={14} className="text-emerald-400" />
                <span>تنها شرط مطالعه رایگان: ورود یا ثبت‌نام در سایت</span>
              </div>
              <ul className="text-[11px] text-zinc-300 space-y-1.5 pr-1">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>بدون نیاز به پرداخت هیچ هزینه‌ای یا شارژ کیف پول</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>دسترسی آنی بلافاصله پس از ورود به حساب کاربری</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>ثبت‌نام سریع در کمتر از ۳۰ ثانیه</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                to="/profile"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>ورود یا ثبت‌نام برای مطالعه رایگان</span>
              </Link>

              <button
                onClick={handleBackToSeries}
                className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black text-xs rounded-xl transition-all border border-white/5 text-center cursor-pointer"
              >
                بازگشت به صفحه مانهوا
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-[#0a0a0c] min-h-screen text-zinc-300 flex flex-col justify-center items-center px-4 py-12" dir="rtl">
        <div className="max-w-md w-full bg-[#111217] border border-white/5 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[var(--color-asura-accent)]/10 blur-3xl rounded-full -z-10"></div>
          
          <div className="w-16 h-16 bg-[var(--color-asura-accent)]/15 border border-[var(--color-asura-accent)]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[var(--color-asura-accent)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="text-xl font-black text-white mb-3 font-sans">محتوای قفل شده</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            برای مطالعه چپتر <span className="text-[var(--color-asura-accent-light)] font-bold">{chapter?.number}</span> از اثر <span className="text-white font-bold">{series?.title}</span> باید مبلغ <span className="text-white font-bold">۴۰۰ تومان</span> پرداخت شود. پس از خرید، تا همیشه به این چپتر دسترسی خواهید داشت.
          </p>

          {!user ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <p className="text-xs text-amber-400 font-bold mb-3">برای خرید چپتر و دسترسی به کیف پول خود باید ابتدا وارد حساب کاربری شوید.</p>
              <Link to="/profile" className="inline-block w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/10">
                ورود به حساب کاربری
              </Link>
            </div>
          ) : (
            <>
              <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">موجودی کیف پول شما:</span>
                <span className="text-sm font-black text-white">
                  {(dbUser?.walletBalance || 0).toLocaleString('fa-IR')} <span className="text-xs text-zinc-400">تومان</span>
                </span>
              </div>

              {purchaseError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3.5 rounded-xl mb-6 text-right leading-relaxed animate-pulse">
                  {purchaseError}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {(dbUser?.walletBalance || 0) >= 400 ? (
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="w-full py-3.5 px-4 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-light)] disabled:opacity-50 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[var(--color-asura-accent)]/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {purchasing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        در حال پردازش تراکنش...
                      </>
                    ) : (
                      <>
                        پرداخت و باز کردن چپتر (۴۰۰ تومان)
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3.5 rounded-xl text-center leading-relaxed">
                      موجودی کیف پول شما برای خرید این چپتر کافی نیست (موجودی فعلی: {(dbUser?.walletBalance || 0).toLocaleString('fa-IR')} تومان).
                    </div>
                    <Link
                      to="/profile?tab=wallet"
                      className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                    >
                      شارژ سریع کیف پول
                    </Link>
                  </div>
                )}

                <button
                  onClick={handleBackToSeries}
                  className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black text-xs rounded-xl transition-all border border-white/5 text-center cursor-pointer"
                >
                  بازگشت به صفحه مانهوا
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleOpenReportForPage = (pageNum: number) => {
    setReportPageNum(`صفحه ${pageNum}`);
    setShowReportModal(true);
  };

  return (
    <div className="bg-[#0a0a0c] min-h-screen text-zinc-300">
      <SEOHead 
        title={chapter?.seoTitle || (series?.title && chapter?.number ? `چپتر ${chapter.number}${chapter.title ? ' - ' + chapter.title : ''} از ${series.type === 'Manga' ? 'مانگا' : series.type === 'Manhua' ? 'مانها' : 'مانهوا'} ${series.title} با ترجمه فارسی | ${settings?.siteName || 'مانگاتا'}` : undefined)}
        description={chapter?.seoDescription || (series?.title ? `مطالعه آنلاین و دانلود چپتر ${chapter?.number} از ${series.type === 'Manga' ? 'مانگا' : series.type === 'Manhua' ? 'مانها' : 'مانهوا'} ${series.title} با کیفیت عالی و ترجمه فارسی اختصاصی.` : undefined)}
        keywords={chapter?.seoKeywords || (series?.title ? `چپتر ${chapter?.number} ${series.title}, دانلود چپتر ${chapter?.number} ${series.title}, خواندن آنلاین ${series.title} چپتر ${chapter?.number}, ${settings?.siteName || 'مانگاتا'}` : undefined)}
        image={chapter?.images?.[0] || series?.cover}
        type="article"
      />
      {/* Top Navbar */}
      <div className={`fixed top-0 left-0 right-0 bg-[#0f0f12] border-b border-white/5 z-50 transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <button 
            onClick={handleBackToSeries} 
            className="flex items-center gap-1.5 text-zinc-200 hover:text-white transition-colors text-xs sm:text-sm font-bold truncate shrink-0 max-w-[55%] bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/5"
            title="بازگشت به صفحه مانهوا"
          >
            <ChevronRight size={18} className="shrink-0 text-amber-400" />
            <span className="truncate">{series?.title || 'بازگشت به اثر'}</span>
          </button>
          
          <div className="flex-1 flex justify-center">
            <div className="font-bold text-white bg-white/10 px-3 py-1 rounded text-xs tracking-widest uppercase font-sans">
              Chapter {chapter?.number}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setReportPageNum('');
                setShowReportModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-colors"
              title="گزارش خراب بودن تصاویر"
            >
              <Flag size={14} />
              <span className="hidden md:inline">گزارش خرابی</span>
            </button>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="text-zinc-500 hover:text-white transition-colors relative"
            >
              <SettingsIcon size={18} />
            </button>
            <button 
              onClick={handleGoHome}
              className="hover:text-white transition-colors text-zinc-400 p-1.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/10 cursor-pointer flex items-center justify-center"
              title="صفحه اصلی وبسایت"
            >
              <Home size={18} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="absolute top-12 right-4 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl shadow-xl p-4 w-64 z-50 text-white text-right" dir="rtl">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3 border-b border-white/5 pb-2">تنظیمات ریدر</h3>
            
            <div className="mb-4">
              <label className="block text-xs mb-2 font-bold text-zinc-400">حالت نمایش تصاویر</label>
              <div className="flex flex-col gap-2">
                 <button 
                   onClick={() => { setReadingMode('vertical'); setActivePageIndex(0); }}
                   className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all ${readingMode === 'vertical' ? 'bg-[var(--color-asura-accent)] text-white' : 'bg-black/50 text-zinc-400 hover:text-white'}`}
                 >عمودی (وبتون)</button>
                 <button 
                   onClick={() => { setReadingMode('single'); setActivePageIndex(0); }}
                   className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all ${readingMode === 'single' ? 'bg-[var(--color-asura-accent)] text-white' : 'bg-black/50 text-zinc-400 hover:text-white'}`}
                 >تک صفحه‌ای</button>
                 <button 
                   onClick={() => { setReadingMode('double'); setActivePageIndex(0); }}
                   className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all ${readingMode === 'double' ? 'bg-[var(--color-asura-accent)] text-white' : 'bg-black/50 text-zinc-400 hover:text-white'}`}
                 >دو صفحه‌ای</button>
              </div>
            </div>

            {readingMode === 'vertical' && (
              <div>
                <label className="block text-xs mb-2 flex justify-between font-bold text-zinc-400">
                  <span>فاصله بین صفحات</span>
                  <span>{imageGap}px</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="24" 
                  step="2"
                  value={imageGap}
                  onChange={e => setImageGap(Number(e.target.value))}
                  className="w-full accent-[var(--color-asura-accent)]" 
                />
              </div>
            )}
          </div>
        )}
      </div>

      {settings?.globalFreeMode && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-b border-emerald-500/30 py-2.5 px-4 text-center text-xs font-black text-emerald-300 mt-12 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50" dir="rtl">
          <Sparkles size={15} className="text-emerald-400 animate-pulse shrink-0" />
          <span>{settings.globalFreeBannerText || '🎉 جشنواره دسترسی رایگان سراسری فعال است - تمام چپترها برای همه کاربران رایگان می‌باشد.'}</span>
        </div>
      )}

      {/* Quick Settings Bar */}
      <div className="bg-[#0b0b0e]/95 backdrop-blur border-y border-white/5 py-3 px-4 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto mt-12 sticky top-12 z-40" dir="rtl">
        <div className="flex flex-wrap items-center gap-2.5">
          <SettingsIcon size={16} className="text-[var(--color-asura-accent-light)] animate-[spin_8s_linear_infinite]" />
          <span className="text-xs font-black text-white font-sans">حالت مطالعه مانهوا:</span>
          
          <div className="flex bg-black/40 rounded-xl p-0.5 border border-white/5 shrink-0">
            <button
              onClick={() => { setReadingMode('vertical'); setActivePageIndex(0); }}
              className={`text-[11px] font-black px-3.5 py-1.5 rounded-lg transition-all ${readingMode === 'vertical' ? 'bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:text-white'}`}
            >
              عمودی (وبتون)
            </button>
            <button
              onClick={() => { setReadingMode('single'); setActivePageIndex(0); }}
              className={`text-[11px] font-black px-3.5 py-1.5 rounded-lg transition-all ${readingMode === 'single' ? 'bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:text-white'}`}
            >
              تک صفحه‌ای
            </button>
            <button
              onClick={() => { setReadingMode('double'); setActivePageIndex(0); }}
              className={`text-[11px] font-black px-3.5 py-1.5 rounded-lg transition-all ${readingMode === 'double' ? 'bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:text-white'}`}
            >
              دو صفحه‌ای
            </button>
          </div>

          <button
            onClick={() => {
              setGlobalReloadKey(prev => prev + 1);
              fetchDirectChapter();
              mutateSeries();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-black transition-all shrink-0 hover:scale-105 active:scale-95 mr-auto md:mr-0 cursor-pointer"
            title="بازخوانی فوری تمام تصاویر چپتر (مناسب کندی اینترنت)"
          >
            <RefreshCw size={14} />
            <span>بازخوانی تمام تصاویر</span>
          </button>

          <button
            onClick={() => {
              setReportPageNum(readingMode !== 'vertical' ? `صفحه ${activePageIndex + 1}` : '');
              setShowReportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-black transition-all shrink-0 hover:scale-105 active:scale-95"
            title="گزارش خراب بودن تصاویر یا اشکال در چپتر"
          >
            <Flag size={14} />
            <span>گزارش خرابی تصویر</span>
          </button>
        </div>

        {readingMode !== 'vertical' && sortedImages && sortedImages.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={prevPage}
              disabled={activePageIndex === 0}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="صفحه قبلی"
            >
              <ChevronRight size={16} />
            </button>
            
            <span className="text-xs font-black text-zinc-400 min-w-[80px] text-center select-none">
              صفحه {readingMode === 'double' ? `${(activePageIndex + 1).toLocaleString('fa-IR')}-${Math.min(activePageIndex + 2, sortedImages.length).toLocaleString('fa-IR')}` : (activePageIndex + 1).toLocaleString('fa-IR')} از {sortedImages.length.toLocaleString('fa-IR')}
            </span>

            <button
              onClick={nextPage}
              disabled={readingMode === 'double' ? activePageIndex >= sortedImages.length - 2 : activePageIndex >= sortedImages.length - 1}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="صفحه بعدی"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Reader Main Content Area */}
      <div className="pt-4 pb-16 max-w-[800px] mx-auto flex flex-col relative w-full bg-black/20">
        <style>{`
          @media print {
            body { display: none !important; }
          }
          img {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -khtml-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-user-drag: none;
          }
        `}</style>

        {sortedImages && sortedImages.length > 0 ? (
          <div className="w-full flex flex-col items-center">
            {/* Vertical Mode (Webtoon) */}
            {readingMode === 'vertical' && (
              <div 
                 className="flex flex-col justify-center items-center w-full"
                 style={{ gap: `${imageGap}px` }}
              >
                {sortedImages.map((img, i) => (
                  <MangaImage
                    key={`${seriesId}-${chapterId}-${i}-${img}`}
                    src={img}
                    index={i}
                    totalImages={sortedImages.length}
                    onReportRequest={handleOpenReportForPage}
                    seriesId={series?.id}
                    chapterId={chapter?.id}
                    chapterNumber={chapter?.number}
                    seriesTitle={series?.title}
                    reloadKey={globalReloadKey}
                  />
                ))}
              </div>
            )}

            {/* Single Page Mode */}
            {readingMode === 'single' && (
              <div className="w-full flex flex-col items-center relative group min-h-[500px] justify-center">
                <div className="relative max-w-full flex justify-center items-center select-none w-full" style={{ minHeight: '500px' }}>
                  <MangaImage
                    key={`${seriesId}-${chapterId}-${activePageIndex}-${sortedImages[activePageIndex]}`}
                    src={sortedImages[activePageIndex]}
                    index={activePageIndex}
                    totalImages={sortedImages.length}
                    onReportRequest={handleOpenReportForPage}
                    seriesId={series?.id}
                    chapterId={chapter?.id}
                    chapterNumber={chapter?.number}
                    seriesTitle={series?.title}
                    reloadKey={globalReloadKey}
                  />
                  
                  {/* Left / Right Nav Click Targets */}
                  <div 
                    onClick={prevPage}
                    className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer flex items-center justify-start p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-black/40 to-transparent z-30"
                    title="صفحه قبل"
                  >
                    <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                  <div 
                    onClick={nextPage}
                    className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer flex items-center justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-black/40 to-transparent z-30"
                    title="صفحه بعد"
                  >
                    <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                      <ChevronLeft size={20} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Double Page Mode */}
            {readingMode === 'double' && (
              <div className="w-full flex flex-col items-center relative group min-h-[500px] justify-center">
                <div className="grid grid-cols-2 gap-4 w-full select-none justify-items-center relative" style={{ minHeight: '500px' }}>
                  
                  {/* Right hand side: page activePageIndex + 1 (manga RTL) */}
                  {activePageIndex + 1 < sortedImages.length ? (
                    <div className="relative w-full flex justify-center items-center min-h-[500px] overflow-hidden rounded-xl">
                      <MangaImage
                        key={`${seriesId}-${chapterId}-${activePageIndex + 1}-${sortedImages[activePageIndex + 1]}`}
                        src={sortedImages[activePageIndex + 1]}
                        index={activePageIndex + 1}
                        totalImages={sortedImages.length}
                        onReportRequest={handleOpenReportForPage}
                        seriesId={series?.id}
                        chapterId={chapter?.id}
                        chapterNumber={chapter?.number}
                        seriesTitle={series?.title}
                        reloadKey={globalReloadKey}
                      />
                    </div>
                  ) : (
                    <div className="max-h-[85vh] aspect-[2/3] w-full flex flex-col items-center justify-center bg-[#111217]/30 rounded-xl border border-white/5 text-zinc-600 text-xs font-black p-4 text-center">
                      پایان چپتر
                    </div>
                  )}

                  {/* Left hand side: page activePageIndex */}
                  <div className="relative w-full flex justify-center items-center min-h-[500px] overflow-hidden rounded-xl">
                    <MangaImage
                      key={`${seriesId}-${chapterId}-${activePageIndex}-${sortedImages[activePageIndex]}`}
                      src={sortedImages[activePageIndex]}
                      index={activePageIndex}
                      totalImages={sortedImages.length}
                      onReportRequest={handleOpenReportForPage}
                      seriesId={series?.id}
                      chapterId={chapter?.id}
                      chapterNumber={chapter?.number}
                      seriesTitle={series?.title}
                      reloadKey={globalReloadKey}
                    />
                  </div>
                </div>

                {/* Left/Right Overlays */}
                <div 
                  onClick={prevPage}
                  className="absolute right-0 top-0 bottom-0 w-1/6 cursor-pointer flex items-center justify-start p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-black/40 to-transparent z-30"
                  title="صفحه قبل"
                >
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                    <ChevronRight size={20} />
                  </div>
                </div>
                <div 
                  onClick={nextPage}
                  className="absolute left-0 top-0 bottom-0 w-1/6 cursor-pointer flex items-center justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-black/40 to-transparent z-30"
                  title="صفحه بعد"
                >
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                    <ChevronLeft size={20} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Placeholder for missing images */
          <div className="flex-1 flex flex-col items-center justify-center p-10 mt-20 min-h-[60vh]" dir="rtl">
            <div className="w-16 h-16 border-4 border-slate-800 border-t-[var(--color-asura-accent)] rounded-full animate-spin mb-6"></div>
            <p className="text-slate-500 font-medium">در حال بارگذاری تصاویر چپتر...</p>
            <p className="text-slate-600 text-xs mt-2 text-center max-w-md">
              تصاویر مانهوا از سرور اختصاصی لود خواهند شد. لطفا شکیبا باشید.
            </p>
            <div className="h-[800px] w-full mt-10 bg-gradient-to-b from-[#15171e] to-transparent rounded animate-pulse"></div>
          </div>
        )}

        {/* Read Next Navigation Area */}
        <div className="p-6 md:p-10 flex flex-col items-center border-t border-white/5 mt-10 bg-[#0f0f12]" dir="rtl">
          <h3 className="font-black text-sm text-zinc-400 mb-6 text-center uppercase tracking-wider font-sans">چپتر {chapter.number} تموم شد</h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            {prevChapter ? (
              <Link to={`/reader/${series?.id || seriesId}/${prevChapter.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors">
                <ChevronLeft size={16} />
                Prev Ch.
              </Link>
            ) : (
              <button disabled className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-white/5 text-zinc-600 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 cursor-not-allowed">
                <ChevronLeft size={16} />
                Prev Ch.
              </button>
            )}

            <button 
              onClick={handleBackToSeries} 
              className="w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors"
            >
              <Menu size={16} />
              صفحه مانهوا
            </button>

            {nextChapter ? (
              <Link to={`/reader/${series?.id || seriesId}/${nextChapter.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors shadow">
                Next Ch.
                <ChevronRight size={16} />
              </Link>
            ) : (
              <button disabled className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-white/5 text-zinc-600 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 cursor-not-allowed">
                Next Ch.
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className={`fixed bottom-6 right-6 flex flex-col gap-3 z-40 transition-transform duration-300 ${showNav ? 'translate-y-0' : 'translate-y-24'}`}>
        <button onClick={scrollToTop} className="w-10 h-10 bg-white/10 backdrop-blur hover:bg-white text-white hover:text-black rounded-lg flex items-center justify-center shadow-xl border border-white/10 transition-colors">
          <ArrowUp size={18} />
        </button>
      </div>

      {/* Report Broken Images Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#14151b] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-right">
            <button
              onClick={() => { setShowReportModal(false); setReportMsg(null); }}
              className="absolute top-4 left-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
              <div className="p-2 bg-red-500/10 rounded-xl text-red-400">
                <Flag size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">گزارش خرابی تصویر یا چپتر</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  اطلاع‌رسانی سریع به مدیریت و ادیتورهای پروژه
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-xl p-3 mb-4 text-xs font-medium text-zinc-300">
              <span className="text-zinc-400">عنوان اثر: </span>
              <strong className="text-white ml-2">{series?.title}</strong>
              <span className="text-zinc-500 mx-1">|</span>
              <span className="text-zinc-400">چپتر: </span>
              <strong className="text-amber-400">{chapter?.number}</strong>
            </div>

            {reportMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2 ${reportMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                {reportMsg.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                <span>{reportMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  نوع مشکل:
                </label>
                <select
                  value={reportIssueType}
                  onChange={e => setReportIssueType(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                >
                  <option value="عدم بارگذاری تصویر / تصویر خراب">عدم بارگذاری تصویر / تصویر خراب</option>
                  <option value="ترتیب اشتباه یا جابه‌جا بودن صفحات">ترتیب اشتباه یا جابه‌جا بودن صفحات</option>
                  <option value="کیفیت پایین یا واترمارک ناخوانا">کیفیت پایین یا واترمارک ناخوانا</option>
                  <option value="صفحه تکراری یا چپتر اشتباهی">صفحه تکراری یا چپتر اشتباهی</option>
                  <option value="سایر موارد">سایر موارد</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  شماره صفحه / صفحات دارای مشکل (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثلا: صفحه ۵ یا صفحات ۳ تا ۷"
                  value={reportPageNum}
                  onChange={e => setReportPageNum(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  توضیحات تکمیلی (اختیاری):
                </label>
                <textarea
                  rows={3}
                  placeholder="در صورت نیاز توضیحات بیشتری بنویسید..."
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-medium text-white focus:outline-none focus:border-[var(--color-asura-accent)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-[var(--color-asura-accent)]/20 disabled:opacity-50"
                >
                  {isSubmittingReport ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={14} />
                      <span>ارسال گزارش</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
