/**
 * POST /api/admin/quick-edit
 * Admin 전용 — AI(GPT-4o-mini)가 자연어 파싱 → 즉시 data_overrides 저장
 * 사실검증 없이 admin의 판단을 믿고 바로 반영
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupabaseAdmin } from "@/lib/supabase";
import OpenAI from "openai";

// OpenAI 클라이언트는 런타임에 지연 초기화 (빌드 시 환경변수 없어도 오류 방지)
let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const SYSTEM_PROMPT = `You are a K-Culture Universe data editor assistant.
Parse the user's Korean or English natural language instruction and output a JSON patch.

Output format (JSON only, no markdown):
{
  "intent": "NAME_CORRECTION" | "EDGE_PROPOSAL" | "ARTIST_ADDITION" | "DATA_CORRECTION" | "EDGE_REMOVAL",
  "target_type": string,  // e.g. "node_name", "edge", "node_add"
  "target_id": string | null,  // Spotify ID if known
  "patch_data": object,   // the actual data change
  "summary": string       // one-line Korean summary of what was changed
}

Examples:
- "아이유 이름 영문을 IU로 수정" → intent: NAME_CORRECTION, patch_data: {name: "IU", nameKo: "아이유"}
- "BTS와 방탄소년단이 같은 아티스트" → intent: DATA_CORRECTION, patch_data: {merge: true, ids: [...]}
- "IU와 BTS는 FEATURED 관계, 가중치 0.8" → intent: EDGE_PROPOSAL, patch_data: {source: "IU", target: "BTS", relation: "FEATURED", weight: 0.8}

Always output valid JSON only.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { input } = await req.json();
  if (!input?.trim()) {
    return NextResponse.json({ error: "입력이 비어있습니다" }, { status: 400 });
  }

  // GPT-4o-mini로 파싱
  let parsed: {
    intent: string; target_type: string; target_id: string | null;
    patch_data: Record<string, unknown>; summary: string;
  };

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `AI 파싱 실패: ${msg}` }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();

  // 1. edit_logs에 기록 (admin이 직접 승인한 것으로 처리)
  const { data: logEntry } = await supabase
    .from("universe_edit_logs")
    .insert({
      intent: parsed.intent,
      raw_input: input,
      parsed_data: parsed.patch_data,
      status: "approved",
      ai_reasoning: `[Admin 직접 입력] ${parsed.summary}`,
      applied_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  // 2. data_overrides에 패치 저장
  await supabase.from("data_overrides").insert({
    edit_log_id: logEntry?.id ?? null,
    target_type: parsed.target_type,
    target_id: parsed.target_id,
    patch_data: parsed.patch_data,
    applied: false,
  });

  return NextResponse.json({
    ok: true,
    message: `✅ ${parsed.summary}\n\n데이터 패치가 저장되었습니다. 빌드 탭에서 Universe Rebuild 후 반영됩니다.`,
    parsed,
  });
}
