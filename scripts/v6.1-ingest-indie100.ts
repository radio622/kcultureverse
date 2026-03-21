/**
 * K-Culture Universe V6.1 — indie100.csv 아티스트 일괄 등록
 *
 * 1. CSV에서 고유 아티스트 추출
 * 2. MusicBrainz에서 MBID 검색 + 관계 수집
 * 3. iTunes에서 이미지/프리뷰 수집
 * 4. organic-graph.json에 노드 추가 (기존 노드와 중복 방지)
 * 5. CSV의 피처링/공동 아티스트 관계를 엣지로 추가
 */

import fs from "fs";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const csv = require("csv-parse/sync");

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_FILE = path.join(CACHE_DIR, "organic-graph.json");
const CSV_FILE = path.join(process.cwd(), "artists", "indie100.csv");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── MusicBrainz API ──────────────────────────────────
const MB_API = "https://musicbrainz.org/ws/2";
const MB_UA = "KCultureUniverse/6.1 (kcultureverse@gmail.com)";

async function searchMBID(name: string): Promise<{mbid: string; name: string} | null> {
  try {
    const url = `${MB_API}/artist/?query=artist:"${encodeURIComponent(name)}"&limit=5&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": MB_UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const artists = data.artists || [];
    // 정확한 이름 매칭 우선
    const exact = artists.find((a: any) =>
      a.name.toLowerCase() === name.toLowerCase() ||
      a["sort-name"]?.toLowerCase() === name.toLowerCase()
    );
    if (exact) return { mbid: exact.id, name: exact.name };
    // 한국(KR) 관련 아티스트 우선
    const kr = artists.find((a: any) =>
      a.area?.["iso-3166-1-codes"]?.includes("KR") ||
      a["begin-area"]?.name?.includes("Korea") ||
      a["begin-area"]?.name?.includes("Seoul")
    );
    if (kr) return { mbid: kr.id, name: kr.name };
    return artists[0] ? { mbid: artists[0].id, name: artists[0].name } : null;
  } catch {
    return null;
  }
}

// ── iTunes Search API ────────────────────────────────
async function searchITunes(name: string): Promise<{image: string | null; previewUrl: string | null; trackName: string | null; genres: string[]}> {
  const result = { image: null as string | null, previewUrl: null as string | null, trackName: null as string | null, genres: [] as string[] };
  try {
    // 곡 검색 (이미지 + 프리뷰)
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=3&country=KR`;
    const res = await fetch(url);
    if (!res.ok) return result;
    const data = await res.json();
    const match = (data.results || []).find((r: any) =>
      r.artistName.toLowerCase().includes(name.toLowerCase())
    ) || data.results?.[0];
    if (match) {
      result.image = match.artworkUrl100?.replace("100x100", "600x600") || null;
      result.previewUrl = match.previewUrl || null;
      result.trackName = match.trackName || null;
      result.genres = match.primaryGenreName ? [match.primaryGenreName] : [];
    }
  } catch { /* ignore */ }
  return result;
}

