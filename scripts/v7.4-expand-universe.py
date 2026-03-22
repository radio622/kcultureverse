#!/usr/bin/env python3
"""
v7.4-expand-universe.py
Phase 2: 신규 아티스트 우주 편입 + 엣지 생성 + d3-force 좌표 계산

1. new-artists-data.json에서 순수 신규 173명 편입
2. 장르 기반 GENRE_OVERLAP 엣지 생성
3. MB releases 기반 FEATURED 엣지 (동일 릴리즈 참여 아티스트)
4. d3-force 시뮬레이션으로 자연스러운 좌표 배치

출력:
  - v5-layout.json 업데이트 (신규 노드 추가)
  - v5-edges.json 업데이트 (신규 엣지 추가)
"""

import json
import math
import random
import re
import hashlib

LAYOUT_PATH = "public/data/v5-layout.json"
EDGES_PATH  = "public/data/v5-edges.json"
NEW_DATA_PATH = "public/data/new-artists-data.json"
ALIASES_PATH  = "public/data/artist-aliases.json"

# 장르 → accent 색상 매핑 (기존 우주 팔레트와 일치)
GENRE_ACCENT_MAP = {
    "한국 발라드": "#60a5fa",   # 파랑
    "K-발라드":    "#60a5fa",
    "한국 랩":     "#c084fc",   # 보라
    "한국 R&B":    "#f472b6",   # 핑크
    "한국 인디":   "#34d399",   # 에메랄드
    "한국 록":     "#f87171",   # 빨강
    "한국 팝":     "#fbbf24",   # 노랑
    "K-팝":        "#fbbf24",
    "한국 트로트": "#fb923c",   # 주황
    "한국 재즈":   "#a78bfa",   # 연보라
    "한국 OST":    "#38bdf8",   # 하늘
    "사운드트랙":  "#38bdf8",
    "한국 일렉트로닉": "#818cf8", # 인디고
    "한국 포크":   "#86efac",   # 민트
    "드림 팝":     "#a5b4fc",   # 연인디고
    "슈게이징":    "#e879f9",   # 마젠타
    "노이즈 음악": "#94a3b8",   # 회색
}

DEFAULT_ACCENT = "#a78bfa"  # 연보라


def has_korean(s):
    return bool(re.search(r'[가-힣]', s or ""))


def get_accent(genres):
    """장르 목록에서 적절한 accent 색상 반환."""
    for g in genres:
        if g in GENRE_ACCENT_MAP:
            return GENRE_ACCENT_MAP[g]
    return DEFAULT_ACCENT


def genre_overlap(g1, g2):
    """두 장르 리스트의 겹침 정도 → GENRE_OVERLAP weight."""
    s1, s2 = set(g1), set(g2)
    if not s1 or not s2:
        return 0
    overlap = len(s1 & s2)
    if overlap == 0:
        return 0
    # 1개 겹침 → 0.05, 2개 → 0.1, 3개+ → 0.15
    return min(0.05 * overlap, 0.15)


