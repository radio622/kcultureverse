/**
 * K-Culture Universe — 플레이리스트 자동 입력 파이프라인
 *
 * Spotify 플레이리스트 URL을 입력하면:
 * 1. 웹 스크래핑으로 아티스트 목록 추출
 * 2. iTunes API로 메타데이터(사진, 장르, 미리듣기) 수집
 * 3. graph.json에 노드 + 관계 엣지 자동 추가
 * 4. Torus Force-Directed Layout 자동 재계산
 *
 * 사용법:
 *   npx tsx scripts/ingest-playlist.ts <SPOTIFY_PLAYLIST_URL>
 *   npx tsx scripts/ingest-playlist.ts https://open.spotify.com/playlist/78tiX3ROeVQM1J33H6jHQT
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
import type { UniverseGraph, GraphNode } from "../src/lib/graph";
import { genreSimilarity } from "../src/lib/graph";

const GRAPH_PATH = path.resolve(__dirname, "../public/data/graph.json");

// ── 유틸 ─────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 1. 플레이리스트에서 아티스트 추출 ────────────────────────────
async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function extractArtistsFromSpotify(
  url: string
): Promise<Array<{ name: string; spotifyId: string }>> {
  const playlistId = url.match(/playlist\/([a-zA-Z0-9]+)/)?.[1];
  if (!playlistId) throw new Error("올바른 Spotify 플레이리스트 URL이 아닙니다.");

  console.log(`   플레이리스트 ID: ${playlistId}`);

  // ── Spotify API로 트랙 조회 시도 ────────────────────────────
  const token = await getSpotifyToken();
  if (token) {
    console.log("   Spotify API 토큰 획득 성공 → API 조회 시도...");
    try {
      const seen = new Map<string, string>();
      let offset = 0;
      const limit = 100;

      while (true) {
        const apiUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}&fields=items(track(artists(id,name))),total`;
        const res = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.log(`   API 응답 ${res.status} — 다른 방법으로 시도...`);
          break;
        }

        const data = (await res.json()) as any;
        const items = data.items || [];

        for (const item of items) {
          const track = item.track;
          if (!track?.artists) continue;
          for (const artist of track.artists) {
            if (artist.id && !seen.has(artist.id)) {
              seen.set(artist.id, artist.name);
            }
          }
        }

        offset += limit;
        if (offset >= (data.total || 0) || items.length === 0) break;
        await sleep(100);
      }

      if (seen.size > 0) {
        const artists: Array<{ name: string; spotifyId: string }> = [];
        for (const [id, name] of seen) {
          artists.push({ name, spotifyId: id });
        }
        console.log(`   ✅ Spotify API에서 ${artists.length}명 추출 성공`);
        return artists;
      }
    } catch (err) {
      console.log(`   API 에러: ${(err as Error).message}`);
    }
  }

  // ── Fallback: 수동 입력 모드 ──────────────────────────────────
  console.log("\n   ⚠️  Spotify API가 차단되어 자동 추출에 실패했습니다.");
  console.log("   아티스트 이름을 수동으로 입력할 수 있습니다.");
  console.log("   (쉼표로 구분, 예: BTS, 블랙핑크, 아이유)");
  console.log('   건너뛰려면 빈 줄로 Enter:');

  // stdin에서 입력 받기
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question("\n   아티스트 이름들: ", async (input) => {
      rl.close();
      const names = input.split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) {
        resolve([]);
        return;
      }

      // 이름으로 iTunes에서 ID 매칭
      console.log(`\n   ${names.length}명을 iTunes에서 검색 중...`);
      const artists: Array<{ name: string; spotifyId: string }> = [];

      for (const name of names) {
        // iTunes에서 아티스트 ID 찾기 (Spotify ID 대용으로 이름 해시 사용)
        const id = "manual_" + Buffer.from(name).toString("base64url").slice(0, 22);
        artists.push({ name, spotifyId: id });
        console.log(`   ✅ ${name} → ${id}`);
      }

      resolve(artists);
    });
  });
}

// ── 2. iTunes API로 아티스트 메타데이터 수집 ─────────────────────
async function fetchArtistMetadata(
  nameOrId: string,
  spotifyId: string
): Promise<GraphNode | null> {
  try {
    // iTunes에서 아티스트 검색
    const query = encodeURIComponent(nameOrId || spotifyId);
    const url = `https://itunes.apple.com/search?term=${query}&entity=musicArtist&country=KR&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const artist = data.results?.[0];

    if (!artist) return null;

    // 아티스트의 곡 검색 (미리듣기 URL + 장르 추출)
    const songUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      artist.artistName
    )}&entity=song&country=KR&limit=5`;
    const songRes = await fetch(songUrl);
    const songData = (await songRes.json()) as any;
    const songs = songData.results || [];

    const previewUrl = songs[0]?.previewUrl || null;
    const previewTrackName = songs[0]?.trackName || null;
    const genres = [
      ...new Set(
        songs
          .map((s: any) => s.primaryGenreName)
          .filter((g: string) => g && g !== "Music")
      ),
    ] as string[];

    // 아티스트 이미지
    const imageUrl = (artist.artworkUrl100 || "")
      .replace("100x100", "400x400")
      || null;

    return {
      name: artist.artistName,
      nameKo: artist.artistName,
      image: imageUrl || null,
      genres,
      popularity: 50, // iTunes는 인기도를 제공하지 않으므로 기본값
      previewUrl,
      spotifyUrl: `https://open.spotify.com/artist/${spotifyId}`,
    };
  } catch {
    return null;
  }
}

// ── 3. Spotify ID로 아티스트 이름 찾기 (기존 캐시 스캔) ──────────
function findNameInCache(spotifyId: string): string | null {
  const hubDir = path.resolve(__dirname, "../public/data/hub");
  try {
    const files = fs.readdirSync(hubDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(hubDir, file), "utf-8");
      const data = JSON.parse(raw);
      // 코어 체크
      if (data.core?.spotifyId === spotifyId) return data.core.name;
      // 위성 체크
      for (const sat of data.satellites || []) {
        if (sat.spotifyId === spotifyId) return sat.name;
      }
    }
  } catch {}
  return null;
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // --artists "이름1, 이름2, ..." 플래그 파싱
  const artistsIdx = args.indexOf("--artists");
  let manualNames: string[] = [];
  let url = "";

  if (artistsIdx !== -1 && args[artistsIdx + 1]) {
    manualNames = args[artistsIdx + 1].split(",").map((s) => s.trim()).filter(Boolean);
    url = args.find((a) => a.startsWith("http")) || "manual-input";
  } else {
    url = args[0] || "";
  }

  if (!url && manualNames.length === 0) {
    console.log("🌌 K-Culture Universe — 플레이리스트 자동 입력 파이프라인\n");
    console.log("사용법:");
    console.log("  1) Spotify 플레이리스트 URL (API가 살아있을 때):");
    console.log('     npx tsx scripts/ingest-playlist.ts https://open.spotify.com/playlist/...\n');
    console.log("  2) 아티스트 이름 직접 입력 (API 차단 시에도 사용 가능):");
    console.log('     npx tsx scripts/ingest-playlist.ts --artists "BTS, 블랙핑크, 아이유, 10cm"\n');
    console.log("  3) 두 가지 혼합:");
    console.log('     npx tsx scripts/ingest-playlist.ts https://... --artists "추가아티스트1, 추가2"\n');
    process.exit(1);
  }

  console.log("🌌 플레이리스트 자동 입력 파이프라인 시작\n");
  if (url !== "manual-input") console.log(`   URL: ${url}\n`);

  // ── Step 1: 아티스트 추출 ──────────────────────────────────
  let artists: Array<{ name: string; spotifyId: string }> = [];

  // Spotify URL이 있으면 API 추출 시도
  if (url && url.startsWith("http")) {
    console.log("📋 Step 1: 플레이리스트에서 아티스트 추출...");
    artists = await extractArtistsFromSpotify(url);
    console.log(`   추출된 아티스트 ID: ${artists.length}개\n`);
  }

  // --artists 로 수동 지정된 이름 추가
  if (manualNames.length > 0) {
    console.log(`📋 수동 입력 아티스트 ${manualNames.length}명 추가...`);
    for (const name of manualNames) {
      const id = "manual_" + Buffer.from(name).toString("base64url").slice(0, 22);
      // 이미 추출된 이름과 중복이면 건너뜀
      if (!artists.find((a) => a.name === name || a.spotifyId === id)) {
        artists.push({ name, spotifyId: id });
        console.log(`   ✅ ${name}`);
      }
    }
    console.log();
  }

  if (artists.length === 0) {
    console.log("⚠️  아티스트를 추출하지 못했습니다.");
    console.log("   Spotify 페이지가 JavaScript로 로딩되어 스크래핑이 제한될 수 있습니다.");
    console.log("   수동으로 아티스트를 추가하려면 graph.json을 직접 편집하세요.");
    process.exit(0);
  }

  // ── Step 2: graph.json 로드 ────────────────────────────────
  console.log("📂 Step 2: graph.json 로드...");
  let graph: UniverseGraph;
  if (fs.existsSync(GRAPH_PATH)) {
    graph = JSON.parse(fs.readFileSync(GRAPH_PATH, "utf-8"));
  } else {
    graph = { nodes: {}, edges: [] };
  }
  const existingCount = Object.keys(graph.nodes).length;
  console.log(`   기존 노드: ${existingCount}개\n`);

  // ── Step 3: 신규 아티스트만 필터링 + 메타데이터 수집 ────────
  console.log("🔍 Step 3: 신규 아티스트 메타데이터 수집...");
  let added = 0;
  let skipped = 0;
  const newIds: string[] = [];
  const playlistArtistIds: string[] = []; // 플레이리스트 동시출현 엣지용

  for (let i = 0; i < artists.length; i++) {
    const { spotifyId } = artists[i];

    playlistArtistIds.push(spotifyId);

    // 이미 그래프에 있으면 스킵
    if (graph.nodes[spotifyId]) {
      skipped++;
      continue;
    }

    // 아티스트 이름 찾기 (입력 값 → 캐시 → ID fallback)
    let name = artists[i].name || findNameInCache(spotifyId);

    // iTunes에서 메타데이터 가져오기 (이름으로 검색)
    const meta = await fetchArtistMetadata(name || spotifyId, spotifyId);

    if (meta) {
      graph.nodes[spotifyId] = meta;
      newIds.push(spotifyId);
      added++;
      console.log(`   [${i + 1}/${artists.length}] ✅ ${meta.name}`);
    } else {
      // iTunes에서도 못 찾으면 최소 메타 생성
      graph.nodes[spotifyId] = {
        name: name || `Artist_${spotifyId.slice(0, 6)}`,
        nameKo: name || `Artist_${spotifyId.slice(0, 6)}`,
        image: null,
        genres: [],
        popularity: 30,
        previewUrl: null,
        spotifyUrl: `https://open.spotify.com/artist/${spotifyId}`,
      };
      newIds.push(spotifyId);
      added++;
      console.log(`   [${i + 1}/${artists.length}] ⚠️ ${name || spotifyId} (메타데이터 없음)`);
    }

    // iTunes Rate Limit 방지
    await sleep(300);
  }

  console.log(`\n   ✅ 신규 추가: ${added}명, ⏭ 기존 스킵: ${skipped}명\n`);

  // ── Step 4: 관계 엣지 생성 ─────────────────────────────────
  console.log("🔗 Step 4: 관계 엣지 생성...");
  const edgeSet = new Set(
    graph.edges.map(([a, b]) => [a, b].sort().join("-"))
  );
  let newEdges = 0;

  // 4-A: 같은 플레이리스트 동시출현 엣지 (weight: 0.35)
  for (let i = 0; i < playlistArtistIds.length; i++) {
    for (let j = i + 1; j < playlistArtistIds.length; j++) {
      const key = [playlistArtistIds[i], playlistArtistIds[j]].sort().join("-");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        graph.edges.push([
          playlistArtistIds[i],
          playlistArtistIds[j],
          0.35,
          "same_playlist",
        ]);
        newEdges++;
      }
    }
    // 너무 많은 엣지 방지 (각 아티스트당 최대 20개)
    if (newEdges > playlistArtistIds.length * 20) break;
  }

  // 4-B: 장르 유사도 엣지 (신규 노드 ↔ 기존 노드)
  for (const newId of newIds) {
    const newNode = graph.nodes[newId];
    if (!newNode.genres.length) continue;

    for (const existId of Object.keys(graph.nodes)) {
      if (existId === newId) continue;
      const existNode = graph.nodes[existId];
      const sim = genreSimilarity(newNode.genres, existNode.genres);
      if (sim > 0.3) {
        const key = [newId, existId].sort().join("-");
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          graph.edges.push([newId, existId, sim * 0.5, "genre_overlap"]);
          newEdges++;
        }
      }
    }
  }

  console.log(`   신규 엣지: ${newEdges}개\n`);

  // ── Step 5: graph.json 저장 ────────────────────────────────
  console.log("💾 Step 5: graph.json 저장...");
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");
  const totalNodes = Object.keys(graph.nodes).length;
  const totalEdges = graph.edges.length;
  console.log(`   총 노드: ${totalNodes}개, 총 엣지: ${totalEdges}개`);
  console.log(`   파일 크기: ${(fs.statSync(GRAPH_PATH).size / 1024).toFixed(1)}KB\n`);

  // ── Step 6: Force-Directed Layout 재계산 ───────────────────
  if (added > 0) {
    console.log("🧮 Step 6: Torus Force-Directed Layout 재계산...");
    // 기존 노드를 pinned로 마킹
    for (const id of Object.keys(graph.nodes)) {
      if (!newIds.includes(id) && graph.nodes[id].x !== undefined) {
        graph.nodes[id].pinned = true;
      }
    }
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");

    try {
      execSync("npx tsx scripts/compute-layout.ts", {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
      });
    } catch (err) {
      console.log("   ⚠️ 레이아웃 계산 실패 — 이전 좌표 유지");
    }

    // pinned 해제 (다음 실행 시 다시 고정되도록)
    const updated = JSON.parse(fs.readFileSync(GRAPH_PATH, "utf-8")) as UniverseGraph;
    for (const id of Object.keys(updated.nodes)) {
      delete updated.nodes[id].pinned;
    }
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(updated, null, 2), "utf-8");
  }

  // ── 완료 리포트 ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("    플레이리스트 입력 완료 리포트");
  console.log("═══════════════════════════════════════");
  console.log(`  📋 입력 URL: ${url}`);
  console.log(`  ✅ 신규 추가: ${added}명`);
  console.log(`  ⏭  기존 스킵: ${skipped}명`);
  console.log(`  🔗 신규 엣지: ${newEdges}개`);
  console.log(`  📊 총 노드: ${totalNodes}개`);
  console.log(`  📊 총 엣지: ${totalEdges}개`);
  console.log("═══════════════════════════════════════");
  console.log("\n🚀 다음 단계:");
  console.log("   git add -A && git commit -m '🎵 아티스트 추가' && git push origin main");
}

main().catch((err) => {
  console.error("치명적 에러:", err);
  process.exit(1);
});
