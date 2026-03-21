/**
 * K-Culture Universe V6.1 — Spotify 이미지 인핸서
 * 
 * Search API가 403 차단이므로, GET /artists?ids= 엔드포인트를 사용합니다.
 * hub-artists.ts의 62명 Spotify ID를 기반으로 고화질 이미지, 장르, 인기도를 주입합니다.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_IN = path.join(CACHE_DIR, "organic-graph.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Spotify 토큰
async function getToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify 키가 .env.local에 없습니다");

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// Spotify GET /artists?ids= (50명씩 Batch)
async function fetchArtistsBatch(token: string, ids: string[]): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetch(`${SPOTIFY_API}/artists?ids=${batch.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`  ❌ Batch ${i}~${i + batch.length} 실패: ${res.status}`);
      await sleep(3000);
      continue;
    }
    const data = await res.json();
    results.push(...(data.artists || []));
    await sleep(200);
  }
  return results;
}

async function main() {
  if (!fs.existsSync(GRAPH_IN)) {
    console.error("organic-graph.json 없음");
    process.exit(1);
  }

  console.log("🎵 Spotify Image Enhancer (V6.1) Started...\n");

  // hub-artists.ts의 Spotify ID 매핑 가져오기
  const hubArtistsPath = path.join(process.cwd(), "src", "data", "hub-artists.ts");
  const hubContent = fs.readFileSync(hubArtistsPath, "utf-8");
  
  // spotifyId와 name/nameKo 추출
  const spotifyMap = new Map<string, { spotifyId: string; nameKo: string }>();
  const idRegex = /spotifyId:\s*"([^"]+)"/g;
  const nameRegex = /name:\s*"([^"]+)"/g;
  const nameKoRegex = /nameKo:\s*"([^"]+)"/g;
  
  const spotifyIds: string[] = [];
  const names: string[] = [];
  const nameKos: string[] = [];
  
  let m;
  while ((m = idRegex.exec(hubContent))) spotifyIds.push(m[1]);
  while ((m = nameRegex.exec(hubContent))) names.push(m[1]);
  while ((m = nameKoRegex.exec(hubContent))) nameKos.push(m[1]);
  
  for (let i = 0; i < names.length && i < spotifyIds.length; i++) {
    spotifyMap.set(names[i].toLowerCase(), { spotifyId: spotifyIds[i], nameKo: nameKos[i] || names[i] });
  }
  
  console.log(`  hub-artists.ts에서 ${spotifyMap.size}명 Spotify ID 로드\n`);

  // Spotify 토큰 획득
  const token = await getToken();
  console.log("  ✅ Spotify 토큰 획득\n");

  // organic-graph.json 로드
  const data = JSON.parse(fs.readFileSync(GRAPH_IN, "utf-8"));
  
  // 1단계: hub-artists에서 매칭되는 노드에 Spotify ID 주입
  const matchedIds: string[] = [];
  let matchCount = 0;
  
  for (const node of data.nodes) {
    const match = spotifyMap.get(node.name.toLowerCase());
    if (match && !node.spotifyId) {
      node.spotifyId = match.spotifyId;
      node.nameKo = match.nameKo;
      matchCount++;
    }
    if (node.spotifyId && !node.spotifyId.startsWith("not_found_")) {
      matchedIds.push(node.spotifyId);
    }
  }
  
  console.log(`  1단계: hub-artists 매칭으로 ${matchCount}명 Spotify ID 주입`);
  console.log(`  Spotify ID 보유 노드: ${matchedIds.length}명\n`);

  // 2단계: GET /artists?ids= Batch 호출로 이미지/장르/인기도 수집
  console.log("  2단계: Spotify API Batch 호출...");
  const uniqueIds = [...new Set(matchedIds)];
  const artists = await fetchArtistsBatch(token, uniqueIds);
  
  // ID -> artist 맵
  const artistMap = new Map<string, any>();
  for (const a of artists) {
    if (a) artistMap.set(a.id, a);
  }
  
  console.log(`  API 응답: ${artistMap.size}명 데이터 수신\n`);

  // 3단계: 그래프 노드에 이미지/장르/인기도 주입
  let updatedCount = 0;
  for (const node of data.nodes) {
    if (!node.spotifyId) continue;
    const artist = artistMap.get(node.spotifyId);
    if (!artist) continue;
    
    node.image = artist.images?.[0]?.url || null;
    node.genres = artist.genres || [];
    node.popularity = artist.popularity || 0;
    updatedCount++;
  }
  
  console.log(`  3단계: ${updatedCount}명 이미지/장르/인기도 업데이트 완료`);

  // 저장
  fs.writeFileSync(GRAPH_IN, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\n🎉 Enhancer 완료! 업데이트: ${updatedCount}명`);
}

main().catch(console.error);
