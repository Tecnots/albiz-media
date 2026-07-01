import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from './auth';

export async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'ADMIN') return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, error: null };
}

export async function requireCircle(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'CIRCLE' && user.role !== 'ADMIN') return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, error: null };
}
