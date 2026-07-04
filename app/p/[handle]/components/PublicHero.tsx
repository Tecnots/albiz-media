import Image from "next/image";
import { MapPin, Globe, Calendar } from "lucide-react";
import type { PublicUserData } from "../PublicProfile";

function formatStat(raw: string): string {
  const n = parseInt(raw, 10) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

export default function PublicHero({
  user,
  displayLocation,
  postsCount,
}: {
  user: PublicUserData;
  displayLocation: string | null;
  postsCount: number;
}) {
  const joinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-white" style={{ borderBottom: "1px solid #ebebeb" }}>
      {/* Cover */}
      <div
        className="relative w-full"
        style={{ height: "clamp(140px, 22vw, 260px)", background: "#f0f0f0" }}
      >
        {user.coverPhoto && (
          <Image
            src={user.coverPhoto}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Avatar */}
        <div className="relative -mt-12 mb-3" style={{ width: "fit-content" }}>
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 80,
              height: 80,
              border: "3px solid white",
              boxShadow: "0 0 0 1px #e5e5e5",
            }}
          >
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={user.name}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                priority
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: "#f5f5f5" }}
              >
                <span
                  className="text-2xl font-semibold"
                  style={{ color: "#737373" }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Name + title */}
        <div className="pb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-xl font-bold leading-tight"
              style={{ color: "#0a0a0a" }}
            >
              {user.name}
            </h1>
            {user.verified && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[9px] font-bold flex-shrink-0"
                style={{ background: "#F44444" }}
                aria-label="Verified"
              >
                ✓
              </span>
            )}
            {user.role === "CIRCLE" && (
              <span
                className="px-2 py-0.5 text-white text-[10px] font-medium rounded-full"
                style={{ background: "#F44444" }}
              >
                Circle
              </span>
            )}
          </div>

          {user.title && (
            <p className="text-sm mt-0.5" style={{ color: "#737373" }}>
              {user.title}
            </p>
          )}

          {/* Meta row */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[13px]"
            style={{ color: "#737373" }}
          >
            {displayLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {displayLocation}
              </span>
            )}
            {user.website && (
              <a
                href={
                  user.website.startsWith("http")
                    ? user.website
                    : `https://${user.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ color: "#737373" }}
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                {user.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              {joinDate}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 mt-4">
            <div>
              <span
                className="text-lg font-bold"
                style={{ color: "#0a0a0a" }}
              >
                {formatStat(user.followers)}
              </span>
              <span
                className="text-xs ml-1.5"
                style={{ color: "#737373" }}
              >
                Followers
              </span>
            </div>
            <div
              className="w-px self-stretch"
              style={{ background: "#e5e5e5" }}
            />
            <div>
              <span
                className="text-lg font-bold"
                style={{ color: "#0a0a0a" }}
              >
                {formatStat(user.followingCount)}
              </span>
              <span
                className="text-xs ml-1.5"
                style={{ color: "#737373" }}
              >
                Following
              </span>
            </div>
            <div
              className="w-px self-stretch"
              style={{ background: "#e5e5e5" }}
            />
            <div>
              <span
                className="text-lg font-bold"
                style={{ color: "#0a0a0a" }}
              >
                {postsCount}
              </span>
              <span
                className="text-xs ml-1.5"
                style={{ color: "#737373" }}
              >
                Posts
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}