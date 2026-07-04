import PublicPostCard from "./PublicPostCard";
import type { PublicUserData, PublicPost } from "../PublicProfile";

export default function PublicPosts({
  user,
  posts,
}: {
  user: PublicUserData;
  posts: PublicPost[];
}) {
  if (posts.length === 0) {
    return (
      <div
        className="bg-white rounded-xl py-16 text-center"
        style={{ border: "1px solid #e5e5e5" }}
      >
        <p className="text-sm" style={{ color: "#a3a3a3" }}>
          No posts yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PublicPostCard key={post.id} post={post} user={user} />
      ))}
    </div>
  );
}