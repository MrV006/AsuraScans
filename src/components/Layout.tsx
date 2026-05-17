import { ReactNode, useEffect } from 'react';
import { Navbar } from './Navbar';
import { Github, Twitter, MessageCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { Link } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  const { settings, genres } = useSettings();

  useEffect(() => {
    document.title = 'ASURA SCANS CLONE';
    if (settings.seoDescription) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', settings.seoDescription);
    }
  }, [settings.seoDescription]);

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
      <Navbar />
      <main className="flex-grow pt-16 selection:bg-[var(--color-asura-accent)] selection:text-white">
        {children}
      </main>
      
      <footer className="bg-[#0f0f12] border-t border-white/5 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
             <div className="flex items-center flex-shrink-0 mb-4">
               <span className="text-2xl font-black tracking-tighter text-[var(--color-asura-accent)]">ASURA<span className="text-white">SCANS</span></span>
             </div>
            <p className="text-zinc-500 text-xs leading-relaxed max-w-sm">
              {settings.aboutText}
            </p>
            <div className="flex space-x-3 mt-6">
              <a href={settings.twitterUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
                <Twitter size={14} />
              </a>
              <a href={settings.discordUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
                <MessageCircle size={14} />
              </a>
              <a href={settings.githubUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-[var(--color-asura-accent)] bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
                <Github size={14} />
              </a>
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
          <div>&copy; {new Date().getFullYear()} ASURA SCANS &bull; MADE BY FANS FOR FANS &bull; TERMS OF SERVICE &bull; PRIVACY POLICY</div>
          <div className="text-[9px] text-zinc-700">{settings.seoKeywords}</div>
        </div>
      </footer>
    </div>
  );
}
