/**
 * V6.4 CSV Batch Ingest Script
 *
 * ⚠️ 데이터 품질 규칙 (docs/DATA_QUALITY_GUIDE.md 필독!):
 *
 * 【규칙 1 — 콜라보 금지】
 * Spotify CSV에서 "Crush;태연", "10CM;이수현" 등 세미콜론(;)으로 연결된 이름은
 * 하나의 아티스트가 아닌 "콜라보레이션 곡"이다.
 * 절대 하나의 노드로 만들지 말 것! → 개별 아티스트 노드 + FEATURED 엣지로 분리 필요.
 *
 * 【규칙 2 — 이름 통합】
 * name(영문)과 nameKo(한글) 모두 반드시 설정할 것.
 * nameKo가 name과 동일하면 안 됨 (한글 이름이 있는 경우).
 *
 * 【규칙 3 — Spotify 발매일 불신】
 * Spotify의 release_date는 리마스터/재발매 날짜로 원본을 덮어씀.
 * MusicBrainz first-release-date를 우선 사용할 것.
 */
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_FILE = path.join(CACHE_DIR, "organic-graph.json");
const CSV_DIR = path.join(process.cwd(), "artists");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MB_API = "https://musicbrainz.org/ws/2";
// 고유 User-Agent 필수 (차단 방지)
const MB_UA = "KCultureUniverse/6.4-Batch (jiti@example.com)";

