import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, User, Menu, X, Library, Bell, ChevronDown, LogOut, Settings, 
  Check, Trophy, LifeBuoy, Volume2, VolumeX, CheckCheck, Trash2, 
  BookOpen, Zap, Bookmark, Coins, MessageSquare, Megaphone, Eye, EyeOff, 
  Clock 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications, NotificationFilter } from '../hooks/useNotifications';
import { AuthModal } from './AuthModal';
import { useSettings } from '../contexts/SettingsContext';

export function Navbar() {
  const { user, profile, isSimulatingUser, logout } = useAuth();
  const { 
    notifications, 
    filteredNotifications, 
    unreadCount, 
    filter, 
    setFilter, 
    soundEnabled, 
    toggleSound, 
    latestToast, 
    dismissToast, 
    markAsRead, 
    markAsUnread, 
    deleteNotification, 
    clearAllNotifications, 
    markAllAsRead 
  } = useNotifications();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const isStaffOrAdmin = user && profile && (
    profile.role === 'admin' ||
    profile.role === 'staff' ||
    profile.roles?.some((r: string) => r === 'super_admin' || r === 'admin' || r === 'translator' || r === 'cleaner' || r === 'editor' || r === 'typesetter' || r === 'proofreader') ||
    user.email === 'amirrezaveisi45@gmail.com' ||
    user.email === 'Mr.V@admin.com'
  );

  useEffect(() => {
    const current = location.pathname;
    if (current !== '/profile' && current !== '/admin') {
      sessionStorage.setItem('asura_last_main_path', current + location.search);
    }
  }, [location]);

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/profile') {
      const backPath = sessionStorage.getItem('asura_last_main_path') || '/';
      navigate(backPath);
    } else {
      navigate('/profile');
    }
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/admin') {
      const backPath = sessionStorage.getItem('asura_last_main_path') || '/';
      navigate(backPath);
    } else {
      navigate('/admin');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setConfirmClearAll(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleLogoClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      sessionStorage.clear();
    } catch (err) {
      console.error("Cache clearing failed:", err);
    }
    window.location.href = `/?update=${Date.now()}`;
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      setMobileMenuOpen(false);
      navigate(`/search?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chapter_release':
      case 'release':
        return {
          icon: <BookOpen size={14} className="text-indigo-400" />,
          bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        };
      case 'bookmark':
        return {
          icon: <Bookmark size={14} className="text-rose-400" />,
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        };
      case 'wallet':
      case 'coin':
      case 'transaction':
      case 'subscription':
        return {
          icon: <Coins size={14} className="text-emerald-400" />,
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        };
      case 'comment_reply':
      case 'comment':
        return {
          icon: <MessageSquare size={14} className="text-sky-400" />,
          bg: 'bg-sky-500/10 border-sky-500/20 text-sky-400'
        };
      case 'ticket':
      case 'support':
        return {
          icon: <LifeBuoy size={14} className="text-cyan-400" />,
          bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
        };
      case 'announcement':
      case 'broadcast':
      case 'system':
        return {
          icon: <Megaphone size={14} className="text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        };
      default:
        return {
          icon: <Bell size={14} className="text-[var(--color-asura-accent-light)]" />,
          bg: 'bg-[var(--color-asura-accent)]/10 border-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)]'
        };
    }
  };

  const getRelativeTime = (dateStr: any) => {
    try {
      const now = Date.now();
      const diffMs = now - new Date(dateStr).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffMin < 1) return 'همین الان';
      if (diffMin < 60) return `${diffMin} دقیقه پیش`;
      if (diffHour < 24) return `${diffHour} ساعت پیش`;
      if (diffDay === 1) return 'دیروز';
      if (diffDay < 7) return `${diffDay} روز پیش`;
      return new Date(dateStr).toLocaleDateString('fa-IR');
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Real-time Floating Toast Notification */}
      <AnimatePresence>
        {latestToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-50 bg-[var(--color-asura-card)]/95 border border-[var(--color-asura-accent)]/40 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-start gap-3 cursor-pointer text-right"
            dir="rtl"
            onClick={() => {
              markAsRead(latestToast.id);
              dismissToast();
              if (latestToast.link) navigate(latestToast.link);
            }}
          >
            <div className={`p-2 rounded-xl border flex-shrink-0 ${getNotificationIcon(latestToast.type).bg}`}>
              {getNotificationIcon(latestToast.type).icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <h4 className="text-xs font-black text-white truncate">{latestToast.title}</h4>
                <span className="text-[9px] text-[var(--color-asura-accent-light)] font-bold">جدید</span>
              </div>
              <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">{latestToast.body}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast();
              }}
              className="text-zinc-500 hover:text-white p-1 rounded-lg"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-asura-card)]/90 backdrop-blur-md border-b border-[var(--color-asura-border)] z-50 flex items-center px-3 sm:px-6 md:px-8 transition-all duration-200">
      <div className="flex items-center gap-2 sm:gap-4 md:gap-8 w-full max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" onClick={handleLogoClick} className="flex items-center flex-shrink-0">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt={settings.siteName || "AsuraClone"} 
              className="h-9 w-auto object-contain max-w-[150px] sm:max-w-[180px]" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-xl sm:text-2xl font-black tracking-tighter text-[var(--color-asura-accent)]">
              {(settings?.siteName || "Mangata").split(' ')[0]}
              <span className="text-white">
                {(settings?.siteName || "Mangata").split(' ').slice(1).join(' ') ? ' ' + (settings?.siteName || "Mangata").split(' ').slice(1).join(' ') : ''}
              </span>
            </span>
          )}
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 h-full text-sm font-bold uppercase tracking-wider">
          <Link to="/" className="text-[var(--color-asura-accent-light)] border-b-2 border-[var(--color-asura-accent)] pb-1 transition-colors">Home</Link>
          <Link to="/search" className="text-zinc-400 hover:text-white transition-colors pb-1 border-b-2 border-transparent">Comics</Link>
          <Link to="/leaderboard" className="text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors pb-1 border-b-2 border-transparent">
            <Trophy size={14} /> Ranking
          </Link>
          <Link to="/support" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors pb-1 border-b-2 border-transparent">
            <LifeBuoy size={14} /> پشتیبانی
          </Link>
          <Link to="/bookmarks" className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors pb-1 border-b-2 border-transparent">
            Bookmarks
          </Link>
        </div>

        <div className="flex-grow"></div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative hidden md:block">
            <input 
              type="text" 
              placeholder="Search series..." 
              onKeyDown={handleSearch}
              className="bg-white/5 text-zinc-300 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-sm w-48 lg:w-64 focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors"
            />
            <Search className="absolute left-3 top-2 text-zinc-500" size={16} />
          </div>
          
          {/* Notification Bell & Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button 
              id="btn-navbar-notifications"
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-zinc-400 hover:text-[var(--color-asura-accent-light)] transition-colors relative p-1.5 rounded-full hover:bg-white/5 focus:outline-none"
              title="مرکز اعلان‌ها"
            >
              <Bell size={20} className={unreadCount > 0 ? "animate-[bounce_2s_infinite] text-[var(--color-asura-accent-light)]" : ""} />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-[var(--color-asura-card)] flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-60 pointer-events-none"></span>
                </>
              )}
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="fixed top-16 left-3 right-3 sm:absolute sm:top-full sm:left-auto sm:right-0 mt-3 w-auto sm:w-[420px] md:w-[460px] bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[85vh] text-right"
                  dir="rtl"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-white/5 bg-black/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[var(--color-asura-accent)] rounded-full"></div>
                      <h3 className="font-black text-white text-xs tracking-wider">مرکز اعلان‌ها</h3>
                      {unreadCount > 0 ? (
                        <span className="bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-500/30">
                          {unreadCount} جدید
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/20">
                          همه خوانده شدند
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Sound Toggle */}
                      <button
                        onClick={toggleSound}
                        title={soundEnabled ? "صدای اعلان: روشن (کلیک برای قطع)" : "صدای اعلان: خاموش (کلیک برای فعال‌سازی)"}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          soundEnabled 
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' 
                            : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                      </button>

                      {/* Mark All Read */}
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          title="خواندن همه اعلان‌ها"
                          className="text-[10px] font-black text-[var(--color-asura-accent-light)] hover:text-white bg-[var(--color-asura-accent)]/10 hover:bg-[var(--color-asura-accent)]/20 border border-[var(--color-asura-accent)]/20 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <CheckCheck size={12} /> خواندن همه
                        </button>
                      )}

                      {/* Clear All Notifications */}
                      {notifications.length > 0 && (
                        <>
                          {confirmClearAll ? (
                            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 p-0.5 rounded-lg">
                              <button
                                onClick={() => {
                                  clearAllNotifications();
                                  setConfirmClearAll(false);
                                }}
                                className="text-[10px] font-black text-red-400 hover:text-white px-1.5 py-0.5 rounded bg-red-500/30"
                              >
                                تایید حذف
                              </button>
                              <button
                                onClick={() => setConfirmClearAll(false)}
                                className="text-[10px] text-zinc-400 hover:text-white px-1 py-0.5"
                              >
                                انصراف
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmClearAll(true)}
                              title="پاکسازی کامل تمام اعلان‌ها"
                              className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 py-2 bg-black/15 border-b border-white/5 overflow-x-auto custom-scrollbar">
                    <button
                      onClick={() => setFilter('all')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                        filter === 'all' 
                          ? 'bg-[var(--color-asura-accent)] text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      همه ({notifications.length})
                    </button>
                    <button
                      onClick={() => setFilter('unread')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
                        filter === 'unread' 
                          ? 'bg-[var(--color-asura-accent)] text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      خوانده‌نشده ({unreadCount})
                    </button>
                    <button
                      onClick={() => setFilter('release')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                        filter === 'release' 
                          ? 'bg-[var(--color-asura-accent)] text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      چپترها
                    </button>
                    <button
                      onClick={() => setFilter('wallet')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                        filter === 'wallet' 
                          ? 'bg-[var(--color-asura-accent)] text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      مالی / سکه
                    </button>
                    <button
                      onClick={() => setFilter('interaction')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                        filter === 'interaction' 
                          ? 'bg-[var(--color-asura-accent)] text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      تعاملات
                    </button>
                    <button
                      onClick={() => setFilter('system')}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                        filter === 'system' 
                          ? 'bg-[var(--color-asura-accent)] text-white shadow-sm' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      سیستم
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="overflow-y-auto max-h-[50vh] divide-y divide-white/5 custom-scrollbar">
                    {filteredNotifications.length > 0 ? (
                      filteredNotifications.map(notif => {
                        const iconMeta = getNotificationIcon(notif.type);
                        return (
                          <div 
                            key={notif.id} 
                            className={`p-3.5 transition-all duration-200 relative group flex gap-3 ${
                              notif.read 
                                ? 'bg-transparent hover:bg-white/5 opacity-80 hover:opacity-100' 
                                : 'bg-[var(--color-asura-accent)]/5 hover:bg-[var(--color-asura-accent)]/10 border-r-2 border-[var(--color-asura-accent)]'
                            }`}
                          >
                            {/* Type Icon Badge */}
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${iconMeta.bg}`}>
                              {iconMeta.icon}
                            </div>

                            {/* Content */}
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                if (!notif.read) markAsRead(notif.id);
                                setShowNotifications(false);
                                if (notif.link) navigate(notif.link);
                              }}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <h4 className={`text-xs font-black truncate ${notif.read ? 'text-zinc-300' : 'text-white'}`}>
                                  {notif.title}
                                </h4>
                                <span className="text-[9px] text-zinc-500 flex items-center gap-1 flex-shrink-0 font-medium">
                                  <Clock size={10} />
                                  {getRelativeTime(notif.createdAt)}
                                </span>
                              </div>
                              <p className={`text-[11px] leading-relaxed line-clamp-2 ${notif.read ? 'text-zinc-500' : 'text-zinc-300'}`}>
                                {notif.body}
                              </p>
                            </div>

                            {/* Quick Actions (Hover) */}
                            <div className="flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (notif.read) {
                                    markAsUnread(notif.id);
                                  } else {
                                    markAsRead(notif.id);
                                  }
                                }}
                                title={notif.read ? "علامت به عنوان خوانده نشده" : "علامت به عنوان خوانده شده"}
                                className="p-1 rounded-md text-zinc-400 hover:text-[var(--color-asura-accent-light)] hover:bg-white/10"
                              >
                                {notif.read ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notif.id);
                                }}
                                title="حذف اعلان"
                                className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-white/10"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-10 text-center flex flex-col items-center justify-center text-zinc-500 text-xs">
                        <Bell size={32} className="text-zinc-600 mb-3 opacity-40" />
                        <p className="font-bold">هیچ اعلانی در این بخش وجود ندارد.</p>
                        <p className="text-[10px] text-zinc-600 mt-1">اعلان‌های جدید بلافاصله در این بخش نمایش داده می‌شوند.</p>
                      </div>
                    )}
                  </div>

                  {/* Storage Lifecycle Notice Footer */}
                  <div className="px-3 py-2 border-t border-white/5 bg-black/40 flex items-center justify-between text-[9px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-amber-400/70" />
                      حذف خودکار: خوانده‌شده (۲۴ ساعت) / خوانده‌نشده (۷ روز)
                    </span>
                    <span className="text-zinc-600 font-mono">Realtime Live</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {user ? (
            <div className="flex items-center gap-1.5 md:gap-2">
              {!isSimulatingUser && isStaffOrAdmin && (
                <button 
                  onClick={handleSettingsClick} 
                  className="text-zinc-400 hover:text-[var(--color-asura-accent-light)] transition-colors p-1.5 rounded-full hover:bg-white/5" 
                  title="Admin Panel"
                >
                  <Settings size={18} />
                </button>
              )}
              <button 
                onClick={handleProfileClick} 
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 p-1 pr-3 rounded-full transition-colors border border-white/5"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-asura-accent)] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden flex-shrink-0">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.displayName?.substring(0, 2).toUpperCase() || 'U'
                  )}
                </div>
                <span className="text-xs font-bold text-white hidden sm:block truncate max-w-[80px]">
                  {profile?.displayName || 'User'}
                </span>
              </button>
              <button onClick={() => logout()} className="text-zinc-400 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-white/5" title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 p-1.5 px-4 rounded-full transition-colors border border-[var(--color-asura-accent)]/30 text-[var(--color-asura-accent-light)] font-bold text-xs uppercase tracking-wider">
              Sign In
            </button>
          )}
          
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors focus:outline-none flex-shrink-0"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>

    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-x-0 top-16 bg-[#0a0a0c] border-b border-[var(--color-asura-border)] z-40 md:hidden p-4 flex flex-col gap-4 shadow-xl transition-all duration-200"
        >
          <div className="relative w-full">
            <input 
              type="text" 
              placeholder="Search series..." 
              onKeyDown={handleSearch}
              className="w-full bg-white/5 text-zinc-300 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors"
            />
            <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
          </div>

          <div className="flex flex-col gap-2 uppercase tracking-wider text-sm font-bold mt-2">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 bg-white/5 rounded-lg text-white">Home</Link>
            <Link to="/search" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 bg-white/5 rounded-lg text-white">Comics</Link>
            <Link to="/leaderboard" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 bg-white/5 rounded-lg text-amber-500 flex items-center gap-2"><Trophy size={16} /> Ranking</Link>
            <Link to="/support" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 bg-white/5 rounded-lg text-indigo-400 flex items-center gap-2"><LifeBuoy size={16} /> پشتیبانی و تیکت‌ها</Link>
            {user && (
              <button 
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  handleProfileClick(e);
                }} 
                className="w-full text-left px-4 py-3 bg-white/5 rounded-lg text-white font-bold"
              >
                My Profile
              </button>
            )}
            {!isSimulatingUser && user && isStaffOrAdmin && (
              <button 
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  handleSettingsClick(e);
                }} 
                className="w-full text-left px-4 py-3 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] rounded-lg font-bold"
              >
                Admin Panel
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
