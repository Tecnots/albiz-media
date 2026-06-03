export default function Loading() {
  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto animate-pulse">
      <div className="sticky top-0 bg-white z-30 border-b border-[#dbdbdb]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="h-6 w-32 rounded shimmer" />
        </div>
        <div className="flex px-4 pb-3 gap-1.5 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-16 rounded-full shimmer flex-shrink-0" />
          ))}
        </div>
      </div>
      <div className="pb-6">
        <p className="px-4 py-2 mt-2">
          <span className="inline-block h-3 w-16 rounded shimmer" />
        </p>
        <div className="px-4 space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-xl border border-[#e5e5e5]">
              <div className="w-10 h-10 rounded-full shimmer flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded shimmer mb-2" />
                <div className="h-3 w-1/4 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
