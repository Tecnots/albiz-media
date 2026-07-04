import Image from "next/image";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { sanitizeHtml } from "@/lib/html-sanitize";
import type { PublicUserData, PublicPost } from "../PublicProfile";

export default function PublicPostCard({
  post,
  user,
}: {
  post: PublicPost;
  user: PublicUserData;
}) {
  const { stats } = post;

  return (
    <div
      className="rounded-xl bg-white p-4"
      style={{ border: "1px solid #e5e5e5" }}
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="rounded-full overflow-hidden flex-shrink-0"
          style={{ width: 36, height: 36, border: "1px solid #e5e5e5" }}
        >
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name}
              width={36}
              height={36}
              className="object-cover w-full h-full"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "#f5f5f5" }}
            >
              <span className="text-xs font-medium" style={{ color: "#737373" }}>
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm font-medium truncate"
              style={{ color: "#0a0a0a" }}
            >
              {user.name}
            </span>
            {user.verified && (
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex-shrink-0"
                style={{ background: "#F44444" }}
              >
                ✓
              </span>
            )}
            <span className="text-xs" style={{ color: "#a3a3a3" }}>
              · {post.date}
            </span>
          </div>
          {user.title && (
            <p className="text-xs truncate" style={{ color: "#737373" }}>
              {user.title}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      {post.title && (
        <h3
          className="font-semibold text-sm mb-1.5 leading-snug"
          style={{ color: "#0a0a0a" }}
        >
          {post.title}
        </h3>
      )}
      {post.content && (
        <div
          className="text-sm mb-3 leading-relaxed [&_b]:font-bold [&_i]:italic [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 line-clamp-5"
          style={{ color: "#262626" }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
        />
      )}
      {post.image && (
        <div className="rounded-xl overflow-hidden mb-3" style={{ maxHeight: 320 }}>
          <Image
            src={post.image}
            alt={post.title || ""}
            width={700}
            height={360}
            className="object-cover w-full"
            unoptimized
          />
        </div>
      )}

      {/* Static read-only stats — no interactive controls */}
      <div
        className="flex items-center gap-5 pt-2.5"
        style={{ borderTop: "1px solid #f0f0f0" }}
      >
        <span className="flex items-center gap-1 text-xs" style={{ color: "#a3a3a3" }}>
          <Heart className="w-3.5 h-3.5" />
          {stats.likes}
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "#a3a3a3" }}>
          <MessageCircle className="w-3.5 h-3.5" />
          {stats.comments}
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "#a3a3a3" }}>
          <Share2 className="w-3.5 h-3.5" />
          {stats.shares}
        </span>
      </div>
    </div>
  );
}