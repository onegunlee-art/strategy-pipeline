// Admin 쿠키 인증 — ADMIN_PASSWORD 환경변수 기반
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'wr_admin';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8시간

export function isAdminAuthed(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  return cookie.value === adminPassword;
}

export function setAdminCookie(res: NextResponse): void {
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  res.cookies.set(COOKIE_NAME, adminPassword, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}
