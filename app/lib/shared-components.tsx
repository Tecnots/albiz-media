"use client";

import Image from "next/image";
import { Circle, Check } from "lucide-react";

export function AlbizLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * (104 / 121)} viewBox="0 0 121 104" fill="none">
      <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444" />
      <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444" />
      <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444" />
      <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212" />
      <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212" />
    </svg>
  );
}

export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Circle className="w-3.5 h-3.5 fill-[#F44444] text-[#F44444]" />
      <Check className="w-2 h-2 text-white absolute" strokeWidth={3} />
    </span>
  );
}

export function Sparkline({ data, color = "#F44444", width = 80, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export function SuggestedProfiles() {
  // Lazy import to avoid circular dependency
  const { useContext } = require("react");
  const { FollowingContext } = require("@/app/lib/contexts");
  const { users } = require("@/app/lib/data");

  const suggestions = users.slice(3);
  const { following, toggleFollow } = useContext(FollowingContext);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[#0a0a0a]">Suggested Profiles</h2>
        <button className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">View all</button>
      </div>
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {suggestions.map((user: any) => {
          const isFollowing = following.has(user.id);
          return (
            <div key={user.id} className="flex items-center gap-2.5 p-3">
              <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${
                user.hasStory ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" : "ring-1 ring-[#e5e5e5]"
              }`}>
                <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm truncate text-[#0a0a0a]">{user.name}</span>
                  <VerifiedBadge className="scale-90" />
                </div>
                <span className="text-xs text-[#737373] truncate block">{user.title}</span>
              </div>
              <button
                onClick={() => toggleFollow(user.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ease-out flex-shrink-0 ${
                  isFollowing
                    ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                    : "bg-[#F44444] text-white border border-transparent hover:bg-[#d64d3c]"
                } active:scale-95`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecentStories() {
  const { users } = require("@/app/lib/data");
  const storyUsers = [users[1], users[2], users[3]];

  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold mb-3 text-[#0a0a0a]">Recent Stories</h2>
      <div className="flex gap-3">
        {storyUsers.map((user: any) => (
          <div key={user.id} className="flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image src={user.avatar} alt={user.name} width={56} height={56} className="object-cover w-full h-full" />
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-[#525252] truncate max-w-14">{user.name.split(" ")[0]}</span>
              <VerifiedBadge className="scale-75" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdCard() {
  return (
    <div className="rounded-2xl overflow-hidden relative flex-1">
      <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 rounded text-xs text-white z-10">Ad</div>
      <Image src="https://picsum.photos/seed/ad-startup/400/600" alt="Advertisement" width={400} height={600} className="object-cover w-full h-full" />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-white font-semibold text-lg">inito</span>
        <p className="text-sm text-white mt-1">At-home diagnostics startup Inito raises $29 million from BII, Fireside Ventures</p>
      </div>
    </div>
  );
}

export function RightSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
      <RecentStories />
      <SuggestedProfiles />
      <div className="flex-1 flex flex-col min-h-0">
        <AdCard />
      </div>
    </aside>
  );
}
