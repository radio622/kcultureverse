import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getArtistFull } from "@/lib/spotify";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// ── v5-layout.json에서 아티스트 이름+이미지 빠르게 조회 ──
interface LayoutNode { id: string; name: string; nameKo: string; }
let _cache: Record<string, LayoutNode> | null = null;
function getNodeName(id: string): string | null {
  if (!_cache) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), "public/data/v5-layout.json"), "utf-8");
      _cache = {};
      for (const n of JSON.parse(raw).nodes) {
        if (n?.id) _cache[n.id] = n;
      }
    } catch { return null; }
  }
  const node = _cache?.[id];
  return node ? (node.nameKo || node.name) : null;
}

// ── 종성 판별 → 조사 선택 ──
function getJosa(word: string, josa1: string, josa2: string) {
  if (!word) return josa1;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return /[13678LMNR]$/i.test(word) ? josa2 : josa1;
  return (last - 0xac00) % 28 > 0 ? josa2 : josa1;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const toId = request.nextUrl.searchParams.get("to");

  // ── 아티스트 정보 수집 ──
  let fromName = getNodeName(id) || "KCultureVerse";
  let fromImage: string | null = null;
  let toName: string | null = null;
  let toImage: string | null = null;

  try {
    const data = await getArtistFull(id);
    fromName = data.core.name;
    fromImage = data.core.imageUrl;
  } catch { /* fallback */ }

  if (toId) {
    toName = getNodeName(toId);
    try {
      const data = await getArtistFull(toId);
      toName = toName || data.core.name;
      toImage = data.core.imageUrl;
    } catch { /* fallback */ }
  }

  // ── 여정 모드: 두 아티스트 합성 ──
  if (toId && toName) {
    const josa = getJosa(fromName, "로부터", "으로부터");
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #060a14 0%, #0c1029 50%, #060a14 100%)",
            fontFamily: "sans-serif",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* 배경 글로우 */}
          <div style={{
            position: "absolute", width: 700, height: 700, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          }} />

          {/* 두 아티스트 사진 */}
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginBottom: 36 }}>
            {/* FROM */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {fromImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fromImage} alt={fromName} width={160} height={160}
                  style={{ borderRadius: "50%", border: "3px solid rgba(167,139,250,0.6)", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: 160, height: 160, borderRadius: "50%",
                  background: "rgba(167,139,250,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 48, color: "rgba(167,139,250,0.8)",
                  border: "3px solid rgba(167,139,250,0.3)",
                }}>{fromName.charAt(0)}</div>
              )}
            </div>

            {/* 화살표 */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 36, color: "rgba(251,191,36,0.8)" }}>→→</div>
              <div style={{ fontSize: 14, color: "rgba(167,139,250,0.5)" }}>🚀</div>
            </div>

            {/* TO */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {toImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toImage} alt={toName} width={160} height={160}
                  style={{ borderRadius: "50%", border: "3px solid rgba(251,191,36,0.5)", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: 160, height: 160, borderRadius: "50%",
                  background: "rgba(251,191,36,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 48, color: "rgba(251,191,36,0.7)",
                  border: "3px solid rgba(251,191,36,0.3)",
                }}>{toName.charAt(0)}</div>
              )}
            </div>
          </div>

          {/* 텍스트 */}
          <div style={{ fontSize: 48, fontWeight: 700, color: "white", textAlign: "center", lineHeight: 1.2 }}>
            {fromName}{josa}
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "rgba(251,191,36,0.9)", textAlign: "center", marginTop: 4 }}>
            {toName}에게
          </div>

          {/* 로고 */}
          <div style={{ position: "absolute", bottom: 28, fontSize: 16, color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}>
            KCultureVerse
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // ── 단일 아티스트 모드 (기존) ──
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #060a14 0%, #0c1029 50%, #060a14 100%)",
          fontFamily: "sans-serif",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)",
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        }} />

        {fromImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fromImage} alt={fromName} width={200} height={200}
            style={{ borderRadius: "50%", border: "3px solid rgba(167,139,250,0.6)", objectFit: "cover", marginBottom: 32 }} />
        )}

        <div style={{ fontSize: 64, fontWeight: 700, color: "white", textAlign: "center", lineHeight: 1.1 }}>
          {fromName}
        </div>
        <div style={{ fontSize: 28, color: "rgba(167,139,250,0.8)", marginTop: 12 }}>
          로부터 🚀
        </div>

        <div style={{ position: "absolute", bottom: 32, fontSize: 18, color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>
          KCultureVerse
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
