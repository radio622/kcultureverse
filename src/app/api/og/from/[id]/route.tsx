import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getArtistFull } from "@/lib/spotify";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let artistName = "KCultureVerse";
  let imageUrl: string | null = null;

  try {
    const data = await getArtistFull(id);
    artistName = data.core.name;
    imageUrl = data.core.imageUrl;
  } catch {
    // fallback
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #060a14 0%, #0c1029 50%, #060a14 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 배경 글로우 */}
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* 아티스트 이미지 */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={artistName}
            width={200}
            height={200}
            style={{
              borderRadius: "50%",
              border: "3px solid rgba(167,139,250,0.6)",
              objectFit: "cover",
              marginBottom: 32,
            }}
          />
        )}

        {/* 텍스트 */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {artistName}
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(167,139,250,0.8)",
            marginTop: 12,
          }}
        >
          로부터
        </div>

        {/* 로고 */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.15em",
          }}
        >
          KCultureVerse
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
