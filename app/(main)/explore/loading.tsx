export default function Loading() {
  return (
    <main className="flex-1 min-w-0 bg-white animate-pulse">
      <div className="sticky top-0 bg-white z-30 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-2.5 md:mb-4 pt-2.5 md:pt-4 px-4 md:px-6">
          <div className="h-7 w-24 rounded shimmer" />
          <div className="w-9 h-9 rounded-lg shimmer" />
        </div>
        <div className="flex gap-1 md:gap-1.5 overflow-hidden pb-3 px-4 md:px-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-20 rounded-full shimmer flex-shrink-0" />
          ))}
        </div>
      </div>
      <div className="px-4 md:px-6 pt-3 md:pt-4 pb-6 space-y-4 md:space-y-5">
        <div>
          <div className="h-3 w-24 rounded shimmer mb-2 md:mb-3" />
          <div className="flex gap-2 md:gap-3 overflow-hidden pb-2 -mx-3 px-3 md:-mx-4 md:px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-w-[160px] md:min-w-[180px] h-16 rounded-xl shimmer flex-shrink-0" />
            ))}
          </div>
        </div>
        <div className="flex gap-1 md:gap-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-16 rounded-full shimmer" />
          ))}
        </div>
        <div className="space-y-1.5 md:space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border border-[#e5e5e5]">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full shimmer flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded shimmer mb-1.5" />
                <div className="h-3 w-48 rounded shimmer" />
              </div>
              <div className="w-16 h-8 rounded-full shimmer hidden sm:block" />
              <div className="w-20 h-8 rounded-full shimmer" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
