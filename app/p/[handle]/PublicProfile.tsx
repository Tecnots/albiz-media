"use client";

import { useState } from "react";
import PublicHero from "./components/PublicHero";
import PublicPosts from "./components/PublicPosts";
import PublicAbout from "./components/PublicAbout";
import PublicSocialLife from "./components/PublicSocialLife";
import PublicAchievements from "./components/PublicAchievements";
import { AlbizLogo } from "@/app/lib/shared-components";

export type PublicUserData = {
  id: number;
  name: string;
  handle: string;
  title: string | null;
  avatar: string | null;
  coverPhoto: string | null;
  bio: string | null;
  location: string | null;
  country: string | null;
  district: string | null;
  city: string | null;
  website: string | null;
  verified: boolean;
  role: string;
  createdAt: string;
  followers: string;
  followingCount: string;
  customDomain: string | null;
  showBranding: boolean;
  experience: Array<{
    id: number;
    role: string;
    company: string;
    logo: string | null;
    period: string;
    description: string | null;
  }>;
  education: Array<{
    id: number;
    school: string;
    degree: string;
    period: string;
    logo: string | null;
  }>;
  skills: string[];
  interests: string[];
  customTabs: Array<{ id: number; title: string; content: string }>;
  highlights: Array<{
    id: number;
    name: string;
    cover: string | null;
    storyCount: number;
  }>;
};

export type PublicPost = {
  id: number;
  type: "post" | "article";
  title: string | null;
  content: string | null;
  date: string;
  image: string | null;
  tags: string[];
  stats: { views: string; likes: string; comments: string; shares: string };
};

const BASE_TABS = ["Posts", "About", "Social Life", "Achievements"];

export default function PublicProfile({
  user,
  posts,
}: {
  user: PublicUserData;
  posts: PublicPost[];
}) {
  const [activeTab, setActiveTab] = useState(0);

  const allTabs = [
    ...BASE_TABS,
    ...user.customTabs.map((t) => t.title),
  ];

  const displayLocation =
    user.location ||
    [user.city, user.district, user.country].filter(Boolean).join(", ") ||
    null;

  function renderTab() {
    if (activeTab === 0) return <PublicPosts user={user} posts={posts} />;
    if (activeTab === 1) return <PublicAbout user={user} />;
    if (activeTab === 2) return <PublicSocialLife user={user} postsCount={posts.length} />;
    if (activeTab === 3) return <PublicAchievements user={user} postsCount={posts.length} />;

    const customIndex = activeTab - BASE_TABS.length;
    const tab = user.customTabs[customIndex];
    if (!tab) return <PublicPosts user={user} posts={posts} />;

    return (
      <div className="bg-white rounded-xl p-5 border border-[#e5e5e5]">
        <p className="text-sm text-[#262626] leading-relaxed whitespace-pre-wrap">
          {tab.content}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f6f6f6" }}>
      <PublicHero
        user={user}
        displayLocation={displayLocation}
        postsCount={posts.length}
      />

      {/* Tab strip */}
      <div
        className="border-b sticky top-0 z-20 bg-white"
        style={{ borderColor: "#e5e5e5" }}
      >
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 flex overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {allTabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className="relative px-4 py-3.5 text-[13px] font-medium whitespace-nowrap transition-colors flex-shrink-0"
              style={{ color: i === activeTab ? "#F44444" : "#737373" }}
            >
              {tab}
              {i === activeTab && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: "#F44444" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {renderTab()}
      </div>

      {/* Branding footer */}
      {user.showBranding && (
        <div
          className="py-5 flex items-center justify-center gap-2"
          style={{ borderTop: "1px solid #ebebeb" }}
        >
          <AlbizLogo size={14} />
          <span className="text-xs" style={{ color: "#a3a3a3" }}>
            Built with
          </span>
          <a
            href="https://albizmedia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: "#525252" }}
          >
            Albiz Media
          </a>
        </div>
      )}
    </div>
  );
}