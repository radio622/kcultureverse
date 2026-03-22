/**
 * K-Culture Universe V7.0.1 — Next.js 미들웨어
 * /admin 경로: Admin 계정만 접근 허용
 * /mypage 경로: 로그인 필수
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // /mypage — 로그인 필수
  if (nextUrl.pathname.startsWith("/mypage")) {
    if (!session) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  // /admin — 로그인 + Admin 역할 필수
  if (nextUrl.pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    if (session.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/mypage/:path*"],
};
