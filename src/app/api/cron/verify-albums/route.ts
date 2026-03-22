import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/cron/verify-albums
 *
 * CRON 자동 발매일 검증 (Vercel CRON에서 매일 UTC 17:00 = KST 02:00 호출)
 *
 * Vercel Hobby 제약 대응 (docs/V7.0.4_ROADMAP.md § Step 3-5):
 *   - 함수 타임아웃: 10초
 *   - 1회 처리: 미검증 앨범 최대 5건 (5 × ~1.5초 = ~7.5초)
 *   - 나머지는 다음날 CRON에서 순차 처리
 *
 * 보안: Authorization: Bearer {CRON_SECRET} 헤더 필수
 *
 * vercel.json CRON 설정:
 * {
 *   "crons": [{
 *     "path": "/api/cron/verify-albums",
 *     "schedule": "0 17 * * *"
 *   }]
 * }
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 5;          // 1회 처리 최대 건수 (10초 타임아웃 고려)
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // 1. 인증
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startAt = Date.now();
  const runDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // 2. 로그 시작 기록
  await supabase.from("daily_verification_logs").insert({
    run_date: runDate,
    status: "running",
    llm_model: "gpt-5-nano",
    started_at: new Date().toISOString(),
  });

  // 3. 미검증 앨범 BATCH_SIZE건 조회
  const { data: albums, error: fetchErr } = await supabase
    .from("album_releases")
    .select("id, artist_name, artist_name_ko, album_title, release_date, mbid")
    .eq("verified", false)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr || !albums || albums.length === 0) {
    await finishLog(runDate, 0, 0, 0, "done", "No unverified albums");
    return NextResponse.json({ message: "No albums to verify", verified: 0 });
  }

  // 4. 각 앨범 검증
  let verifiedCount = 0;
  let correctedCount = 0;
  const logLines: string[] = [];

  for (const album of albums) {
    if (Date.now() - startAt > 8000) {
      // 8초 초과 시 안전하게 조기 종료 (10초 타임아웃 버퍼)
      logLines.push(`⚠️ 타임아웃 임박, ${verifiedCount}건 처리 후 중단`);
      break;
    }

    const result = await verifyAlbum(album);
    verifiedCount++;

    if (result.corrected) {
      correctedCount++;
      logLines.push(
        `✅ 수정: [${album.artist_name}] "${album.album_title}" ${album.release_date} → ${result.corrected_date} (Korean Artist: ${result.is_korean_artist})`
      );
      await supabase
        .from("album_releases")
        .update({
          release_date: result.corrected_date,
          is_korean_artist: result.is_korean_artist,
          verified: true,
          verified_at: new Date().toISOString(),
          verification_source: "cron_gpt5_nano",
          verification_note: result.note,
        })
        .eq("id", album.id);
    } else {
      logLines.push(`✓ 확인: [${album.artist_name}] "${album.album_title}" ${album.release_date} (Korean Artist: ${result.is_korean_artist})`);
      await supabase
        .from("album_releases")
        .update({
          is_korean_artist: result.is_korean_artist,
          verified: true,
          verified_at: new Date().toISOString(),
          verification_source: "cron_gpt5_nano",
          verification_note: result.note,
        })
        .eq("id", album.id);
    }
  }

  // 5. 총 미검증 수 파악 (진행률 확인용)
  const { count: remainingCount } = await supabase
    .from("album_releases")
    .select("id", { count: "exact", head: true })
    .eq("verified", false);

  // 6. 로그 완료
  await finishLog(runDate, albums.length, verifiedCount, correctedCount, "done",
    logLines.join("\n") + `\n\n남은 미검증: ${remainingCount ?? "?"}건`
  );

  return NextResponse.json({
    message: "Verification complete",
    verified: verifiedCount,
    corrected: correctedCount,
    remaining: remainingCount ?? -1,
    elapsed_ms: Date.now() - startAt,
  });
}

// ── 단일 앨범 검증 (LLM 교차 확인) ─────────────────
async function verifyAlbum(album: {
  id: number;
  artist_name: string;
  artist_name_ko: string | null;
  album_title: string;
  release_date: string;
  mbid: string | null;
}): Promise<{ corrected: boolean; corrected_date?: string; is_korean_artist: boolean | null; note: string }> {
  try {
    const systemPrompt = `You are a K-pop/K-indie music data expert.
Verify the release date of the following album and check if the artist is a Korean artist (K-Pop/K-Indie/K-Culture).
Return ONLY valid JSON in this exact format, with no markdown code blocks:
{
  "verified": true/false,
  "corrected_date": "YYYY-MM-DD" (or null if original is correct),
  "is_korean_artist": true/false (true if the artist operates primarily in the Korean music scene),
  "note": "Brief explanation or source"
}`;

    const userPrompt = `
    Artist: ${album.artist_name} ${album.artist_name_ko ? `(${album.artist_name_ko})` : ""}
    Album: ${album.album_title}
    Current DB Date: ${album.release_date}
    
    Is the release date correct? If it is a re-release or remaster, find the ORIGINAL first release date. Also, is this artist a Korean artist?
    `;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [
          { role: "system", "content": systemPrompt },
          { role: "user", "content": userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!resp.ok) {
      return { corrected: false, is_korean_artist: null, note: `API 오류: HTTP ${resp.status}` };
    }

    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Markdown JSON code block 제거
    if (content.startsWith("```json")) {
      content = content.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (content.startsWith("```")) {
      content = content.replace(/^```/, "").replace(/```$/, "").trim();
    }
    
    const parsed = JSON.parse(content);
    return {
      corrected: !parsed.verified,
      corrected_date: parsed.corrected_date || undefined,
      is_korean_artist: parsed.is_korean_artist ?? null,
      note: parsed.note || "LLM Verified"
    };
  } catch (error: any) {
    return { corrected: false, is_korean_artist: null, note: `LLM 호출 에러: ${error.message}` };
  }
}

// ── 로그 완료 헬퍼 ─────────────────────────────────────────
async function finishLog(
  runDate: string,
  total: number,
  verified: number,
  corrected: number,
  status: string,
  logText: string
) {
  await supabase
    .from("daily_verification_logs")
    .update({
      total_albums: total,
      verified,
      corrected,
      status,
      completed_at: new Date().toISOString(),
      log_text: logText,
    })
    .eq("run_date", runDate)
    .eq("status", "running");
}
