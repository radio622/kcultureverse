"use client";

/**
 * NextAuth SessionProvider 래퍼
 * layout.tsx에서 전체 앱을 감싸서 useSession() 훅 활성화
 */

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export default function AuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
