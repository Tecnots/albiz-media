import { Award, Star, TrendingUp } from "lucide-react";
import type { PublicUserData } from "../PublicProfile";

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const BADGE_POOL = [
  { name: "Thought Leader", color: "#2563eb", bg: "#dbeafe" },
  { name: "Connector", color: "#7c3aed", bg: "#ede9fe" },
  { name: "Innovator", color: "#0891b2", bg: "#cffafe" },
  { name: "Top Creator", color: "#d97706", bg: "#fef3c7" },
  { name: "Mentor", color: "#16a34a", bg: "#dcfce7" },
  { name: "Contributor", color: "#dc2626", bg: "#fee2e2" },
  { name: "Expert", color: "#7c3aed", bg: "#f3e8ff" },
  { name: "Pioneer", color: "#0284c7", bg: "#e0f2fe" },
];

const AWARD_POOL = [
  "Most Engaging Content",
  "Top Community Voice",
  "Excellence in Writing",
  "Rising Star",
  "Best Industry Insight",
];

function deriveMilestones(user: PublicUserData, postsCount: number) {
  const milestones: { label: string; value: string }[] = [];

  const joinYear = new Date(user.createdAt).getFullYear();
  milestones.push({ label: "Member since", value: String(joinYear) });

  const followers = parseInt(user.followers, 10) || 0;
  if (followers > 0) {
    milestones.push({
      label: "Total followers",
      value:
        followers >= 1000
          ? `${(followers / 1000).toFixed(1).replace(/\.0$/, "")}k`
          : String(followers),
    });
  }

  if (postsCount > 0) {
    milestones.push({ label: "Posts published", value: String(postsCount) });
  }

  if (user.experience.length > 0) {
    milestones.push({
      label: "Companies worked at",
      value: String(user.experience.length),
    });
  }

  if (user.skills.length > 0) {
    milestones.push({ label: "Skills listed", value: String(user.skills.length) });
  }

  return milestones;
}

export default function PublicAchievements({
  user,
  postsCount,
}: {
  user: PublicUserData;
  postsCount: number;
}) {
  const rng = seededRng(user.id * 31337);

  const badgeCount = 2 + Math.floor(rng() * 3);
  const shuffledBadges = [...BADGE_POOL].sort(() => rng() - 0.5).slice(0, badgeCount);

  const awardCount = 1 + Math.floor(rng() * 2);
  const shuffledAwards = [...AWARD_POOL].sort(() => rng() - 0.5).slice(0, awardCount);

  const milestones = deriveMilestones(user, postsCount);

  return (
    <div className="space-y-4">
      {/* Badges */}
      <div
        className="bg-white rounded-xl p-5"
        style={{ border: "1px solid #e5e5e5" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4" style={{ color: "#737373" }} />
          <span className="text-sm font-semibold" style={{ color: "#0a0a0a" }}>
            Badges
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {shuffledBadges.map((badge) => (
            <span
              key={badge.name}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.name}
            </span>
          ))}
          {user.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: "#f5f5f5",
                color: "#525252",
                border: "1px solid #e5e5e5",
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Awards */}
      <div
        className="bg-white rounded-xl p-5"
        style={{ border: "1px solid #e5e5e5" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4" style={{ color: "#737373" }} />
          <span className="text-sm font-semibold" style={{ color: "#0a0a0a" }}>
            Awards
          </span>
        </div>
        <div className="space-y-3">
          {shuffledAwards.map((award) => (
            <div key={award} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#fef3c7" }}
              >
                <Award className="w-4 h-4" style={{ color: "#d97706" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#0a0a0a" }}>
                  {award}
                </p>
                <p className="text-xs" style={{ color: "#a3a3a3" }}>
                  Albiz Media · {new Date(user.createdAt).getFullYear()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div
          className="bg-white rounded-xl p-5"
          style={{ border: "1px solid #e5e5e5" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: "#737373" }} />
            <span className="text-sm font-semibold" style={{ color: "#0a0a0a" }}>
              Milestones
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {milestones.map((m) => (
              <div
                key={m.label}
                className="rounded-xl p-3 text-center"
                style={{ background: "#f9f9f9", border: "1px solid #f0f0f0" }}
              >
                <span
                  className="block text-xl font-bold"
                  style={{ color: "#0a0a0a" }}
                >
                  {m.value}
                </span>
                <span
                  className="block text-[11px] mt-0.5"
                  style={{ color: "#737373" }}
                >
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}