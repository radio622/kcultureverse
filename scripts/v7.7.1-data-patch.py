#!/usr/bin/env python3
"""
V7.7.1 Data Quality Patch
=========================
organic-graph.json 원본에 3가지 수정 적용:

  1. GENRE_OVERLAP weight 0.5/0.6 → 0.1로 하향 (384개 플레이리스트 앵커 엣지)
     장르 유사성(weight 0.15)도 0.1로 통일
  2. 중복 노드 병합 (42그룹 / 85개 노드 → 42개로 축소)
  3. previewUrl 오염 정리 (~70개 동명이곡 문제)

적용 후 v5.4-build-universe.ts 재실행하면 public/data/* 재생성됨.
"""

import json
import copy
import os
from collections import defaultdict
from datetime import datetime

GRAPH_FILE = os.path.join(os.path.dirname(__file__), ".cache", "v5.4", "organic-graph.json")
BACKUP_FILE = GRAPH_FILE.replace(".json", f".backup-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")

def load_graph():
    with open(GRAPH_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_graph(graph):
    with open(GRAPH_FILE, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    print(f"✅ organic-graph.json 저장 완료 ({len(graph['nodes'])} nodes, {len(graph['edges'])} edges)")

def backup_graph(graph):
    with open(BACKUP_FILE, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    print(f"📦 백업 완료: {os.path.basename(BACKUP_FILE)}")


# ═══════════════════════════════════════════════════════════
# PATCH 1: GENRE_OVERLAP weight 하향
# ═══════════════════════════════════════════════════════════
def patch_genre_overlap_weights(graph):
    print("\n" + "="*60)
    print("PATCH 1: GENRE_OVERLAP weight → 0.1")
    print("="*60)

    changed = 0
    for edge in graph["edges"]:
        if edge.get("relation") == "GENRE_OVERLAP":
            old_w = edge.get("weight", 0)
            if old_w != 0.1:
                edge["weight"] = 0.1
                changed += 1

    print(f"  ✅ {changed}개 GENRE_OVERLAP 엣지 weight → 0.1로 변경")
    return changed


# ═══════════════════════════════════════════════════════════
# PATCH 2: 중복 노드 병합
# ═══════════════════════════════════════════════════════════
def patch_duplicate_nodes(graph):
    print("\n" + "="*60)
    print("PATCH 2: 중복 노드 병합")
    print("="*60)

    nodes = graph["nodes"]
    edges = graph["edges"]

    # ── Step 1: 이름 기반 그루핑 ──
    # name(lower) 또는 nameKo(lower)가 같으면 같은 아티스트 후보
    name_groups = defaultdict(list)
    for i, n in enumerate(nodes):
        # 콜라보 노드는 스킵 (세미콜론 포함)
        name = n.get("name", "")
        name_ko = n.get("nameKo", "")
        if ";" in name or ";" in name_ko:
            continue

        keys = set()
        if name:
            keys.add(name.lower().strip())
        if name_ko and name_ko != name:
            keys.add(name_ko.lower().strip())
        for k in keys:
            name_groups[k].append(i)

    # 같은 이름으로 2개 이상 매핑된 그룹 찾기
    dup_groups = {}  # group_key → set of node indices
    for key, indices in name_groups.items():
        if len(indices) >= 2:
            # 이 인덱스들을 하나의 그룹으로 묶기
            frozen = frozenset(indices)
            if frozen not in dup_groups:
                dup_groups[frozen] = key

    # 그룹 병합 (겹치는 그룹 통합)
    merged_groups = []
    used = set()
    for group_indices in dup_groups:
        if any(i in used for i in group_indices):
            # 이미 다른 그룹에 포함된 인덱스가 있으면 해당 그룹에 병합
            found = False
            for mg in merged_groups:
                if mg & group_indices:
                    mg.update(group_indices)
                    used.update(group_indices)
                    found = True
                    break
            if not found:
                merged_groups.append(set(group_indices))
                used.update(group_indices)
        else:
            merged_groups.append(set(group_indices))
            used.update(group_indices)

    print(f"  발견된 중복 그룹: {len(merged_groups)}개")

    # ── Step 2: 각 그룹에서 primary 선택 & 병합 ──
    # degree(엣지 수)가 높은 노드를 primary로 선택
    edge_count = defaultdict(int)
    for e in edges:
        edge_count[e["source"]] += 1
        edge_count[e["target"]] += 1

    merge_map = {}  # old_mbid → primary_mbid
    nodes_to_remove = set()
    total_merged = 0

    for group in merged_groups:
        group_nodes = [(i, nodes[i]) for i in group]

        # primary: edge 수 가장 많은 것, 동점이면 MusicBrainz UUID 우선 (batch_ 아닌 것)
        def sort_key(item):
            idx, n = item
            mbid = n.get("mbid", "")
            is_real = 0 if mbid.startswith("batch_") else 1
            deg = edge_count.get(mbid, 0)
            return (is_real, deg)

        group_nodes.sort(key=sort_key, reverse=True)
        primary_idx, primary_node = group_nodes[0]
        primary_mbid = primary_node["mbid"]

        # 나머지를 primary로 병합
        for idx, node in group_nodes[1:]:
            old_mbid = node["mbid"]
            merge_map[old_mbid] = primary_mbid
            nodes_to_remove.add(idx)
            total_merged += 1

            # primary에 없는 데이터 보충
            if not primary_node.get("image") and node.get("image"):
                primary_node["image"] = node["image"]
            if not primary_node.get("previewUrl") and node.get("previewUrl"):
                primary_node["previewUrl"] = node["previewUrl"]
                primary_node["previewTrackName"] = node.get("previewTrackName")
            if not primary_node.get("nameKo") and node.get("nameKo"):
                primary_node["nameKo"] = node["nameKo"]
            if not primary_node.get("spotifyId") and node.get("spotifyId"):
                primary_node["spotifyId"] = node["spotifyId"]
            # genres 합치기
            existing_genres = set(primary_node.get("genres") or [])
            for g in (node.get("genres") or []):
                existing_genres.add(g)
            primary_node["genres"] = list(existing_genres)

        names = [nodes[i]["name"] for i in group]
        if total_merged <= 30:  # 로그 제한
            print(f"    🔗 병합: {names} → '{primary_node['name']}' (primary)")

    if total_merged > 30:
        print(f"    ... 외 {total_merged - 30}건")

    # ── Step 3: 엣지 리매핑 ──
    remapped_edges = 0
    for edge in edges:
        if edge["source"] in merge_map:
            edge["source"] = merge_map[edge["source"]]
            remapped_edges += 1
        if edge["target"] in merge_map:
            edge["target"] = merge_map[edge["target"]]
            remapped_edges += 1

    # 셀프-루프 제거
    self_loops = [i for i, e in enumerate(edges) if e["source"] == e["target"]]
    for i in sorted(self_loops, reverse=True):
        edges.pop(i)

    # 중복 엣지 제거 (같은 source-target 쌍)
    seen_edge_keys = set()
    deduped_edges = []
    for e in edges:
        key = tuple(sorted([e["source"], e["target"]]))
        if key not in seen_edge_keys:
            seen_edge_keys.add(key)
            deduped_edges.append(e)
    dup_edges_removed = len(edges) - len(deduped_edges)
    graph["edges"] = deduped_edges

    # 노드 제거
    graph["nodes"] = [n for i, n in enumerate(nodes) if i not in nodes_to_remove]

    print(f"  ✅ {total_merged}개 중복 노드 병합 → {len(nodes_to_remove)}개 노드 삭제")
    print(f"  ✅ {remapped_edges}개 엣지 리매핑, {len(self_loops)}개 셀프루프 제거, {dup_edges_removed}개 중복 엣지 제거")
    return total_merged


# ═══════════════════════════════════════════════════════════
# PATCH 3: 콜라보 노드 분해 (세미콜론)
# ═══════════════════════════════════════════════════════════
def patch_collab_nodes(graph):
    print("\n" + "="*60)
    print("PATCH 3: 콜라보 노드(;) 분해")
    print("="*60)

    nodes = graph["nodes"]
    edges = graph["edges"]

    # 빠른 조회용 이름→mbid 맵
    name_to_mbid = {}
    for n in nodes:
        name_to_mbid[n.get("name", "").lower().strip()] = n["mbid"]
        if n.get("nameKo"):
            name_to_mbid[n["nameKo"].lower().strip()] = n["mbid"]

    collab_indices = []
    for i, n in enumerate(nodes):
        name = n.get("name", "")
        name_ko = n.get("nameKo", "")
        if ";" in name or ";" in name_ko:
            collab_indices.append(i)

    print(f"  발견된 콜라보 노드: {len(collab_indices)}개")

    nodes_to_remove = set()
    new_edges = []
    decomposed = 0

    for idx in collab_indices:
        node = nodes[idx]
        collab_mbid = node["mbid"]
        name = node.get("nameKo") or node.get("name", "")
        parts = [p.strip() for p in name.split(";") if p.strip()]

        if len(parts) < 2:
            continue

        # 각 파트를 기존 노드에 매칭
        part_mbids = []
        for part in parts:
            matched_mbid = name_to_mbid.get(part.lower().strip())
            if matched_mbid:
                part_mbids.append((part, matched_mbid, True))
            else:
                # 기존 노드 없음 → 콜라보 노드를 첫 번째 아티스트로 재활용하지 않고
                # 연결만 안 되는 것으로 로깅
                part_mbids.append((part, None, False))

        # 콜라보 노드의 기존 엣지를 각 파트에 이관
        collab_edges = [e for e in edges if e["source"] == collab_mbid or e["target"] == collab_mbid]

        for part_name, part_id, exists in part_mbids:
            if not exists or not part_id:
                continue
            for ce in collab_edges:
                other = ce["target"] if ce["source"] == collab_mbid else ce["source"]
                if other == part_id:
                    continue  # 셀프루프 방지
                new_edges.append({
                    "source": part_id,
                    "target": other,
                    "weight": ce.get("weight", 0.3),
                    "relation": ce.get("relation", "INDIRECT"),
                    "label": ce.get("label", "콜라보 분해"),
                })

        # 파트들 사이에 FEATURED 엣지 추가
        existing_part_ids = [pid for _, pid, ex in part_mbids if ex and pid]
        for i in range(len(existing_part_ids)):
            for j in range(i+1, len(existing_part_ids)):
                new_edges.append({
                    "source": existing_part_ids[i],
                    "target": existing_part_ids[j],
                    "weight": 0.6,
                    "relation": "FEATURED",
                    "label": "피처링 (콜라보 분해)",
                })

        nodes_to_remove.add(idx)
        decomposed += 1
        if decomposed <= 20:
            matched_names = [p for p, _, ex in part_mbids if ex]
            unmatched_names = [p for p, _, ex in part_mbids if not ex]
            status = f"매칭={matched_names}"
            if unmatched_names:
                status += f" 미매칭={unmatched_names}"
            print(f"    💥 분해: '{name}' → {status}")

    if decomposed > 20:
        print(f"    ... 외 {decomposed - 20}건")

    # 새 엣지 추가 (중복 제거)
    existing_keys = set()
    for e in edges:
        existing_keys.add(tuple(sorted([e["source"], e["target"]])))

    added_edges = 0
    for ne in new_edges:
        key = tuple(sorted([ne["source"], ne["target"]]))
        if key not in existing_keys:
            edges.append(ne)
            existing_keys.add(key)
            added_edges += 1

    # 콜라보 노드 제거
    graph["nodes"] = [n for i, n in enumerate(nodes) if i not in nodes_to_remove]

    # 콜라보 노드 가리키는 엣지도 제거
    removed_mbids = {nodes[i]["mbid"] for i in nodes_to_remove}
    graph["edges"] = [e for e in graph["edges"]
                      if e["source"] not in removed_mbids and e["target"] not in removed_mbids]

    print(f"  ✅ {decomposed}개 콜라보 노드 분해 → {len(nodes_to_remove)}개 노드 삭제")
    print(f"  ✅ {added_edges}개 신규 엣지 추가 (FEATURED + 이관)")
    return decomposed


# ═══════════════════════════════════════════════════════════
# PATCH 4: previewUrl 동명이곡 오염 정리
# ═══════════════════════════════════════════════════════════
def patch_preview_contamination(graph):
    print("\n" + "="*60)
    print("PATCH 4: previewUrl 동명이곡 오염 정리")
    print("="*60)

    cleaned = 0
    for node in graph["nodes"]:
        name = node.get("name", "")
        name_ko = node.get("nameKo", "")
        track_name = node.get("previewTrackName", "")
        preview_url = node.get("previewUrl")

        if not preview_url or not track_name:
            continue

        # 오염 판별: trackName이 아티스트 name과 동일 → 아티스트명 동명곡
        # (정상: trackName은 곡 이름이므로 아티스트명과 다름)
        is_contaminated = False

        # 정확히 같은 경우 (대소문자 무시)
        if track_name.lower().strip() == name.lower().strip():
            is_contaminated = True

        # nameKo와 같은 경우
        if name_ko and track_name.lower().strip() == name_ko.lower().strip():
            is_contaminated = True

        if is_contaminated:
            if cleaned < 20:
                print(f"    🧹 오염 제거: '{name}' (trackName='{track_name}')")
            node["previewUrl"] = None
            node["previewTrackName"] = None
            cleaned += 1

    if cleaned > 20:
        print(f"    ... 외 {cleaned - 20}건")

    print(f"  ✅ {cleaned}개 노드의 오염된 previewUrl 제거")
    return cleaned


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════
def main():
    print("🩹 V7.7.1 Data Quality Patch")
    print(f"  대상: {GRAPH_FILE}")
    print(f"  시각: {datetime.now().isoformat()}")

    graph = load_graph()
    print(f"\n📊 패치 전: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

    # 백업
    backup_graph(graph)

    # 패치 실행
    p1 = patch_genre_overlap_weights(graph)
    p2 = patch_duplicate_nodes(graph)
    p3 = patch_collab_nodes(graph)
    p4 = patch_preview_contamination(graph)

    # 저장
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"  PATCH 1: GENRE_OVERLAP weight → 0.1  ({p1}개 변경)")
    print(f"  PATCH 2: 중복 노드 병합              ({p2}개 병합)")
    print(f"  PATCH 3: 콜라보 노드 분해            ({p3}개 분해)")
    print(f"  PATCH 4: previewUrl 오염 정리        ({p4}개 정리)")
    print(f"\n📊 패치 후: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

    save_graph(graph)

    print(f"\n⚡ 다음 단계: 빌드 재실행")
    print(f"  npx tsx scripts/v5.4-build-universe.ts")


if __name__ == "__main__":
    main()
