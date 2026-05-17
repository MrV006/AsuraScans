import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSeriesList } from '../hooks/useSeries';
import { Search as SearchIcon, Filter, X, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeriesCardSkeleton } from '../components/Skeletons';

export default function Search() {
  const { series, loading, error } = useSeriesList();
  
  const ALL_GENRES = useMemo(() => Array.from(new Set(series.flatMap(s => s.genres || []))).sort(), [series]);
  const ALL_TAGS = useMemo(() => Array.from(new Set(series.flatMap(s => s.tags || []))).sort(), [series]);
  const ALL_STATUSES = useMemo(() => Array.from(new Set(series.map(s => s.status || 'Ongoing'))).sort(), [series]);

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(q);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  const [showFilters, setShowFilters] = useState(true);

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const toggleTag = (t: string) => {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (val.toMillis) return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    return 0;
  };

  const results = useMemo(() => {
    if (loading) return [];
    let filtered = series.filter(s => {
      // Search text (title, author, artist)
      const qLower = query.toLowerCase();
      const matchText = !query || 
                        s.title.toLowerCase().includes(qLower) || 
                        (s.author && s.author.toLowerCase().includes(qLower)) || 
                        (s.artist && s.artist.toLowerCase().includes(qLower));
      
      const matchGenre = selectedGenres.length === 0 || selectedGenres.every(g => (s.genres || []).includes(g));
      const matchTag = selectedTags.length === 0 || selectedTags.every(t => (s.tags || []).includes(t));
      const matchStatus = !selectedStatus || s.status === selectedStatus;

      return matchText && matchGenre && matchTag && matchStatus;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      }
      if (sortBy === 'oldest') {
        return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
      }
      if (sortBy === 'rating' || sortBy === 'views') {
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });

    return filtered;
  }, [series, query, selectedGenres, selectedTags, selectedStatus, sortBy, loading]);

  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setPage(1);
  }, [query, selectedGenres, selectedTags, selectedStatus, sortBy]);

  const displayedResults = useMemo(() => {
    return results.slice(0, page * itemsPerPage);
  }, [results, page]);

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedTags([]);
    setSelectedStatus('');
    setPage(1);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className={`w-full md:w-64 shrink-0 flex flex-col gap-6 ${showFilters ? 'block' : 'hidden md:flex'}`}>
            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Filter size={16} className="text-[var(--color-asura-accent-light)]" />
                  Filters
                </h3>
                {(selectedGenres.length > 0 || selectedTags.length > 0 || selectedStatus) && (
                  <button onClick={clearFilters} className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 transition-colors">
                    Clear
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Status</h4>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                >
                  <option value="">All Statuses</option>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Genres */}
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Genres</h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-colors border ${selectedGenres.includes(g) ? 'bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)]' : 'bg-white/5 text-zinc-400 border-white/5 hover:border-[var(--color-asura-accent)]/50'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Tags & Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_TAGS.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`text-[10px] font-bold px-2 py-1 rounded tracking-wider transition-colors border ${selectedTags.includes(t) ? 'bg-indigo-900/50 text-indigo-200 border-indigo-500/50' : 'bg-transparent text-zinc-500 border-white/10 hover:border-indigo-500/30'}`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search & Results */}
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-[var(--color-asura-accent)] rounded-full"></span>
              Advanced Search
            </h2>

            <div className="flex gap-4 mb-8">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, author, or artist..." 
                  className="w-full bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors shadow-lg"
                />
                <SearchIcon className="absolute left-4 top-3.5 text-zinc-500" size={20} />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-4 top-3.5 text-zinc-500 hover:text-white">
                    <X size={18} />
                  </button>
                )}
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl px-4 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <Filter size={20} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                {loading ? 'Searching...' : `Found ${results.length} series`}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">Sort By</span>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-lg px-3 py-2 text-xs font-bold text-white uppercase tracking-wider focus:outline-none focus:border-[var(--color-asura-accent)]/50 flex-1 sm:flex-none cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="views">Most Viewed</option>
                  <option value="rating">Highest Rating</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array(10).fill(0).map((_, i) => <SeriesCardSkeleton key={i} />)}
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {displayedResults.map(series => (
                    <Link to={`/series/${series.id}`} key={series.id} className="bg-white/5 border border-white/5 rounded-xl overflow-hidden group flex flex-col hover:border-[var(--color-asura-accent)]/50 transition-colors relative h-full">
                      <div className="relative aspect-[2/3] overflow-hidden bg-zinc-800 shrink-0">
                        <img src={series.cover} alt={series.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80"></div>
                        <div className="absolute inset-0 bg-[var(--color-asura-accent)]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Star size={10} className="text-yellow-500 fill-yellow-500" />
                          {series.rating}
                        </div>

                        <div className="absolute bottom-2 left-2 right-2">
                           <div className="flex flex-wrap gap-1 mb-1">
                              {series.genres.slice(0, 2).map(g => (
                                <span key={g} className="bg-[var(--color-asura-accent)] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">{g}</span>
                              ))}
                           </div>
                        </div>
                      </div>
                      <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
                        <h3 className="text-xs font-bold text-white line-clamp-2 group-hover:text-[var(--color-asura-accent)] transition-colors">
                          {series.title}
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1 truncate">
                          {series.author}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {displayedResults.length < results.length && (
                  <div className="mt-8 flex justify-center">
                    <button 
                      onClick={() => setPage(page + 1)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-3 rounded-lg text-sm font-bold text-white uppercase tracking-wider transition-colors"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-zinc-600 mb-4">
                  <SearchIcon size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">No results found</h3>
                <p className="text-sm text-zinc-500">Try adjusting your filters or search query.</p>
                <button onClick={clearFilters} className="mt-6 text-[10px] font-bold uppercase tracking-widest text-[var(--color-asura-accent-light)] hover:text-white transition-colors">
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
