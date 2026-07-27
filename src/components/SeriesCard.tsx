import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star, BookOpen, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { Series } from '../lib/types';

interface SeriesCardProps {
  series: Series;
  className?: string;
  widthClass?: string;
  key?: React.Key;
}

export function SeriesCard({ series, className = '', widthClass = '' }: SeriesCardProps) {
  const navigate = useNavigate();
  const [isTouched, setIsTouched] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Navigate to series details page
    navigate(`/series/${series.id || series.slug}`);
  };

  const handleChapterClick = (e: React.MouseEvent, chapterId: string) => {
    e.stopPropagation(); // Stop event bubbling so it navigates to reader instead of series page
  };

  const handlePosterTouchStart = (e: React.TouchEvent) => {
    // Enable overlay on touch device
    setIsTouched(true);
  };

  const handlePosterTouchEnd = (e: React.TouchEvent) => {
    // Keeps touched active for 3 seconds or toggles
  };

  const totalChaps = series.totalChapters !== undefined ? series.totalChapters : (series.chaptersCount !== undefined ? series.chaptersCount : (series.chapters ? series.chapters.length : 0));
  const latestChapter = series.chapters && series.chapters.length > 0 ? series.chapters[0] : null;

  const displayRating = (typeof series.rating === 'number' && !isNaN(series.rating) && series.rating > 0)
    ? Number(series.rating).toFixed(1)
    : (series.rating && Number(series.rating) > 0 ? Number(series.rating).toFixed(1) : '0.0');

  return (
    <div
      onClick={handleCardClick}
      onTouchStart={handlePosterTouchStart}
      className={`bg-zinc-900/80 border border-white/5 rounded-2xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/50 transition-all duration-300 hover:-translate-y-1.5 shadow-xl relative cursor-pointer select-none ${widthClass} ${className}`}
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {/* Poster Container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-950 select-none">
        <img
          src={series.cover}
          alt={series.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none"></div>

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-center z-10 pointer-events-none">
          {/* Total Chapters Badge */}
          <div className="bg-black/75 backdrop-blur-md border border-white/10 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-md">
            <BookOpen size={11} className="text-amber-400" />
            <span>{totalChaps} چپتر</span>
          </div>

          {/* Rating Badge */}
          <div className="bg-black/75 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-md">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="font-sans">{displayRating}</span>
          </div>
        </div>

        {/* HOVER & TOUCH OVERLAY (Synopsis & Details) */}
        <div 
          className={`absolute inset-0 z-20 p-3.5 bg-gradient-to-b from-zinc-950/95 via-zinc-950/90 to-black/95 backdrop-blur-md transition-all duration-300 ease-out flex flex-col justify-between text-right select-none ${
            isTouched ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto'
          }`} 
          dir="rtl"
        >
          <div>
            {/* Header / Type */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-asura-accent-light)] bg-[var(--color-asura-accent)]/15 px-2 py-0.5 rounded-md border border-[var(--color-asura-accent)]/30">
                {series.type || 'مانهوا'}
              </span>
              <span className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                {displayRating}
              </span>
            </div>

            {/* Title */}
            <h4 className="text-xs font-black text-white line-clamp-2 leading-snug mb-2 group-hover:text-[var(--color-asura-accent-light)] transition-colors">
              {series.title}
            </h4>

            {/* Synopsis / Summary */}
            <div className="mt-1">
              <p className="text-[10px] text-amber-400/90 font-bold mb-1 flex items-center gap-1">
                <Sparkles size={10} />
                خلاصه داستان:
              </p>
              <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-5 font-normal">
                {series.synopsis || 'خلاصه داستانی برای این اثر ثبت نشده است.'}
              </p>
            </div>
          </div>

          <div>
            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {series.genres.slice(0, 3).map((g, idx) => (
                  <span key={idx} className="text-[9px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Action Button */}
            <button className="w-full py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg">
              <span>مشاهده کامل اثر</span>
              <ArrowLeft size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info (Visible when not hovering) */}
      <div className="p-3.5 flex-grow flex flex-col justify-between bg-[var(--color-asura-card)] select-none">
        <h3 className="text-xs font-black text-white line-clamp-1 group-hover:text-[var(--color-asura-accent-light)] transition-colors mb-2.5">
          {series.title}
        </h3>

        {/* Bottom Chapter indicator */}
        <div className="pt-2 border-t border-[var(--color-asura-border)]/60 flex items-center justify-between text-[10px] text-zinc-400" dir="rtl">
          {latestChapter ? (
            <Link
              to={`/reader/${series.id}/${latestChapter.id}`}
              onClick={(e) => handleChapterClick(e, latestChapter.id)}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-[var(--color-asura-accent-light)] transition-colors bg-white/5 px-2 py-1 rounded-lg border border-white/5 font-bold"
            >
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              <span>چپتر {latestChapter.number}</span>
            </Link>
          ) : (
            <span className="text-[10px] text-zinc-500 italic">بدون چپتر</span>
          )}

          <span className="text-[10px] text-zinc-400 font-bold bg-black/40 px-2 py-0.5 rounded-md">
            {totalChaps} چپتر
          </span>
        </div>
      </div>
    </div>
  );
}
