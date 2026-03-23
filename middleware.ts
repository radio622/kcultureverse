/**
 * K-Culture Universe V7.0.1 — Next.js 미들웨어
 * ⚠️ Edge Runtime 호환을 위해 auth.ts를 직접 import하지 않음
 *    (auth.ts → @supabase/supabase-js → process.cwd() 등 Node.js API 사용)
 * 대신 next-auth 세션 쿠키 존재 여부만 확인하는 경량 미들웨어
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // next-auth v5 세션 쿠키 이름 (JWT strategy 기준)
  const sessionToken =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value;

  const isLoggedIn = !!sessionToken;

  // /mypage — 로그인 필수
  if (pathname.startsWith("/mypage") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // /admin — 로그인 필수 (role 체크는 페이지 서버 컴포넌트에서 수행)
  if (pathname.startsWith("/admin") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/mypage/:path*"],
};
