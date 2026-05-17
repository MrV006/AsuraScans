import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Menu, X, Library, Bell, ChevronDown, LogOut, Settings, Check, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../hooks/useNotifications';

export function Navbar() {
  const { user, profile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      setMobileMenuOpen(false);
      navigate(`/search?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-asura-card)]/90 backdrop-blur-md border-b border-[var(--color-asura-border)] z-50 flex items-center px-4 md:px-8">
      <div className="flex items-center gap-8 w-full max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center flex-shrink-0">
          <span className="text-2xl font-black tracking-tighter text-[var(--color-asura-accent)]">ASURA<span className="text-white">SCANS</span></span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-6 h-full text-sm font-bold uppercase tracking-wider ml-8">
          <Link to="/" className="text-[var(--color-asura-accent-light)] border-b-2 border-[var(--color-asura-accent)] pb-1 transition-colors">Home</Link>
          <Link to="/search" className="text-zinc-400 hover:text-white transition-colors pb-1 border-b-2 border-transparent">Comics</Link>
          <Link to="/leaderboard" className="text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors pb-1 border-b-2 border-transparent">
            <Trophy size={14} /> Ranking
          </Link>
          <Link to="#" className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors pb-1 border-b-2 border-transparent">
            Bookmarks <ChevronDown size={14} />
          </Link>
        </div>

        <div className="flex-1"></div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
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
              className="text-zinc-400 hover:text-white transition-colors relative p-1"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-asura-card)] animate-pulse"></span>
              )}
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl shadow-xl overflow-hidden z-50 flex flex-col max-h-[80vh]"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <h3 className="font-bold text-white uppercase text-sm tracking-wider">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Check size={12} /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-[60vh]">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => {
                            if (!notif.read) markAsRead(notif.id);
                            setShowNotifications(false);
                            if (notif.link) navigate(notif.link);
                          }}
                          className={`p-4 border-b border-white/5 cursor-pointer transition-colors ${notif.read ? 'bg-transparent hover:bg-white/5' : 'bg-[var(--color-asura-accent)]/5 hover:bg-[var(--color-asura-accent)]/10'}`}
                        >
                          <h4 className={`text-sm font-bold ${notif.read ? 'text-zinc-300' : 'text-white'} mb-1`}>{notif.title}</h4>
                          <p className={`text-xs ${notif.read ? 'text-zinc-500' : 'text-zinc-400'} line-clamp-2`}>{notif.body}</p>
                          <span className="text-[10px] text-zinc-600 mt-2 block font-bold uppercase tracking-wider">
                            {notif.createdAt?.toDate ? new Date(notif.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-zinc-500 text-sm">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {user ? (
            <div className="flex items-center gap-2">
              {(user.email === 'amirrezaveisi45@gmail.com' || user.email === 'Mr.V@admin.com') && (
                <Link to="/admin" className="text-zinc-400 hover:text-[var(--color-asura-accent-light)] transition-colors p-1" title="Admin Panel">
                  <Settings size={18} />
                </Link>
              )}
              <Link to="/profile" className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 p-1 pr-3 rounded-full transition-colors border border-white/5">
                <div className="w-7 h-7 rounded-full bg-[var(--color-asura-accent)] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.displayName?.substring(0, 2).toUpperCase() || 'U'
                  )}
                </div>
                <span className="text-xs font-bold text-white hidden sm:block truncate max-w-[80px]">
                  {profile?.displayName || 'User'}
                </span>
              </Link>
              <button onClick={() => signOut(auth)} className="text-zinc-400 hover:text-red-400 transition-colors p-1" title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 p-1.5 px-4 rounded-full transition-colors border border-[var(--color-asura-accent)]/30 text-[var(--color-asura-accent-light)] font-bold text-xs uppercase tracking-wider">
              Sign In
            </button>
          )}
          
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-zinc-400 hover:text-white">
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
          className="fixed inset-x-0 top-16 bg-[#0a0a0c] border-b border-[var(--color-asura-border)] z-40 md:hidden p-4 flex flex-col gap-4 shadow-xl"
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
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 bg-white/5 rounded-lg text-white">My Profile</Link>
            )}
            {user && (user.email === 'amirrezaveisi45@gmail.com' || user.email === 'Mr.V@admin.com') && (
              <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] rounded-lg">Admin Panel</Link>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