// ── 메인 ────────────────────────────────────────────────
async function main() {
  console.log("🎵 indie100.csv 아티스트 일괄 등록 시작...\n");

  // 1. CSV 로드
  const csvContent = fs.readFileSync(CSV_FILE, "utf-8");
  const records = csv.parse(csvContent, { columns: true, skip_empty_lines: true });
  console.log(`  CSV: ${records.length}곡 로드`);

  // 2. 고유 아티스트 + 메타데이터 추출
  interface ArtistMeta {
    name: string;
    genres: Set<string>;
    spotifyTrackUri: string;
    label: string;
  }
  const artistMap = new Map<string, ArtistMeta>();
  
  for (const row of records) {
    const names = (row["Artist Name(s)"] || "").split(";").map((n: string) => n.trim()).filter(Boolean);
    const genreStr = row["Genres"] || "";
    const genres = genreStr.split(",").map((g: string) => g.trim()).filter(Boolean);
    const label = row["Record Label"] || "";
    const trackUri = row["Track URI"] || "";
    
    for (const name of names) {
      if (!artistMap.has(name)) {
        artistMap.set(name, { name, genres: new Set(genres), spotifyTrackUri: trackUri, label });
      } else {
        genres.forEach(g => artistMap.get(name)!.genres.add(g));
      }
    }
  }
  console.log(`  고유 아티스트: ${artistMap.size}명`);

  // 3. 기존 그래프 로드
  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
  const existingNames = new Set(graph.nodes.map((n: any) => n.name.toLowerCase()));
  const existingMBIDs = new Set(graph.nodes.map((n: any) => n.mbid));
  
  console.log(`  기존 그래프: 노드 ${graph.nodes.length}개, 엣지 ${graph.edges.length}개`);

  // 4. 새 아티스트 수집
  const newArtists: string[] = [];
  for (const [name] of artistMap) {
    if (!existingNames.has(name.toLowerCase())) {
      newArtists.push(name);
    }
  }
  console.log(`  새로 추가할 아티스트: ${newArtists.length}명\n`);

  let added = 0;
  for (let i = 0; i < newArtists.length; i++) {
    const name = newArtists[i];
    const meta = artistMap.get(name)!;
    console.log(`  [${i + 1}/${newArtists.length}] ${name}...`);

    // MusicBrainz MBID 검색
    const mb = await searchMBID(name);
    await sleep(1100); // MB rate limit: 1req/sec

    // iTunes 이미지/프리뷰 검색
    const itunes = await searchITunes(name);
    await sleep(300);

    const mbid = mb?.mbid || `indie100_${name.replace(/[^a-zA-Z0-9가-힣]/g, "_").toLowerCase()}`;
    
    if (existingMBIDs.has(mbid)) {
      console.log(`    ⏭️ MBID 중복 (이미 그래프에 있음)`);
      continue;
    }

    // Spotify Track URI에서 ID 추출
    const spotifyTrackId = meta.spotifyTrackUri.replace("spotify:track:", "");

    // 노드 추가
    const newNode = {
      mbid,
      name: mb?.name || name,
      nameKo: name, // CSV의 이름을 한국어명으로 사용
      depth: 0, // Seed로 취급
      image: itunes.image,
      genres: itunes.genres.length > 0 ? itunes.genres : Array.from(meta.genres),
      popularity: 0,
      spotifyId: null, // Track ID만 있고 Artist ID는 없음
      previewUrl: itunes.previewUrl,
      previewTrackName: itunes.trackName,
      label: meta.label,
    };

    graph.nodes.push(newNode);
    existingMBIDs.add(mbid);
    existingNames.add(name.toLowerCase());
    added++;

    const status = [
      mb ? "MB✅" : "MB❌",
      itunes.image ? "IMG✅" : "IMG❌",
      itunes.previewUrl ? "PRV✅" : "PRV❌",
    ].join(" ");
    console.log(`    ${status} → ${mbid.substring(0, 8)}...`);

    // 중간 저장
    if (added % 10 === 0) {
      fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");
      console.log(`    💾 중간 저장 (${added}명 추가)`);
    }
  }

  // 5. CSV 피처링 관계 엣지 추가
  console.log("\n  피처링/공동 아티스트 엣지 추가...");
  const mbidMap = new Map<string, string>();
  for (const n of graph.nodes) {
    mbidMap.set(n.name.toLowerCase(), n.mbid);
    if (n.nameKo) mbidMap.set(n.nameKo.toLowerCase(), n.mbid);
  }

  let edgesAdded = 0;
  const existingEdgeKeys = new Set(
    graph.edges.map((e: any) => [e.source, e.target].sort().join("::"))
  );

  for (const row of records) {
    const names = (row["Artist Name(s)"] || "").split(";").map((n: string) => n.trim()).filter(Boolean);
    if (names.length < 2) continue;

    // 같은 트랙에 세미콜론으로 나열된 아티스트들은 FEATURED 관계
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = mbidMap.get(names[i].toLowerCase());
        const b = mbidMap.get(names[j].toLowerCase());
        if (!a || !b) continue;
        
        const key = [a, b].sort().join("::");
        if (existingEdgeKeys.has(key)) continue;
        
        graph.edges.push({
          source: a, target: b,
          weight: 0.7, relation: "FEATURED",
          label: `피처링: ${row["Track Name"] || ""}`,
        });
        existingEdgeKeys.add(key);
        edgesAdded++;
      }
    }
  }

  console.log(`  피처링 엣지: ${edgesAdded}개 추가`);

  // 최종 저장
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");
  console.log(`\n🎉 완료! 새 노드 ${added}개, 새 엣지 ${edgesAdded}개 추가`);
  console.log(`  최종 그래프: 노드 ${graph.nodes.length}개, 엣지 ${graph.edges.length}개`);
}

main().catch(console.error);
