import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";
import PublicProfile from "./PublicProfile";

export const revalidate = 60;

interface Props {
  params: Promise<{ handle: string }>;
}

function resolve(url: string | null | undefined): string | null {
  if (!url) return null;
  return blobStorageService.resolveMediaUrl(url) ?? url;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle },
    select: {
      name: true,
      title: true,
      bio: true,
      avatar: true,
      customDomain: true,
    },
  });

  if (!user) return { title: "Profile not found" };

  const avatarUrl = resolve(user.avatar);
  const displayName = user.name;
  const headline = user.title?.trim() || "";
  const pageTitle = headline ? `${displayName} – ${headline}` : displayName;
  const description = user.bio?.trim() || `${displayName}'s profile on Albiz Media`;
  const canonical = user.customDomain
    ? `https://${user.customDomain}`
    : undefined;

  return {
    title: pageTitle,
    description,
    ...(canonical && { alternates: { canonical } }),
    openGraph: {
      title: pageTitle,
      description,
      type: "profile",
      ...(avatarUrl && {
        images: [{ url: avatarUrl, width: 400, height: 400, alt: displayName }],
      }),
    },
    twitter: {
      card: avatarUrl ? "summary_large_image" : "summary",
      title: pageTitle,
      description,
      ...(avatarUrl && { images: [avatarUrl] }),
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle },
    include: {
      experience: { orderBy: { order: "asc" } },
      education: { orderBy: { order: "asc" } },
      skills: true,
      interests: true,
      customTabs: { orderBy: { order: "asc" } },
      highlights: { orderBy: { order: "asc" } },
    },
  });

  if (!user) notFound();

  const posts = await prisma.post.findMany({
    where: { userId: user.id, status: "published" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      date: true,
      image: true,
      tags: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
    },
  });

  const userData = {
    id: user.id,
    name: user.name,
    handle: user.handle,
    title: user.title?.trim() || null,
    avatar: resolve(user.avatar),
    coverPhoto: resolve(user.coverPhoto),
    bio: user.bio || null,
    location: user.location || null,
    country: user.country || null,
    district: user.district || null,
    city: user.city || null,
    website: user.website || null,
    verified: user.verified,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    followers: user.followers,
    followingCount: user.followingCount,
    customDomain: user.customDomain || null,
    showBranding: user.showBranding,
    experience: user.experience.map((e) => ({
      id: e.id,
      role: e.role,
      company: e.company,
      logo: resolve(e.logo),
      period: e.period,
      description: e.description || null,
    })),
    education: user.education.map((e) => ({
      id: e.id,
      school: e.school,
      degree: e.degree,
      period: e.period,
      logo: resolve(e.logo),
    })),
    skills: user.skills.map((s) => s.name),
    interests: user.interests.map((i) => i.name),
    customTabs: user.customTabs
      .filter((t) => t.title?.trim())
      .map((t) => ({ id: t.id, title: t.title, content: t.content })),
    highlights: user.highlights.map((h) => ({
      id: h.id,
      name: h.name,
      cover: resolve(h.cover),
      storyCount: h.storyCount,
    })),
  };

  const postsData = posts.map((p) => ({
    id: p.id,
    type: p.type.toLowerCase() as "post" | "article",
    title: p.title || null,
    content: p.content || null,
    date: p.date,
    image: resolve(p.image),
    tags: p.tags,
    stats: {
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
    },
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: user.name,
    ...(user.title?.trim() && { jobTitle: user.title }),
    ...(user.bio && { description: user.bio }),
    ...(user.customDomain && { url: `https://${user.customDomain}` }),
    ...(userData.avatar && { image: userData.avatar }),
    ...(user.experience[0]?.company && {
      worksFor: { "@type": "Organization", name: user.experience[0].company },
    }),
    ...(user.education[0]?.school && {
      alumniOf: {
        "@type": "EducationalOrganization",
        name: user.education[0].school,
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicProfile user={userData} posts={postsData} />
    </>
  );
}