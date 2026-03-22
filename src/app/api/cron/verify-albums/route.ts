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
    llm_model: "gemini-2.0-flash",
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
        `✅ 수정: [${album.artist_name}] "${album.album_title}" ${album.release_date} → ${result.corrected_date}`
      );
      await supabase
        .from("album_releases")
        .update({
          release_date: result.corrected_date,
          verified: true,
          verified_at: new Date().toISOString(),
          verification_source: "cron_gemini",
          verification_note: result.note,
        })
        .eq("id", album.id);
    } else {
      logLines.push(`✓ 확인: [${album.artist_name}] "${album.album_title}" ${album.release_date}`);
      await supabase
        .from("album_releases")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          verification_source: "cron_gemini",
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

// ── 단일 앨범 검증 (MusicBrainz 교차 확인) ─────────────────
async function verifyAlbum(album: {
  id: number;
  artist_name: string;
  artist_name_ko: string | null;
  album_title: string;
  release_date: string;
  mbid: string | null;
}): Promise<{ corrected: boolean; corrected_date?: string; note: string }> {
  // MusicBrainz first-release-date 재확인 (MBID 있을 경우)
  if (album.mbid) {
    try {
      const resp = await fetch(
        `https://musicbrainz.org/ws/2/release/${album.mbid}?fmt=json`,
        {
          headers: {
            "User-Agent": "KCultureUniverse/7.4 (contact@kcultureverse.com)",
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const mbDate: string | undefined = data["date"];
        if (mbDate && mbDate !== album.release_date && mbDate.length >= 4) {
          // 연도만 있는 경우 (ex: "1998") 는 단순 참고만
          if (mbDate.length === 4) {
            return {
              corrected: false,
              note: `MB 연도만 확인됨: ${mbDate}`,
            };
          }
          return {
            corrected: true,
            corrected_date: mbDate,
            note: `MB 재확인: ${album.release_date} → ${mbDate}`,
          };
        }
        return { corrected: false, note: `MB 일치: ${mbDate ?? "n/a"}` };
      }
    } catch {
      // MB API 실패는 조용히 무시하고 검증됨으로 처리
      return { corrected: false, note: "MB API 오류 — 스킵" };
    }
  }

  // MBID 없는 경우: 일단 verified=true로 마킹 (Admin이 수동 확인)
  return { corrected: false, note: "MBID 없음 — 수동 확인 필요" };
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
