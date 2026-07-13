import { useSeriesList } from '../hooks/useSeries';
import { Layout } from '../components/Layout';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Star, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { SeriesCardSkeleton, SidebarSkeleton, HeroSkeleton } from '../components/Skeletons';

export default function Home() {
  const { series, loading, error } = useSeriesList();

  if (error) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[50vh] text-red-500">
          Error: {error}
        </div>
      </Layout>
    );
  }

  const heroSeries = loading ? [] : series.filter(s => s.isHero);
  const featured = heroSeries.length > 0 ? heroSeries : (loading ? [] : series.slice(0, 3));
  
  const latestUpdates = loading ? [] : series;

  const featuredSidebar = loading ? [] : series.filter(s => s.isFeatured);
  const topThisWeek = featuredSidebar.length > 0 ? featuredSidebar.slice(0, 5) : (loading ? [] : series.slice(0, 5));

  return (
    <Layout>
      {/* Hero Carousel Area */}
      {loading ? (
        <HeroSkeleton />
      ) : (
        <div className="relative w-full overflow-hidden bg-[var(--color-asura-dark)]">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-asura-dark)]/80 via-transparent to-[var(--color-asura-dark)] z-10 pointer-events-none"></div>
          <div className="flex h-[400px] md:h-[500px]">
            {featured.map((series, i) => (
              <div 
                key={series.id}
                className={`relative w-full h-full flex-shrink-0 transition-opacity duration-1000 ${i === 0 ? 'opacity-100' : 'hidden'}`}
              >
                <img src={series.banner} alt={series.title} className="absolute inset-0 w-full h-full object-cover object-top opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-asura-dark)] to-transparent via-[var(--color-asura-dark)]/50"></div>
                
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 z-20 max-w-7xl mx-auto flex gap-8 items-end">
                  <div className="hidden md:block w-48 h-64 shrink-0 rounded-lg overflow-hidden shadow-2xl shadow-black/80 border border-white/10 relative -bottom-6">
                    <img src={series.cover} alt={series.title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 bg-[var(--color-asura-accent)] text-white text-xs font-bold px-2 py-1 rounded">HOT</div>
                  </div>
                  
                  <div className="flex-1 pb-6 md:pb-12">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {series.genres.slice(0, 3).map(g => (
                        <span key={g} className="bg-[var(--color-asura-accent)] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">{g}</span>
                      ))}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-2 leading-none">
                      {series.title}
                    </h1>
                    <p className="text-zinc-400 text-sm max-w-lg line-clamp-2 md:line-clamp-3 mb-6">
                      {series.synopsis}
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <Link to={`/series/${series.id}`} className="bg-white text-black px-6 py-2 rounded-lg font-bold text-sm uppercase transition-colors">
                        Read Now
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col lg:flex-row gap-8">
        {/* Main Content - Latest Updates */}
        <div className="flex-grow w-full lg:w-2/3 xl:w-3/4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white uppercase tracking-tighter flex items-center gap-2">
              <span className="w-1 h-5 bg-[var(--color-asura-accent)] rounded-full"></span>Latest Updates
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 cursor-pointer">
            {loading ? (
              Array(8).fill(0).map((_, i) => <SeriesCardSkeleton key={i} />)
            ) : (
              latestUpdates.map((series, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={series.id} 
                  className="bg-white/5 border border-white/5 rounded-xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/50 transition-colors"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-[2/3] overflow-hidden bg-zinc-800">
                    <img 
                      src={series.cover} 
                      alt={series.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                    <div className="absolute inset-0 bg-[var(--color-asura-accent)]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    {/* Rating Badge */}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Star size={10} className="text-yellow-500 fill-yellow-500" />
                      {series.rating}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                    <Link to={`/series/${series.id}`} className="text-xs font-bold text-white line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors mb-2">
                      {series.title}
                    </Link>
                    <div className="mt-auto space-y-1.5 pt-2 border-t border-[var(--color-asura-border)]">
                      {series.chapters && series.chapters.slice(0, 2).map((ch) => (
                        <Link 
                          key={ch.id} 
                          to={`/reader/${series.id}/${ch.id}`}
                          className="flex justify-between items-center group/ch"
                        >
                          <span className="text-[10px] text-zinc-400 bg-white/5 group-hover/ch:bg-[var(--color-asura-accent)]/10 px-1.5 py-0.5 rounded border border-white/5 group-hover/ch:border-[var(--color-asura-accent)]/30 transition-colors">
                            Ch. {ch.number}
                          </span>
                          <span className="text-[9px] text-zinc-500 italic">
                            {ch.createdAt?.toDate ? formatDistanceToNow(ch.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar - Popular */}
        <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-6">
           <div className="bg-[var(--color-asura-card)] rounded-2xl p-5 border border-white/5 overflow-hidden flex flex-col h-full">
             <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center justify-between">
               Top This Week
             </h2>
             
             <div className="flex flex-col gap-3 flex-1">
               {loading ? (
                 Array(5).fill(0).map((_, i) => <SidebarSkeleton key={i} />)
               ) : (
                 topThisWeek.map((series, idx) => (
                   <Link to={`/series/${series.id}`} key={series.id} className="flex gap-4 items-center p-2 rounded-lg hover:bg-white/5 transition-colors group">
                     <span className="text-2xl font-black text-white/10 italic w-6 text-right group-hover:text-[var(--color-asura-accent)]/50 transition-colors">
                       0{idx + 1}
                     </span>
                     <div className="w-12 h-16 shrink-0 bg-zinc-800 rounded shadow-lg overflow-hidden relative">
                       <img src={series.cover} className="w-full h-full object-cover" alt={series.title} />
                     </div>
                     
                     <div className="flex-1 min-w-0">
                       <h4 className="text-xs font-bold text-white truncate group-hover:text-[var(--color-asura-accent)] transition-colors">{series.title}</h4>
                       <p className="text-[10px] text-[var(--color-asura-accent-light)] mt-0.5">
                         {series.genres[0]}
                       </p>
                       <div className="flex items-center gap-1 mt-1">
                         <span className="text-[9px] text-yellow-500 tracking-tighter">★★★★★</span>
                         <span className="text-[9px] text-zinc-500">{series.rating}</span>
                       </div>
                     </div>
                   </Link>
                 ))
               )}
             </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
