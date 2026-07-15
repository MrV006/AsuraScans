import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Navigate, Link } from 'react-router-dom';
import { Settings, Bookmark, MessageSquare, Heart, Clock, Wallet } from 'lucide-react';
import { useBookmarks, useHistory } from '../hooks/useUserActivity';
import { formatDistanceToNow } from 'date-fns';
import { apiClient, getSocketInstance } from '../lib/apiClient';

export default function Profile() {
  const { user, profile, loading, setShowSetupModal } = useAuth();
  const { bookmarks, loading: bookmarksLoading, removeBookmark } = useBookmarks();
  const { history, loading: historyLoading } = useHistory();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history' | 'comments' | 'settings' | 'wallet'>('bookmarks');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Wallet specific states
  const [dbUser, setDbUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile]);

  // Load backend user info on mount to display wallet balance
  useEffect(() => {
    if (user) {
      apiClient.getUser(user.id || user.uid).then(setDbUser).catch(console.error);
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const userId = user.id || user.uid;
      const uData = await apiClient.getUser(userId);
      setDbUser(uData);
      const txs = await apiClient.getWalletTransactions(userId);
      setTransactions(txs);
    } catch (err) {
      console.error("Failed to load wallet data:", err);
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'wallet') {
      fetchWalletData();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id || user.uid;
    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data.userId === userId) {
        setDbUser(prev => prev ? { ...prev, walletBalance: data.balance } : { walletBalance: data.balance });
        apiClient.getWalletTransactions(userId).then(setTransactions).catch(console.error);
      }
    };
    
    const socketEventName = `wallet:updated:${userId}`;
    socket.on(socketEventName, handleUpdate);
    return () => {
      socket.off(socketEventName, handleUpdate);
    };
  }, [user]);

  // Category filters for Bookmarks & History
  const [bookmarkTypeFilter, setBookmarkTypeFilter] = useState<'all' | 'مانهوا' | 'مانگا' | 'مانها'>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'مانهوا' | 'مانگا' | 'مانها'>('all');

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("حجم تصویر باید کمتر از ۱ مگابایت باشد.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const userId = user.id || user.uid;
      // Sync to backend SQL/JSON database
      await apiClient.saveUser({
        id: userId,
        email: user.email || '',
        displayName: displayName || 'کاربر مهمان',
        avatarUrl: avatarUrl || '',
        firstName,
        lastName,
        phoneNumber
      });

      alert("حساب کاربری با موفقیت بروزرسانی شد!");
    } catch (e: any) {
      alert("خطا در بروزرسانی اطلاعات: " + e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // -------------------------------------------------------------
  // Filtered Bookmarks selector
  // -------------------------------------------------------------
  const getFilteredBookmarks = () => {
    return bookmarks.filter(bz => {
      if (!bz.seriesData) return false;
      if (bookmarkTypeFilter === 'all') return true;
      const type = bz.seriesData.type?.toLowerCase();
      if (bookmarkTypeFilter === 'مانهوا' && (type === 'manhwa' || type === 'مانهوا')) return true;
      if (bookmarkTypeFilter === 'مانگا' && (type === 'manga' || type === 'مانگا')) return true;
      if (bookmarkTypeFilter === 'مانها' && (type === 'manhua' || type === 'مانها')) return true;
      return false;
    });
  };

  // -------------------------------------------------------------
  // Grouped and Filtered History builder
  // -------------------------------------------------------------
  const getGroupedHistory = () => {
    const filtered = history.filter(h => {
      if (!h.seriesData) return false;
      if (historyTypeFilter === 'all') return true;
      const type = h.seriesData.type?.toLowerCase();
      if (historyTypeFilter === 'مانهوا' && (type === 'manhwa' || type === 'مانهوا')) return true;
      if (historyTypeFilter === 'مانگا' && (type === 'manga' || type === 'مانگا')) return true;
      if (historyTypeFilter === 'مانها' && (type === 'manhua' || type === 'مانها')) return true;
      return false;
    });

    const today: typeof history = [];
    const yesterday: typeof history = [];
    const older: typeof history = [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    filtered.forEach(item => {
      if (!item.updatedAt) {
        older.push(item);
        return;
      }
      const date = new Date(item.updatedAt);
      const isToday = date.toDateString() === now.toDateString();
      const yesterdayDate = new Date(now.getTime() - oneDay);
      const isYesterday = date.toDateString() === yesterdayDate.toDateString();

      if (isToday) {
        today.push(item);
      } else if (isYesterday) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    });

    return { today, yesterday, older, totalCount: filtered.length };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center flex-col gap-4 items-center h-96" dir="rtl">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-bold text-xs">در حال بارگذاری پروفایل کاربری...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const { today, yesterday, older, totalCount } = getGroupedHistory();
  const filteredBookmarks = getFilteredBookmarks();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 text-right" dir="rtl">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-72 shrink-0">
            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-[var(--color-asura-dark)] overflow-hidden mb-4 border-2 border-[var(--color-asura-border)] shadow-xl relative group">
                {profile?.avatarUrl ? (
                   <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black bg-gradient-to-tr from-[var(--color-asura-accent)] to-[var(--color-asura-accent-light)] text-white">
                    {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <h1 className="text-lg font-black text-white mb-1 text-center truncate w-full">
                {profile?.displayName || 'کاربر آسورا'}
              </h1>
              <p className="text-[11px] font-mono text-zinc-500 mb-2 truncate w-full text-center">{user.email}</p>
              {profile?.melliCode && (
                <div className="bg-[var(--color-asura-accent)]/10 border border-[var(--color-asura-accent)]/20 px-3 py-1.5 rounded-full text-center mb-6">
                  <span className="text-[10px] font-black text-[var(--color-asura-accent-light)]">کد اختصاصی کاربری: </span>
                  <span className="text-xs font-mono font-black text-white">{profile.melliCode}</span>
                </div>
              )}

              <div className="w-full flex flex-col gap-2 border-t border-white/5 pt-4">
                <button 
                  onClick={() => setActiveTab('bookmarks')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'bookmarks' ? 'bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Bookmark size={15} /> مانهواهای نشان‌شده من
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'history' ? 'bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Clock size={15} /> تاریخچه مطالعه مانهواها
                </button>
                <button 
                  onClick={() => setActiveTab('comments')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'comments' ? 'bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <MessageSquare size={15} /> نظرات ارسال شده من
                </button>
                <button 
                  onClick={() => setActiveTab('wallet')}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'wallet' ? 'bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet size={15} /> کیف پول من
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
                    {(dbUser?.walletBalance || 0).toLocaleString('fa-IR')} ت
                  </span>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'settings' ? 'bg-[var(--color-asura-accent)]/10 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                >
                  <Settings size={15} /> تنظیمات حساب کاربری
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2 mb-6">
              <span className="w-1.5 h-6 bg-[var(--color-asura-accent)] rounded-full"></span>
              {activeTab === 'bookmarks' && 'مانهواهای نشان‌گذاری شده'}
              {activeTab === 'history' && 'تاریخچه مطالعه شخصی'}
              {activeTab === 'comments' && 'فعالیت‌های ثبت نظرات'}
              {activeTab === 'settings' && 'تنظیمات و اطلاعات پروفایل'}
              {activeTab === 'wallet' && 'کیف پول و مدیریت تراکنش‌ها'}
            </h2>

            <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 min-h-[450px]">
              {/* ========================================================= */}
              {/* BOOKMARKS TAB */}
              {/* ========================================================= */}
              {activeTab === 'bookmarks' && (
                bookmarksLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div>
                    {/* Categories Filter Bar */}
                    <div className="flex flex-wrap items-center gap-2 mb-6 bg-black/20 p-2 rounded-xl border border-white/5">
                      <span className="text-[11px] font-black text-zinc-500 px-2">دسته بندی:</span>
                      {(['all', 'مانهوا', 'مانگا', 'مانها'] as const).map(filter => (
                        <button
                          key={filter}
                          onClick={() => setBookmarkTypeFilter(filter)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${bookmarkTypeFilter === filter ? 'bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:text-white bg-white/5'}`}
                        >
                          {filter === 'all' ? 'همه نشان‌شده‌ها' : filter}
                        </button>
                      ))}
                    </div>

                    {filteredBookmarks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 bg-black/10 rounded-xl border border-dashed border-white/5 p-8">
                        <Heart size={44} className="mb-4 text-zinc-700 opacity-60" />
                        <p className="text-xs font-bold text-zinc-400">هیچ مانهوایی در این دسته‌بندی یافت نشد.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {filteredBookmarks.map(bz => bz.seriesData ? (
                          <div key={bz.seriesId} className="group relative rounded-2xl overflow-hidden bg-black/40 border border-white/5 hover:border-[var(--color-asura-accent)]/30 transition-all duration-300">
                            <Link to={`/series/${bz.seriesId}`}>
                              <div className="aspect-[3/4] relative">
                                <img src={bz.seriesData.cover} alt={bz.seriesData.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent opacity-90"></div>
                                <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[9px] font-black text-[var(--color-asura-accent-light)] uppercase backdrop-blur-sm border border-white/10">
                                  {bz.seriesData.type === 'manhwa' ? 'مانهوا' : bz.seriesData.type === 'manga' ? 'مانگا' : bz.seriesData.type === 'manhua' ? 'مانها' : bz.seriesData.type}
                                </div>
                              </div>
                              <div className="p-3 absolute bottom-0 left-0 right-0">
                                <h3 className="font-black text-white text-xs line-clamp-1 group-hover:text-[var(--color-asura-accent-light)] transition-colors">{bz.seriesData.title}</h3>
                              </div>
                            </Link>
                            <button 
                              onClick={(e) => { e.preventDefault(); removeBookmark(bz.seriesId); }}
                              className="absolute top-2 left-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors z-10 shadow-lg backdrop-blur-sm"
                              title="حذف نشان‌شده"
                            >
                              <Bookmark size={13} fill="currentColor" />
                            </button>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ========================================================= */}
              {/* HISTORY TAB */}
              {/* ========================================================= */}
              {activeTab === 'history' && (
                historyLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div>
                    {/* Categories Filter Bar */}
                    <div className="flex flex-wrap items-center gap-2 mb-6 bg-black/20 p-2 rounded-xl border border-white/5">
                      <span className="text-[11px] font-black text-zinc-500 px-2">دسته بندی:</span>
                      {(['all', 'مانهوا', 'مانگا', 'مانها'] as const).map(filter => (
                        <button
                          key={filter}
                          onClick={() => setHistoryTypeFilter(filter)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${historyTypeFilter === filter ? 'bg-[var(--color-asura-accent)] text-white shadow-lg shadow-[var(--color-asura-accent)]/20' : 'text-zinc-400 hover:text-white bg-white/5'}`}
                        >
                          {filter === 'all' ? 'همه تاریخچه' : filter}
                        </button>
                      ))}
                    </div>

                    {totalCount === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 bg-black/10 rounded-xl border border-dashed border-white/5 p-8">
                        <Clock size={44} className="mb-4 text-zinc-700 opacity-60" />
                        <p className="text-xs font-bold text-zinc-400">تاریخچه مطالعه‌ای در این دسته‌بندی وجود ندارد.</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {/* TODAY GROUP */}
                        {today.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-[var(--color-asura-accent-light)] mb-3 bg-[var(--color-asura-accent)]/5 px-3 py-1.5 rounded-lg inline-block">امروز</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {today.map(h => h.seriesData ? (
                                <Link 
                                  key={h.seriesId} 
                                  to={`/reader/${h.seriesId}/${h.chapterId}`}
                                  className="flex items-center gap-4 bg-black/20 hover:bg-white/5 border border-white/5 rounded-2xl p-3 transition-all duration-300 group"
                                >
                                   <img src={h.seriesData.cover} alt={h.seriesData.title} className="w-12 h-16 object-cover rounded-xl shadow-lg shrink-0" />
                                   <div className="flex-1 min-w-0 text-right">
                                     <h4 className="font-black text-white text-xs line-clamp-1 group-hover:text-[var(--color-asura-accent-light)] transition-colors">{h.seriesData.title}</h4>
                                     <p className="text-zinc-400 text-[11px] mt-1 font-bold">آخرین مطالعه: چپتر {h.chapterNumber}</p>
                                     <p className="text-[9px] text-zinc-600 mt-1 font-mono">
                                       {new Date(h.updatedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                     </p>
                                   </div>
                                </Link>
                              ) : null)}
                            </div>
                          </div>
                        )}

                        {/* YESTERDAY GROUP */}
                        {yesterday.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-zinc-400 mb-3 bg-white/5 px-3 py-1.5 rounded-lg inline-block">دیروز</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {yesterday.map(h => h.seriesData ? (
                                <Link 
                                  key={h.seriesId} 
                                  to={`/reader/${h.seriesId}/${h.chapterId}`}
                                  className="flex items-center gap-4 bg-black/20 hover:bg-white/5 border border-white/5 rounded-2xl p-3 transition-all duration-300 group"
                                >
                                   <img src={h.seriesData.cover} alt={h.seriesData.title} className="w-12 h-16 object-cover rounded-xl shadow-lg shrink-0" />
                                   <div className="flex-1 min-w-0 text-right">
                                     <h4 className="font-black text-white text-xs line-clamp-1 group-hover:text-[var(--color-asura-accent-light)] transition-colors">{h.seriesData.title}</h4>
                                     <p className="text-zinc-400 text-[11px] mt-1 font-bold">آخرین مطالعه: چپتر {h.chapterNumber}</p>
                                     <p className="text-[9px] text-zinc-600 mt-1 font-mono">
                                       {new Date(h.updatedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                     </p>
                                   </div>
                                </Link>
                              ) : null)}
                            </div>
                          </div>
                        )}

                        {/* OLDER GROUP */}
                        {older.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black text-zinc-500 mb-3 bg-white/5 px-3 py-1.5 rounded-lg inline-block">پیش‌تر</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {older.map(h => h.seriesData ? (
                                <Link 
                                  key={h.seriesId} 
                                  to={`/reader/${h.seriesId}/${h.chapterId}`}
                                  className="flex items-center gap-4 bg-black/20 hover:bg-white/5 border border-white/5 rounded-2xl p-3 transition-all duration-300 group"
                                >
                                   <img src={h.seriesData.cover} alt={h.seriesData.title} className="w-12 h-16 object-cover rounded-xl shadow-lg shrink-0" />
                                   <div className="flex-1 min-w-0 text-right">
                                     <h4 className="font-black text-white text-xs line-clamp-1 group-hover:text-[var(--color-asura-accent-light)] transition-colors">{h.seriesData.title}</h4>
                                     <p className="text-zinc-400 text-[11px] mt-1 font-bold">آخرین مطالعه: چپتر {h.chapterNumber}</p>
                                     <p className="text-[9px] text-zinc-600 mt-1 font-mono">
                                       {new Date(h.updatedAt).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' })}
                                     </p>
                                   </div>
                                </Link>
                              ) : null)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ========================================================= */}
              {/* COMMENTS TAB */}
              {/* ========================================================= */}
              {activeTab === 'comments' && (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500 bg-black/10 rounded-xl border border-dashed border-white/5 p-8">
                  <MessageSquare size={44} className="mb-4 text-zinc-700 opacity-60" />
                  <p className="text-xs font-bold text-zinc-400">تاکنون نظری توسط شما ثبت نشده است.</p>
                </div>
              )}

              {/* ========================================================= */}
              {/* SETTINGS TAB */}
              {/* ========================================================= */}
              {activeTab === 'settings' && (
                <div className="max-w-lg text-right" dir="rtl">
                  <div className="mb-6">
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">نام نمایشی شما (نام کاربری عمومی)</label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-black/40 border border-[var(--color-asura-border)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">کد اختصاصی کاربری (غیرقابل تغییر)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={profile?.melliCode || ''}
                        readOnly
                        disabled
                        className="w-full bg-black/20 border border-[var(--color-asura-border)]/50 rounded-xl px-4 py-2.5 text-xs text-zinc-500 font-mono focus:outline-none cursor-not-allowed text-left"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(profile?.melliCode || '');
                          alert("کد اختصاصی با موفقیت کپی شد!");
                        }}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0 font-sans"
                      >
                        کپی کد
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">نام واقعی</label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="نام شما (اختیاری)"
                        className="w-full bg-black/40 border border-[var(--color-asura-border)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">نام خانوادگی</label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="نام خانوادگی (اختیاری)"
                        className="w-full bg-black/40 border border-[var(--color-asura-border)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">شماره تلفن همراه</label>
                    <input 
                      type="text" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="مثال: 09123456789 (اختیاری)"
                      className="w-full bg-black/40 border border-[var(--color-asura-border)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 text-right font-mono"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">آواتار و تصویر کاربری</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[var(--color-asura-dark)] border border-white/10 overflow-hidden shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-[var(--color-asura-accent)] text-white">
                            {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-xs font-black text-white transition-colors inline-block text-center">
                          آپلود آواتار جدید
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden" 
                          />
                        </label>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest">حداکثر حجم فایل ۱ مگابایت</p>
                      </div>
                    </div>
                    <div className="mt-4">
                       <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">یا آدرس مستقیم تصویر (URL)</label>
                       <input 
                         type="text" 
                         value={avatarUrl}
                         onChange={(e) => setAvatarUrl(e.target.value)}
                         placeholder="https://example.com/avatar.png"
                         className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50"
                       />
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-xl font-black text-xs transition-colors shadow-lg disabled:opacity-50"
                  >
                    {savingProfile ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات'}
                  </button>
                </div>
              )}

              {activeTab === 'wallet' && (
                !profile?.hasCompletedSetup ? (
                  <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-8 text-center flex flex-col items-center gap-4 justify-center" dir="rtl">
                    <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center">
                      <Wallet size={28} />
                    </div>
                    <p className="text-zinc-300 text-sm font-bold">برای استفاده از کیف پول و شارژ حساب، ابتدا باید اطلاعات کاربری خود را تکمیل کنید.</p>
                    <button
                      onClick={() => setShowSetupModal(true)}
                      className="py-2.5 px-6 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-xs rounded-xl transition-all shadow-lg"
                    >
                      تکمیل اطلاعات حساب کاربری
                    </button>
                  </div>
                ) : loadingWallet ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-6" dir="rtl">
                    {/* Premium Balance Card */}
                    <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-asura-accent)]/10 rounded-full blur-3xl -z-10"></div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <p className="text-zinc-400 text-xs font-black mb-1">موجودی فعلی حساب شما</p>
                          <h3 className="text-3xl font-black text-white flex items-baseline gap-2">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 font-mono">
                              {(dbUser?.walletBalance || 0).toLocaleString('fa-IR')}
                            </span>
                            <span className="text-xs text-zinc-500 font-bold">تومان</span>
                          </h3>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-right">
                          <p className="text-[10px] text-emerald-400 font-black mb-0.5">وضعیت کیف پول</p>
                          <p className="text-xs text-white font-bold">فعال و آماده استفاده</p>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-white/5 flex gap-2 items-start text-zinc-400 text-xs">
                        <span className="text-amber-400 font-black">ⓘ</span>
                        <p className="leading-relaxed">
                          شارژ کیف پول در حال حاضر فقط توسط مدیریت کل یا نمایندگان منتخب پشتیبانی سایت انجام می‌شود. پس از هماهنگی، مبلغ درخواستی به صورت آنی به کیف پول شما افزوده خواهد شد.
                        </p>
                      </div>
                    </div>

                    {/* Transaction History Section */}
                    <div>
                      <h4 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
                        تاریخچه تراکنش‌ها و ریز حساب
                      </h4>

                      {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 bg-black/10 rounded-xl border border-dashed border-white/5 p-8">
                          <Wallet size={36} className="mb-3 text-zinc-700 opacity-60" />
                          <p className="text-xs font-bold text-zinc-400">تاکنون تراکنشی در حساب شما ثبت نشده است.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-white/5 text-zinc-500">
                                <th className="pb-3 font-black pr-2 text-right">ردیف</th>
                                <th className="pb-3 font-black text-right">مبلغ تراکنش</th>
                                <th className="pb-3 font-black text-right">نوع تراکنش</th>
                                <th className="pb-3 font-black text-right">توضیحات تراکنش</th>
                                <th className="pb-3 font-black text-right">توسط شخص</th>
                                <th className="pb-3 font-black pl-2 text-right">تاریخ ثبت</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {transactions.map((tx, idx) => {
                                const isPositive = tx.amount >= 0;
                                return (
                                  <tr key={tx.id || idx} className="hover:bg-white/5 transition-colors group">
                                    <td className="py-3.5 pr-2 font-mono text-zinc-600">{idx + 1}</td>
                                    <td className={`py-3.5 font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {isPositive ? '+' : ''}{tx.amount.toLocaleString('fa-IR')} ت
                                    </td>
                                    <td className="py-3.5 font-bold">
                                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                                        tx.type === 'admin_adjustment' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                        tx.type === 'purchase' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                        'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                      }`}>
                                        {tx.type === 'admin_adjustment' ? 'تغییر توسط مدیریت' :
                                         tx.type === 'purchase' ? 'خرید چپتر' : 'سایر موارد'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 text-zinc-300 font-bold max-w-xs truncate" title={tx.description}>
                                      {tx.description || 'بدون توضیحات'}
                                    </td>
                                    <td className="py-3.5 text-zinc-400 font-bold">{tx.creatorName || 'سیستم'}</td>
                                    <td className="py-3.5 pl-2 font-mono text-zinc-500 text-[11px]">
                                      {new Date(tx.createdAt).toLocaleDateString('fa-IR')} {new Date(tx.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
