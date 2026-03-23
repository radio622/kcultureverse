/**
 * K-Culture Universe V7.0.1 — Next.js 미들웨어
 * next-auth v5의 auth() wrapper 대신 순수 next-auth/middleware 사용
 * → Edge Runtime 호환 (Supabase SDK가 번들에 포함되지 않음)
 */

export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/admin/:path*", "/mypage/:path*"],
};