// === API 검색 ===
async function searchMBID(name: string) {
  try {
    const url = `${MB_API}/artist/?query=artist:"${encodeURIComponent(name)}"&limit=3&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": MB_UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const artists = data.artists || [];
    const exact = artists.find((a: any) =>
      a.name.toLowerCase() === name.toLowerCase() ||
      a["sort-name"]?.toLowerCase() === name.toLowerCase()
    );
    if (exact) return { mbid: exact.id, name: exact.name };
    const kr = artists.find((a: any) => a.area?.["iso-3166-1-codes"]?.includes("KR"));
    if (kr) return { mbid: kr.id, name: kr.name };
    return artists[0] ? { mbid: artists[0].id, name: artists[0].name } : null;
  } catch {
    return null;
  }
}

async function searchITunes(name: string) {
  const result = { image: null as string | null, previewUrl: null as string | null, trackName: null as string | null, genres: [] as string[] };
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=2&country=KR`;
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

const PLAYLIST_ANCHORS: Record<string, string> = {
  "Korean_Rock_Best_Songs_🇰🇷_(한국_락_마스터피스).csv": "신해철",
  "90년대_가요_탑텐_역대_1위곡_모음.csv": "신승훈",
  "검정치마_라디오.csv": "검정치마",
  "Linus'_Blanket_라디오.csv": "라이너스의 담요",
  "라이너스의_담요_라디오.csv": "라이너스의 담요",
  "언니네_이발관_라디오.csv": "언니네이발관",
  "k90s00s.csv": "이효리",
  "indie100.csv": "장기하와 얼굴들",
  "지금_들어도_좋은_옛날_한국_노래_(80,90,00년대).csv": "김동률",
};

async function main() {
  console.log("🚀 V6.4 CSV Batch Ingest 시작...");

  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
  let addedNodes = 0;
  let addedEdges = 0;

  // 전체 기존 아티스트 해시맵 구성
  const existingMap = new Map<string, string>(); // name(lower) -> mbid
  for (const n of graph.nodes) {
    existingMap.set(n.name.toLowerCase().trim(), n.mbid);
    if (n.nameKo) existingMap.set(n.nameKo.toLowerCase().trim(), n.mbid);
  }

  // 기존 엣지 키셋 구성 (중복 방지)
  const existingEdgeKeys = new Set(
    graph.edges.map((e: any) => [e.source, e.target].sort().join("::"))
  );

  const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith(".csv"));
  
  for (const file of csvFiles) {
    console.log(`\n📂 파일 처리 시작: ${file}`);
    const filePath = path.join(CSV_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    
    // BOM 자동 제거 옵션 활성화
    const records = parse(content, { columns: true, skip_empty_lines: true, bom: true });

    // 이름 컬럼 탐색 자동화
    let nameKey = null;
    if (records.length > 0) {
      const keys = Object.keys(records[0]);
      nameKey = keys.find(k => k.toLowerCase().includes("artist name") || k.includes("가수") || k.toLowerCase().includes("artist"));
    }
    if (!nameKey) {
      console.log(`  [Skip] 아티스트 이름 컬럼을 못찾음`);
      continue;
    }

    const anchorName = PLAYLIST_ANCHORS[file] || null;
    const anchorMbid = anchorName ? existingMap.get(anchorName.toLowerCase()) : null;

    let fileNewCount = 0;

    for (const record of records) {
      const rawVal = record[nameKey];
      if (!rawVal) continue;

      const names = rawVal.split(",").map((x: string) => x.trim());
      for (const nameKo of names) {
        if (!nameKo || nameKo.toLowerCase() === "various artists") continue;

        // ⚠️ 【규칙 1 — 콜라보 감지】 세미콜론이 있으면 콜라보 곡!
        // 하나의 노드로 추가하면 안 됨. 개별 분리 필요.
        // TODO: V7.0.3 Phase 1에서 자동 분리 로직 구현 예정
        if (nameKo.includes(';')) {
          console.log(`  ⚠️ [콜라보 감지] "${nameKo}" → 분리 필요 (스킵)`);
          continue; // 콜라보는 별도 처리. 절대 단일 노드로 만들지 않음!
        }
        
        // 중복이면 스킵
        if (existingMap.has(nameKo.toLowerCase())) {
          // 중복이지만 앵커와 엣지가 없다면 연결해주자 (느슨한 플레이리스트 유대감)
          const existingMbid = existingMap.get(nameKo.toLowerCase());
          if (anchorMbid && existingMbid && anchorMbid !== existingMbid) {
            const edgeKey = [existingMbid, anchorMbid].sort().join("::");
            if (!existingEdgeKeys.has(edgeKey)) {
              graph.edges.push({
                source: existingMbid, target: anchorMbid, relation: "GENRE_OVERLAP", weight: 0.1, label: "같은 플레이리스트 (라디오/모음집)"
              });
              existingEdgeKeys.add(edgeKey);
              addedEdges++;
            }
          }
          continue;
        }

        console.log(`  🔍 신규 발굴: ${nameKo} API 검색 중...`);
        // Rate limit 회피
        await sleep(1100);
        const mb = await searchMBID(nameKo);
        await sleep(200);
        const itunes = await searchITunes(nameKo);

        const mbid = mb?.mbid || `batch_${Buffer.from(nameKo).toString("base64").substring(0, 10)}`;
        
        // 이미 이번 회차에 추가된 mbid일 경우 스킵
        const existingNode = graph.nodes.find((n: any) => n.mbid === mbid);
        if (existingNode) continue;

        const newNode = {
          mbid,
          name: mb?.name || nameKo,
          nameKo: nameKo,
          depth: 0,
          image: itunes.image,
          genres: itunes.genres,
          popularity: 45, // 배치 주입 기본 인기도
          spotifyId: null,
          previewUrl: itunes.previewUrl,
          previewTrackName: itunes.trackName,
        };

        graph.nodes.push(newNode);
        existingMap.set(nameKo.toLowerCase(), mbid);
        (mb?.name) && existingMap.set(mb.name.toLowerCase(), mbid);
        addedNodes++;
        fileNewCount++;

        console.log(`    ✅ 노드 추가 완료: ${nameKo} (ID:${mbid.substring(0,8)}... / 음악:${itunes.previewUrl ? 'O' : 'X'})`);

        // 앵커와 엣지 생성
        if (anchorMbid && mbid !== anchorMbid) {
          const edgeKey = [mbid, anchorMbid].sort().join("::");
          if (!existingEdgeKeys.has(edgeKey)) {
            graph.edges.push({
              source: mbid, target: anchorMbid, relation: "GENRE_OVERLAP", weight: 0.1, label: "같은 플레이리스트 기원"
            });
            existingEdgeKeys.add(edgeKey);
            addedEdges++;
            console.log(`    🔗 엣지 연결됨: ${nameKo} ↔ ${anchorName}`);
          }
        }
      }
    }
    console.log(`  👉 ${file} 처리 완료: 신규 ${fileNewCount}명 추가됨.`);
    
    // 중간 세이브 - 혹시 중간에 끊겨도 반영되게
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");
  }

  console.log(`\n🎉 V6.4 배치 처리 대성공! 최종 추가 인원: ${addedNodes}명, 신규 엣지: ${addedEdges}개`);
}

main().catch(console.error);