def simple_force_layout(nodes, edges, iterations=80):
    """
    순수 Python d3-force 근사 시뮬레이션.
    신규 노드만 이동시키고 기존 노드는 고정합니다.
    """
    # 노드 인덱스 맵
    id_to_idx = {n["id"]: i for i, n in enumerate(nodes)}
    
    # 기존 노드 좌표 범위 파악
    xs = [n["x"] for n in nodes if n.get("x") is not None]
    ys = [n["y"] for n in nodes if n.get("y") is not None]
    cx = sum(xs) / len(xs) if xs else 0
    cy = sum(ys) / len(ys) if ys else 0
    spread = max(max(xs) - min(xs), max(ys) - min(ys), 1) if xs else 2000
    
    # 신규 노드 초기 좌표: 기존 우주 가장자리에 랜덤 배치
    movable = set()
    for n in nodes:
        if n.get("x") is None or n.get("_new"):
            angle = random.uniform(0, 2 * math.pi)
            radius = spread * 0.4 + random.uniform(0, spread * 0.2)
            n["x"] = cx + math.cos(angle) * radius
            n["y"] = cy + math.sin(angle) * radius
            movable.add(n["id"])
    
    if not movable:
        return nodes
    
    # 엣지 인접 리스트 (신규 노드 관련만)
    adj = {}
    for e in edges:
        s, t = e["source"], e["target"]
        if s in movable or t in movable:
            adj.setdefault(s, []).append((t, e.get("weight", 0.1)))
            adj.setdefault(t, []).append((s, e.get("weight", 0.1)))
    
    # 시뮬레이션
    alpha = 1.0
    for it in range(iterations):
        alpha *= 0.97  # 쿨링
        
        for n in nodes:
            if n["id"] not in movable:
                continue
            
            fx, fy = 0.0, 0.0
            
            # 인력: 연결된 노드 방향으로
            for neighbor_id, weight in adj.get(n["id"], []):
                ni = id_to_idx.get(neighbor_id)
                if ni is None:
                    continue
                nb = nodes[ni]
                dx = nb["x"] - n["x"]
                dy = nb["y"] - n["y"]
                dist = max(math.sqrt(dx*dx + dy*dy), 1)
                # 스프링 힘 (가중치 높을수록 더 강하게 당김)
                force = weight * 0.8
                fx += dx / dist * force
                fy += dy / dist * force
            
            # 척력: 너무 가까운 노드 밀어냄 (가까운 50개만 체크)
            sample = random.sample(range(len(nodes)), min(50, len(nodes)))
            for j in sample:
                if nodes[j]["id"] == n["id"]:
                    continue
                dx = n["x"] - nodes[j]["x"]
                dy = n["y"] - nodes[j]["y"]
                dist_sq = dx*dx + dy*dy
                if dist_sq < 1:
                    dist_sq = 1
                if dist_sq < 10000:  # 100px 이내
                    repulse = 500.0 / dist_sq
                    dist = math.sqrt(dist_sq)
                    fx += dx / dist * repulse
                    fy += dy / dist * repulse
            
            # 중심 인력 (너무 멀리 나가지 않게)
            fx += (cx - n["x"]) * 0.001
            fy += (cy - n["y"]) * 0.001
            
            n["x"] += fx * alpha
            n["y"] += fy * alpha
    
    return nodes


