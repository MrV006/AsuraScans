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

      // Helper to fetch and map only the single latest chapter for cleaner UI
      const mapWithChapters = async (list: Series[]) => {
        return Promise.all(list.map(async (s: any) => {
          try {
            const chapters = await apiClient.getChapters(s.id);
            return {
              ...s,
              chapters: Array.isArray(chapters) ? chapters.slice(0, 1) : []
            };
          } catch {
            return { ...s, chapters: [] };
          }
        }));
      };

      const [
        latestWithChapters,
        viewsWithChapters,
        popularWithChapters,
        oldestWithChapters
      ] = await Promise.all([
        mapWithChapters(latest),
        mapWithChapters(views),
        mapWithChapters(popular),
        mapWithChapters(oldest)
      ]);

      setLatestList(latestWithChapters);
      setViewsList(viewsWithChapters);
      setPopularList(popularWithChapters);
      setOldestList(oldestWithChapters);

      // Filter slider items (marked isHero) from all lists combined, or load them
      const allFetched = [...latest, ...views, ...popular, ...oldest];
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
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                key={`${series.id}-expanded-${idx}`}
                className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/40 transition-all duration-300 hover:-translate-y-1 shadow-lg relative cursor-pointer"
              >
                {/* Entire card overlay link */}
                <Link to={`/series/${series.id}`} className="absolute inset-0 z-10" />

                {/* Poster Container */}
                <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                  <img 
                    src={series.cover} 
                    alt={series.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-70"></div>
                  
                  {/* Stats Badge */}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 z-20">
                    <Star size={10} className="text-yellow-500 fill-yellow-500" />
                    <span className="font-sans">{series.rating}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                  <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors mb-3 z-20">
                    {series.title}
                  </h3>

                  {/* Top Chapter display (single latest chapter) */}
                  <div className="mt-auto pt-3 border-t border-[var(--color-asura-border)]/50 relative z-20">
                    {series.chapters && series.chapters.length > 0 ? (
                      <Link 
                        to={`/reader/${series.id}/${series.chapters[0].id}`}
                        className="flex justify-between items-center group/ch hover:text-[var(--color-asura-accent)] transition-colors"
                      >
                        <span className="text-[10px] font-black text-zinc-300 group-hover/ch:text-[var(--color-asura-accent)] transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          چپتر {series.chapters[0].number}
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          {formatChapterDate(series.chapters[0].createdAt)}
                        </span>
                      </Link>
                    ) : (
                      <div className="text-[10px] text-zinc-500 italic text-center w-full">چپتری آپلود نشده است</div>
                    )}
                  </div>
                </div>
              </motion.div>
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
              <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative w-full overflow-hidden bg-[var(--color-asura-dark)] h-[350px] md:h-[480px] border-b border-white/5 group select-none"
              >
                {/* Gradient Overlay for high-end cinematic feel */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-asura-dark)]/40 to-[var(--color-asura-dark)] z-10 pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/85 z-10 pointer-events-none"></div>

                {/* Slides Container */}
                <div className="relative w-full h-full">
                  <AnimatePresence mode="wait">
                    {sliderItems.map((series, i) => {
                      if (i !== currentSlide) return null;
                      return (
                        <motion.div
                           key={series.id}
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           transition={{ duration: 0.8 }}
                           className="absolute inset-0 w-full h-full"
                           dir="rtl"
                        >
                          {/* Full-bleed clickable slide background Link */}
                          <Link to={`/series/${series.id}`} className="absolute inset-0 z-10" />

                          {/* Banner Background - higher opacity on mobile to look vibrant and clear */}
                          <img 
                            src={series.banner || series.cover} 
                            alt={series.title} 
                            className="absolute inset-0 w-full h-full object-cover object-center opacity-55 md:opacity-30 transition-transform duration-1000 scale-105" 
                            referrerPolicy="no-referrer"
                          />
                          
                          {/* Slide details (RTL layout) */}
                          <div className="absolute inset-0 max-w-7xl mx-auto px-6 md:px-12 flex items-center z-20">
                            <div className="flex gap-8 items-center w-full">
                              
                              {/* Poster (md+) */}
                              <div className="hidden md:block w-48 h-64 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative transform hover:scale-[1.02] transition-transform duration-300">
                                <img src={series.cover} alt={series.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute top-3 right-3 bg-[var(--color-asura-accent)] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md">HOT</div>
                              </div>

                              {/* Details */}
                              <div className="flex-1 text-right max-w-2xl">
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {(Array.isArray(series.genres) ? series.genres : (typeof series.genres === "string" ? series.genres.split(",") : [])).slice(0, 3).map(g => (
                                    <span key={g} className="bg-white/10 backdrop-blur-md text-zinc-300 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide border border-white/5">{g.trim()}</span>
                                  ))}
                                </div>
                                <h1 className="text-2xl md:text-5xl font-black text-white mb-4 leading-tight">
                                  {series.title}
                                </h1>
                                <p className="text-zinc-300 md:text-zinc-400 text-xs md:text-sm leading-relaxed mb-6 line-clamp-3">
                                  {series.synopsis}
                                </p>
                                
                                <div className="flex items-center gap-4 relative z-30">
                                  <Link 
                                    to={`/series/${series.id}`} 
                                    className="bg-gradient-to-r from-[var(--color-asura-accent)] to-[#ff843a] hover:opacity-95 text-white px-7 py-3 rounded-xl font-bold text-xs transition-all shadow-lg shadow-[var(--color-asura-accent)]/15"
                                  >
                                    شروع خواندن
                                  </Link>
                                </div>
                              </div>

                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Left / Right Nav Arrows (Visibile on hover) */}
                <button 
                  onClick={handlePrevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/40 hover:bg-[var(--color-asura-accent)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/5"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={handleNextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/40 hover:bg-[var(--color-asura-accent)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/5"
                >
                  <ChevronRight size={20} />
                </button>

                {/* Slide indicator dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2.5 bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/5">
                  {sliderItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? "w-6 bg-[var(--color-asura-accent)]" : "w-2 bg-zinc-500"}`}
                    />
                  ))}
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
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      key={series.id} 
                      className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/30 transition-all duration-300 hover:-translate-y-1 shadow-md w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start relative cursor-pointer"
                    >
                      {/* Entire card overlay link */}
                      <Link to={`/series/${series.id}`} className="absolute inset-0 z-10" />

                      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                        <img 
                          src={series.cover} 
                          alt={series.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-20">
                          <Star size={10} className="text-yellow-500 fill-yellow-500" />
                          <span className="font-sans">{series.rating}</span>
                        </div>
                      </div>

                      <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                        <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors mb-2.5 z-20">
                          {series.title}
                        </h3>
                        <div className="mt-auto pt-2 border-t border-[var(--color-asura-border)]/50 relative z-20">
                          {series.chapters && series.chapters.length > 0 ? (
                            <Link 
                              to={`/reader/${series.id}/${series.chapters[0].id}`}
                              className="flex justify-between items-center group/ch hover:text-[var(--color-asura-accent)] transition-colors w-full"
                            >
                              <span className="text-[10px] font-black text-zinc-300 group-hover/ch:text-[var(--color-asura-accent)] transition-colors flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                چپتر {series.chapters[0].number}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                {formatChapterDate(series.chapters[0].createdAt)}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">بدون چپتر</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
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
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      key={series.id} 
                      className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/30 transition-all duration-300 hover:-translate-y-1 shadow-md w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start relative cursor-pointer"
                    >
                      {/* Entire card overlay link */}
                      <Link to={`/series/${series.id}`} className="absolute inset-0 z-10" />

                      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                        <img 
                          src={series.cover} 
                          alt={series.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-20">
                          <Eye size={10} className="text-blue-400" />
                          <span className="font-sans text-[10px]">{series.views || 0}</span>
                        </div>
                      </div>

                      <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                        <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors mb-2.5 z-20">
                          {series.title}
                        </h3>
                        <div className="mt-auto pt-2 border-t border-[var(--color-asura-border)]/50 relative z-20">
                          {series.chapters && series.chapters.length > 0 ? (
                            <Link 
                              to={`/reader/${series.id}/${series.chapters[0].id}`}
                              className="flex justify-between items-center group/ch hover:text-[var(--color-asura-accent)] transition-colors w-full"
                            >
                              <span className="text-[10px] font-black text-zinc-300 group-hover/ch:text-[var(--color-asura-accent)] transition-colors flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                چپتر {series.chapters[0].number}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                {formatChapterDate(series.chapters[0].createdAt)}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">بدون چپتر</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
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
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      key={series.id} 
                      className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/30 transition-all duration-300 hover:-translate-y-1 shadow-md w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start relative cursor-pointer"
                    >
                      {/* Entire card overlay link */}
                      <Link to={`/series/${series.id}`} className="absolute inset-0 z-10" />

                      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                        <img 
                          src={series.cover} 
                          alt={series.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                        <div className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-20">
                          <Flame size={10} className="text-white fill-white animate-pulse" />
                          <span>ویژه</span>
                        </div>
                      </div>

                      <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                        <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors mb-2.5 z-20">
                          {series.title}
                        </h3>
                        <div className="mt-auto pt-2 border-t border-[var(--color-asura-border)]/50 relative z-20">
                          {series.chapters && series.chapters.length > 0 ? (
                            <Link 
                              to={`/reader/${series.id}/${series.chapters[0].id}`}
                              className="flex justify-between items-center group/ch hover:text-[var(--color-asura-accent)] transition-colors w-full"
                            >
                              <span className="text-[10px] font-black text-zinc-300 group-hover/ch:text-[var(--color-asura-accent)] transition-colors flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                چپتر {series.chapters[0].number}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                {formatChapterDate(series.chapters[0].createdAt)}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">بدون چپتر</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
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
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      key={series.id} 
                      className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/30 transition-all duration-300 hover:-translate-y-1 shadow-md w-[150px] sm:w-[175px] md:w-[190px] shrink-0 snap-start relative cursor-pointer"
                    >
                      {/* Entire card overlay link */}
                      <Link to={`/series/${series.id}`} className="absolute inset-0 z-10" />

                      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                        <img 
                          src={series.cover} 
                          alt={series.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-20">
                          <Clock size={10} className="text-zinc-400" />
                          <span className="font-sans text-[10px]">{new Date(series.createdAt).getFullYear()}</span>
                        </div>
                      </div>

                      <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                        <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors mb-2.5 z-20">
                          {series.title}
                        </h3>
                        <div className="mt-auto pt-2 border-t border-[var(--color-asura-border)]/50 relative z-20">
                          {series.chapters && series.chapters.length > 0 ? (
                            <Link 
                              to={`/reader/${series.id}/${series.chapters[0].id}`}
                              className="flex justify-between items-center group/ch hover:text-[var(--color-asura-accent)] transition-colors w-full"
                            >
                              <span className="text-[10px] font-black text-zinc-300 group-hover/ch:text-[var(--color-asura-accent)] transition-colors flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                چپتر {series.chapters[0].number}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                {formatChapterDate(series.chapters[0].createdAt)}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">بدون چپتر</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
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
