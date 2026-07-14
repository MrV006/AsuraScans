import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, User, Menu, X, Library, Bell, ChevronDown, LogOut, Settings, Check, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../hooks/useNotifications';
import { AuthModal } from './AuthModal';
import { useSettings } from '../contexts/SettingsContext';

export function Navbar() {
  const { user, profile, isSimulatingUser, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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

  return (
    <>
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
              {(settings?.siteName || "ASURA SCANS").split(' ')[0]}
              <span className="text-white">
                {(settings?.siteName || "ASURA SCANS").split(' ').slice(1).join(' ') ? ' ' + (settings?.siteName || "ASURA SCANS").split(' ').slice(1).join(' ') : ''}
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
          <Link to="#" className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors pb-1 border-b-2 border-transparent">
            Bookmarks <ChevronDown size={14} />
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
          
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-zinc-400 hover:text-[var(--color-asura-accent-light)] transition-colors relative p-1.5 rounded-full hover:bg-white/5"
            >
              <Bell size={20} className={unreadCount > 0 ? "animate-[bounce_2s_infinite] text-[var(--color-asura-accent-light)]" : ""} />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-asura-card)]"></span>
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-asura-card)] animate-ping opacity-75"></span>
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
                  className="fixed top-16 left-4 right-4 sm:absolute sm:top-full sm:left-auto sm:right-0 mt-3 w-auto sm:w-[380px] md:w-[420px] bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[80vh] text-right"
                  dir="rtl"
                >
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-black/20">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-[var(--color-asura-accent)] rounded-full"></span>
                      <h3 className="font-black text-white text-xs uppercase tracking-wider">اعلان‌های انتشار</h3>
                      {unreadCount > 0 && (
                        <span className="bg-red-500/10 text-red-400 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-red-500/20">
                          {unreadCount} جدید
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-black text-[var(--color-asura-accent-light)] hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Check size={12} /> خواندن همه
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto max-h-[50vh] divide-y divide-white/5 custom-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => {
                            if (!notif.read) markAsRead(notif.id);
                            setShowNotifications(false);
                            if (notif.link) navigate(notif.link);
                          }}
                          className={`p-4 cursor-pointer transition-all duration-200 relative flex gap-3 ${notif.read ? 'bg-transparent hover:bg-white/5' : 'bg-[var(--color-asura-accent)]/5 hover:bg-[var(--color-asura-accent)]/10'}`}
                        >
                          {!notif.read && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[var(--color-asura-accent)] rounded-full"></span>
                          )}
                          <div className={`flex-1 ${!notif.read ? 'pr-2' : ''}`}>
                            <h4 className={`text-xs font-black ${notif.read ? 'text-zinc-300' : 'text-white'} leading-snug`}>
                              {notif.title}
                            </h4>
                            <p className={`text-[11px] mt-1.5 leading-relaxed ${notif.read ? 'text-zinc-500' : 'text-zinc-400'} line-clamp-2`}>
                              {notif.body}
                            </p>
                            <span className="text-[9px] text-zinc-600 mt-2 block font-bold">
                              {new Date(notif.createdAt).toLocaleDateString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center flex flex-col items-center justify-center text-zinc-500 text-xs">
                        <Bell size={28} className="text-zinc-600 mb-3 opacity-50" />
                        هیچ اعلانی یافت نشد.
                      </div>
                    )}
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
