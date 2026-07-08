"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Link2, Music } from "lucide-react";
import { api } from "@/app/lib/api";
import type { StickerElement } from "@/app/lib/storySticker";
import type { InteractionContext } from "@/app/lib/contexts";

// Per-type visual content for a Story sticker element. The caller (StoryViewer)
// owns positioning/rotation/opacity/z-index — this only renders what's *inside*
// the sticker pill, so editor and viewer share the exact same wrapper styling.
// Every branch falls back to the same placeholder text the editor/viewer has
// always shown when `data` is empty, so already-published (pre-upgrade) stories
// render unchanged.

export function StoryStickerContent({
  element,
  storyTime,
  storyId,
  isSignedIn,
  requireGuestAuth,
}: {
  element: StickerElement;
  storyTime: string;
  storyId: number;
  isSignedIn: boolean;
  requireGuestAuth: (context: InteractionContext, fn: () => void) => void;
}) {
  switch (element.type) {
    case "poll":
      return <PollSticker element={element} storyId={storyId} isSignedIn={isSignedIn} requireGuestAuth={requireGuestAuth} />;
    case "question":
      return (
        <div className="min-w-[180px]">
          <div className="bg-[#F44444] px-4 py-3">
            <p className="text-sm font-semibold text-white text-center">{element.data.prompt || "Ask me anything"}</p>
          </div>
          <div className="bg-white px-3 pb-3 pt-2">
            <div className="bg-[#f5f5f5] rounded-full px-3 py-2 text-sm text-[#a3a3a3] text-center">Reply below...</div>
          </div>
        </div>
      );
    case "time":
      return <span className="text-[#0a0a0a] text-xs font-semibold">{storyTime}</span>;
    case "hashtag":
      return (
        <Link href={`/hashtag/${encodeURIComponent(element.data.tag || "trending")}`} onClick={(e) => e.stopPropagation()}>
          <span className="text-[#F44444] text-xs font-semibold">#{element.data.tag || "trending"}</span>
        </Link>
      );
    case "mention":
      return element.data.handle ? (
        <Link href={`/${element.data.handle}`} onClick={(e) => e.stopPropagation()}>
          <span className="text-xs font-semibold text-[#0a0a0a]">@{element.data.handle}</span>
        </Link>
      ) : (
        <span className="text-xs font-semibold text-[#0a0a0a]">@username</span>
      );
    case "link": {
      const url = element.data.url;
      const isSafeUrl = !!url && /^https?:\/\//i.test(url);
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isSafeUrl) window.open(url, "_blank", "noopener,noreferrer");
          }}
          className="flex items-center gap-1"
        >
          <Link2 className="w-3 h-3 text-[#F44444]" />
          <span className="text-xs font-semibold text-[#0a0a0a]">Link</span>
        </button>
      );
    }
    case "music":
      return (
        <>
          {element.data.artworkUrl ? (
            <img src={element.data.artworkUrl} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
          ) : (
            <Music className="w-3 h-3 text-white flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-white">
            {element.data.title ? `${element.data.title}${element.data.artist ? ` — ${element.data.artist}` : ""}` : "Song Name"}
          </span>
        </>
      );
    default:
      return null;
  }
}

function PollSticker({
  element,
  storyId,
  isSignedIn,
  requireGuestAuth,
}: {
  element: StickerElement;
  storyId: number;
  isSignedIn: boolean;
  requireGuestAuth: (context: InteractionContext, fn: () => void) => void;
}) {
  const question = element.data.question || "What do you think?";
  const options = element.data.options?.length ? element.data.options : ["Option 1", "Option 2"];
  const hasRealPoll = !!element.data.question;

  const [results, setResults] = useState<{ options: { index: number; text: string; count: number }[]; total: number; myVote: number | null } | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!hasRealPoll || !storyId) return;
    api.getPollResults(storyId, element.id).then(setResults).catch(() => {});
  }, [hasRealPoll, storyId, element.id]);

  if (!hasRealPoll) {
    return (
      <div className="min-w-[180px]">
        <div className="bg-[#F44444] px-4 py-3">
          <p className="text-sm font-semibold text-white text-center">{question}</p>
        </div>
        <div className="bg-white px-3 pb-3 pt-2 space-y-1.5">
          {options.map((opt, i) => (
            <div key={i} className="bg-[#f5f5f5] rounded-full px-3 py-2 text-sm text-center font-medium text-[#0a0a0a]">{opt}</div>
          ))}
        </div>
      </div>
    );
  }

  const vote = (optionIndex: number) => {
    if (voting || results?.myVote != null) return;
    if (!isSignedIn) { requireGuestAuth("like", () => vote(optionIndex)); return; }
    setVoting(true);
    setResults((prev) =>
      prev
        ? {
            ...prev,
            myVote: optionIndex,
            total: prev.total + 1,
            options: prev.options.map((o) => (o.index === optionIndex ? { ...o, count: o.count + 1 } : o)),
          }
        : prev
    );
    api
      .votePoll(storyId, element.id, optionIndex)
      .then(() => api.getPollResults(storyId, element.id).then(setResults))
      .catch(() => {})
      .finally(() => setVoting(false));
  };

  const total = results?.total ?? 0;
  const myVote = results?.myVote ?? null;

  return (
    <div className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-[#F44444] px-4 py-3">
        <p className="text-sm font-semibold text-white text-center">{question}</p>
      </div>
      <div className="bg-white px-3 pb-3 pt-2 space-y-1.5">
        {options.map((opt, i) => {
          const count = results?.options.find((o) => o.index === i)?.count ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMine = myVote === i;
          return (
            <button
              key={i}
              type="button"
              disabled={myVote != null}
              onClick={() => vote(i)}
              className={`relative w-full rounded-full px-3 py-2 text-sm text-center font-medium overflow-hidden ${myVote != null ? "cursor-default" : "cursor-pointer"} ${isMine ? "text-[#F44444]" : "text-[#0a0a0a]"} bg-[#f5f5f5]`}
            >
              {myVote != null && (
                <div className="absolute inset-0 bg-[#F44444]/10 rounded-full" style={{ width: `${pct}%` }} />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span>{opt}</span>
                {myVote != null && <span className="text-[#a3a3a3] tabular-nums text-xs">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
