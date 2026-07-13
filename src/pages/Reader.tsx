import { useParams, Link } from 'react-router-dom';
import { useSeriesOverview } from '../hooks/useSeries';
import { useHistory } from '../hooks/useUserActivity';
import { ChevronLeft, ChevronRight, Menu, Home, ArrowUp, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Comments } from '../components/Comments';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { ReaderSkeleton } from '../components/Skeletons';

export default function Reader() {
  const { seriesId, chapterId } = useParams();
  const { series, loading: seriesLoading } = useSeriesOverview(seriesId);
  const { updateHistory } = useHistory();
  const { user, isSimulatingUser } = useAuth();
  
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [readDirection, setReadDirection] = useState<'vertical' | 'horizontal-rtl'>('vertical');
  const [imageGap, setImageGap] = useState<number>(0);
  const [readingMode, setReadingMode] = useState<'vertical' | 'single' | 'double'>('vertical');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [dbUser, setDbUser] = useState<any>(null);
  const [isPurchased, setIsPurchased] = useState<boolean>(false);
  const [checkingPurchase, setCheckingPurchase] = useState<boolean>(true);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const chapterIdx = series?.chapters ? series.chapters.findIndex(c => c.id === chapterId) : -1;
  const chapter = chapterIdx >= 0 && series?.chapters ? series.chapters[chapterIdx] : (series?.chapters ? series.chapters[0] : null);
  
  const nextChapter = series?.chapters && chapterIdx >= 0 ? series.chapters[chapterIdx - 1] : null; 
  const prevChapter = series?.chapters && chapterIdx >= 0 ? series.chapters[chapterIdx + 1] : null; 

  const nextPage = () => {
    if (!chapter?.images) return;
    if (readingMode === 'single') {
      if (activePageIndex < chapter.images.length - 1) {
        setActivePageIndex(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (readingMode === 'double') {
      if (activePageIndex < chapter.images.length - 2) {
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
  }, [readingMode, activePageIndex, chapter?.images?.length]);

  useEffect(() => {
    if (series?.title && chapter?.number) {
      document.title = `Chapter ${chapter.number} - ${series.title} - ASURA SCANS CLONE`;
    }
  }, [series?.title, chapter?.number]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowNav(false);
      } else {
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

        const isSuperAdmin = uData && (
          uData.email === 'amirrezaveisi45@gmail.com' ||
          uData.email === 'Mr.V@admin.com' ||
          (uData.roles && uData.roles.includes('super_admin'))
        );

        const hasBypassPermission = uData && (
          uData.permissions && uData.permissions.includes('free_chapters_access')
        );

        const bypass = !isSimulatingUser && (isSuperAdmin || hasBypassPermission);

        if (bypass || pResult?.purchased) {
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
  }, [user, seriesId, chapterId, isSimulatingUser]);

  // Subscribe to live wallet balance updates
  useEffect(() => {
    if (!user) return;
    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data.userId === user.uid) {
        setDbUser(prev => prev ? { ...prev, walletBalance: data.balance } : { walletBalance: data.balance });
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
      if (res.success) {
        setIsPurchased(true);
        if (dbUser) {
          setDbUser({ ...dbUser, walletBalance: res.balance });
        }
      } else {
        setPurchaseError(res.error || "خطایی در انجام تراکنش رخ داد.");
      }
    } catch (err) {
      console.error("Purchase error:", err);
      setPurchaseError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPurchasing(false);
    }
  };

  useEffect(() => {
    if (seriesId && chapterId && chapter && isPurchased) {
      updateHistory(seriesId, chapterId, chapter.number);
      // Clean, seamless, errorless view increments using our cPanel MySQL API
      apiClient.incrementSeriesViews(seriesId)
        .catch(err => console.error("Error incrementing series views via API:", err));

      apiClient.incrementChapterViews(seriesId, chapterId)
        .catch(err => console.error("Error incrementing chapter views via API:", err));
    }
  }, [seriesId, chapterId, chapter?.number, updateHistory, isPurchased]);

  if (seriesLoading || (user && checkingPurchase)) {
    return <ReaderSkeleton />;
  }

  if (!series || !series.chapters || !chapter) {
    return (
      <div className="bg-[#0a0a0c] min-h-screen text-zinc-300 flex justify-center items-center">
        Chapter not found
      </div>
    );
  }

  // If the user has not purchased the chapter
  if (!isPurchased) {
    return (
      <div className="bg-[#0a0a0c] min-h-screen text-zinc-300 flex flex-col justify-center items-center px-4 py-12" dir="rtl">
        <div className="max-w-md w-full bg-[#111217] border border-white/5 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden animate-fade-in">
          {/* Subtle glow behind lock */}
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
              {/* Wallet Info */}
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
                    className="w-full py-3.5 px-4 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-light)] disabled:opacity-50 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[var(--color-asura-accent)]/20 flex items-center justify-center gap-2"
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
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3.5 rounded-xl text-center">
                      موجودی کیف پول شما برای خرید این چپتر کافی نیست.
                    </div>
                    <Link
                      to="/profile?tab=wallet"
                      className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                    >
                      شارژ سریع کیف پول
                    </Link>
                  </div>
                )}

                <Link
                  to={`/series/${series.id}`}
                  className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black text-xs rounded-xl transition-all border border-white/5"
                >
                  بازگشت به صفحه مانهوا
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0c] min-h-screen text-zinc-300">
      {/* Top Navbar */}
      <div className={`fixed top-0 left-0 right-0 bg-[#0f0f12] border-b border-white/5 z-50 transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link to={`/series/${series.id}`} className="flex items-center gap-2 hover:text-white transition-colors text-sm font-bold truncate shrink-0 max-w-[40%]">
            <ChevronLeft size={16} />
            <span className="hidden sm:inline truncate">{series.title}</span>
          </Link>
          
          <div className="flex-1 flex justify-center">
            <div className="font-bold text-white bg-white/10 px-3 py-1 rounded text-xs tracking-widest uppercase">
              Chapter {chapter.number}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="text-zinc-500 hover:text-white transition-colors relative"
            >
              <SettingsIcon size={18} />
            </button>
            <Link to="/" className="hover:text-white transition-colors text-zinc-500">
              <Home size={18} />
            </Link>
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

      {/* Quick Settings Bar */}
      <div className="bg-[#0b0b0e]/95 backdrop-blur border-y border-white/5 py-3 px-4 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto mt-12 sticky top-12 z-40" dir="rtl">
        <div className="flex flex-wrap items-center gap-2.5">
          <SettingsIcon size={16} className="text-[var(--color-asura-accent-light)] animate-[spin_8s_linear_infinite]" />
          <span className="text-xs font-black text-white">حالت مطالعه مانهوا:</span>
          
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
        </div>

        {readingMode !== 'vertical' && chapter.images && chapter.images.length > 0 && (
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
              صفحه {readingMode === 'double' ? `${activePageIndex + 1}-${Math.min(activePageIndex + 2, chapter.images.length)}` : activePageIndex + 1} از {chapter.images.length}
            </span>

            <button
              onClick={nextPage}
              disabled={readingMode === 'double' ? activePageIndex >= chapter.images.length - 2 : activePageIndex >= chapter.images.length - 1}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="صفحه بعدی"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Reader Content */}
      <div className="pt-4 pb-16 max-w-[800px] mx-auto flex flex-col relative w-full bg-black/20">
        {chapter.images && chapter.images.length > 0 ? (
          <div className="w-full flex flex-col items-center">
            {readingMode === 'vertical' && (
              <div 
                 className="flex flex-col justify-center items-center w-full"
                 style={{ gap: `${imageGap}px` }}
              >
                {chapter.images.map((img, i) => (
                  <img 
                    key={i} 
                    src={img} 
                    alt={`Page ${i + 1}`} 
                    className="object-contain block w-full mx-auto"
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {readingMode === 'single' && (
              <div className="w-full flex flex-col items-center relative group">
                <div className="relative max-w-full flex justify-center items-center select-none">
                  <img 
                    src={chapter.images[activePageIndex]} 
                    alt={`Page ${activePageIndex + 1}`} 
                    className="max-h-[90vh] object-contain block w-auto mx-auto rounded-xl shadow-2xl border border-white/5"
                  />
                  
                  {/* Absolute Nav Click Targets */}
                  <div 
                    onClick={prevPage}
                    className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer flex items-center justify-start p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-black/40 to-transparent"
                    title="صفحه قبل"
                  >
                    <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                  <div 
                    onClick={nextPage}
                    className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer flex items-center justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-black/40 to-transparent"
                    title="صفحه بعد"
                  >
                    <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                      <ChevronLeft size={20} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {readingMode === 'double' && (
              <div className="w-full flex flex-col items-center relative group">
                <div className="grid grid-cols-2 gap-4 w-full select-none justify-items-center">
                  {/* Right hand side: page activePageIndex + 1 (manga RTL) */}
                  {activePageIndex + 1 < chapter.images.length ? (
                    <img 
                      src={chapter.images[activePageIndex + 1]} 
                      alt={`Page ${activePageIndex + 2}`} 
                      className="max-h-[85vh] object-contain block w-full rounded-xl shadow-2xl border border-white/5"
                    />
                  ) : (
                    <div className="max-h-[85vh] aspect-[2/3] w-full flex flex-col items-center justify-center bg-zinc-950 rounded-xl border border-white/5 text-zinc-600 text-xs font-black p-4 text-center">
                      پایان فصل
                    </div>
                  )}

                  {/* Left hand side: page activePageIndex */}
                  <img 
                    src={chapter.images[activePageIndex]} 
                    alt={`Page ${activePageIndex + 1}`} 
                    className="max-h-[85vh] object-contain block w-full rounded-xl shadow-2xl border border-white/5"
                  />
                </div>

                {/* Left/Right Overlays */}
                <div 
                  onClick={prevPage}
                  className="absolute right-0 top-0 bottom-0 w-1/6 cursor-pointer flex items-center justify-start p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-black/40 to-transparent"
                  title="صفحه قبل"
                >
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-[var(--color-asura-accent)] transition-colors">
                    <ChevronRight size={20} />
                  </div>
                </div>
                <div 
                  onClick={nextPage}
                  className="absolute left-0 top-0 bottom-0 w-1/6 cursor-pointer flex items-center justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-black/40 to-transparent"
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
          <div className="flex-1 flex flex-col items-center justify-center p-10 mt-20 min-h-[60vh]">
            <div className="w-16 h-16 border-4 border-slate-800 border-t-[var(--color-asura-accent)] rounded-full animate-spin mb-6"></div>
            <p className="text-slate-500 font-medium">در حال بارگذاری تصاویر فصل...</p>
            <p className="text-slate-600 text-xs mt-2 text-center max-w-md">
              تصاویر مانهوا از سرور اختصاصی لود خواهند شد. لطفا شکیبا باشید.
            </p>
            <div className="h-[800px] w-full mt-10 bg-gradient-to-b from-[#15171e] to-transparent rounded animate-pulse"></div>
          </div>
        )}

        {/* Read Next Navigation Area */}
        <div className="p-6 md:p-10 flex flex-col items-center border-t border-white/5 mt-10 bg-[#0f0f12]" dir="rtl">
          <h3 className="font-black text-sm text-zinc-400 mb-6 text-center uppercase tracking-wider">مطالعه فصل {chapter.number} به پایان رسید</h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            {prevChapter ? (
              <Link to={`/reader/${series.id}/${prevChapter.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors">
                <ChevronLeft size={16} />
                Prev Ch.
              </Link>
            ) : (
              <button disabled className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-white/5 text-zinc-600 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 cursor-not-allowed">
                <ChevronLeft size={16} />
                Prev Ch.
              </button>
            )}

            <Link to={`/series/${series.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors">
              <Menu size={16} />
              Index
            </Link>

            {nextChapter ? (
              <Link to={`/reader/${series.id}/${nextChapter.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors shadow">
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

        <div className="p-6 md:p-10">
          <Comments seriesId={series.id} chapterId={chapter.id} />
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className={`fixed bottom-6 right-6 flex flex-col gap-3 z-40 transition-transform duration-300 ${showNav ? 'translate-y-0' : 'translate-y-24'}`}>
        <button onClick={scrollToTop} className="w-10 h-10 bg-white/10 backdrop-blur hover:bg-white text-white hover:text-black rounded-lg flex items-center justify-center shadow-xl border border-white/10 transition-colors">
          <ArrowUp size={18} />
        </button>
      </div>

    </div>
  );
}
