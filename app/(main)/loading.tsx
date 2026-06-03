import { PostCardShimmer, ArticleCardShimmer } from "@/app/lib/shared-components";

export default function Loading() {
  return (
    <div className="animate-pulse flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-4">
        {/* Shimmer for Feed Header */}
        <div className="sticky top-0 bg-white z-30 py-2.5 md:py-4 -mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="h-6 w-32 rounded shimmer" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg shimmer" />
              <div className="w-8 h-8 rounded-lg shimmer" />
            </div>
          </div>
          <div className="flex gap-2 overflow-hidden pb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-7 w-20 rounded-full shimmer flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Shimmer for Feed Posts */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4">
            <PostCardShimmer />
            <ArticleCardShimmer />
          </div>
        ))}
      </div>
    </div>
  );
}
