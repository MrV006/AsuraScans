import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Navigate, Link } from 'react-router-dom';
import { Settings, Bookmark, MessageSquare, Heart, Clock } from 'lucide-react';
import { useState } from 'react';
import { seedDatabase } from '../lib/seed';
import { useBookmarks, useHistory } from '../hooks/useUserActivity';
import { formatDistanceToNow } from 'date-fns';

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const { bookmarks, loading: bookmarksLoading, removeBookmark } = useBookmarks();
  const { history, loading: historyLoading } = useHistory();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history' | 'comments' | 'settings'>('bookmarks');

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center flex-col gap-4 items-center h-96">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-[var(--color-asura-dark)] overflow-hidden mb-4 border-2 border-[var(--color-asura-border)]">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-[var(--color-asura-accent)] text-white">
                    {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <h1 className="text-xl font-bold text-white mb-1 text-center truncate w-full">{profile?.displayName || 'User'}</h1>
              <p className="text-xs text-zinc-500 mb-6 truncate w-full text-center">{user.email}</p>

              <div className="w-full flex flex-col gap-2">
                <button 
                  onClick={() => setActiveTab('bookmarks')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === 'bookmarks' ? 'bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/30' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Bookmark size={16} /> Bookmarks
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === 'history' ? 'bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/30' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Clock size={16} /> History
                </button>
                <button 
                  onClick={() => setActiveTab('comments')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === 'comments' ? 'bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/30' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <MessageSquare size={16} /> Comments
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors uppercase tracking-wider ${activeTab === 'settings' ? 'bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/30' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Settings size={16} /> Settings
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-[var(--color-asura-accent)] rounded-full"></span>
              {activeTab === 'bookmarks' && 'My Bookmarks'}
              {activeTab === 'history' && 'Reading History'}
              {activeTab === 'comments' && 'My Comments'}
              {activeTab === 'settings' && 'Profile Settings'}
            </h2>

            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 min-h-[400px]">
              {activeTab === 'bookmarks' && (
                bookmarksLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
                  </div>
                ) : bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                    <Heart size={48} className="mb-4 text-zinc-700" />
                    <p>You haven't bookmarked any series yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {bookmarks.map(bz => bz.seriesData ? (
                      <div key={bz.seriesId} className="group relative rounded-xl overflow-hidden bg-black/40 border border-white/5">
                        <Link to={`/series/${bz.seriesId}`}>
                          <div className="aspect-[3/4] relative">
                            <img src={bz.seriesData.cover} alt={bz.seriesData.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent opacity-90"></div>
                            <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-white uppercase backdrop-blur-sm border border-white/10">
                              {bz.seriesData.type}
                            </div>
                          </div>
                          <div className="p-3 absolute bottom-0 left-0 right-0">
                            <h3 className="font-bold text-white text-sm line-clamp-1">{bz.seriesData.title}</h3>
                          </div>
                        </Link>
                        <button 
                          onClick={(e) => { e.preventDefault(); removeBookmark(bz.seriesId); }}
                          className="absolute top-2 left-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors z-10 shadow-lg backdrop-blur-sm"
                          title="Remove Bookmark"
                        >
                          <Bookmark size={14} fill="currentColor" />
                        </button>
                      </div>
                    ) : null)}
                  </div>
                )
              )}
              {activeTab === 'history' && (
                historyLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                    <Clock size={48} className="mb-4 text-zinc-700" />
                    <p>Your reading history is empty.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map(h => h.seriesData ? (
                      <Link 
                        key={h.seriesId} 
                        to={`/reader/${h.seriesId}/${h.chapterId}`}
                        className="flex items-center gap-4 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl p-3 transition-colors group"
                      >
                         <img src={h.seriesData.cover} alt={h.seriesData.title} className="w-16 h-20 object-cover rounded-md shadow-lg" />
                         <div className="flex-1 min-w-0">
                           <h3 className="font-bold text-white text-sm md:text-base line-clamp-1 group-hover:text-[var(--color-asura-accent)] transition-colors">{h.seriesData.title}</h3>
                           <p className="text-zinc-400 text-xs mt-1">Read Chapter {h.chapterNumber}</p>
                           {h.updatedAt?.toDate && (
                             <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-wider font-bold">
                               {formatDistanceToNow(h.updatedAt.toDate(), { addSuffix: true })}
                             </p>
                           )}
                         </div>
                      </Link>
                    ) : null)}
                  </div>
                )
              )}
              {activeTab === 'comments' && (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <MessageSquare size={48} className="mb-4 text-zinc-700" />
                  <p>You haven't posted any comments yet.</p>
                </div>
              )}
              {activeTab === 'settings' && (
                <div className="max-w-lg">
                  <div className="mb-6">
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Display Name</label>
                    <input 
                      type="text" 
                      defaultValue={profile?.displayName || ''}
                      className="w-full bg-black/40 border border-[var(--color-asura-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                    />
                  </div>
                  <div className="mb-6">
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Avatar URL</label>
                    <input 
                      type="text" 
                      defaultValue={profile?.avatarUrl || ''}
                      className="w-full bg-black/40 border border-[var(--color-asura-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                    />
                  </div>
                  <button className="px-6 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-lg font-bold text-sm uppercase tracking-wider transition-colors shadow-lg">
                    Save Changes
                  </button>
                  
                  <div className="mt-12 pt-8 border-t border-[var(--color-asura-border)]">
                    <h3 className="text-sm font-black text-red-500 uppercase tracking-widest mb-4">Admin Tools</h3>
                    <button 
                      onClick={() => seedDatabase()}
                      className="px-6 py-2 bg-red-900/20 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
                    >
                      Seed Demo Content
                    </button>
                    <p className="text-xs text-zinc-500 mt-2">Only works if your UID is in the `/admins` Firestore collection.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
