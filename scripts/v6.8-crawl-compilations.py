"""
V6.8 컴필레이션 앨범 기반 COMPILATION 엣지 생성 스크립트
MusicBrainz API로 각 아티스트의 컴필레이션 참여 이력을 수집하고,
같은 컴필레이션에 참여한 아티스트끼리 엣지를 생성합니다.
"""
import json
import time
import urllib.request
import urllib.parse
import os

GRAPH_FILE = os.path.join("scripts", ".cache", "v5.4", "organic-graph.json")
CACHE_FILE = os.path.join("scripts", ".cache", "v5.4", "compilation-cache.json")
MB_BASE = "https://musicbrainz.org/ws/2"
USER_AGENT = "KCultureUniverse/6.8 (contact: radio622@gmail.com)"

def mb_get(url):
    """MusicBrainz API GET with rate limiting"""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    ⚠ API 에러: {e}")
        return None

def get_compilations(mbid):
    """아티스트의 컴필레이션 앨범 목록 조회"""
    url = f"{MB_BASE}/release?artist={mbid}&type=compilation&fmt=json&limit=100"
    data = mb_get(url)
    if not data or "releases" not in data:
        return []
    
    compilations = []
    for rel in data["releases"]:
        rg = rel.get("release-group", {})
        rg_id = rg.get("id")
        title = rel.get("title", "")
        if rg_id and title:
            compilations.append({"rg_id": rg_id, "title": title})
    return compilations

def main():
    print("📀 V6.8 컴필레이션 크롤링 시작...\n")
    
    with open(GRAPH_FILE, "r", encoding="utf-8") as f:
        graph = json.load(f)
    
    # 우주에 포함된 아티스트만 (degree >= 3 이상이 빌드에 포함됨)
    nodes_map = {n["mbid"]: n.get("nameKo") or n["name"] for n in graph["nodes"]}
    mbids = list(nodes_map.keys())
    
    print(f"📌 대상 아티스트: {len(mbids)}명")
    
    # 캐시 로드 (이전 크롤링 결과가 있으면 재사용)
    cache = {}
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cache = json.load(f)
        print(f"📦 캐시에서 {len(cache)}명 로드\n")
    
    # 크롤링
    rg_to_artists = {}  # release_group_id -> [(mbid, name), ...]
    rg_to_title = {}    # release_group_id -> title
    
    crawled = 0
    for i, mbid in enumerate(mbids):
        name = nodes_map[mbid]
        
        if mbid in cache:
            compilations = cache[mbid]
        else:
            compilations = get_compilations(mbid)
            cache[mbid] = compilations
            crawled += 1
            time.sleep(1.1)  # Rate limit: 1 req/sec
        
        for comp in compilations:
            rg_id = comp["rg_id"]
            if rg_id not in rg_to_artists:
                rg_to_artists[rg_id] = []
                rg_to_title[rg_id] = comp["title"]
            rg_to_artists[rg_id].append((mbid, name))
        
        if (i + 1) % 50 == 0 or i == len(mbids) - 1:
            print(f"  [{i+1}/{len(mbids)}] 크롤링 완료 (신규 API 호출: {crawled}건)")
            # 중간 캐시 저장
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False)
    
    # 캐시 최종 저장
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    
    # 같은 컴필레이션에 2명+ 참여한 경우 엣지 생성
    existing_keys = set()
    for e in graph["edges"]:
        key = "::".join(sorted([e["source"], e["target"]]))
        existing_keys.add(key)
    
    new_edges = 0
    comp_details = []
    
    for rg_id, artists in rg_to_artists.items():
        # 우주에 있는 아티스트만 필터 + 중복 제거
        universe_artists = list({mbid: name for mbid, name in artists if mbid in nodes_map}.items())
        
        if len(universe_artists) < 2:
            continue
        
        title = rg_to_title[rg_id]
        
        # 모든 페어에 대해 엣지 생성
        for i in range(len(universe_artists)):
            for j in range(i + 1, len(universe_artists)):
                mbid_a, name_a = universe_artists[i]
                mbid_b, name_b = universe_artists[j]
                key = "::".join(sorted([mbid_a, mbid_b]))
                
                if key not in existing_keys:
                    graph["edges"].append({
                        "source": mbid_a,
                        "target": mbid_b,
                        "relation": "COMPILATION",
                        "weight": 0.5,
                        "label": f"컴필레이션: {title}"
                    })
                    existing_keys.add(key)
                    new_edges += 1
                    comp_details.append(f"  {name_a} ↔ {name_b} ({title})")
    
    # 저장
    with open(GRAPH_FILE, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    
    print(f"\n🎉 컴필레이션 크롤링 완료!")
    print(f"   - 발견된 컴필레이션 앨범: {len([rg for rg, a in rg_to_artists.items() if len(set(m for m,_ in a if m in nodes_map)) >= 2])}개")
    print(f"   - 새로 생성된 COMPILATION 엣지: {new_edges}개")
    print(f"   - API 신규 호출: {crawled}건")
    
    if comp_details:
        print(f"\n📀 생성된 엣지 샘플 (최대 20개):")
        for d in comp_details[:20]:
            print(d)
        if len(comp_details) > 20:
            print(f"  ... 외 {len(comp_details) - 20}개")

if __name__ == "__main__":
    main()
