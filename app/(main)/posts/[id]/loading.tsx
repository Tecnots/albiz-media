export default function Loading() {
  return (
    <main className="w-full flex-1 min-w-0 bg-white overflow-hidden animate-pulse h-screen">
      <header className="sticky top-0 z-30 bg-white border-b border-[#f0f0f0] px-4 py-3">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="h-8 w-20 rounded shimmer" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg shimmer" />
            <div className="h-8 w-8 rounded-lg shimmer" />
          </div>
        </div>
      </header>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full shimmer" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded shimmer" />
              <div className="h-3 w-48 rounded shimmer" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-full shimmer" />
        </div>
        <div className="flex gap-4">
          <div className="h-3 w-16 rounded shimmer" />
          <div className="h-3 w-20 rounded shimmer" />
          <div className="h-3 w-12 rounded shimmer" />
        </div>
        <div className="h-6 w-5/6 rounded shimmer" />
        <div className="space-y-2.5">
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-5/6 rounded shimmer" />
          <div className="h-4 w-2/3 rounded shimmer" />
        </div>
        <div className="w-full h-64 sm:h-80 rounded-2xl shimmer" />
        <div className="flex items-center justify-between py-4 border-t border-b border-[#f0f0f0]">
          <div className="flex gap-6">
            <div className="h-5 w-12 rounded shimmer" />
            <div className="h-5 w-12 rounded shimmer" />
          </div>
          <div className="h-5 w-6 rounded shimmer" />
        </div>
      </div>
    </main>
  );
}
