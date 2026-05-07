"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useContext, useEffect } from "react";
import { ArrowLeft, MapPin, Globe, ExternalLink, Eye, EyeOff, Heart, MessageCircle, Share2, Bookmark, MoreVertical } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { api } from "@/app/lib/api";
import { newsAuthors, newsArticles, generateNewsArticleContent } from "@/app/lib/data";
import { VerifiedBadge, RightSidebar } from "@/app/lib/shared-components";

function AuthorHeader({ author, isFollowing, onFollow }: { author: typeof newsAuthors[0]; isFollowing: boolean; onFollow: () => void }) {
  return (
    <div className="relative">
      <div className="h-32 sm:h-44 rounded-b-2xl overflow-hidden">
        <Image src={author.coverPhoto} alt="" width={1200} height={400} className="object-cover w-full h-full" />
      </div>
      <div className="px-4 sm:px-6 -mt-12 sm:-mt-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-white flex-shrink-0">
              <Image src={author.avatar} alt={author.name} width={128} height={128} className="object-cover w-full h-full" />
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0a0a0a]">{author.name}</h1>
                <VerifiedBadge className="scale-110" />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F3FF] text-[#8B5CF6]">Author</span>
              </div>
              <p className="text-sm text-[#737373]">{author.role} @ {author.org}</p>
            </div>
          </div>
          <div className="pb-1">
            <button
              onClick={onFollow}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 active:scale-95 ${
                isFollowing
                  ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                  : "bg-[#F44444] text-white hover:bg-[#d63c3c]"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthorInfo({ author }: { author: typeof newsAuthors[0] }) {
  return (
    <div className="px-4 sm:px-6 pt-4 pb-6 border-b border-[#e5e5e5]">
      <p className="text-sm text-[#262626] mb-4">{author.bio}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#737373] mb-4">
        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{author.location}</span>
        {author.socials.website && (
          <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" />{author.socials.website}</span>
        )}
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <span className="text-lg font-bold text-[#0a0a0a]">{author.published}</span>
          <p className="text-xs text-[#737373]">Published</p>
        </div>
        <div className="w-px h-8 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-lg font-bold text-[#0a0a0a]">{author.followers}</span>
          <p className="text-xs text-[#737373]">Followers</p>
        </div>
      </div>
      {(author.socials.twitter || author.socials.linkedin) && (
        <div className="flex items-center gap-2">
          {author.socials.twitter && (
            <a href={`https://x.com/${author.socials.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              @{author.socials.twitter}
            </a>
          )}
          {author.socials.linkedin && (
            <a href={`https://linkedin.com/in/${author.socials.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs text-[#525252] hover:bg-[#fafafa] transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function AuthorArticleCard({ article, author, onRead }: { article: any; author: typeof newsAuthors[0]; onRead: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <div onClick={onRead} className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white hover:border-[#d5d5d5] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer">
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4">
        {article.image && (
          <div className="w-full sm:w-40 h-40 sm:h-auto flex-shrink-0 rounded-lg overflow-hidden">
            <Image src={article.image} alt={article.title} width={160} height={160} className="object-cover w-full h-full" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {article.tags?.map((tag: string, i: number) => (
                <span key={tag}>
                  <span className="text-[#F44444]">{tag}</span>
                  {i < article.tags.length - 1 && <span className="text-[#a3a3a3] ml-2">&middot;</span>}
                </span>
              ))}
              <span className="text-[#a3a3a3]">&middot;</span>
              <span className="text-[#737373]">{article.date}</span>
            </div>
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4 text-[#737373]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1.5 z-20 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150" onClick={e => e.stopPropagation()}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                    <EyeOff className="w-3.5 h-3.5" /> Not interested
                  </button>
                </div>
              )}
            </div>
          </div>
          <h3 className="text-base font-semibold mb-1.5 leading-tight text-[#0a0a0a]">{article.title}</h3>
          <p className="text-[#525252] text-xs mb-3 line-clamp-2">{article.description}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[#a3a3a3] text-xs">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.stats.views}</span>
              <span>{article.stats.likes} likes</span>
            </div>
            <span className="px-3 py-1 bg-[#F44444] text-white text-xs font-medium rounded-full">Read</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleReadView({ article, author, onBack, isFollowing, handleFollow }: { article: any; author: typeof newsAuthors[0]; onBack: () => void; isFollowing: boolean; handleFollow: () => void }) {
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const content = generateNewsArticleContent(article.id);

  const handleInteraction = (action: () => void) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    action();
  };

  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto animate-fade-in">
      <header className="sticky top-0 z-30 bg-white border-b border-[#f0f0f0]">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => handleInteraction(() => setIsLiked(!isLiked))} className={`p-2 rounded-lg transition-colors ${isLiked ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            </button>
            <button onClick={() => handleInteraction(() => setIsSaved(!isSaved))} className={`p-2 rounded-lg transition-colors ${isSaved ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
              <Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
            </button>
            <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <article className="px-4 sm:px-6 py-8 max-w-2xl">
        <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
          {article.tags?.map((tag: string, i: number) => (
            <span key={tag}>
              <span className="text-[#F44444] font-medium">{tag}</span>
              {i < article.tags.length - 1 && <span className="text-[#d5d5d5] ml-2">&middot;</span>}
            </span>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] leading-tight mb-6">{article.title}</h1>

        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#e5e5e5]">
          <Link href={`/author/${author.handle}`}>
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image src={author.avatar} alt={author.name} width={48} height={48} className="object-cover w-full h-full" />
            </div>
          </Link>
          <div>
            <Link href={`/author/${author.handle}`} className="flex items-center gap-1.5 hover:underline">
              <span className="font-semibold text-[#0a0a0a]">{author.name}</span>
              <VerifiedBadge />
            </Link>
            <span className="text-xs text-[#737373]">{author.role} @ {author.org}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#737373] mb-6">
          <span>{article.date}</span>
          <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {article.stats.views} views</span>
        </div>

        {article.image && (
          <div className="rounded-2xl overflow-hidden mb-8">
            <Image src={article.image} alt={article.title} width={800} height={450} className="object-cover w-full" />
          </div>
        )}

        <div className="mb-10">
          {content.map((paragraph: string, i: number) => (
            <p key={i} className="text-[#262626] leading-relaxed mb-5 text-base sm:text-lg">{paragraph}</p>
          ))}
        </div>

        <div className="flex items-center justify-between py-4 border-t border-b border-[#e5e5e5] mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => handleInteraction(() => setIsLiked(!isLiked))} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isLiked ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} /><span className="text-sm font-medium">{article.stats.likes}</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
              <MessageCircle className="w-5 h-5" /><span className="text-sm font-medium">{article.stats.comments}</span>
            </button>
          </div>
          <button onClick={() => handleInteraction(() => setIsSaved(!isSaved))} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isSaved ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
            <Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} /><span className="text-sm font-medium hidden sm:inline">Save</span>
          </button>
        </div>

        <div className="bg-[#fafafa] rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <Link href={`/author/${author.handle}`}>
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0">
                <Image src={author.avatar} alt={author.name} width={64} height={64} className="object-cover w-full h-full" />
              </div>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Link href={`/author/${author.handle}`} className="font-semibold text-lg text-[#0a0a0a] hover:underline">{author.name}</Link>
                <VerifiedBadge />
              </div>
              <p className="text-sm text-[#737373] mb-1">{author.role} @ {author.org}</p>
              <p className="text-xs text-[#525252] mb-3">{author.bio}</p>
              <button
                onClick={() => handleInteraction(handleFollow)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  isFollowing
                    ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                    : "bg-[#F44444] text-white hover:bg-[#d63c3c]"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}

export default function AuthorProfilePage() {
  const params = useParams();
  const authorHandle = params.id as string;
  const author = newsAuthors.find(a => a.handle === authorHandle);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);

  const authorUserId = author?.id ?? 0;
  const isFollowing = following.has(authorUserId);
  const handleFollow = () => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(authorUserId);
    if (isFollowing) {
      api.unfollow(currentUserId, authorUserId).catch(() => {});
    } else {
      api.follow(currentUserId, authorUserId).catch(() => {});
    }
  };

  if (!author) {
    return (
      <>
        <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-[#737373]">Author not found</p>
            <Link href="/" className="text-[#F44444] text-sm font-medium mt-2 inline-block hover:underline">Back to feed</Link>
          </div>
        </main>
        <RightSidebar />
      </>
    );
  }

  const authorArticles = newsArticles.filter(a => a.authorId === author.id);

  if (selectedArticle) {
    const article = newsArticles.find(a => a.id === selectedArticle);
    if (article) {
      return (
        <>
          <ArticleReadView article={article} author={author} onBack={() => setSelectedArticle(null)} isFollowing={isFollowing} handleFollow={handleFollow} />
          <RightSidebar />
        </>
      );
    }
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-white overflow-y-auto">
        <div className="sticky top-0 z-30 bg-white border-b border-[#f0f0f0] px-4 sm:px-6 py-3">
          <Link href="/" className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors inline-flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </Link>
        </div>

        <AuthorHeader author={author} isFollowing={isFollowing} onFollow={handleFollow} />
        <AuthorInfo author={author} />

        <div className="px-4 sm:px-6 py-6">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-4">
            Articles by {author.name} ({authorArticles.length})
          </p>
          <div className="space-y-3">
            {authorArticles.map(article => (
              <AuthorArticleCard
                key={article.id}
                article={article}
                author={author}
                onRead={() => setSelectedArticle(article.id)}
              />
            ))}
            {authorArticles.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#737373] text-sm">No published articles yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