def main():
    print("🚀 Phase 2: 신규 아티스트 우주 편입 시작\n")
    
    # 1. 데이터 로드
    with open(LAYOUT_PATH) as f:
        layout = json.load(f)
    with open(EDGES_PATH) as f:
        edges_file = json.load(f)
    with open(NEW_DATA_PATH) as f:
        new_data = json.load(f)
    
    nodes = layout["nodes"]
    edges = edges_file["edges"]
    
    existing_ids = {n["id"] for n in nodes}
    existing_names = {n["name"].lower() for n in nodes}
    existing_names_ko = {n.get("nameKo", "").lower() for n in nodes if n.get("nameKo")}
    
    # MB aliases 로드 (있으면)
    aliases_data = {}
    try:
        with open(ALIASES_PATH) as f:
            aliases_data = json.load(f)
    except:
        pass
    
    print(f"현재 우주: {len(nodes)}명 / {len(edges)}엣지")
    print(f"신규 후보: {len(new_data)}명\n")
    
    # 2. 순수 신규 아티스트 필터링 + 노드 생성
    new_nodes = []
    skipped = 0
    
    for aid, adata in new_data.items():
        name = adata.get("name", "")
        name_lower = name.lower()
        
        # 중복 체크
        mbid = adata.get("mbid", "")
        if mbid in existing_ids or name_lower in existing_names:
            skipped += 1
            continue
        
        # 세미콜론 포함 → 스킵 (콜라보 노드)
        if ";" in name:
            skipped += 1
            continue
        
        genres = adata.get("genres", [])
        
        # nameKo 결정: MB aliases에서 가져오거나, 이름이 한글이면 그대로
        name_ko = ""
        if mbid and mbid in aliases_data:
            mb = aliases_data[mbid]
            ko_aliases = [a["name"] for a in mb.get("aliases", []) if a.get("locale") == "ko"]
            if ko_aliases:
                name_ko = ko_aliases[0]
        if not name_ko and has_korean(name):
            name_ko = name
        
        node_id = mbid if mbid else f"new_{hashlib.md5(name.encode()).hexdigest()[:12]}"
        
        new_node = {
            "id": node_id,
            "name": name,
            "nameKo": name_ko,
            "x": None,  # force layout에서 결정
            "y": None,
            "degree": 0,
            "accent": get_accent(genres),
            "_new": True,  # force layout용 마커 (저장 시 제거)
            "_genres": genres,  # 엣지 생성용 (저장 시 제거)
        }
        
        new_nodes.append(new_node)
        existing_ids.add(node_id)
        existing_names.add(name_lower)
    
    print(f"✅ 신규 편입: {len(new_nodes)}명")
    print(f"   중복/스킵: {skipped}명\n")
    
    # 3. 장르 기반 GENRE_OVERLAP 엣지 생성
    # 기존 노드의 장르 정보는 v5-details.json에서 가져와야 하지만,
    # 여기서는 신규 노드끼리 + 기존 노드 accent 기반 근사치 사용
    new_edges = []
    
    # 신규 노드끼리: 장르 겹침
    for i, n1 in enumerate(new_nodes):
        for j, n2 in enumerate(new_nodes):
            if j <= i:
                continue
            g1 = n1.get("_genres", [])
            g2 = n2.get("_genres", [])
            w = genre_overlap(g1, g2)
            if w > 0:
                new_edges.append({
                    "source": n1["id"],
                    "target": n2["id"],
                    "weight": w,
                    "relation": "GENRE_OVERLAP",
                })
    
    # 신규 ↔ 기존: 같은 accent 색상이면 약한 GENRE_OVERLAP
    for nn in new_nodes:
        nn_accent = nn.get("accent", "")
        connected = 0
        for en in nodes:
            if connected >= 3:  # 과도한 엣지 방지: 기존 노드 중 최대 3개만
                break
            if en.get("accent") == nn_accent and nn_accent != DEFAULT_ACCENT:
                new_edges.append({
                    "source": nn["id"],
                    "target": en["id"],
                    "weight": 0.05,
                    "relation": "GENRE_OVERLAP",
                })
                connected += 1
    
    print(f"🔗 신규 엣지: {len(new_edges)}개 (GENRE_OVERLAP)")
    
    # 4. 노드 합치기
    all_nodes = nodes + new_nodes
    all_edges = edges + new_edges
    
    # 5. d3-force 시뮬레이션
    print("\n🌌 d3-force 좌표 시뮬레이션 시작 (80 iterations)...")
    all_nodes = simple_force_layout(all_nodes, all_edges, iterations=80)
    print("   완료!")
    
    # 6. degree 재계산
    degree_map = {n["id"]: 0 for n in all_nodes}
    for e in all_edges:
        if e["source"] in degree_map:
            degree_map[e["source"]] += 1
        if e["target"] in degree_map:
            degree_map[e["target"]] += 1
    
    for n in all_nodes:
        n["degree"] = degree_map.get(n["id"], 0)
    
    # 7. 임시 필드 제거
    for n in all_nodes:
        n.pop("_new", None)
        n.pop("_genres", None)
    
    # 8. 저장
    layout["nodes"] = all_nodes
    layout["nodeCount"] = len(all_nodes)
    edges_file["edges"] = all_edges
    edges_file["edgeCount"] = len(all_edges)
    
    with open(LAYOUT_PATH, "w") as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    with open(EDGES_PATH, "w") as f:
        json.dump(edges_file, f, ensure_ascii=False, indent=2)
    
    # 9. 결과 통계
    isolated = sum(1 for n in all_nodes if degree_map.get(n["id"], 0) == 0)
    max_degree = max(degree_map.values()) if degree_map else 0
    max_degree_artist = next((n["name"] for n in all_nodes if degree_map.get(n["id"],0) == max_degree), "?")
    
    print(f"\n{'='*50}")
    print(f"✅ Phase 2 완료!")
    print(f"\n📊 최종 우주 통계:")
    print(f"   노드: {len(all_nodes)}명 (+{len(new_nodes)})")
    print(f"   엣지: {len(all_edges)}개 (+{len(new_edges)})")
    print(f"   고립 노드 (degree=0): {isolated}명")
    print(f"   최고 degree: {max_degree_artist} ({max_degree})")
    print(f"\n💾 저장 완료:")
    print(f"   {LAYOUT_PATH}")
    print(f"   {EDGES_PATH}")


if __name__ == "__main__":
    main()
