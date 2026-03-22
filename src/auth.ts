/**
 * K-Culture Universe V7.0.1 — Auth.js v5 설정
 * Google OAuth + Supabase 유저 프로필 연동
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  callbacks: {
    /**
     * 로그인 성공 시 Supabase user_profiles 자동 생성/업데이트
     * Admin 이메일이면 role='admin' 부여
     */
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      if (!user.email || !user.id) return false;

      const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());

      // 먼저 기존 행이 있는지 확인
      const { data: existing } = await supabaseAdmin
        .from("user_profiles")
        .select("id, role")
        .eq("google_id", user.id)
        .maybeSingle();

      if (existing) {
        // 기존 유저: email과 role만 갱신 (nickname 등 기존 데이터 보존)
        await supabaseAdmin
          .from("user_profiles")
          .update({ email: user.email, role: isAdmin ? "admin" : "user" })
          .eq("google_id", user.id);
      } else {
        // 신규 유저: nickname 없이 최소 정보로 행 생성 (SQL에서 nullable로 변경됨)
        await supabaseAdmin
          .from("user_profiles")
          .insert({
            google_id: user.id,
            email: user.email,
            role: isAdmin ? "admin" : "user",
          });
      }

      return true;
    },

    /**
     * JWT에 google_id, role, membership, onboarded 주입
     * ── 매 요청마다 Supabase에서 최신 role을 읽어 반영 (ADMIN_EMAILS 변경 즉시 적용)
     */
    async jwt({ token, user, account, trigger }) {
      // 최초 로그인 또는 세션 업데이트(update() 호출) 시에만 googleId 세팅
      if (account?.provider === "google" && user?.id) {
        token.googleId = user.id;
      }

      // googleId가 있으면 매번 Supabase에서 최신 프로필 읽기
      if (token.googleId || trigger === "update") {
        const googleId = token.googleId as string | undefined;
        if (googleId) {
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("role, membership, newsletter, nickname")
            .eq("google_id", googleId)
            .maybeSingle();

          token.role = profile?.role ?? "user";
          token.membership = profile?.membership ?? "associate";
          token.newsletter = profile?.newsletter ?? false;
          token.onboarded = !!profile?.nickname;
        }
      }
      return token;
    },

    /**
     * 세션에 role, membership, onboarded 노출
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.googleId = token.googleId as string;
        session.user.role = token.role as string;
        session.user.membership = token.membership as string;
        session.user.newsletter = token.newsletter as boolean;
        session.user.onboarded = token.onboarded as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: "/", // 커스텀 로그인 페이지 없이 구글 팝업 직행
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
});
