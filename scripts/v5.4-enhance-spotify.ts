/**
 * K-Culture Universe V6.1 — 다중 소스 이미지 인핸서
 *
 * 전략: Spotify → iTunes → hub-artists 하드코딩 순으로 폴백
 *
 * 1순위: Spotify GET /artists (이미 ID가 있는 노드)
 * 2순위: iTunes Search API (무료, 인증 불필요, 이미지+프리뷰)
 * 3순위: hub-artists.ts의 하드코딩 Spotify ID → URL 구성
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_IN = path.join(CACHE_DIR, "organic-graph.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── iTunes Search API ──────────────────────────────────
interface ITunesArtist {
  artistName: string;
  artistId: number;
  artworkUrl100?: string;
  primaryGenreName?: string;
}

async function searchITunes(name: string): Promise<ITunesArtist | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results: ITunesArtist[] = data.results || [];

    // 정확한 이름 매칭 우선
    const exact = results.find(
      (r) => r.artistName.toLowerCase() === name.toLowerCase()
    );
    return exact || results[0] || null;
  } catch {
    return null;
  }
}

// iTunes로 아티스트 대표곡 프리뷰 URL 가져오기
async function getITunesPreview(artistName: string): Promise<{previewUrl: string | null; trackName: string | null; artworkUrl: string | null}> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=3&country=KR`;
    const res = await fetch(url);
    if (!res.ok) return { previewUrl: null, trackName: null, artworkUrl: null };
    const data = await res.json();
    const results = data.results || [];
    
    // 아티스트명이 매칭되는 곡 찾기
    const match = results.find(
      (r: any) => r.artistName.toLowerCase().includes(artistName.toLowerCase())
    ) || results[0];
    
    if (match) {
      // artworkUrl100 → 고해상도로 변환 (100x100 → 600x600)
      const artworkHQ = match.artworkUrl100?.replace("100x100", "600x600") || null;
      return {
        previewUrl: match.previewUrl || null,
        trackName: match.trackName || null,
        artworkUrl: artworkHQ,
      };
    }
    return { previewUrl: null, trackName: null, artworkUrl: null };
  } catch {
    return { previewUrl: null, trackName: null, artworkUrl: null };
  }
}

// ── Spotify API (폴백용) ────────────────────────────────
async function trySpotifyBatch(ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return map;

    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) return map;
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const res = await fetch(`https://api.spotify.com/v1/artists?ids=${batch.join(",")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) break; // 403이면 중단
      const data = await res.json();
      for (const a of data.artists || []) {
        if (a) map.set(a.id, a);
      }
      await sleep(200);
    }
  } catch { /* Spotify 실패 시 무시 */ }
  return map;
}

// ── hub-artists.ts에서 nameKo + spotifyId 매핑 로드 ─────
function loadHubArtists(): Map<string, { spotifyId: string; nameKo: string }> {
  const hubPath = path.join(process.cwd(), "src", "data", "hub-artists.ts");
  const content = fs.readFileSync(hubPath, "utf-8");
  const map = new Map<string, { spotifyId: string; nameKo: string }>();

  // 간단한 파싱: { spotifyId, name, nameKo } 블록 추출
  const blocks = content.split(/\{/).slice(1);
  for (const block of blocks) {
    const sid = block.match(/spotifyId:\s*"([^"]+)"/)?.[1];
    const name = block.match(/name:\s*"([^"]+)"/)?.[1];
    const nameKo = block.match(/nameKo:\s*"([^"]+)"/)?.[1];
    if (sid && name) {
      map.set(name.toLowerCase(), { spotifyId: sid, nameKo: nameKo || name });
    }
  }
  return map;
}

