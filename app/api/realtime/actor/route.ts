import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const ACTOR_COOKIE_KEY = 'dd_actor';
const ACTOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const normalizeActor = (value?: string) => {
  if (!value) return '';
  return value.startsWith('anon-') ? value : '';
};

export async function GET(request: NextRequest) {
  const existing = normalizeActor(request.cookies.get(ACTOR_COOKIE_KEY)?.value);

  if (existing) {
    return NextResponse.json({ actorId: existing });
  }

  const actorId = `anon-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const response = NextResponse.json({ actorId });

  response.cookies.set({
    name: ACTOR_COOKIE_KEY,
    value: actorId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACTOR_COOKIE_MAX_AGE,
  });

  return response;
}
