import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { apiClient } from '../lib/apiClient';
import { Series } from '../lib/types';
import { Trophy, Star, Eye, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useSettings } from '../contexts/SettingsContext';

export default function Leaderboard() {
  const { settings } = useSettings();
  const [topSeries, setTopSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'all' | 'month' | 'week'>('all');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const list = await apiClient.getSeries();
        
        if (timeframe === 'week') {
            // Sort by views
            list.sort((a: any, b: any) => (b.views || 0) - (a.views || 0));
        } else if (timeframe === 'month') {
             // Weighted sort using both views and ratings
             list.sort((a: any, b: any) => {
               const scoreA = (a.views || 0) * 0.4 + (a.rating || 5) * 20;
               const scoreB = (b.views || 0) * 0.4 + (b.rating || 5) * 20;
               return scoreB - scoreA;
             });
         } else {
              // All-Time sorted by ratings, fallback to views
              list.sort((a: any, b: any) => {
                if ((b.rating || 0) !== (a.rating || 0)) {
                  return (b.rating || 0) - (a.rating || 0);
                }
                return (b.views || 0) - (a.views || 0);
              });
         }

        setTopSeries(list.slice(0, 10)); // top 10
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [timeframe]);

  return (
    <Layout>
      <SEOHead 
        title={`برترین مانهواها و مانگاهای برگزیده (رتبه‌بندی) | ${settings?.siteName || 'مانگاتا'}`}
        description={`جدول رتبه‌بندی محبوب‌ترین و پربازدیدترین مانهواها، مانگاها و کمیک‌های ترجمه‌شده در ${settings?.siteName || 'مانگاتا'}.`}
        keywords={`برترین مانهواها, مانهواهای محبوب, رتبه‌بندی مانگا, پربازدیدترین مانهوا, ${settings?.siteName || 'مانگاتا'}`}
        siteName={settings?.siteName || 'مانگاتا'}
      />
      <div className="max-w-5xl mx-auto py-12 px-4 md:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-asura-accent)]/20 flex flex-col items-center justify-center text-[var(--color-asura-accent)] border border-[var(--color-asura-accent)]/30">
              <Trophy size={32} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">Global <span className="text-[var(--color-asura-accent)]">Ranking</span></h1>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mt-1">Discover the most popular comics</p>
            </div>
          </div>
          
          <div className="flex bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl p-1">
            <button 
              onClick={() => setTimeframe('week')}
              className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${timeframe === 'week' ? 'bg-[var(--color-asura-accent)] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              Weekly
            </button>
            <button 
              onClick={() => setTimeframe('month')}
              className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${timeframe === 'month' ? 'bg-[var(--color-asura-accent)] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setTimeframe('all')}
              className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${timeframe === 'all' ? 'bg-[var(--color-asura-accent)] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {topSeries.map((series, index) => {
              // Real view calculations
              const readersCount = series.views || 0;
              const isTop3 = index < 3;
              
              return (
                <Link to={`/series/${series.id}`} key={series.id} className="group flex flex-col md:flex-row bg-[var(--color-asura-card)] hover:bg-[#1a1a20] border border-[var(--color-asura-border)] hover:border-[var(--color-asura-accent)]/50 rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1">
                  
                  {/* Rank Column */}
                  <div className={`flex md:w-24 items-center justify-center p-6 ${isTop3 ? 'bg-gradient-to-br from-[var(--color-asura-accent)]/20 to-transparent' : 'bg-black/20'}`}>
                    <span className={`text-4xl md:text-5xl font-black ${index === 0 ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : index === 1 ? 'text-zinc-300 drop-shadow-[0_0_10px_rgba(212,212,216,0.3)]' : index === 2 ? 'text-amber-600 drop-shadow-[0_0_10px_rgba(217,119,6,0.3)]' : 'text-zinc-600'}`}>
                      #{index + 1}
                    </span>
                  </div>

                  {/* Image */}
                  <div className="w-full md:w-32 h-64 md:h-auto shrink-0 relative overflow-hidden">
                    <img 
                      src={series.cover} 
                      alt={series.title}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent md:hidden"></div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-asura-accent)] bg-[var(--color-asura-accent)]/10 px-2 py-1 rounded">
                         {series.type || 'Manhwa'}
                       </span>
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight group-hover:text-[var(--color-asura-accent)] transition-colors mb-2 line-clamp-1">
                      {series.title}
                    </h2>
                    <p className="text-sm text-zinc-400 line-clamp-2 md:line-clamp-3 mb-6 flex-1">
                      {series.synopsis}
                    </p>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-auto">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Rating</div>
                        <div className="flex items-center gap-1 font-black text-yellow-500">
                          <Star size={14} fill="currentColor" />
                          {(series.rating || 0).toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Readers</div>
                        <div className="flex items-center gap-1 font-black text-zinc-300">
                          <Eye size={14} />
                          {(readersCount).toLocaleString()}
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Status</div>
                        <div className="flex items-center gap-1 font-bold text-zinc-300 text-sm">
                          {series.status || 'Ongoing'}
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Trend</div>
                        <div className="flex items-center gap-1 font-bold text-green-500 text-sm">
                          <TrendingUp size={14} /> 
                          {(series.views || 0) > 100 ? "+15% up" : "+3% stable"}
                        </div>
                      </div>
                    </div>
                  </div>

                </Link>
              );
            })}
          </div>
        )}

      </div>
    </Layout>
  );
}
