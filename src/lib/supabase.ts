/**
 * Supabase 클라이언트 (두 가지 버전)
 *
 * ─ 보안 원칙 ──────────────────────────────────────────────────────────
 *  1. createBrowserClient (Publishable/Anon Key)
 *     → 브라우저 & 클라이언트 컴포넌트에서 사용
 *     → RLS(Row Level Security) 정책으로 보호되므로 공개해도 안전
 *
 *  2. createServerClient (Service Role Key / Secret Key)
 *     → 서버(API Routes, Server Actions)에서만 사용
 *     → RLS를 우회하는 강력한 권한 → 절대 클라이언트에 노출 금지!
 * ────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── 1. 브라우저 클라이언트 (클라이언트 컴포넌트용) ──────────────────
// 싱글턴 패턴: 여러 번 호출해도 같은 인스턴스 재사용
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error(
      "Supabase 환경 변수가 설정되지 않았습니다. (.env.local 파일을 확인하세요)"
    );
  }
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        persistSession: true,        // 로그인 세션 유지
        autoRefreshToken: true,      // 토큰 자동 갱신
        detectSessionInUrl: true,    // OAuth 콜백 처리
      },
    });
  }
  return browserClient;
}

// ── 2. 서버 클라이언트 (API Routes / Server Actions 전용) ────────────
// 매 요청마다 새 인스턴스 생성 (서버사이드에서는 싱글턴 사용 금지)
export function getSupabaseServer() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Supabase 서버 환경 변수가 설정되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      persistSession: false,   // 서버에서는 세션 저장 불필요
      autoRefreshToken: false, // 서버에서는 토큰 갱신 불필요
    },
  });
}

// ── 데이터베이스 타입 정의 ────────────────────────────────────────────
// Supabase 스키마에 맞게 점진적으로 확장 예정

export interface DbUser {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface DbReview {
  id: string;
  user_id: string;
  target_id: string;           // 인물 or 작품 ID (Neo4j key)
  target_type: "person" | "work";
  rating: number;              // 1~5
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBookmark {
  id: string;
  user_id: string;
  target_id: string;
  target_type: "person" | "work";
  created_at: string;
}

export interface DbCardNews {
  id: string;
  title: string;
  content: string;             // LLM이 생성한 카드뉴스 본문
  category: "trivia" | "trending" | "connection";
  related_ids: string[];       // 관련 인물/작품 ID 목록
  generated_by: string;        // "gemini-1.5-flash" 등 모델명
  published_at: string | null;
  created_at: string;
}
