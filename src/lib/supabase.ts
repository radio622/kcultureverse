/**
 * K-Culture Universe V7.0.1 — Supabase 서버/클라이언트 헬퍼
 */

import { createClient } from "@supabase/supabase-js";

// ── 서버 전용 (Service Role Key — API Route에서만 사용) ────────────
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── 클라이언트 전용 (Anon Key — RLS 보호됨) ─────────────────────
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

// ── 타입 ────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  google_id: string;
  email: string;
  nickname: string | null;
  gender: "male" | "female" | "other" | "undisclosed" | null;
  age_group: "10s" | "20s" | "30s" | "40s" | "50s+" | null;
  newsletter: boolean;
  role: "admin" | "user";
  membership: "associate" | "full";
  created_at: string;
  updated_at: string;
}
