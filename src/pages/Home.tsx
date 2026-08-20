import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { Link } from "react-router-dom";
import { 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  Star, 
  Flame, 
  Eye, 
  Heart, 
  History, 
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiClient } from "../lib/apiClient";
import { Series } from "../lib/types";
import { SeriesCardSkeleton, HeroSkeleton } from "../components/Skeletons";
import { SeriesCard } from "../components/SeriesCard";
import { SEOHead } from "../components/SEOHead";

export default function Home() {
  // State for homepage lists (initial loads up to 8 items to detect if there are more than 7)
  const [latestList, setLatestList] = useState<Series[]>([]);
  const [viewsList, setViewsList] = useState<Series[]>([]);
  const [popularList, setPopularList] = useState<Series[]>([]);
  const [oldestList, setOldestList] = useState<Series[]>([]);
  const [sliderItems, setSliderItems] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-play Slider State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Touch Swipe State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // Lazy Loaded Vertical View States
  const [expandedSection, setExpandedSection] = useState<"latest" | "views" | "popular" | "oldest" | null>(null);
  const [expandedItems, setExpandedItems] = useState<Series[]>([]);
  const [expandedOffset, setExpandedOffset] = useState(0);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Custom Date Formatter for Persian Relative Time
  const formatChapterDate = (dateVal: any) => {
    if (!dateVal) return "به‌تازگی";
    try {
      let d: Date;
      if (typeof dateVal.toDate === "function") {
        d = dateVal.toDate();
      } else {
        d = new Date(dateVal);
      }
      
      const diffMs = new Date().getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "الان";
      if (diffMins < 60) return `${diffMins} دقیقه پیش`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} ساعت پیش`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays} روز پیش`;
      return d.toLocaleDateString("fa-IR");
    } catch (e) {
      return "قبل";
    }
  };

  // Initial Fetch of Home Data
  const fetchHomeData = async () => {
    try {
      setLoading(true);
      const [latest, views, popular, oldest] = await Promise.all([
        apiClient.getSeries({ sortBy: "newest", limit: 8 }),
        apiClient.getSeries({ sortBy: "views", limit: 8 }),
        apiClient.getSeries({ sortBy: "popular", limit: 8 }),
        apiClient.getSeries({ sortBy: "oldest", limit: 8 }),
      ]);

      const safeLatest = Array.isArray(latest) ? latest : [];
      const safeViews = Array.isArray(views) ? views : [];
      const safePopular = Array.isArray(popular) ? popular : [];
      const safeOldest = Array.isArray(oldest) ? oldest : [];

      setLatestList(safeLatest);
      setViewsList(safeViews);
      setPopularList(safePopular);
      setOldestList(safeOldest);

      // Filter slider items (marked isHero) from all lists combined, or load them
      const allFetched = [...safeLatest, ...safeViews, ...safePopular, ...safeOldest];
      const uniqueFetched = Array.from(new Map(allFetched.map(item => [item.id, item])).values());
      const heroes = uniqueFetched.filter(s => s.isHero);
      
      // Fallback to top 4 latest if no hero is marked
      setSliderItems(heroes.length > 0 ? heroes : uniqueFetched.slice(0, 4));

    } catch (err) {
      console.error("Error loading home data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  // Slide navigation with built-in auto-play timer reset
  const handleNextSlide = () => {
    if (sliderItems.length === 0) return;
    setCurrentSlide((prev) => (prev + 1) % sliderItems.length);
  };

  const handlePrevSlide = () => {
    if (sliderItems.length === 0) return;
    setCurrentSlide((prev) => (prev - 1 + sliderItems.length) % sliderItems.length);
  };

  // Touch Swipe handlers for Hero Slider
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const diffX = touchStartX - touchEndX;
    const minSwipeDistance = 50;

    if (Math.abs(diffX) > minSwipeDistance) {
      if (diffX > 0) {
        // Swipe Left (Next slide in standard flow)
        handleNextSlide();
      } else {
        // Swipe Right (Prev slide in standard flow)
        handlePrevSlide();
      }
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Auto-play effect with precise timeout: clears and recreates whenever slide changes,
  // naturally resetting the 5.5s countdown after any user manual action (click/swipe)
  useEffect(() => {
    if (sliderItems.length <= 1) return;
    const timer = setTimeout(() => {
      handleNextSlide();
    }, 5500);
    return () => clearTimeout(timer);
  }, [currentSlide, sliderItems.length]);

  // Expand Section (Vertical Infinite Loading)
  const handleExpandSection = async (section: "latest" | "views" | "popular" | "oldest") => {
    setExpandedSection(section);
    setExpandedItems([]);
    setExpandedOffset(0);
    setExpandedLoading(true);
    setHasMore(true);

    const sortByMap = {
      latest: "newest",
      views: "views",
      popular: "popular",
      oldest: "oldest"
    };

    try {
      const data = await apiClient.getSeries({ sortBy: sortByMap[section], limit: 6, offset: 0 });
      
      // Map chapters for all elements in expanded list
      const itemsWithChapters = await Promise.all(data.map(async (s: any) => {
        try {
          const chapters = await apiClient.getChapters(s.id);
          return {
            ...s,
            chapters: Array.isArray(chapters) ? chapters.slice(0, 2) : []
          };
        } catch {
          return { ...s, chapters: [] };
        }
      }));

      setExpandedItems(itemsWithChapters);
      setExpandedOffset(6);
      if (data.length < 6) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error expanding section:", err);
    } finally {
      setExpandedLoading(false);
    }
  };

  // Load More (6 by 6) for Expanded Section
  const handleLoadMore = async () => {
    if (expandedLoading || !hasMore || !expandedSection) return;
    setExpandedLoading(true);

    const sortByMap = {
      latest: "newest",
      views: "views",
      popular: "popular",
      oldest: "oldest"
    };

    try {
      const data = await apiClient.getSeries({ 
        sortBy: sortByMap[expandedSection], 
        limit: 6, 
        offset: expandedOffset 
      });

      if (data.length < 6) {
        setHasMore(false);
      }

      const itemsWithChapters = await Promise.all(data.map(async (s: any) => {
        try {
          const chapters = await apiClient.getChapters(s.id);
          return {
            ...s,
            chapters: Array.isArray(chapters) ? chapters.slice(0, 2) : []
          };
        } catch {
          return { ...s, chapters: [] };
        }
      }));

      setExpandedItems(prev => [...prev, ...itemsWithChapters]);
      setExpandedOffset(prev => prev + 6);
    } catch (err) {
      console.error("Error loading more items:", err);
    } finally {
      setExpandedLoading(false);
    }
  };

  const getSectionTitle = (type: "latest" | "views" | "popular" | "oldest") => {
    switch (type) {
      case "latest": return "جدیدترین‌ها";
      case "views": return "پربازدیدترین‌ها";
      case "popular": return "محبوب‌ترین‌ها";
      case "oldest": return "قدیمی‌ترین آثار";
      default: return "";
    }
  };

  // Switch to home view
  const handleBackToHome = () => {
    setExpandedSection(null);
    setExpandedItems([]);
    setExpandedOffset(0);
  };

  return (
    <Layout>
      <SEOHead 
        title="مانگاتا | پلتفرم هوشمند ترجمه، مدیریت و خوانش مانهوا و مانگا"
        description="مانگاتا (MANGATA) مرجع اصلی و زنده خواندن آنلاین و دانلود مانهوا، مانگا، مانها و کمیک با ترجمه اختصاصی، کیفیت HD و به روزرسانی روزانه."
        keywords="مانهوا, مانگا, مانها, کمیک, کمیک بوک, انیمه, مانگاتا, خواندن مانهوا, ترجمه مانهوا, mangata"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "مانگاتا",
          "url": window.location.origin,
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${window.location.origin}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        }}
      />
      {/* 1. EXPANDED VERTICAL SECTION WITH LAZY LOADING (6 BY 6) */}
      {expandedSection ? (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 text-right" dir="rtl">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-5">
            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-[var(--color-asura-accent)] rounded-full"></span>
              {getSectionTitle(expandedSection)}
            </h1>
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-white/5"
            >
              <ArrowLeft size={14} className="rotate-180" />
              <span>بازگشت به خانه</span>
            </button>
          </div>

          {/* Grid List */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {expandedItems.map((series, idx) => (
              <SeriesCard key={`${series.id}-expanded-${idx}`} series={series} />
            ))}
          </div>

          {/* Lazy Loading Actions (6 by 6) */}
          {hasMore && (
            <div className="flex justify-center mt-12">
              <button
                onClick={handleLoadMore}
                disabled={expandedLoading}
                className="bg-gradient-to-r from-[var(--color-asura-accent)] to-[#ff843a] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-[var(--color-asura-accent)]/15 flex items-center gap-3"
              >
                {expandedLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Sparkles size={14} />
                )}
                <span>مشاهده ۶ اثر بیشتر</span>
              </button>
            </div>
          )}

          {!hasMore && expandedItems.length > 0 && (
            <p className="text-center text-zinc-500 text-xs mt-12">تمامی مانهواها با موفقیت بارگذاری شدند.</p>
          )}
        </div>
      ) : (
        /* 2. STANDARD HOMEPAGE VIEW (SLIDER + STACKED CATEGORIES) */
        <div className="pb-16">
          {/* A. HERO CAROUSEL / SLIDER (AUTO-PLAYING AND CONFIGURABLE) */}
          {loading ? (
            <HeroSkeleton />
          ) : (
            sliderItems.length > 0 && (
              <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-2">
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="relative w-full overflow-hidden rounded-3xl bg-zinc-950/90 border border-white/10 group select-none shadow-2xl min-h-[340px] sm:min-h-[380px] md:min-h-[420px] lg:min-h-[460px] flex items-center"
                >
                  {/* Slides Container */}
                  <div className="relative w-full h-full min-h-[340px] sm:min-h-[380px] md:min-h-[420px] lg:min-h-[460px]">
                    <AnimatePresence mode="wait">
                      {sliderItems.map((series, i) => {
                        if (i !== currentSlide) return null;
                        const seriesSlugOrId = series.slug || series.id;
                        const coverImg = series.cover || series.banner;
                        const backdropImg = series.banner || series.cover;
                        const genresList = (Array.isArray(series.genres) 
                          ? series.genres 
                          : (typeof series.genres === "string" ? series.genres.split(",") : [])
                        ).map((g: string) => g.trim()).filter(Boolean);

                        return (
                          <motion.div
                             key={series.id}
                             initial={{ opacity: 0, scale: 0.98 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 1.01 }}
                             transition={{ duration: 0.35, ease: "easeOut" }}
                             className="absolute inset-0 w-full h-full flex items-center overflow-hidden"
                             dir="rtl"
                          >
                            {/* Full-slide clickable Link */}
                            <Link to={`/series/${seriesSlugOrId}`} className="absolute inset-0 z-20 cursor-pointer" />

                            {/* 1. Atmospheric Glowing Backdrop (Vibrant, colorful ambient glow) */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              <img 
                                src={backdropImg} 
                                alt="" 
                                className="w-full h-full object-cover object-center filter blur-2xl scale-125 opacity-35 brightness-110 saturate-150 transform transition-all duration-700" 
                                referrerPolicy="no-referrer"
                                loading="eager"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent"></div>
                              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/60 to-transparent"></div>
                            </div>

                            {/* 2. Slide Content Grid: High-Res Cover Poster Card + Clean Information */}
                            <div className="relative z-25 w-full h-full max-w-7xl mx-auto px-5 sm:px-10 md:px-14 py-6 flex flex-row items-center justify-between gap-4 sm:gap-8 md:gap-12 pointer-events-none">
                              
                              {/* Right Side: Series Details & Action (RTL) */}
                              <div className="flex-1 flex flex-col justify-center text-right items-start max-w-xl">
                                
                                {/* Top Badges */}
                                <div className="flex items-center flex-wrap gap-2 mb-2.5 sm:mb-3 pointer-events-auto">
                                  <span className="bg-gradient-to-r from-[var(--color-asura-accent)] to-[#ff843a] text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-[var(--color-asura-accent)]/25 flex items-center gap-1">
                                    <Sparkles size={12} />
                                    {series.type || "مانهوا"}
                                  </span>
                                  {series.isHero && (
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full">
                                      ★ برگزیده
                                    </span>
                                  )}
                                  {genresList.slice(0, 2).map((g: string) => (
                                    <span key={g} className="bg-black/60 backdrop-blur-md text-zinc-300 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-white/10">
                                      {g}
                                    </span>
                                  ))}
                                </div>

                                {/* Title */}
                                <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-white mb-2 sm:mb-3 leading-snug line-clamp-2 drop-shadow-lg">
                                  {series.title}
                                </h1>

                                {/* Meta stats */}
                                <div className="flex items-center gap-3 text-xs text-zinc-300 mb-3 sm:mb-4 font-medium flex-wrap">
                                  {series.rating && (
                                    <span className="flex items-center gap-1 text-amber-400 font-bold bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 text-xs">
                                      <Star size={13} className="fill-amber-400" />
                                      {series.rating}
                                    </span>
                                  )}
                                  {series.status && (
                                    <span className="text-zinc-300 text-[11px] sm:text-xs bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                      وضعیت: <span className="text-white font-bold">{series.status === 'Ongoing' ? 'در حال انتشار' : series.status === 'Completed' ? 'تکمیل شده' : series.status}</span>
                                    </span>
                                  )}
                                </div>

                                {/* Description (Shortened, elegant) */}
                                {series.description && (
                                  <p className="text-xs sm:text-sm text-zinc-300/90 line-clamp-2 mb-4 sm:mb-6 max-w-lg leading-relaxed hidden sm:block">
                                    {series.description}
                                  </p>
                                )}

                                {/* CTA Button */}
                                <div className="flex items-center gap-3 pointer-events-auto pt-1">
                                  <Link 
                                    to={`/series/${seriesSlugOrId}`} 
                                    className="bg-gradient-to-r from-[var(--color-asura-accent)] to-[#ff843a] hover:opacity-90 active:scale-95 text-white px-5 py-2.5 sm:px-7 sm:py-3 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-xl shadow-[var(--color-asura-accent)]/30 flex items-center gap-2"
                                  >
                                    <span>شروع خواندن</span>
                                    <ChevronLeft size={16} />
                                  </Link>
                                </div>

                              </div>

                              {/* Left Side: Gorgeous Full Cover Poster Card (100% Crisp Artwork Showcase) */}
                              <div className="shrink-0 pointer-events-auto relative group/card">
                                <Link 
                                  to={`/series/${seriesSlugOrId}`}
                                  className="block relative w-[110px] sm:w-[150px] md:w-[200px] lg:w-[230px] aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border-2 border-white/20 hover:border-[var(--color-asura-accent)] transition-all duration-300 hover:scale-105"
                                >
                                  <img 
                                    src={coverImg} 
                                    alt={series.title} 
                                    className="w-full h-full object-cover object-center"
                                    referrerPolicy="no-referrer"
                                    loading="eager"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-end justify-center p-3">
                                    <span className="text-[11px] font-black text-white bg-[var(--color-asura-accent)] px-3 py-1 rounded-full shadow-lg">
                                      مشاهده اثر
                                    </span>
                                  </div>
                                </Link>
                              </div>

                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Prev / Next Navigation Arrows */}
                  <button 
                    onClick={handlePrevSlide}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-11 sm:h-11 bg-black/60 hover:bg-[var(--color-asura-accent)] active:scale-90 text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/10 backdrop-blur-md shadow-xl cursor-pointer"
                    title="اسلاید قبلی"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={handleNextSlide}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-11 sm:h-11 bg-black/60 hover:bg-[var(--color-asura-accent)] active:scale-90 text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/10 backdrop-blur-md shadow-xl cursor-pointer"
                    title="اسلاید بعدی"
                  >
                    <ChevronRight size={20} />
                  </button>

                  {/* Slide Indicators */}
                  <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    {sliderItems.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${idx === currentSlide ? "w-6 bg-[var(--color-asura-accent)]" : "w-2 bg-white/30 hover:bg-white/60"}`}
                        title={`اسلاید ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {/* B. CATEGORY SECTIONS LISTS */}
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col gap-12" dir="rtl">
            
            {/* I. NEWEST SECTION (جدیدترین‌ها) */}
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-md md:text-lg font-black text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-[var(--color-asura-accent)] rounded-full"></span>
                  جدیدترین‌ها
                </h2>
                {latestList.length > 7 && (
                  <button 
                    onClick={() => handleExpandSection("latest")}
                    className="text-xs font-bold text-[var(--color-asura-accent)] hover:text-white transition-colors"
                  >
                    نمایش بیشتر &larr;
                  </button>
                )}
              </div>

              {/* Horizontal Scroll content */}
              <div className="flex overflow-x-auto gap-5 pb-5 pt-1 scrollbar-none snap-x snap-mandatory text-right [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loading ? (
                  Array(7).fill(0).map((_, i) => (
                    <div key={i} className="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 aspect-[3/4] rounded-2xl bg-white/5 border border-white/5 animate-pulse overflow-hidden">
                      <div className="h-2/3 bg-zinc-800"></div>
                      <div className="p-3.5 flex flex-col gap-2.5">
                        <div className="h-3.5 bg-zinc-700 rounded w-2/3"></div>
                        <div className="h-2 bg-zinc-800 rounded w-full"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  latestList.slice(0, 7).map((series, idx) => (
                    <SeriesCard 
                      key={series.id} 
                      series={series} 
                      widthClass="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start" 
                    />
                  ))
                )}

                {/* Show Expand Card if more than 7 items exist */}
                {!loading && latestList.length > 7 && (
                  <motion.div
                    onClick={() => handleExpandSection("latest")}
                    className="bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer group hover:bg-[var(--color-asura-accent)]/5 hover:border-[var(--color-asura-accent)]/40 transition-all duration-300 w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start h-auto aspect-[3/4]"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--color-asura-accent)]/10 transition-colors mb-2">
                      <ChevronRight size={18} className="text-zinc-400 group-hover:text-[var(--color-asura-accent)]" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 group-hover:text-[var(--color-asura-accent)]">مشاهده همه</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* II. MOST VIEWED SECTION (پربازدیدترین‌ها) */}
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-md md:text-lg font-black text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                  پربازدیدترین‌ها
                </h2>
                {viewsList.length > 7 && (
                  <button 
                    onClick={() => handleExpandSection("views")}
                    className="text-xs font-bold text-[var(--color-asura-accent)] hover:text-white transition-colors"
                  >
                    نمایش بیشتر &larr;
                  </button>
                )}
              </div>

              {/* Horizontal Scroll content */}
              <div className="flex overflow-x-auto gap-5 pb-5 pt-1 scrollbar-none snap-x snap-mandatory text-right [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loading ? (
                  Array(7).fill(0).map((_, i) => (
                    <div key={i} className="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 aspect-[3/4] rounded-2xl bg-white/5 border border-white/5 animate-pulse overflow-hidden">
                      <div className="h-2/3 bg-zinc-800"></div>
                      <div className="p-3.5 flex flex-col gap-2.5">
                        <div className="h-3.5 bg-zinc-700 rounded w-2/3"></div>
                        <div className="h-2 bg-zinc-800 rounded w-full"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  viewsList.slice(0, 7).map((series, idx) => (
                    <SeriesCard 
                      key={series.id} 
                      series={series} 
                      widthClass="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start" 
                    />
                  ))
                )}

                {/* Show Expand Card if more than 7 items exist */}
                {!loading && viewsList.length > 7 && (
                  <motion.div
                    onClick={() => handleExpandSection("views")}
                    className="bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer group hover:bg-[var(--color-asura-accent)]/5 hover:border-[var(--color-asura-accent)]/40 transition-all duration-300 w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start h-auto aspect-[3/4]"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--color-asura-accent)]/10 transition-colors mb-2">
                      <ChevronRight size={18} className="text-zinc-400 group-hover:text-[var(--color-asura-accent)]" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 group-hover:text-[var(--color-asura-accent)]">مشاهده همه</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* III. MOST POPULAR SECTION (محبوب‌ترین‌ها) */}
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-md md:text-lg font-black text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
                  محبوب‌ترین‌ها
                </h2>
                {popularList.length > 7 && (
                  <button 
                    onClick={() => handleExpandSection("popular")}
                    className="text-xs font-bold text-[var(--color-asura-accent)] hover:text-white transition-colors"
                  >
                    نمایش بیشتر &larr;
                  </button>
                )}
              </div>

              {/* Horizontal Scroll content */}
              <div className="flex overflow-x-auto gap-5 pb-5 pt-1 scrollbar-none snap-x snap-mandatory text-right [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loading ? (
                  Array(7).fill(0).map((_, i) => (
                    <div key={i} className="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 aspect-[3/4] rounded-2xl bg-white/5 border border-white/5 animate-pulse overflow-hidden">
                      <div className="h-2/3 bg-zinc-800"></div>
                      <div className="p-3.5 flex flex-col gap-2.5">
                        <div className="h-3.5 bg-zinc-700 rounded w-2/3"></div>
                        <div className="h-2 bg-zinc-800 rounded w-full"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  popularList.slice(0, 7).map((series, idx) => (
                    <SeriesCard 
                      key={series.id} 
                      series={series} 
                      widthClass="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start" 
                    />
                  ))
                )}

                {/* Show Expand Card if more than 7 items exist */}
                {!loading && popularList.length > 7 && (
                  <motion.div
                    onClick={() => handleExpandSection("popular")}
                    className="bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer group hover:bg-[var(--color-asura-accent)]/5 hover:border-[var(--color-asura-accent)]/40 transition-all duration-300 w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start h-auto aspect-[3/4]"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--color-asura-accent)]/10 transition-colors mb-2">
                      <ChevronRight size={18} className="text-zinc-400 group-hover:text-[var(--color-asura-accent)]" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 group-hover:text-[var(--color-asura-accent)]">مشاهده همه</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* IV. OLDEST SECTION (قدیمی‌ترین آثار) */}
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-md md:text-lg font-black text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-zinc-600 rounded-full"></span>
                  قدیمی‌ترین آثار
                </h2>
                {oldestList.length > 7 && (
                  <button 
                    onClick={() => handleExpandSection("oldest")}
                    className="text-xs font-bold text-[var(--color-asura-accent)] hover:text-white transition-colors"
                  >
                    نمایش بیشتر &larr;
                  </button>
                )}
              </div>

              {/* Horizontal Scroll content */}
              <div className="flex overflow-x-auto gap-5 pb-5 pt-1 scrollbar-none snap-x snap-mandatory text-right [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loading ? (
                  Array(7).fill(0).map((_, i) => (
                    <div key={i} className="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 aspect-[3/4] rounded-2xl bg-white/5 border border-white/5 animate-pulse overflow-hidden">
                      <div className="h-2/3 bg-zinc-800"></div>
                      <div className="p-3.5 flex flex-col gap-2.5">
                        <div className="h-3.5 bg-zinc-700 rounded w-2/3"></div>
                        <div className="h-2 bg-zinc-800 rounded w-full"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  oldestList.slice(0, 7).map((series, idx) => (
                    <SeriesCard 
                      key={series.id} 
                      series={series} 
                      widthClass="w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start" 
                    />
                  ))
                )}

                {/* Show Expand Card if more than 7 items exist */}
                {!loading && oldestList.length > 7 && (
                  <motion.div
                    onClick={() => handleExpandSection("oldest")}
                    className="bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer group hover:bg-[var(--color-asura-accent)]/5 hover:border-[var(--color-asura-accent)]/40 transition-all duration-300 w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start h-auto aspect-[3/4]"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--color-asura-accent)]/10 transition-colors mb-2">
                      <ChevronRight size={18} className="text-zinc-400 group-hover:text-[var(--color-asura-accent)]" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 group-hover:text-[var(--color-asura-accent)]">مشاهده همه</span>
                  </motion.div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}
