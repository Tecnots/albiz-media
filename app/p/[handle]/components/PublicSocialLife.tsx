import type { PublicUserData } from "../PublicProfile";

function formatStat(raw: string): string {
  const n = parseInt(raw, 10) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

export default function PublicSocialLife({
  user,
  postsCount,
}: {
  user: PublicUserData;
  postsCount: number;
}) {
  const stats = [
    { label: "Followers", value: formatStat(user.followers) },
    { label: "Following", value: formatStat(user.followingCount) },
    { label: "Posts", value: String(postsCount) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-4 text-center"
            style={{ border: "1px solid #e5e5e5" }}
          >
            <span
              className="block text-2xl font-bold"
              style={{ color: "#0a0a0a" }}
            >
              {s.value}
            </span>
            <span className="text-xs mt-0.5 block" style={{ color: "#737373" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {user.interests.length > 0 && (
        <div
          className="bg-white rounded-xl p-5"
          style={{ border: "1px solid #e5e5e5" }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: "#737373" }}>
            Interests
          </p>
          <div className="flex flex-wrap gap-2">
            {user.interests.map((interest) => (
              <span
                key={interest}
                className="px-3 py-1.5 rounded-full text-xs"
                style={{
                  background: "#f5f5f5",
                  color: "#525252",
                  border: "1px solid #e5e5e5",
                }}
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}