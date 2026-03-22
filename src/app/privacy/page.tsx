/**
 * /privacy — 개인정보 처리방침
 * 한국 개인정보보호법(PIPA) 대응
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "K-Culture Universe 개인정보 처리방침",
};

export default function PrivacyPage() {
  const UPDATED = "2026년 3월 22일";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#05050f",
      color: "rgba(255,255,255,0.8)",
      fontFamily: "'Inter', 'Apple SD Gothic Neo', sans-serif",
      padding: "60px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{ maxWidth: 680, width: "100%" }}>
        <Link href="/universe" style={{ fontSize: 13, color: "rgba(167,139,250,0.7)", textDecoration: "none" }}>
          ← 우주로 돌아가기
        </Link>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 20, marginBottom: 4 }}>
          개인정보 처리방침
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 36 }}>
          최종 수정일: {UPDATED}
        </p>

        {SECTIONS.map((s, i) => (
          <section key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#c084fc", marginBottom: 10 }}>
              {i + 1}. {s.title}
            </h2>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" }}>
              {s.body}
            </div>
          </section>
        ))}

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          문의: K-Culture Universe 운영팀 (radio622@gmail.com)
        </p>
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    title: "수집하는 개인정보 항목",
    body: `K-Culture Universe는 구글 소셜 로그인을 통해 다음의 정보를 수집합니다.

• 구글 계정 이메일 주소
• 구글 프로필 사진 (브라우저 표시용)
• 회원가입 시 직접 입력하는 닉네임, 성별, 연령대
• 뉴스레터 수신 동의 여부`,
  },
  {
    title: "수집 및 이용 목적",
    body: `수집한 정보는 다음 목적으로만 사용됩니다.

• 서비스 인증 및 회원 관리
• 아티스트 정보 에디트 제안 기능 제공 (정회원)
• 우주 통계 및 서비스 개선을 위한 익명 집계
• 뉴스레터 발송 (동의한 경우)`,
  },
  {
    title: "보유 및 이용 기간",
    body: `• 회원 탈퇴 시 개인정보를 즉시 삭제합니다.
• 유저가 제안한 에디트 로그는 익명 처리 후 서비스 데이터로 보존될 수 있습니다.`,
  },
  {
    title: "제3자 제공",
    body: `수집한 개인정보는 법적 의무 이행을 제외하고는 어떠한 제3자에게도 제공하지 않습니다.`,
  },
  {
    title: "정보 보안",
    body: `• Supabase (PostgreSQL) Row Level Security(RLS)를 통해 본인 데이터만 접근 가능하도록 보호합니다.
• Auth.js v5 JWT 기반 세션은 서버에서 서명되어 클라이언트 조작이 불가능합니다.`,
  },
  {
    title: "이용자의 권리",
    body: `회원은 언제든지 다음 권리를 행사할 수 있습니다.

• 개인정보 조회: 마이페이지에서 확인
• 개인정보 정정: 마이페이지에서 직접 수정
• 회원탈퇴 및 삭제: 마이페이지 → 회원탈퇴 (즉시 완전 삭제)`,
  },
  {
    title: "쿠키(Cookie) 사용",
    body: `서비스는 로그인 세션 유지를 위해 HTTP-Only Secure 쿠키를 사용합니다. 이 쿠키는 인증 목적으로만 사용됩니다.`,
  },
];
