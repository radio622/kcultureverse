/**
 * K-Culture Universe V7.0.1 — data_overrides 머지 스크립트
 *
 * Supabase data_overrides 테이블에서 applied=false인 패치를 읽어
 * v5-layout.json, v5-edges.json에 머지 후 재빌드를 트리거합니다.
 *
 * 실행: npx tsx scripts/merge-overrides.ts
 *
 * 처리 가능한 target_type:
 *   - "node_name"  → 노드 이름 수정
 *   - "edge"       → 엣지 추가/수정
 *   - "node_add"   → 신규 노드 추가 (레이아웃은 가장 가까운 기존 노드 근처에 배치)
 *   - "other"      → 커스텀 패치 (로그만)
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LAYOUT_PATH = path.resolve(__dirname, "../public/data/v5-layout.json");
const EDGES_PATH = path.resolve(__dirname, "../public/data/v5-edges.json");
const DETAILS_PATH = path.resolve(__dirname, "../public/data/v5-details.json");

interface LayoutNode {
  id: string; name: string; nameKo: string;
  x: number; y: number; degree: number; accent?: string;
}
interface LayoutFile { version: string; nodeCount: number; nodes: LayoutNode[]; }
interface EdgeEntry { source: string; target: string; weight: number; relation: string; label: string; }
interface EdgesFile { version: string; edgeCount: number; edges: EdgeEntry[]; }

async function main() {
  console.log("🔄 data_overrides 머지 시작\n");

  // 1. 미적용 패치 가져오기
  const { data: patches, error } = await supabase
    .from("data_overrides")
    .select("*")
    .eq("applied", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Supabase 조회 실패:", error.message);
    process.exit(1);
  }

  if (!patches || patches.length === 0) {
    console.log("✅ 적용할 패치가 없습니다.");
    return;
  }

  console.log(`📋 미적용 패치 ${patches.length}건 발견\n`);

  // 2. 현재 데이터 로드
  const layout: LayoutFile = JSON.parse(fs.readFileSync(LAYOUT_PATH, "utf-8"));
  const edgesFile: EdgesFile = JSON.parse(fs.readFileSync(EDGES_PATH, "utf-8"));
  let details: Record<string, any> = {};
  if (fs.existsSync(DETAILS_PATH)) {
    details = JSON.parse(fs.readFileSync(DETAILS_PATH, "utf-8"));
  }

  // 노드 맵 (빠른 조회용)
  const nodeMap = new Map<string, LayoutNode>();
  for (const n of layout.nodes) nodeMap.set(n.id, n);

  let applied = 0;
  let skipped = 0;

  for (const patch of patches) {
    const { id, target_type, target_id, patch_data } = patch;
    const data = patch_data as Record<string, any>;

    try {
      switch (target_type) {
        case "node_name": {
          // 이름 수정: target_id 또는 patch_data.spotifyId로 노드 찾기
          const nodeId = target_id || data.spotifyId;
          const node = nodeId ? nodeMap.get(nodeId) : null;
          if (node) {
            if (data.name) node.name = data.name;
            if (data.nameKo) node.nameKo = data.nameKo;
            console.log(`  ✅ #${id} 이름 수정: ${node.nameKo} (${node.name})`);
            applied++;
          } else {
            // spotifyId가 없으면 이름으로 검색
            const found = layout.nodes.find(n =>
              n.name === data.from || n.nameKo === data.from
            );
            if (found) {
              if (data.to || data.name) found.name = data.to || data.name;
              if (data.nameKo) found.nameKo = data.nameKo;
              console.log(`  ✅ #${id} 이름 수정 (이름검색): ${found.nameKo}`);
              applied++;
            } else {
              console.log(`  ⏭ #${id} 이름 수정 실패: 노드 '${data.from}' 미발견`);
              skipped++;
            }
          }
          break;
        }

        case "edge": {
          // 엣지 추가/수정
          const src = data.source as string;
          const tgt = data.target as string;
          const relation = data.relation as string || "INDIRECT";
          const weight = (data.weight as number) || 0.3;
          const label = (data.detail as string) || "";

          // 기존 엣지 중복 체크
          const exists = edgesFile.edges.some(e =>
            (e.source === src && e.target === tgt) ||
            (e.source === tgt && e.target === src)
          );

          if (exists) {
            // 기존 엣지 업데이트
            const idx = edgesFile.edges.findIndex(e =>
              (e.source === src && e.target === tgt) ||
              (e.source === tgt && e.target === src)
            );
            if (idx >= 0) {
              edgesFile.edges[idx] = { source: src, target: tgt, weight, relation, label };
            }
            console.log(`  ✅ #${id} 엣지 업데이트: ${src} ↔ ${tgt} (${relation})`);
          } else {
            edgesFile.edges.push({ source: src, target: tgt, weight, relation, label });
            // degree 업데이트
            const srcNode = nodeMap.get(src);
            const tgtNode = nodeMap.get(tgt);
            if (srcNode) srcNode.degree = (srcNode.degree || 0) + 1;
            if (tgtNode) tgtNode.degree = (tgtNode.degree || 0) + 1;
            console.log(`  ✅ #${id} 엣지 추가: ${src} ↔ ${tgt} (${relation}, w=${weight})`);
          }
          applied++;
          break;
        }

        case "node_add": {
          // 신규 노드: 기존 노드 중 랜덤 위치 근처에 배치
          const name = data.name as string;
          const nameKo = (data.nameKo as string) || name;
          const newId = `override_${id}_${Date.now()}`;

          // 랜덤 기존 노드 근처에 배치 (±50 오프셋)
          const refNode = layout.nodes[Math.floor(Math.random() * layout.nodes.length)];
          const x = refNode.x + (Math.random() - 0.5) * 100;
          const y = refNode.y + (Math.random() - 0.5) * 100;

          const newNode: LayoutNode = { id: newId, name, nameKo, x, y, degree: 0 };
          layout.nodes.push(newNode);
          nodeMap.set(newId, newNode);
          layout.nodeCount++;

          console.log(`  ✅ #${id} 노드 추가: ${nameKo} (${name}) at (${x.toFixed(0)}, ${y.toFixed(0)})`);
          applied++;
          break;
        }

        default:
          console.log(`  ⏭ #${id} 미지원 target_type: ${target_type}`);
          skipped++;
      }

      // 적용 완료 마킹
      await supabase
        .from("data_overrides")
        .update({ applied: true })
        .eq("id", id);

    } catch (err: any) {
      console.log(`  ❌ #${id} 처리 오류: ${err.message}`);
      skipped++;
    }
  }

  // 3. 파일 저장
  edgesFile.edgeCount = edgesFile.edges.length;
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2), "utf-8");
  fs.writeFileSync(EDGES_PATH, JSON.stringify(edgesFile, null, 2), "utf-8");

  console.log(`\n📊 결과: 적용 ${applied}건, 스킵 ${skipped}건`);
  console.log(`💾 ${LAYOUT_PATH} (${(fs.statSync(LAYOUT_PATH).size / 1024).toFixed(1)}KB)`);
  console.log(`💾 ${EDGES_PATH} (${(fs.statSync(EDGES_PATH).size / 1024).toFixed(1)}KB)`);
  console.log("\n✅ 머지 완료! compute-layout은 필요 시 별도 실행하세요.");
}

main().catch((err) => {
  console.error("치명적 에러:", err);
  process.exit(1);
});
