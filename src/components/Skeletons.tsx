export function SeriesCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden flex flex-col animate-pulse">
      <div className="relative aspect-[2/3] bg-zinc-800 shrink-0"></div>
      <div className="p-3 flex-grow flex flex-col bg-[var(--color-asura-card)]">
        <div className="h-4 bg-zinc-700/50 rounded w-3/4 mb-3"></div>
        <div className="mt-auto space-y-1.5 pt-2 border-t border-[var(--color-asura-border)]">
          <div className="flex justify-between items-center bg-zinc-700/30 px-1.5 py-1 rounded h-5"></div>
          <div className="flex justify-between items-center bg-zinc-700/30 px-1.5 py-1 rounded h-5"></div>
        </div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex gap-4 items-center p-2 rounded-lg py-3 animate-pulse">
      <div className="w-6 h-6 bg-zinc-800/50 rounded"></div>
      <div className="w-12 h-16 shrink-0 bg-zinc-800 rounded"></div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="h-3 bg-zinc-700/50 rounded w-full"></div>
        <div className="h-2 bg-zinc-700/50 rounded w-1/2"></div>
        <div className="h-2 bg-zinc-700/50 rounded w-1/3"></div>
      </div>
    </div>
  );
}

export function ReaderSkeleton() {
  return (
    <div className="bg-[#0a0a0c] min-h-screen animate-pulse">
      <div className="fixed top-0 left-0 right-0 h-14 bg-zinc-900 border-b border-white/5"></div>
      <div className="pt-20 px-4 max-w-3xl mx-auto flex flex-col gap-4">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="w-full aspect-[2/3] bg-zinc-800 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}

export function SeriesDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden bg-zinc-900 border-b border-white/5"></div>
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-32 md:-mt-48 relative z-10 pb-12">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 shadow-2xl border border-white/10"></div>
            <div className="mt-6 flex flex-col gap-3">
              <div className="h-10 bg-zinc-800 rounded-lg w-full"></div>
              <div className="h-10 bg-zinc-800 rounded-lg w-full"></div>
            </div>
          </div>
          <div className="flex-1 pt-4 md:pt-16">
            <div className="flex gap-2 mb-4">
              <div className="w-16 h-4 bg-zinc-700/50 rounded"></div>
              <div className="w-16 h-4 bg-zinc-700/50 rounded"></div>
            </div>
            <div className="w-3/4 h-12 bg-zinc-700/50 rounded mb-2"></div>
            <div className="w-1/2 h-4 bg-zinc-700/50 rounded mb-8"></div>
            
            <div className="flex gap-6 mb-8">
              <div className="w-16 h-8 bg-zinc-700/50 rounded"></div>
              <div className="w-16 h-8 bg-zinc-700/50 rounded"></div>
            </div>
            
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8 h-32"></div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 h-64"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
