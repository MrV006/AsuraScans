import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X } from 'lucide-react';

export function AppInterceptors() {
  const location = useLocation();
  const [showExitModal, setShowExitModal] = useState(false);
  const [lastBackPress, setLastBackPress] = useState(0);
  const [showDoubleTapToast, setShowDoubleTapToast] = useState(false);

  // 1. Clear Cache on Mount (Refresh)
  useEffect(() => {
    async function clearCacheOnLoad() {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
          console.log("Caches cleared successfully on refresh.");
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
          console.log("Service workers unregistered on refresh.");
        }
        // Clear session storage to keep it super fresh
        sessionStorage.clear();
      } catch (err) {
        console.error("Failed to clear cache on load:", err);
      }
    }
    clearCacheOnLoad();
  }, []);

  // 2. Intercept Back Button (only when on homepage)
  useEffect(() => {
    // Only intercept back button when on the home page '/'
    if (location.pathname !== '/') {
      return;
    }

    // Push a dummy state to history so there is something to go back from
    // without actually changing the path
    window.history.pushState({ noExit: true }, "", window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      // Re-push the state to maintain interception for next time
      window.history.pushState({ noExit: true }, "", window.location.href);

      const now = Date.now();
      if (now - lastBackPress < 2000) {
        // Double press back button within 2 seconds -> Exit (go back for real)
        // To allow exit, we remove listener and go back
        window.removeEventListener('popstate', handlePopState);
        // Navigate away or go back twice to bypass our pushed state
        window.history.go(-2);
      } else {
        setLastBackPress(now);
        setShowExitModal(true);
        setShowDoubleTapToast(true);
        setTimeout(() => setShowDoubleTapToast(false), 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, lastBackPress]);

  const handleExit = () => {
    // Attempt to close the window or go back out of the site
    // This goes back before the pushed history states
    window.history.go(-2);
    // Fallback if inside a webview/tab
    setTimeout(() => {
      window.close();
    }, 100);
  };

  return (
    <>
      {/* Toast Notification for Double Back Press */}
      <AnimatePresence>
        {showDoubleTapToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-white text-xs px-4 py-2.5 rounded-full shadow-lg border border-white/10 z-[9999] font-medium tracking-tight pointer-events-none"
            style={{ direction: 'rtl' }}
          >
            برای خروج از سایت، یک‌بار دیگر دکمه بازگشت را بزنید
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant Exit Modal */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[var(--color-asura-card)] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 text-right"
              style={{ direction: 'rtl' }}
            >
              <button
                onClick={() => setShowExitModal(false)}
                className="absolute top-4 left-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-4 text-red-500">
                <div className="p-2 bg-red-500/10 rounded-xl">
                  <LogOut size={22} />
                </div>
                <h3 className="text-lg font-bold text-white">خروج از وبسایت</h3>
              </div>

              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                آیا می‌خواهید از وبسایت خارج شوید؟
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleExit}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/10 active:scale-[0.98]"
                >
                  بله، خروج
                </button>
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-bold text-sm transition-all border border-white/5"
                >
                  خیر، می‌مانم
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
