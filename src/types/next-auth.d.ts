/**
 * NextAuth TypeScript 타입 확장
 * session.user에 googleId, role, membership, newsletter, onboarded 추가
 */
import "next-auth";

declare module "next-auth" {
  interface User {
    googleId?: string;
    role?: string;
    membership?: string;
    newsletter?: boolean;
    onboarded?: boolean;
  }
  interface Session {
    user: {
      googleId?: string;
      role?: string;
      membership?: string;
      newsletter?: boolean;
      onboarded?: boolean;
    } & import("next-auth").DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string;
    role?: string;
    membership?: string;
    newsletter?: boolean;
    onboarded?: boolean;
  }
}
