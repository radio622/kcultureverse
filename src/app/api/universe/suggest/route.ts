/**
 * POST /api/universe/suggest
 * 정회원(Full Member) 전용 — 자연어 에디트 제안
 *
 * 흐름:
 * 1. 인증 + 멤버십 + rate limit 확인
 * 2. Gemini Flash-Lite → Intent 파싱
 * 3. 서버 사이드 검증 (MusicBrainz + iTunes)
 * 4. 판정 → Supabase universe_edit_logs 저장
 * 5. 승인 시 data_overrides에도 등록
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Rate Limit (메모리, 서버리스 인스턴스 단위) ──────────────
const rateLimitMap = new Map<string, number>(); // googleId → lastRequestTime
const RATE_LIMIT_MS = 60_000; // 1분

// ── Gemini 초기화 ─────────────────────────────────────────────
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
}

const SYSTEM_PROMPT = `You are a K-Culture Universe data editor AI.
Parse the user's Korean or English natural language instruction about K-Pop/K-Culture artists.
Output a structured JSON object.

OUTPUT FORMAT (JSON only, no markdown, no comments):
{
  "intent": "NAME_CORRECTION" | "EDGE_PROPOSAL" | "ARTIST_ADDITION" | "DATA_CORRECTION" | "IRRELEVANT",
  "target_type": "node_name" | "edge" | "node_add" | "other",
  "artist_names": [list of artist names mentioned],
  "parsed_data": {
    // For NAME_CORRECTION: { "from": "...", "to": "...", "spotifyId": "..." }
    // For EDGE_PROPOSAL: { "source": "...", "target": "...", "relation": "FEATURED|PRODUCER|WRITER|COVER_OFFICIAL|COVER_FULL|COVER_PARTIAL|LABEL|TV_SHOW|SAME_GROUP", "weight": 0.1-1.0, "detail": "..." }
    // For ARTIST_ADDITION: { "name": "...", "nameKo": "...", "genres": [...] }
    // For DATA_CORRECTION: { ... }
  },
  "summary_ko": "one-line Korean summary",
  "confidence": 0.0-1.0
}

IMPORTANT RULES:
- For EDGE_PROPOSAL, determine the correct relation subtype and weight:
  - COVER_OFFICIAL (0.7): officially released remake/cover on streaming platforms
  - COVER_FULL (0.5): full cover on broadcast/SNS but not released as official track
  - COVER_PARTIAL (0.3): partial cover on broadcast/SNS
  - FEATURED (0.7): collaboration featured track
  - PRODUCER (0.7): produced tracks for the other artist
  - WRITER (0.7): wrote songs for the other artist
  - LABEL (0.2): same entertainment label
  - TV_SHOW (0.15): appeared on same TV show
  - SAME_GROUP (1.0): members of the same group
- Set confidence based on how clear and verifiable the claim is
- If the input is unrelated to K-Culture artists, set intent to "IRRELEVANT"
- Always output valid JSON only, never markdown`;

// ── MusicBrainz 검증 ─────────────────────────────────────────
async function verifyMusicBrainz(artistNames: string[]): Promise<{ found: boolean; details: string }> {
  const results: string[] = [];
  for (const name of artistNames.slice(0, 2)) {
    await new Promise(r => setTimeout(r, 1100)); // rate limit: 1 req/sec
    try {
      const res = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(name)}&fmt=json&limit=3`,
        { headers: { "User-Agent": "KCultureUniverse/7.0 (contact@kcultureverse.com)" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.artists?.length > 0) {
          results.push(`✅ MusicBrainz: "${name}" 발견 (MBID: ${data.artists[0].id})`);
        } else {
          results.push(`❌ MusicBrainz: "${name}" 미발견`);
        }
      } else if (res.status === 503) {
        results.push(`⚠️ MusicBrainz: Rate limited, 재시도 필요`);
      }
    } catch {
      results.push(`⚠️ MusicBrainz: "${name}" 조회 실패`);
    }
  }
  return { found: results.some(r => r.startsWith("✅")), details: results.join("\n") };
}

// ── iTunes 검증 ──────────────────────────────────────────────
async function verifyItunes(artistNames: string[]): Promise<{ found: boolean; details: string }> {
  const results: string[] = [];
  for (const name of artistNames.slice(0, 2)) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=3`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.resultCount > 0) {
          results.push(`✅ iTunes: "${name}" 발견 (${data.results[0].artistName})`);
        } else {
          results.push(`❌ iTunes: "${name}" 미발견`);
        }
      }
    } catch {
      results.push(`⚠️ iTunes: "${name}" 조회 실패`);
    }
  }
  return { found: results.some(r => r.startsWith("✅")), details: results.join("\n") };
}

// ── 메인 핸들러 ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. 인증 확인
  const session = await auth();
  if (!session?.user?.googleId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  // 2. 정회원(Full) 확인
  if (session.user.membership !== "full") {
    return NextResponse.json({
      error: "정회원만 에디트 제안이 가능합니다. 마이페이지에서 뉴스레터를 켜면 정회원으로 전환됩니다.",
    }, { status: 403 });
  }

  // 3. Rate Limit (1분 1회)
  const googleId = session.user.googleId;
  const lastReq = rateLimitMap.get(googleId) ?? 0;
  const remaining = RATE_LIMIT_MS - (Date.now() - lastReq);
  if (remaining > 0) {
    return NextResponse.json({
      error: `요청 간격 제한: ${Math.ceil(remaining / 1000)}초 후 다시 시도하세요.`
    }, { status: 429 });
  }
  rateLimitMap.set(googleId, Date.now());

  // 4. 입력 읽기
  const { input } = await req.json();
  if (!input?.trim() || input.length > 500) {
    return NextResponse.json({ error: "입력이 비어있거나 너무 깁니다 (최대 500자)" }, { status: 400 });
  }

  // 5. Gemini Flash-Lite 파싱
  let parsed: {
    intent: string; target_type: string; artist_names: string[];
    parsed_data: Record<string, unknown>; summary_ko: string; confidence: number;
  };

  try {
    const model = getGeminiModel();
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: input },
    ]);
    const text = result.response.text().trim();
    // JSON 블록만 추출 (마크다운 코드블록 대비)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `AI 처리 오류: ${msg}` }, { status: 500 });
  }

  // IRRELEVANT 즉시 거절
  if (parsed.intent === "IRRELEVANT") {
    return NextResponse.json({
      status: "rejected",
      message: "K-Culture 아티스트와 관련 없는 내용입니다.",
      parsed,
    });
  }

  // 6. 서버 사이드 검증 (MusicBrainz + iTunes 병렬)
  const [mbResult, itunesResult] = await Promise.all([
    verifyMusicBrainz(parsed.artist_names),
    verifyItunes(parsed.artist_names),
  ]);

  // 7. 판정
  const sourcesFound = [mbResult.found, itunesResult.found].filter(Boolean).length;
  let status: "approved" | "pending" | "rejected";
  let reasoning: string;

  if (parsed.confidence >= 0.8 && sourcesFound >= 2) {
    status = "approved";
    reasoning = `AI 신뢰도 ${(parsed.confidence * 100).toFixed(0)}%, 출처 ${sourcesFound}건 확인 → 자동 승인`;
  } else if (parsed.confidence >= 0.5 && sourcesFound >= 1) {
    status = "pending";
    reasoning = `AI 신뢰도 ${(parsed.confidence * 100).toFixed(0)}%, 출처 ${sourcesFound}건 → 관리자 확인 필요`;
  } else {
    status = "rejected";
    reasoning = `AI 신뢰도 ${(parsed.confidence * 100).toFixed(0)}%, 출처 ${sourcesFound}건 → 자동 거절`;
  }

  const ai_sources = {
    musicbrainz: mbResult.details,
    itunes: itunesResult.details,
  };

  // 8. Supabase 저장
  const supabase = createSupabaseAdmin();

  // user_profiles에서 id 조회 (user_id FK용)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("google_id", googleId)
    .maybeSingle();

  const { data: logEntry } = await supabase
    .from("universe_edit_logs")
    .insert({
      user_id: profile?.id ?? null,
      intent: parsed.intent,
      raw_input: input,
      parsed_data: parsed.parsed_data,
      status,
      ai_reasoning: reasoning,
      ai_sources,
      applied_at: status === "approved" ? new Date().toISOString() : null,
    })
    .select("id")
    .maybeSingle();

  // 승인 시 data_overrides에도 패치 등록
  if (status === "approved" && logEntry?.id) {
    await supabase.from("data_overrides").insert({
      edit_log_id: logEntry.id,
      target_type: parsed.target_type,
      patch_data: parsed.parsed_data,
      applied: false,
    });
  }

  // 9. 유저 피드백 반환
  const STATUS_EMOJI = { approved: "✅", pending: "⏳", rejected: "❌" };
  const STATUS_MSG = {
    approved: "제안이 승인되었습니다! 다음 우주 빌드에 반영됩니다. 🌟",
    pending: "제안이 접수되었습니다. 관리자가 추가 확인 후 반영합니다. 📋",
    rejected: "제안이 검증에 실패했습니다. 정확한 정보로 다시 시도해주세요. 🔍",
  };

  return NextResponse.json({
    status,
    emoji: STATUS_EMOJI[status],
    message: STATUS_MSG[status],
    summary: parsed.summary_ko,
    reasoning,
    parsed,
  });
}
