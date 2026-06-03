export default function Loading() {
  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto animate-pulse">
      <div className="sticky top-0 bg-white z-30 py-4 px-4 sm:px-6 border-b border-[#e5e5e5]">
        <div className="flex items-center justify-between mb-3">
          <div className="h-7 w-24 rounded shimmer" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-full shimmer" />
            <div className="w-9 h-9 rounded-lg shimmer" />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-hidden pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-7 w-20 rounded-full shimmer flex-shrink-0" />
          ))}
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="relative rounded-xl overflow-hidden aspect-[9/16] shimmer" />
          ))}
        </div>
      </div>
    </main>
  );
}
