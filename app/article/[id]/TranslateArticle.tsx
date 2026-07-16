"use client";

import Image from "next/image";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { useContentTranslation } from "@/app/lib/useContentTranslation";
import { Avatar } from "@/app/components/Avatar";

interface Author {
  name: string;
  handle: string | null;
  avatar: string | null;
  title: string | null;
}

// Renders everything from the title through the end of the body — the whole
// translatable span of the Article/News detail page — as one client
// component, so a single Translate action covers title, description, and
// body together. The surrounding Server Component (page.tsx) keeps the tags
// row and footer link, which aren't part of the translatable content.
export function TranslateArticle({
  postId,
  title,
  description,
  paragraphs,
  author,
  date,
  coverImage,
}: {
  postId: number;
  title: string | null;
  description: string | null;
  paragraphs: string[];
  author: Author | null;
  date: string;
  coverImage: string | null;
}) {
  const isHtmlBody = paragraphs.length === 1 && paragraphs[0].startsWith("<");

  const { state, translated, showTranslated, isTranslatable, handleTranslate, toggleOriginal, isRtl } = useContentTranslation(
    "article",
    postId,
    {
      title: title ?? undefined,
      description: description ?? undefined,
      paragraphs: isHtmlBody ? paragraphs.map((p) => ({ html: p })) : paragraphs,
    }
  );

  const displayTitle = showTranslated ? translated?.title ?? title : title;
  const displayDescription = showTranslated ? translated?.description ?? description : description;
  const displayParagraphs = showTranslated
    ? paragraphs.map((p, i) => translated?.[`paragraph:${i}`] ?? p)
    : paragraphs;

  return (
    <>
      {/* Title */}
      <h1 className="text-3xl font-bold text-[#0a0a0a] leading-tight mb-4" dir={isRtl ? "rtl" : undefined}>{displayTitle}</h1>

      {/* Subtitle/description */}
      {displayDescription && (
        <p className="text-lg text-[#525252] leading-relaxed mb-6" dir={isRtl ? "rtl" : undefined}>{displayDescription}</p>
      )}

      {/* Author + date */}
      <div className="mb-8 pb-8 border-b border-[#f0f0f0]">
        <p className="text-xs font-medium text-[#737373] mb-3">Written By</p>
        <Link href={author?.handle ? `/author/${author.handle}` : "/"} className="flex items-center gap-3 group">
          <Avatar
            src={author?.avatar}
            name={author?.name ?? "Albiz"}
            size={40}
            className="ring-1 ring-[#e5e5e5]"
          />
          <div>
            <p className="text-sm font-semibold text-[#0a0a0a] group-hover:text-[#F44444] transition-colors">{author?.name ?? "Albiz"}</p>
            {author?.title && <p className="text-xs text-[#737373]">{author.title}</p>}
          </div>
        </Link>
        <p className="text-xs text-[#a3a3a3] mt-3">{date}</p>
      </div>

      {/* Cover image */}
      {coverImage && (
        <div className="rounded-2xl overflow-hidden mb-8 aspect-video relative bg-[#f5f5f5]">
          <Image
            src={coverImage}
            alt={title ?? ""}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            quality={90}
          />
        </div>
      )}

      {/* Body — HTML from TipTap (original or translated, structure preserved) or plain paragraphs */}
      {isHtmlBody ? (
        <div
          className="ProseMirror text-[#262626] text-base leading-7"
          dir={isRtl ? "rtl" : undefined}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(showTranslated ? translated?.[`paragraph:0`] ?? paragraphs[0] : paragraphs[0]) }}
        />
      ) : (
        <div className="space-y-5" dir={isRtl ? "rtl" : undefined}>
          {displayParagraphs.map((p, i) => (
            <p key={i} className="text-[#262626] text-base leading-[1.8]">{p}</p>
          ))}
        </div>
      )}

      {isTranslatable && (
        <div className="mt-4">
          {showTranslated ? (
            <button onClick={toggleOriginal} className="text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors">
              Show original
            </button>
          ) : (
            <button
              onClick={handleTranslate}
              disabled={state === "loading"}
              className="text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-60"
            >
              {state === "loading" ? "Translating…" : "Translate"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
