import { useParams, Link } from 'react-router-dom';
import { useSeriesOverview } from '../hooks/useSeries';
import { useHistory } from '../hooks/useUserActivity';
import { ChevronLeft, ChevronRight, Menu, Home, MessageSquare, ArrowUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Comments } from '../components/Comments';

import { ReaderSkeleton } from '../components/Skeletons';

export default function Reader() {
  const { seriesId, chapterId } = useParams();
  const { series, loading } = useSeriesOverview(seriesId);
  const { updateHistory } = useHistory();
  
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chapterIdx = series?.chapters ? series.chapters.findIndex(c => c.id === chapterId) : -1;
  const chapter = chapterIdx >= 0 && series?.chapters ? series.chapters[chapterIdx] : (series?.chapters ? series.chapters[0] : null);
  
  const nextChapter = series?.chapters && chapterIdx >= 0 ? series.chapters[chapterIdx - 1] : null; 
  const prevChapter = series?.chapters && chapterIdx >= 0 ? series.chapters[chapterIdx + 1] : null; 

  useEffect(() => {
    if (seriesId && chapterId && chapter) {
      updateHistory(seriesId, chapterId, chapter.number);
      // Increment views
      import('firebase/firestore').then(({ doc, updateDoc, increment }) => {
        updateDoc(doc(db, 'series', seriesId), {
          views: increment(1)
        }).catch(err => console.error("Error incrementing series views", err));

        updateDoc(doc(db, `series/${seriesId}/chapters`, chapterId), {
          views: increment(1)
        }).catch(err => console.error("Error incrementing chapter views", err));
      });
    }
  }, [seriesId, chapterId, chapter?.number, updateHistory]);

  if (loading) {
    return <ReaderSkeleton />;
  }

  if (!series || !series.chapters || !chapter) {
    return (
      <div className="bg-[#0a0a0c] min-h-screen text-zinc-300 flex justify-center items-center">
        Chapter not found
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0c] min-h-screen text-zinc-300">
      {/* Top Navbar */}
      <div className={`fixed top-0 left-0 right-0 bg-[#0f0f12] border-b border-white/5 z-50 transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link to={`/series/${series.id}`} className="flex items-center gap-2 hover:text-white transition-colors text-sm font-bold truncate shrink-0 max-w-[40%]">
            <ChevronLeft size={16} />
            <span className="hidden sm:inline truncate">{series.title}</span>
          </Link>
          
          <div className="flex-1 flex justify-center">
            <div className="font-bold text-white bg-white/10 px-3 py-1 rounded text-xs tracking-widest uppercase">
              Chapter {chapter.number}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={async () => {
                if (!user) return alert('Please login to report an issue.');
                const reason = window.prompt("What is the issue with this chapter? (e.g. Broken images, missing pages)");
                if (!reason || !reason.trim()) return;
                try {
                  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                  await addDoc(collection(db, 'reports'), {
                    type: 'chapter_issue',
                    seriesId,
                    chapterId,
                    chapterNumber: chapter.number,
                    reason: reason.trim(),
                    reporterId: user.uid,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                  });
                  alert('Thank you! Our moderators will look into it.');
                } catch (e: any) {
                  alert('Failed to submit report: ' + e.message);
                }
              }}
              title="Report Chapter Issue" 
              className="text-zinc-500 hover:text-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
            </button>
            <Link to="/" className="hover:text-white transition-colors text-zinc-500">
              <Home size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div className="pt-14 pb-16 max-w-[800px] mx-auto flex flex-col relative w-full bg-black/20">
        {chapter.images && chapter.images.length > 0 ? (
          chapter.images.map((img, i) => (
            <img 
              key={i} 
              src={img} 
              alt={`Page ${i + 1}`} 
              className="w-full object-contain mx-auto block"
              loading="lazy"
            />
          ))
        ) : (
          /* Placeholder for missing images */
          <div className="flex-1 flex flex-col items-center justify-center p-10 mt-20 min-h-[60vh]">
            <div className="w-16 h-16 border-4 border-slate-800 border-t-[var(--color-asura-accent)] rounded-full animate-spin mb-6"></div>
            <p className="text-slate-500 font-medium">Loading chapter images...</p>
            <p className="text-slate-600 text-sm mt-2 text-center max-w-md">
              (This is a demo. Actual chapters would have 20-50 vertically stacked high-resolution pages here.)
            </p>
            <div className="h-[800px] w-full mt-10 bg-gradient-to-b from-[#15171e] to-transparent rounded animate-pulse"></div>
          </div>
        )}

        {/* Read Next Navigation Area */}
        <div className="p-6 md:p-10 flex flex-col items-center border-t border-white/5 mt-10 bg-[#0f0f12]">
          <h3 className="font-black text-xl text-white mb-6 text-center uppercase tracking-tighter">Chapter {chapter.number} Finished</h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            {prevChapter ? (
              <Link to={`/reader/${series.id}/${prevChapter.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors">
                <ChevronLeft size={16} />
                Prev Ch.
              </Link>
            ) : (
              <button disabled className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-white/5 text-zinc-600 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 cursor-not-allowed">
                <ChevronLeft size={16} />
                Prev Ch.
              </button>
            )}

            <Link to={`/series/${series.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors">
              <Menu size={16} />
              Index
            </Link>

            {nextChapter ? (
              <Link to={`/reader/${series.id}/${nextChapter.id}`} className="w-full sm:w-auto px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors shadow">
                Next Ch.
                <ChevronRight size={16} />
              </Link>
            ) : (
              <button disabled className="w-full sm:w-auto px-6 py-2.5 bg-transparent border border-white/5 text-zinc-600 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 cursor-not-allowed">
                Next Ch.
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6 md:p-10">
          <Comments seriesId={series.id} chapterId={chapter.id} />
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className={`fixed bottom-6 right-6 flex flex-col gap-3 z-40 transition-transform duration-300 ${showNav ? 'translate-y-0' : 'translate-y-24'}`}>
        <button onClick={scrollToTop} className="w-10 h-10 bg-white/10 backdrop-blur hover:bg-white text-white hover:text-black rounded-lg flex items-center justify-center shadow-xl border border-white/10 transition-colors">
          <ArrowUp size={18} />
        </button>
      </div>

    </div>
  );
}
