"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useContext, useEffect, useState } from "react";
import { Hash, Loader2 } from "lucide-react";
import { StoryContext } from "@/app/lib/contexts";

interface HashtagUser {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
}

interface HashtagPost {
  id: number;
  content: string | null;
  image: string | null;
  createdAt: string;
  user: HashtagUser | null;
}

interface HashtagStory {
  id: number;
  imageUrl: string;
  createdAt: string;
  user: HashtagUser | null;
}

export default function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params);
  const { setShowStoryViewer, setStoryViewingUserId } = useContext(StoryContext);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<HashtagPost[]>([]);
  const [stories, setStories] = useState<HashtagStory[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/hashtag/${encodeURIComponent(tag)}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setStories(data.stories ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tag]);

  const openStory = (userId: number) => {
    setStoryViewingUserId(userId);
    setShowStoryViewer(true);
  };

  const isEmpty = !loading && posts.length === 0 && stories.length === 0;

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white">
      <div className="px-4 pt-6 pb-4 flex items-center gap-2.5 border-b border-[#efefef]">
        <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center flex-shrink-0">
          <Hash className="w-5 h-5 text-[#F44444]" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#0a0a0a]">#{tag}</p>
          {!loading && <p className="text-[12px] text-[#a3a3a3]">{posts.length + stories.length} {posts.length + stories.length === 1 ? "result" : "results"}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-1.5 py-16">
          <p className="text-[13px] font-medium text-[#525252]">No results for #{tag}</p>
          <p className="text-[12px] text-[#a3a3a3]">Nothing has been tagged with this hashtag yet.</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          {stories.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-[#737373] mb-2.5">Stories</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {stories.map((s) => (
                  <button key={s.id} onClick={() => s.user && openStory(s.user.id)} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
                    <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#F44444] p-[2px]">
                      <div className="relative w-full h-full rounded-full overflow-hidden bg-[#f5f5f5]">
                        <Image src={s.imageUrl} alt="Story" fill className="object-cover" unoptimized />
                      </div>
                    </div>
                    <span className="text-[11px] text-[#525252] truncate w-full text-center">{s.user?.name ?? ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {posts.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-[#737373] mb-2.5">Posts</p>
              <div className="grid grid-cols-3 gap-2">
                {posts.map((p) => (
                  <Link key={p.id} href={p.user ? `/${p.user.handle}` : "#"} className="relative aspect-square rounded-lg overflow-hidden bg-[#f5f5f5] block">
                    {p.image ? (
                      <Image src={p.image} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <p className="text-[11px] text-[#737373] line-clamp-4">{p.content}</p>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
