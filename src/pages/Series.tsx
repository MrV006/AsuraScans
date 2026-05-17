import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSeriesOverview } from '../hooks/useSeries';
import { useBookmarks, useHistory } from '../hooks/useUserActivity';
import { useRatings } from '../hooks/useRatings';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Star, Clock, Heart, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { Comments } from '../components/Comments';
import { formatDistanceToNow } from 'date-fns';
import { SeriesDetailSkeleton } from '../components/Skeletons';

export default function Series() {
  const { id } = useParams();
  const { user } = useAuth();
  const { series, loading } = useSeriesOverview(id);
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { getHistoryForSeries } = useHistory();
  const { averageRating, userRating, submitRating, loading: ratingsLoading } = useRatings(id);

  const [hoverRating, setHoverRating] = useState(0);

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
          <p className="text-xl font-bold uppercase tracking-widest text-red-500">Series not found</p>
          <Link to="/" className="text-sm text-zinc-400 hover:text-white underline">Return Home</Link>
        </div>
      </Layout>
    );
  }

  const bookmarked = isBookmarked(id);
  const history = getHistoryForSeries(id);

  const handleBookmarkToggle = () => {
    if (!user) {
      alert("Please log in to bookmark series.");
      return;
    }
    if (bookmarked) {
      removeBookmark(id);
    } else {
      addBookmark(id);
    }
  };

  // Filter out scheduled chapters
  const now = new Date();
  const publishedChapters = series.chapters?.filter(ch => {
    if (!ch.publishAt) return true;
    return new Date(ch.publishAt) <= now;
  }) || [];

  // Find the first chapter to read, or the last read chapter if history exists
  const firstChapter = publishedChapters.length > 0 ? publishedChapters[publishedChapters.length - 1] : null;
  const readLink = history ? `/reader/${id}/${history.chapterId}` : (firstChapter ? `/reader/${id}/${firstChapter.id}` : '#');
  const readText = history ? `Continue Reading (Ch. ${history.chapterNumber})` : 'Start Reading';

  return (
    <Layout>
      {/* Banner Area */}
      <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden bg-[var(--color-asura-dark)]">
        <img 
          src={series.banner} 
          alt={series.title} 
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-asura-dark)] via-[var(--color-asura-dark)]/80 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-asura-dark)] via-transparent to-transparent"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-32 md:-mt-48 relative z-10 pb-12">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column - Poster & CTA */}
          <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black border border-white/10"
            >
              <img src={series.cover} alt={series.title} className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-[var(--color-asura-accent)] text-white text-xs font-bold px-2 py-1 rounded shadow">
                {series.type}
              </div>
            </motion.div>
            
            <div className="mt-6 flex flex-col gap-3">
              <Link to={readLink} className="w-full py-2 bg-white text-black rounded-lg font-bold text-sm uppercase text-center flex justify-center items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg">
                <Play size={16} fill="currentColor" />
                {readText}
              </Link>
              <button 
                onClick={handleBookmarkToggle}
                className={`w-full py-2 backdrop-blur-md rounded-lg font-bold text-sm uppercase text-center flex justify-center items-center gap-2 transition-colors border ${bookmarked ? 'bg-[var(--color-asura-accent)]/20 hover:bg-[var(--color-asura-accent)]/30 text-[var(--color-asura-accent-light)] border-[var(--color-asura-accent)]/50' : 'bg-white/10 hover:bg-white/20 text-white border-white/5'}`}
              >
                <Heart size={16} className={bookmarked ? 'fill-current' : ''} />
                {bookmarked ? 'Bookmarked' : 'Bookmark Series'}
              </button>
            </div>
          </div>

          {/* Right Column - Info */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 pt-4 md:pt-16"
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {series.genres.map(g => (
                <span key={g} className="text-[10px] font-bold text-zinc-300 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded uppercase tracking-wider">
                  {g}
                </span>
              ))}
              {series.tags && series.tags.map(t => (
                <span key={t} className="text-[10px] font-bold text-[var(--color-asura-accent-light)] bg-[var(--color-asura-accent)]/10 border border-[var(--color-asura-accent)]/20 px-2.5 py-0.5 rounded tracking-wider italic">
                  #{t}
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
                          onClick={() => submitRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star 
                            size={18} 
                            fill={star <= (hoverRating || userRating || 0) ? "currentColor" : "none"} 
                            className={star <= (hoverRating || userRating || 0) ? "text-[var(--color-asura-accent-light)]" : "text-zinc-600"} 
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!user && <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Log in to rate</span>}
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <div className="flex flex-col">
                  <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Status</span>
                  <span className="font-bold text-[var(--color-asura-accent-light)] text-xs uppercase">{series.status}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Author</span>
                  <span className="font-bold text-white text-xs">{series.author}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Artist</span>
                  <span className="font-bold text-white text-xs">{series.artist}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-asura-accent)]/5 rounded-full blur-3xl"></div>
              <h3 className="text-xs font-black mb-3 text-white uppercase tracking-widest">Synopsis</h3>
              <p className="text-zinc-400 leading-relaxed max-w-4xl text-xs md:text-sm">
                {series.synopsis}
              </p>
            </div>

            {/* Chapters List */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                  <span className="w-1 h-5 bg-[var(--color-asura-accent)] rounded-full"></span>Chapters
                </h2>
                <span className="text-xs font-bold text-zinc-500">{publishedChapters.length} Total</span>
              </div>
              
              <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl divide-y divide-white/5 overflow-hidden max-h-[600px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                {publishedChapters.map((ch) => (
                  <Link 
                    key={ch.id} 
                    to={`/reader/${series.id}/${ch.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black/40 border border-white/5 rounded flex items-center justify-center shrink-0 group-hover:border-[var(--color-asura-accent)]/30 transition-colors">
                        <span className="font-black text-white text-lg">{ch.number}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-200 group-hover:text-[var(--color-asura-accent)] transition-colors">
                          {ch.title || `Chapter ${ch.number}`}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] text-zinc-500 italic">
                             {ch.createdAt?.toDate ? formatDistanceToNow(ch.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                           </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Comments Section */}
            <Comments seriesId={series.id} />

          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
