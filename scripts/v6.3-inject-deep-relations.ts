/**
 * K-Culture Universe V6.3 Phase 2 — Deep-Scan Injection
 * 
 * 기존 TOP 10 트랙 수집 한계로 누락되었던 
 * 아이유 (리메이크/피처링 프로젝트), 이찬혁비디오 (협업 프로젝트) 등의
 * 역사적인 연결고리와 대상 아티스트 노드들을 수동으로 추가/병합합니다.
 */

import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "v5.4");
const GRAPH_FILE = path.join(CACHE_DIR, "organic-graph.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MB_API = "https://musicbrainz.org/ws/2";
const MB_UA = "KCultureUniverse/6.3 (kcultureverse@gmail.com)";

async function searchMBID(name: string) {
  try {
    const url = `${MB_API}/artist/?query=artist:"${encodeURIComponent(name)}"&limit=5&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": MB_UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const artists = data.artists || [];
    const exact = artists.find((a: any) =>
      a.name.toLowerCase() === name.toLowerCase() ||
      a["sort-name"]?.toLowerCase() === name.toLowerCase()
    );
    if (exact) return { mbid: exact.id, name: exact.name };
    const kr = artists.find((a: any) =>
      a.area?.["iso-3166-1-codes"]?.includes("KR") ||
      a["begin-area"]?.name?.includes("Korea")
    );
    if (kr) return { mbid: kr.id, name: kr.name };
    return artists[0] ? { mbid: artists[0].id, name: artists[0].name } : null;
  } catch {
    return null;
  }
}

async function searchITunes(name: string) {
  const result = { image: null as string | null, previewUrl: null as string | null, trackName: null as string | null, genres: [] as string[] };
  try {
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

// 강제 주입 대상 데이터 (이름, 장르)
const INJECT_ARTISTS = [
  { nameKo: "서태지", searchName: "Seo Taiji", genres: ["Rock", "K-Pop"] },
  { nameKo: "산울림", searchName: "Sanullim", genres: ["Rock", "Folk"] },
  { nameKo: "김창완", searchName: "Kim Chang Wan", genres: ["Rock", "Folk"] },
  { nameKo: "조덕배", searchName: "Cho Deok-bae", genres: ["Folk", "Ballad"] },
  { nameKo: "양희은", searchName: "Yang Hee-eun", genres: ["Folk"] },
  { nameKo: "오혁", searchName: "Oh Hyuk", genres: ["Indie", "R&B"] },
  { nameKo: "이승철", searchName: "Lee Seung-chul", genres: ["Ballad", "Pop"] },
  { nameKo: "이성경", searchName: "Lee Sung-kyung", genres: ["Pop", "OST"] },
];

async function main() {
  console.log("🕵️ V6.3 Deep Scan Injection 시작...\n");

  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
  let addedNodes = 0;
  let addedEdges = 0;

  // 이름 -> MBID 매핑 캐시
  const nodeMap = new Map<string, string>();
  for (const n of graph.nodes) {
    nodeMap.set(n.name.toLowerCase(), n.mbid);
    if (n.nameKo) nodeMap.set(n.nameKo.toLowerCase(), n.mbid);
  }

  // ==== 1. 심층(Deep) 대상 노드 수집 ====
  for (let i = 0; i < INJECT_ARTISTS.length; i++) {
    const target = INJECT_ARTISTS[i];
    if (nodeMap.has(target.nameKo.toLowerCase())) {
      console.log(`  [Skip] 이미 존재함: ${target.nameKo}`);
      continue;
    }

    console.log(`  [${i + 1}/${INJECT_ARTISTS.length}] ${target.nameKo} 노드 스캔...`);
    
    let mb = await searchMBID(target.searchName);
    if (!mb) mb = await searchMBID(target.nameKo);
    await sleep(1100);

    const itunes = await searchITunes(target.nameKo);
    await sleep(300);

    const mbid = mb?.mbid || `deep_${target.searchName.replace(/\\s+/g, '_').toLowerCase()}`;
    
    const newNode = {
      mbid,
      name: mb?.name || target.searchName,
      nameKo: target.nameKo,
      depth: 0,
      image: itunes.image,
      genres: itunes.genres.length > 0 ? itunes.genres : target.genres,
      popularity: 60,
      spotifyId: null,
      previewUrl: itunes.previewUrl,
      previewTrackName: itunes.trackName,
    };

    graph.nodes.push(newNode);
    nodeMap.set(target.nameKo.toLowerCase(), mbid);
    nodeMap.set(target.searchName.toLowerCase(), mbid);
    addedNodes++;

    console.log(`    ✅ 추가됨: ${target.nameKo} (IMG:${itunes.image ? "O" : "X"}, PRV:${itunes.previewUrl ? "O" : "X"})`);
  }

  // ==== 2. 심층 관계 (Edges) 수집 및 병합 ====
  console.log("\n🔗 딥 스캔 엣지 연결 (아이유 꽃갈피, 이찬혁비디오 등)...");

  interface DeepRelation {
    a: string; b: string; relation: string; weight: number; label: string;
  }
  
  const INJECT_EDGES: DeepRelation[] = [
    // === IU 꽃갈피/리메이크 & 피처링 ===
    { a: "아이유", b: "산울림", relation: "COVER", weight: 0.8, label: "리메이크: 너의 의미" },
    { a: "아이유", b: "김창완", relation: "FEATURED", weight: 0.8, label: "피처링: 너의 의미" },
    { a: "아이유", b: "조덕배", relation: "COVER", weight: 0.7, label: "리메이크: 나의 옛날이야기" },
    { a: "아이유", b: "양희은", relation: "COVER", weight: 0.7, label: "리메이크: 가을 아침" },
    { a: "아이유", b: "김광석", relation: "COVER", weight: 0.8, label: "리메이크: 잊어야 한다는 마음으로" },
    { a: "아이유", b: "서태지", relation: "FEATURED", weight: 0.9, label: "콜라보: 소격동" },
    { a: "아이유", b: "오혁", relation: "FEATURED", weight: 0.8, label: "콜라보: 사랑이 잘" },
    
    // 악동뮤지션(AKMU)과의 연결
    { a: "아이유", b: "악동뮤지션", relation: "FEATURED", weight: 0.9, label: "피처링: 낙하" },
    { a: "아이유", b: "이찬혁", relation: "WRITER", weight: 0.7, label: "작사/작곡: 낙하, 프라이" },

    // 언니네이발관 등 인디 연결고리
    { a: "아이유", b: "언니네이발관", relation: "FEATURED", weight: 0.7, label: "콜라보: 이석원 참여" },
    { a: "아이유", b: "가을방학", relation: "FEATURED", weight: 0.7, label: "콜라보: 정바비 참여" },
    { a: "아이유", b: "줄리아하트", relation: "INDIRECT", weight: 0.6, label: "인디 씬 프로듀싱 참여" },
    { a: "아이유", b: "윤상", relation: "PRODUCER", weight: 0.9, label: "작곡/프로듀싱: 나만 몰랐던 이야기" },

    // === 이찬혁비디오 (Lee Chanhyuk Video) ===
    { a: "이찬혁", b: "이승철", relation: "PRODUCER", weight: 0.8, label: "이찬혁비디오: 우산" },
    { a: "이찬혁", b: "이성경", relation: "PRODUCER", weight: 0.7, label: "이찬혁비디오" },
    { a: "이찬혁", b: "장기하와 얼굴들", relation: "PRODUCER", weight: 0.7, label: "이찬혁비디오 리메이크 원곡자" },
    { a: "악동뮤지션", b: "장기하와 얼굴들", relation: "INDIRECT", weight: 0.6, label: "음악적 영감 교류" },
  ];

  const existingEdgeKeys = new Set(
    graph.edges.map((e: any) => [e.source, e.target].sort().join("::"))
  );

  for (const edge of INJECT_EDGES) {
    const idA = nodeMap.get(edge.a.toLowerCase());
    const idB = nodeMap.get(edge.b.toLowerCase());
    
    if (!idA) console.warn(`  ⚠️ 경고: [${edge.a}] 노드를 찾을 수 없어 연결 스킵.`);
    if (!idB) console.warn(`  ⚠️ 경고: [${edge.b}] 노드를 찾을 수 없어 연결 스킵.`);
    
    if (idA && idB) {
      const key = [idA, idB].sort().join("::");
      if (!existingEdgeKeys.has(key)) {
        graph.edges.push({
          source: idA, target: idB,
          weight: edge.weight,
          relation: edge.relation,
          label: edge.label,
        });
        existingEdgeKeys.add(key);
        addedEdges++;
        console.log(`    🔗 [${edge.a}] ↔ [${edge.b}] (${edge.label})`);
      }
    }
  }

  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");
  console.log(`\n🎉 완료! 심층 노드 ${addedNodes}개 추가, 엣지 ${addedEdges}개 추가`);
  console.log(`   organic-graph 현재 상태: 노드 ${graph.nodes.length}개, 엣지 ${graph.edges.length}개`);
}

main().catch(console.error);
