import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Globe } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/app/components/Avatar";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

async function getAuthor(handle: string) {
  const user = await prisma.user.findUnique({
    where: { handle },
    select: {
      id: true,
      name: true,
      handle: true,
      avatar: true,
      title: true,
      bio: true,
      role: true,
      verified: true,
      location: true,
      website: true,
      coverPhoto: true,
      joinedDate: true,
    },
  });
  if (!user) return null;
  // Only AUTHOR / ADMIN are reachable here. Other roles 404 out so the route
  // stays meaningfully tied to "writers".
  if (user.role !== "AUTHOR" && user.role !== "ADMIN") return null;
  return user;
}

async function getAuthorArticles(userId: number) {
  // Published articles only.
  const ids = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Post"
    WHERE "userId" = ${userId} AND type = 'ARTICLE'
      AND (status = 'published' OR status IS NULL)
    ORDER BY id DESC
    LIMIT 50
  `;
  if (!ids.length) return [];
  return prisma.post.findMany({
    where: { id: { in: ids.map(r => r.id) } },
    select: {
      id: true, title: true, description: true, image: true,
      date: true, tags: true, views: true, likes: true,
    },
    orderBy: { id: "desc" },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const resolved = await params;
  const author = await getAuthor(resolved.username);
  if (!author) return { title: "Author not found" };
  const url = `${APP_URL}/author/${author.handle}`;
  return {
    title: `${author.name} — Albiz`,
    description: author.bio ?? author.title ?? `Articles by ${author.name} on Albiz.`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      title: author.name,
      description: author.bio ?? author.title ?? "",
      siteName: "Albiz",
    },
  };
}

export default async function AuthorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const resolved = await params;
  const author = await getAuthor(resolved.username);
  if (!author) notFound();

  const articles = await getAuthorArticles(author.id);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-[#f0f0f0]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#525252] hover:text-[#0a0a0a] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Albiz
          </Link>
          <span className="text-xs font-medium text-[#a3a3a3] uppercase tracking-wider">Author</span>
        </div>
      </div>

      {/* Cover */}
      {author.coverPhoto && (
        <div className="relative h-48 sm:h-64 bg-[#f5f5f5]">
          <Image
            src={author.coverPhoto}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto px-6">
        <div className={`flex flex-col sm:flex-row sm:items-end gap-5 ${author.coverPhoto ? "-mt-12" : "mt-10"} mb-8`}>
          <Avatar
            src={author.avatar}
            name={author.name}
            size={96}
            className="ring-4 ring-white bg-[#f5f5f5] flex-shrink-0"
          />
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-[#0a0a0a] truncate">{author.name}</h1>
              {author.verified && (
                <span className="text-[10px] font-semibold text-[#22c55e] bg-[#F0FDF4] px-1.5 py-0.5 rounded-full">Verified</span>
              )}
            </div>
            {author.title && <p className="text-sm text-[#737373] mb-2">{author.title}</p>}
            <div className="flex items-center gap-4 text-xs text-[#a3a3a3] flex-wrap">
              <span>@{author.handle}</span>
              {author.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {author.location}
                </span>
              )}
              {author.website && (
                <a href={author.website.startsWith("http") ? author.website : `https://${author.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#525252] transition-colors">
                  <Globe className="w-3 h-3" />
                  {author.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {author.joinedDate && <span>Joined {author.joinedDate}</span>}
            </div>
          </div>
        </div>

        {/* Bio */}
        {author.bio && (
          <div className="mb-10 max-w-2xl">
            <p className="text-[15px] text-[#262626] leading-relaxed whitespace-pre-line">{author.bio}</p>
          </div>
        )}

        {/* Articles */}
        <div className="border-t border-[#f0f0f0] pt-8 pb-16">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-sm font-semibold text-[#0a0a0a]">Published articles</h2>
            <span className="text-xs text-[#a3a3a3]">{articles.length}</span>
          </div>

          {articles.length === 0 ? (
            <p className="text-sm text-[#a3a3a3] py-12 text-center">No articles published yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {articles.map(article => (
                <Link
                  key={article.id}
                  href={`/article/${article.id}`}
                  className="group rounded-xl overflow-hidden border border-[#f0f0f0] hover:border-[#e5e5e5] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all"
                >
                  {article.image && (
                    <div className="relative aspect-[16/9] bg-[#f5f5f5] overflow-hidden">
                      <Image
                        src={article.image}
                        alt={article.title ?? ""}
                        fill
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    {article.tags.length > 0 && (
                      <p className="text-[10px] font-medium text-[#F44444] uppercase tracking-wide mb-1.5">
                        {article.tags[0]}
                      </p>
                    )}
                    <h3 className="text-sm font-semibold text-[#0a0a0a] leading-snug mb-1.5 line-clamp-2 group-hover:text-[#F44444] transition-colors">
                      {article.title}
                    </h3>
                    {article.description && (
                      <p className="text-xs text-[#737373] line-clamp-2 mb-2">{article.description}</p>
                    )}
                    <p className="text-[11px] text-[#a3a3a3]">{article.date}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