// ── 메인 ────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(GRAPH_IN)) {
    console.error("organic-graph.json 없음");
    process.exit(1);
  }

  console.log("🎵 Multi-Source Image Enhancer (V6.1) Started...\n");

  const data = JSON.parse(fs.readFileSync(GRAPH_IN, "utf-8"));
  const hubMap = loadHubArtists();
  console.log(`  hub-artists.ts: ${hubMap.size}명 로드`);

  // Phase 1: hub-artists 매칭으로 Spotify ID + nameKo 주입
  let hubMatched = 0;
  for (const node of data.nodes) {
    const match = hubMap.get(node.name.toLowerCase());
    if (match) {
      if (!node.spotifyId) node.spotifyId = match.spotifyId;
      if (!node.nameKo || node.nameKo === node.name) node.nameKo = match.nameKo;
      hubMatched++;
    }
  }
  console.log(`  Phase 1: hub-artists 매칭 ${hubMatched}명\n`);

  // Phase 2: Spotify Batch (가능하면)
  const spotifyIds = data.nodes
    .filter((n: any) => n.spotifyId && !n.spotifyId.startsWith("not_found_"))
    .map((n: any) => n.spotifyId);
  
  console.log("  Phase 2: Spotify Batch 시도...");
  const spotifyData = await trySpotifyBatch([...new Set(spotifyIds)]);
  
  let spotifyUpdated = 0;
  if (spotifyData.size > 0) {
    for (const node of data.nodes) {
      if (!node.spotifyId) continue;
      const artist = spotifyData.get(node.spotifyId);
      if (!artist) continue;
      node.image = artist.images?.[0]?.url || node.image;
      node.genres = artist.genres?.length ? artist.genres : node.genres;
      node.popularity = artist.popularity || node.popularity;
      spotifyUpdated++;
    }
  }
  console.log(`  Spotify: ${spotifyUpdated}명 업데이트 ${spotifyData.size === 0 ? "(403 차단 — iTunes 폴백)" : ""}\n`);

  // Phase 3: iTunes 폴백 (이미지/프리뷰가 없는 노드)
  console.log("  Phase 3: iTunes Search 폴백...");
  let itunesUpdated = 0;
  
  for (let i = 0; i < data.nodes.length; i++) {
    const node = data.nodes[i];
    
    // 이미 이미지가 있으면 스킵
    if (node.image && node.previewUrl) continue;
    
    console.log(`    [${i + 1}/${data.nodes.length}] ${node.name}...`);
    
    // iTunes 아티스트 검색
    const itunesArtist = await searchITunes(node.name);
    if (itunesArtist) {
      // iTunes 곡 검색 (프리뷰 + 고화질 아트워크)
      const preview = await getITunesPreview(node.name);
      
      if (!node.image && preview.artworkUrl) {
        node.image = preview.artworkUrl;
      }
      if (!node.previewUrl && preview.previewUrl) {
        node.previewUrl = preview.previewUrl;
        node.previewTrackName = preview.trackName;
      }
      if (!node.genres?.length && itunesArtist.primaryGenreName) {
        node.genres = [itunesArtist.primaryGenreName];
      }
      itunesUpdated++;
      console.log(`      ✅ iTunes 매칭! ${preview.artworkUrl ? "이미지" : ""} ${preview.previewUrl ? "+ 프리뷰" : ""}`);
    } else {
      console.log(`      ⚠️ iTunes 검색 결과 없음`);
    }
    
    await sleep(300); // iTunes rate limit 방어
    
    // 중간 저장
    if (itunesUpdated > 0 && itunesUpdated % 10 === 0) {
      fs.writeFileSync(GRAPH_IN, JSON.stringify(data, null, 2), "utf-8");
      console.log(`      💾 중간 저장`);
    }
  }

  console.log(`\n  iTunes: ${itunesUpdated}명 업데이트\n`);

  // 최종 저장
  fs.writeFileSync(GRAPH_IN, JSON.stringify(data, null, 2), "utf-8");
  
  // 통계
  const withImage = data.nodes.filter((n: any) => n.image).length;
  const withPreview = data.nodes.filter((n: any) => n.previewUrl).length;
  console.log("=== 최종 통계 ===");
  console.log(`  이미지 보유: ${withImage}/${data.nodes.length}명`);
  console.log(`  프리뷰 보유: ${withPreview}/${data.nodes.length}명`);
  console.log(`  Spotify: ${spotifyUpdated}명 / iTunes: ${itunesUpdated}명`);
  console.log("🎉 Multi-Source Enhancer 완료!");
}

main().catch(console.error);
