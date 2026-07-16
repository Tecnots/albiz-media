import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from './auth';
import { prisma } from '@/lib/prisma';

export type AuthedUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;

export type GuardResult =
  | { user: AuthedUser; error: null }
  | { user: null; error: NextResponse };

function unauthorizedResult(): GuardResult {
  return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
}

function forbiddenResult(message = 'Forbidden'): GuardResult {
  return { user: null, error: NextResponse.json({ error: message }, { status: 403 }) };
}

/** Any authenticated, non-banned user with a live session. */
export async function requireAuth(request?: NextRequest): Promise<GuardResult> {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResult();
  return { user, error: null };
}

/** Generic role gate. Pass every role allowed to proceed. */
export function requireRole(...roles: string[]) {
  return async function (request?: NextRequest): Promise<GuardResult> {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResult();
    if (!roles.includes(user.role)) return forbiddenResult();
    return { user, error: null };
  };
}

export async function requireAdmin(request?: NextRequest): Promise<GuardResult> {
  return requireRole('ADMIN')(request);
}

export async function requireCircle(request?: NextRequest): Promise<GuardResult> {
  return requireRole('CIRCLE', 'ADMIN')(request);
}

export async function requireAuthor(request?: NextRequest): Promise<GuardResult> {
  return requireRole('AUTHOR', 'ADMIN')(request);
}

export async function requireEditor(request?: NextRequest): Promise<GuardResult> {
  return requireRole('EDITOR', 'ADMIN')(request);
}

export async function requireUploader(request?: NextRequest): Promise<GuardResult> {
  return requireRole('UPLOADER', 'ADMIN')(request);
}

/** Ad-management surface: ADMIN and AUTHOR per the product intent documented in ads/route.ts. */
export async function requireAdAccess(request?: NextRequest): Promise<GuardResult> {
  return requireRole('ADMIN', 'AUTHOR')(request);
}

/**
 * Verifies the caller may act on a specific article as its reviewing editor:
 * either they are the post's assignedEditorId, or they are ADMIN.
 * Use this on every editor write path that mutates a specific post/note —
 * a role check alone is not sufficient (see audit findings C-8, H-1).
 */
export function isAssignedEditor(
  user: { id: number; role: string },
  post: { assignedEditorId: number | null }
): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'EDITOR') return false;
  return post.assignedEditorId != null && post.assignedEditorId === user.id;
}

/** Verifies the caller holds a section assignment for the given section (any editor sharing the section). */
export async function hasSectionAssignment(userId: number, sectionId: number | null | undefined): Promise<boolean> {
  if (!sectionId) return false;
  const assignment = await prisma.editorSectionAssignment.findUnique({
    where: { editorId_sectionId: { editorId: userId, sectionId } },
  });
  return !!assignment;
}

/** Verifies the caller holds canPublish for the given section. */
export async function hasSectionPublishRight(userId: number, sectionId: number | null | undefined): Promise<boolean> {
  if (!sectionId) return false;
  const assignment = await prisma.editorSectionAssignment.findUnique({
    where: { editorId_sectionId: { editorId: userId, sectionId } },
  });
  return !!assignment?.canPublish;
}

/** Verifies the caller owns the resource (resourceUserId) or is ADMIN. */
export function isOwnerOrAdmin(user: { id: number; role: string }, resourceUserId: number): boolean {
  return user.role === 'ADMIN' || user.id === resourceUserId;
}
