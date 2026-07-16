import { ReactNode, useEffect } from 'react';
import { Navbar } from './Navbar';
import { Github, Twitter, MessageCircle, Instagram, Send } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export function Layout({ children }: { children: ReactNode }) {
  const { settings, genres } = useSettings();
  const { isSimulatingUser, setIsSimulatingUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.title = settings.siteName || 'Mangata';
    if (settings.seoDescription) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', settings.seoDescription);
    }
  }, [settings.siteName, settings.seoDescription]);

  if (settings.maintenanceMode && window.location.pathname !== '/admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f12] text-white p-4">
        <div className="text-center max-w-md">
           <h1 className="text-4xl font-black text-[var(--color-asura-accent)] mb-4">Under Maintenance</h1>
           <p className="text-zinc-500">We are currently upgrading the platform. Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {isSimulatingUser && (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-black text-xs font-black z-[100] rounded-2xl p-4 md:p-5 shadow-2xl shadow-amber-500/20 border border-amber-400/50 flex flex-col gap-3 md:gap-4 animate-fade-in transition-all" dir="rtl">
          <div className="flex items-start gap-2.5">
            <span className="relative flex h-2.5 w-2.5 mt-1 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black"></span>
            </span>
            <div className="flex-1">
              <h4 className="font-black text-sm text-black mb-1 font-sans">حالت شبیه‌ساز فعال است</h4>
              <p className="text-black/90 leading-relaxed text-[11px] font-bold">
                شما کل سایت (از جمله پرداخت چپترها) را مانند یک کاربر معمولی بدون نقش و دسترسی مشاهده می‌کنید.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-black/15 pt-3">
            <button
              onClick={() => setIsSimulatingUser(false)}
              className="w-full bg-black hover:bg-zinc-900 text-amber-500 transition-colors px-4 py-2.5 rounded-xl font-black text-xs text-center shadow-lg active:scale-95 transition-transform"
            >
              خروج از شبیه‌ساز و بازگشت به مدیریت
            </button>
          </div>
        </div>
      )}
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main 
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex-grow pt-16 selection:bg-[var(--color-asura-accent)] selection:text-white"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      
      <footer className="bg-[#0f0f12] border-t border-white/5 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
             <div className="flex items-center flex-shrink-0 mb-4">
               <span className="text-2xl font-black tracking-tighter text-[var(--color-asura-accent)]">
                 {(settings.siteName || 'Mangata').split(' ')[0]}
                 <span className="text-white">
                   {(settings.siteName || 'Mangata').split(' ').slice(1).join(' ') ? ' ' + (settings.siteName || 'Mangata').split(' ').slice(1).join(' ') : ''}
                 </span>
               </span>
             </div>
            <p className="text-zinc-500 text-xs leading-relaxed max-w-sm">
              {settings.aboutText}
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {settings.twitterUrl && settings.twitterUrl !== '#' && settings.twitterUrl !== '' && (
                <a href={settings.twitterUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md hover:scale-105" title="Twitter">
                  <Twitter size={14} />
                </a>
              )}
              {settings.discordUrl && settings.discordUrl !== '#' && settings.discordUrl !== '' && (
                <a href={settings.discordUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md hover:scale-105" title="Discord">
                  <MessageCircle size={14} />
                </a>
              )}
              {settings.githubUrl && settings.githubUrl !== '#' && settings.githubUrl !== '' && (
                <a href={settings.githubUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md hover:scale-105" title="GitHub">
                  <Github size={14} />
                </a>
              )}
              {settings.telegramUrl && settings.telegramUrl !== '#' && settings.telegramUrl !== '' && (
                <a href={settings.telegramUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md hover:scale-105" title="Telegram">
                  <Send size={14} />
                </a>
              )}
              {settings.instagramUrl && settings.instagramUrl !== '#' && settings.instagramUrl !== '' && (
                <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md hover:scale-105" title="Instagram">
                  <Instagram size={14} />
                </a>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-white mb-4 uppercase text-[10px] tracking-widest">Quick Links</h4>
            <ul className="space-y-2 text-xs font-medium text-zinc-400">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/search" className="hover:text-white transition-colors">Comics</Link></li>
              <li><Link to="/profile" className="hover:text-white transition-colors">Bookmarks</Link></li>
              <li><Link to="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-white mb-4 uppercase text-[10px] tracking-widest">Genres</h4>
            <ul className="grid grid-cols-2 gap-2 text-xs font-medium text-zinc-400">
              {genres.slice(0, 6).map(g => (
                <li key={g}><Link to={`/search?genre=${g}`} className="hover:text-white transition-colors">{g}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-12 pt-6 border-t border-white/5 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-600 flex flex-col gap-2">
          <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4">
            <span>&copy; {new Date().getFullYear()} {settings.footerCopyrightText || 'Mangata'}</span>
            <span className="text-zinc-800">&bull;</span>
            <span className="text-zinc-500">{settings.footerSubtext || 'MADE BY FANS FOR FANS'}</span>
            <span className="text-zinc-800">&bull;</span>
            <Link to="/terms" className="hover:text-[var(--color-asura-accent)] text-zinc-400 transition-colors">TERMS OF SERVICE</Link>
            <span className="text-zinc-800">&bull;</span>
            <Link to="/privacy" className="hover:text-[var(--color-asura-accent)] text-zinc-400 transition-colors">PRIVACY POLICY</Link>
          </div>
          <div className="text-[9px] text-zinc-700 mt-2">{settings.seoKeywords}</div>
        </div>
      </footer>
    </div>
  );
}
