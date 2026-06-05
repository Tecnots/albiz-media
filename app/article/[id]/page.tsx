import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function getArticle(id: number) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { articleContent: true, user: { select: { name: true, handle: true, avatar: true, title: true } } },
  });
  if (!post || post.type !== "ARTICLE") return null;
  return post;
}

// ─── Dynamic metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const article = await getArticle(Number(params.id));
  if (!article) return { title: "Article not found" };

  const title = article.title ?? "Untitled Article";
  const description = article.seoDescription ?? article.description ?? article.content?.slice(0, 160) ?? "";
  const image = article.image ?? `${APP_URL}/og-default.png`;
  const url = `${APP_URL}/article/${article.id}`;
  const authorName = article.user?.name ?? "Albiz";

  return {
    title,
    description,
    authors: [{ name: authorName }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Albiz",
      publishedTime: article.date,
      authors: [authorName],
      tags: article.tags,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@albizmedia",
      title,
      description,
      images: [image],
    },
  };
}

// ─── JSON-LD structured data ──────────────────────────────────────────────────

function ArticleJsonLd({ article }: { article: NonNullable<Awaited<ReturnType<typeof getArticle>>> }) {
  const url = `${APP_URL}/article/${article.id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title ?? "",
    description: article.seoDescription ?? article.description ?? "",
    image: article.image ? [article.image] : [],
    datePublished: article.date,
    dateModified: article.date,
    url,
    author: {
      "@type": "Person",
      name: article.user?.name ?? "Albiz",
      url: article.user?.handle ? `${APP_URL}/${article.user.handle}` : APP_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Albiz",
      url: APP_URL,
      logo: { "@type": "ImageObject", url: `${APP_URL}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: article.tags.join(", "),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await getArticle(Number(params.id));
  if (!article) notFound();

  const paragraphs = article.articleContent?.paragraphs ?? (article.content ? [article.content] : []);

  return (
    <>
      <ArticleJsonLd article={article} />

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <div className="border-b border-[#f0f0f0] px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-[#0a0a0a] hover:opacity-70 transition-opacity">
            <svg width="24" height="21" viewBox="0 0 121 104" fill="none">
              <path d="M71.9121 20.311L59.8833 0L0 103.861H23.2838L71.9121 20.311Z" fill="#FF4444"/>
              <path d="M96.0998 62.082L83.9408 41.909L47.9848 103.861H71.9121L96.0998 62.082Z" fill="#FF4444"/>
              <path d="M120.15 103.861L108.381 83.297L96.0998 103.861H120.15Z" fill="#FF4444"/>
              <path d="M108.058 83.316L96.144 62.453L84.054 83.316L96.144 103.795L108.058 83.316Z" fill="#AF1212"/>
              <path d="M47.661 62.453L60.042 83.316L47.661 103.795L35.755 82.55L47.661 62.453Z" fill="#AF1212"/>
            </svg>
            <span className="text-sm font-semibold">Albiz</span>
          </Link>
          <Link href="/" className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">← Feed</Link>
        </div>

        <article className="max-w-3xl mx-auto px-6 py-10">
          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {article.tags.map(tag => (
                <span key={tag} className="text-[11px] font-medium text-[#F44444] uppercase tracking-wide">{tag}</span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-4">{article.title}</h1>

          {/* Subtitle/description */}
          {article.description && (
            <p className="text-lg text-[#525252] leading-relaxed mb-6">{article.description}</p>
          )}

          {/* Author + date */}
          <div className="mb-8 pb-8 border-b border-[#f0f0f0]">
            <p className="text-xs font-medium text-[#737373] mb-3">Written By</p>
            <Link
              href={article.user?.handle ? `/author/${article.user.handle}` : "/"}
              className="flex items-center gap-3 group"
            >
              {article.user?.avatar && (
                <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] flex-shrink-0">
                  <Image src={article.user.avatar} alt={article.user.name} width={40} height={40} className="object-cover w-full h-full" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[#0a0a0a] group-hover:text-[#F44444] transition-colors">{article.user?.name ?? "Albiz"}</p>
                {article.user?.title && (
                  <p className="text-xs text-[#737373]">{article.user.title}</p>
                )}
              </div>
            </Link>
            <p className="text-xs text-[#a3a3a3] mt-3">{article.date}</p>
          </div>

          {/* Cover image */}
          {article.image && (
            <div className="rounded-2xl overflow-hidden mb-8 aspect-video relative bg-[#f5f5f5]">
              <Image
                src={article.image}
                alt={article.title ?? ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
                quality={90}
              />
            </div>
          )}

          {/* Body — render HTML from TipTap or plain paragraphs */}
          {paragraphs.length === 1 && paragraphs[0].startsWith("<") ? (
            <div
              className="ProseMirror text-[#262626] text-base leading-7"
              dangerouslySetInnerHTML={{ __html: paragraphs[0] }}
            />
          ) : (
            <div className="space-y-5">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[#262626] text-base leading-[1.8]">{p}</p>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-[#f0f0f0]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors"
            >
              Read more on Albiz
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
