"use client";

/**
 * K-Culture Universe V7.0.1 — 마이페이지
 * 닉네임 변경, 뉴스레터 토글(정/준회원 전환), 회원탈퇴
 */

import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Profile {
  id: string;
  nickname: string | null;
  gender: string | null;
  age_group: string | null;
  newsletter: boolean;
  role: string;
  membership: string;
  email: string;
  created_at: string;
}

const GENDER_LABEL: Record<string, string> = {
  male: "남성", female: "여성", other: "기타", undisclosed: "밝히지 않음",
};
const AGE_LABEL: Record<string, string> = {
  "10s": "10대", "20s": "20대", "30s": "30대", "40s": "40대", "50s+": "50대+",
};

export default function MypageClient() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 닉네임 편집 상태
  const [editingNick, setEditingNick] = useState(false);
  const [newNick, setNewNick] = useState("");
  const [nickError, setNickError] = useState("");
  const [nickSaving, setNickSaving] = useState(false);

  // 뉴스레터 토글 상태
  const [newsletterSaving, setNewsletterSaving] = useState(false);

  // 탈퇴 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 미인증 → 홈으로
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // 프로필 로드
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  // 닉네임 저장
  const handleNickSave = useCallback(async () => {
    if (!newNick.trim()) { setNickError("닉네임을 입력해주세요"); return; }
    setNickSaving(true); setNickError("");
    const res = await fetch("/api/auth/profile/patch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: newNick }),
    });
    const data = await res.json();
    if (!res.ok) { setNickError(data.error ?? "저장 실패"); setNickSaving(false); return; }
    setProfile(p => p ? { ...p, nickname: newNick.trim() } : p);
    setEditingNick(false);
    setNickSaving(false);
    await updateSession();
  }, [newNick, updateSession]);

  // 뉴스레터 토글
  const handleNewsletterToggle = useCallback(async () => {
    if (!profile) return;
    setNewsletterSaving(true);
    const next = !profile.newsletter;
    const res = await fetch("/api/auth/profile/patch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newsletter: next }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(p => p ? { ...p, newsletter: next, membership: data.membership } : p);
      await updateSession();
    }
    setNewsletterSaving(false);
  }, [profile, updateSession]);

  // 회원탈퇴
  const handleDelete = useCallback(async () => {
    if (deleteConfirm !== "탈퇴") return;
    setDeleteLoading(true);
    const res = await fetch("/api/auth/me/delete", { method: "DELETE" });
    if (!res.ok) { setDeleteLoading(false); return; }
    await signOut({ callbackUrl: "/" });
  }, [deleteConfirm]);

  if (status === "loading" || loading) {
    return (
      <div style={styles.container}>
        <div style={{ color: "rgba(200,180,255,0.5)", fontSize: 14 }}>🌌 불러오는 중...</div>
      </div>
    );
  }

  if (!profile) return null;

  const isFull = profile.membership === "full";
  const isAdmin = profile.role === "admin";

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <Link href="/universe" style={styles.backBtn}>← 우주로 돌아가기</Link>
        <h1 style={styles.title}>🌌 마이페이지</h1>
      </div>

      <div style={styles.card}>
        {/* 멤버십 배지 */}
        <div style={styles.membershipBadge}>
          <span>{isFull ? "🌟 정회원" : "🤝 준회원"}</span>
          {isAdmin && <span style={{ marginLeft: 8, color: "#fbbf24" }}>👑 Admin</span>}
        </div>

        {/* 기본 정보 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>기본 정보</div>
          <div style={styles.row}>
            <span style={styles.label}>이메일</span>
            <span style={styles.value}>{profile.email}</span>
          </div>
          {profile.gender && (
            <div style={styles.row}>
              <span style={styles.label}>성별</span>
              <span style={styles.value}>{GENDER_LABEL[profile.gender] ?? profile.gender}</span>
            </div>
          )}
          {profile.age_group && (
            <div style={styles.row}>
              <span style={styles.label}>연령대</span>
              <span style={styles.value}>{AGE_LABEL[profile.age_group] ?? profile.age_group}</span>
            </div>
          )}
          <div style={styles.row}>
            <span style={styles.label}>가입일</span>
            <span style={styles.value}>
              {new Date(profile.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>

        {/* 닉네임 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>닉네임</div>
          {editingNick ? (
            <div>
              <input
                id="mypage-nickname-input"
                value={newNick}
                onChange={e => setNewNick(e.target.value)}
                maxLength={20}
                onKeyDown={e => e.key === "Enter" && handleNickSave()}
                style={styles.input}
                autoFocus
              />
              {nickError && <p style={styles.errorText}>{nickError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button id="nick-save-btn" onClick={handleNickSave} disabled={nickSaving} style={styles.btnPrimary}>
                  {nickSaving ? "저장 중..." : "저장"}
                </button>
                <button onClick={() => { setEditingNick(false); setNickError(""); }} style={styles.btnSecondary}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.row}>
              <span style={styles.value}>{profile.nickname ?? "(미설정)"}</span>
              <button
                id="nick-edit-btn"
                onClick={() => { setEditingNick(true); setNewNick(profile.nickname ?? ""); }}
                style={styles.editBtn}
              >
                변경
              </button>
            </div>
          )}
        </div>

        {/* 뉴스레터 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>뉴스레터 수신</div>
          <div
            style={{
              ...styles.newsletterBox,
              borderColor: profile.newsletter ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)",
              background: profile.newsletter ? "rgba(167,139,250,0.07)" : "rgba(255,255,255,0.02)",
            }}
            onClick={newsletterSaving ? undefined : handleNewsletterToggle}
          >
            <div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>
                {profile.newsletter ? "✅ 수신 중" : "❌ 미수신"}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "rgba(200,180,255,0.6)" }}>
                {profile.newsletter
                  ? "🌟 정회원 상태입니다. 끄면 준회원으로 전환되며 에디트 권한이 정지됩니다."
                  : "🤝 뉴스레터를 켜면 정회원으로 승급되어 아티스트 정보 업데이트를 요청할 수 있어요!"}
              </div>
            </div>
            <div style={{
              width: 44, height: 24, borderRadius: 12, flexShrink: 0,
              background: profile.newsletter ? "#c084fc" : "rgba(255,255,255,0.1)",
              position: "relative", cursor: "pointer", transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 3,
                left: profile.newsletter ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>
          {newsletterSaving && (
            <p style={{ fontSize: 12, color: "rgba(200,180,255,0.5)", marginTop: 6 }}>저장 중...</p>
          )}
        </div>

        {/* 회원탈퇴 */}
        <div style={{ marginTop: 12, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            id="delete-account-btn"
            onClick={() => setShowDeleteModal(true)}
            style={{ fontSize: 12, color: "rgba(248,113,113,0.6)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            회원탈퇴
          </button>
        </div>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showDeleteModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>정말 탈퇴하시겠어요?</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.6 }}>
              계정과 모든 개인정보가 즉시 삭제됩니다. 에디트 제안 기록은 익명으로 보존됩니다.
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
              확인을 위해 <strong style={{ color: "#f87171" }}>탈퇴</strong>를 입력해주세요.
            </p>
            <input
              id="delete-confirm-input"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="탈퇴"
              style={{ ...styles.input, borderColor: "rgba(248,113,113,0.3)" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                id="delete-confirm-btn"
                onClick={handleDelete}
                disabled={deleteConfirm !== "탈퇴" || deleteLoading}
                style={{
                  ...styles.btnPrimary,
                  background: deleteConfirm === "탈퇴" ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.05)",
                  opacity: deleteConfirm !== "탈퇴" ? 0.5 : 1,
                }}
              >
                {deleteLoading ? "처리 중..." : "탈퇴 확인"}
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }} style={styles.btnSecondary}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh", background: "#05050f",
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", padding: "40px 16px",
    fontFamily: "'Inter', 'Apple SD Gothic Neo', sans-serif",
  },
  header: { width: "100%", maxWidth: 480, marginBottom: 24 },
  backBtn: {
    fontSize: 13, color: "rgba(167,139,250,0.7)", textDecoration: "none",
    display: "block", marginBottom: 12,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" },
  card: {
    width: "100%", maxWidth: 480,
    background: "rgba(10,14,26,0.92)",
    border: "1px solid rgba(167,139,250,0.15)",
    borderRadius: 20, padding: "24px 20px",
  },
  membershipBadge: {
    display: "inline-flex", alignItems: "center",
    fontSize: 13, color: "rgba(200,180,255,0.8)",
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 20, padding: "4px 12px",
    marginBottom: 20,
  },
  section: { marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" },
  sectionTitle: { fontSize: 11, color: "rgba(200,180,255,0.5)", letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" as const },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontSize: 13, color: "rgba(255,255,255,0.4)", flexShrink: 0 },
  value: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  input: {
    display: "block", width: "100%", padding: "10px 14px", boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.25)",
    borderRadius: 10, fontSize: 14, color: "#fff", outline: "none",
  },
  btnPrimary: {
    padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    background: "linear-gradient(135deg, #a78bfa, #c084fc)",
    border: "none", color: "#fff", cursor: "pointer",
  },
  btnSecondary: {
    padding: "9px 18px", borderRadius: 10, fontSize: 13,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)", cursor: "pointer",
  },
  editBtn: {
    fontSize: 12, color: "rgba(167,139,250,0.7)", background: "none",
    border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6,
    padding: "3px 10px", cursor: "pointer",
  },
  newsletterBox: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "14px 16px", borderRadius: 12, cursor: "pointer",
    border: "1px solid", transition: "all 0.2s",
  },
  modalOverlay: {
    position: "fixed" as const, inset: 0, zIndex: 1000, display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
  },
  modalBox: {
    background: "rgba(10,14,26,0.97)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 18, padding: "28px 24px", width: "min(380px,90vw)",
  },
  errorText: { margin: "6px 0 0", fontSize: 12, color: "#f87171" },
};
