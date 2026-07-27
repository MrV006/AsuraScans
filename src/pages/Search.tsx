import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Search as SearchIcon, X, Star, Layers, Sparkles, Check, BookOpen, Filter, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeriesCardSkeleton } from '../components/Skeletons';
import { SeriesCard } from '../components/SeriesCard';
import { apiClient } from '../lib/apiClient';
import { Series } from '../lib/types';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(q);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  const [results, setResults] = useState<Series[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Dynamic filter lists from all series to populate the Bento UI
  const ALL_GENRES = useMemo(() => {
    const list = Array.from(new Set(allSeries.flatMap(s => (Array.isArray(s.genres) ? s.genres : (typeof s.genres === 'string' ? s.genres.split(',') : [])).map(g => g.trim()).filter(Boolean)))).sort();
    return list.length > 0 ? list : ['Action', 'Fantasy', 'Adventure', 'Comedy', 'Drama', 'Martial Arts', 'Rebirth', 'System', 'Magic', 'School Life'];
  }, [allSeries]);

  const ALL_TAGS = useMemo(() => {
    const list = Array.from(new Set(allSeries.flatMap(s => (Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : [])).map(t => t.trim()).filter(Boolean)))).sort();
    return list.length > 0 ? list : ['Overpowered', 'Regression', 'Dungeon', 'Monsters', 'Tower', 'Revenge', 'Leveling', 'Guilds'];
  }, [allSeries]);

  const ALL_STATUSES = useMemo(() => {
    const list = Array.from(new Set(allSeries.map(s => s.status || 'Ongoing'))).sort();
    return list.length > 0 ? list : ['Ongoing', 'Completed', 'Hiatus'];
  }, [allSeries]);

  const ALL_TYPES = useMemo(() => {
    const list = Array.from(new Set(allSeries.map(s => s.type || 'Manhwa'))).sort();
    return list.length > 0 ? list : ['Manhwa', 'Manhua', 'Manga'];
  }, [allSeries]);

  // Load all series once to discover tags, statuses, and genres
  useEffect(() => {
    apiClient.getSeries()
      .then(data => {
        setAllSeries(data);
      })
      .catch(err => console.error("Error loading taxonomy", err));
  }, []);

  // Fetch filtered results from backend whenever filter state changes
  useEffect(() => {
    setSearching(true);
    const delayDebounceFn = setTimeout(() => {
      apiClient.getSeries({
        q: query,
        genres: selectedGenres,
        tags: selectedTags,
        status: selectedStatus,
        type: selectedType,
        sortBy: sortBy
      })
      .then(data => {
        setResults(data);
        setSearching(false);
        setLoading(false);
      })
      .catch(err => {
        console.error("Search failed", err);
        setSearching(false);
        setLoading(false);
      });
    }, 250); // Small debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query, selectedGenres, selectedTags, selectedStatus, selectedType, sortBy]);

  // Update URL query param if main search query is entered
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  }, [query]);

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const toggleTag = (t: string) => {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedTags([]);
    setSelectedStatus('');
    setSelectedType('');
    setQuery('');
  };

  // Pagination for results display
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setPage(1);
  }, [query, selectedGenres, selectedTags, selectedStatus, selectedType, sortBy]);

  const displayedResults = useMemo(() => {
    return results.slice(0, page * itemsPerPage);
  }, [results, page]);

  // Infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && displayedResults.length < results.length) {
          setPage(prev => prev + 1);
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [displayedResults.length, results.length]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12" dir="rtl">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-white/5">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <span className="w-2 h-8 bg-[var(--color-asura-accent)] rounded-full"></span>
              فیلتر و جستجوی پیشرفته مانهوا
            </h1>
            <p className="text-zinc-500 text-xs mt-1.5 font-bold uppercase tracking-wider">
              آرشیو کامل را با فیلترهای چندگانه و هوشمند کاوش کنید
            </p>
          </div>
          
          {(selectedGenres.length > 0 || selectedTags.length > 0 || selectedStatus || selectedType || query) && (
            <button 
              onClick={clearFilters}
              className="mt-4 md:mt-0 px-4 py-2 text-xs font-black uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all duration-200"
            >
              پاک کردن همه فیلترها ({selectedGenres.length + selectedTags.length + (selectedStatus ? 1 : 0) + (selectedType ? 1 : 0)})
            </button>
          )}
        </div>

        {/* Bento Grid Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10">
          
          {/* Bento Card 1: Main Search & Type Selector (6 cols) */}
          <div className="md:col-span-6 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-asura-accent)]/5 rounded-full blur-2xl group-hover:bg-[var(--color-asura-accent)]/10 transition-colors"></div>
            
            <div className="z-10">
              <div className="flex items-center gap-2 mb-3 text-white">
                <SearchIcon className="text-[var(--color-asura-accent-light)]" size={18} />
                <span className="text-xs font-black uppercase tracking-wider">جستجوی متنی</span>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="نام اثر، نام طراح یا نویسنده را تایپ کنید..." 
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-all shadow-inner text-right"
                />
                <SearchIcon className="absolute right-3.5 top-3.5 text-zinc-500" size={16} />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute left-3 top-3.5 text-zinc-500 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 z-10">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2.5">نوع اثر (Type)</span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectedType('')}
                  className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${!selectedType ? 'bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/20' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  همه
                </button>
                {ALL_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${selectedType === t ? 'bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/20' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                  >
                    {t === 'Manhwa' ? 'مانهوا' : t === 'Manga' ? 'مانگا' : t === 'Manhua' ? 'مانها' : t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bento Card 2: Status & Advanced Sorting (6 cols) */}
          <div className="md:col-span-6 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
            
            <div className="z-10">
              <div className="flex items-center gap-2 mb-3 text-white">
                <Layers className="text-[var(--color-asura-accent-light)]" size={18} />
                <span className="text-xs font-black uppercase tracking-wider">وضعیت انتشار</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectedStatus('')}
                  className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${!selectedStatus ? 'bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/20' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  همه وضعیت‌ها
                </button>
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${selectedStatus === s ? 'bg-[var(--color-asura-accent)] text-white border-[var(--color-asura-accent)] shadow-lg shadow-[var(--color-asura-accent)]/20' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                  >
                    {s === 'Ongoing' ? 'درحال انتشار' : s === 'Completed' ? 'پایان یافته' : s === 'Hiatus' ? 'وقفه' : s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 z-10">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2.5">مرتب‌سازی هوشمند نتایج</span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSortBy('newest')}
                  className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${sortBy === 'newest' ? 'bg-zinc-800 text-white border-zinc-700 shadow-lg' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  جدیدترین
                </button>
                <button
                  onClick={() => setSortBy('views')}
                  className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${sortBy === 'views' ? 'bg-zinc-800 text-white border-zinc-700 shadow-lg' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  پربازدیدترین
                </button>
                <button
                  onClick={() => setSortBy('rating')}
                  className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${sortBy === 'rating' ? 'bg-zinc-800 text-white border-zinc-700 shadow-lg' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  محبوب‌ترین
                </button>
                <button
                  onClick={() => setSortBy('oldest')}
                  className={`text-xs font-bold py-2 rounded-xl border transition-all duration-200 ${sortBy === 'oldest' ? 'bg-zinc-800 text-white border-zinc-700 shadow-lg' : 'bg-black/20 text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                >
                  قدیمی‌ترین
                </button>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Genres Selection (Full width Bento Card, 12 cols) */}
          <div className="md:col-span-12 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 text-white">
              <BookOpen className="text-[var(--color-asura-accent-light)]" size={18} />
              <span className="text-xs font-black uppercase tracking-wider">انتخاب ژانرها (امکان انتخاب همزمان چندگانه)</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-2">
              {ALL_GENRES.map(g => {
                const isSelected = selectedGenres.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`text-xs font-bold py-2.5 px-3 rounded-xl border flex items-center justify-between transition-all duration-200 ${isSelected ? 'bg-[var(--color-asura-accent)]/20 border-[var(--color-asura-accent)] text-[var(--color-asura-accent-light)] font-black' : 'bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                  >
                    <span>{g}</span>
                    {isSelected && <Check size={12} className="text-[var(--color-asura-accent-light)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bento Card 4: Tags Selection (Full width Bento Card, 12 cols) */}
          <div className="md:col-span-12 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3.5 text-white">
              <Sparkles className="text-indigo-400" size={18} />
              <span className="text-xs font-black uppercase tracking-wider">برچسب‌ها و موضوعات</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map(t => {
                const isSelected = selectedTags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`text-xs font-bold px-3.5 py-2 rounded-full border transition-all duration-200 flex items-center gap-1.5 ${isSelected ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-md font-black' : 'bg-black/20 text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10'}`}
                  >
                    <span>#{t}</span>
                    {isSelected && <Check size={10} className="text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Results Info Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Filter size={14} className="text-[var(--color-asura-accent-light)]" />
            {searching ? 'در حال جستجو و فیلتر...' : `یافت شده: ${results.length} اثر`}
          </div>
          
          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
            نتایج از سرور مرکزی لود می‌شوند
          </div>
        </div>

        {/* Results Display */}
        {searching && results.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array(10).fill(0).map((_, i) => <SeriesCardSkeleton key={i} />)}
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayedResults.map(s => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
            
            {displayedResults.length < results.length && (
              <div className="mt-12 flex justify-center pb-8" ref={loadMoreRef}>
                <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-lg">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-zinc-600 mb-4">
              <SearchIcon size={32} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">اثری پیدا نشد</h3>
            <p className="text-sm text-zinc-500">فیلترها یا عبارت جستجو را تغییر دهید تا نتایج بهتری پیدا کنید.</p>
            <button 
              onClick={clearFilters} 
              className="mt-6 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-light)] transition-colors rounded-xl shadow-lg"
            >
              پاک کردن فیلترها و شروع مجدد
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
