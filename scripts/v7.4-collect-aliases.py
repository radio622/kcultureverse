#!/usr/bin/env python3
"""
v7.4-collect-aliases.py
Phase 1 Step 1-1: MusicBrainz Aliases 수집

MBID를 보유한 아티스트(856명)의 locale별 별칭 데이터를 수집합니다.
결과: public/data/artist-aliases.json

출력 형식:
{
  "mbid_xxx": {
    "primaryName": "BTS",
    "aliases": [
      { "name": "방탄소년단", "locale": "ko", "primary": false },
      { "name": "防弾少年団", "locale": "ja", "primary": false }
    ]
  }
}

Rate limit: 1.1초/요청 (MusicBrainz 정책)
예상 소요: 856명 × 1.1초 ≈ 16분

⚠️ DATA_QUALITY_GUIDE.md 규칙 참고:
  - primary가 영문 + ko locale 별칭 있음 → 영문 메인 (BTS)
  - primary가 한글 → 한글 메인 (아이유)
  - 정보 없음 → 이름의 한글 포함 여부로 판정
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error
import os
import re

MB_UA = "KCultureUniverse/7.4-CollectAliases (contact@kcultureverse.com)"
MB_API = "https://musicbrainz.org/ws/2"
LAYOUT_PATH = "public/data/v5-layout.json"
OUTPUT_PATH = "public/data/artist-aliases.json"
RATE_LIMIT = 1.1  # 초


def fetch_aliases(mbid: str) -> dict:
    """MB에서 단일 아티스트의 aliases 조회."""
    url = f"{MB_API}/artist/{mbid}?inc=aliases&fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": MB_UA})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            aliases_raw = data.get("aliases", [])

            # primary 이름 추출 (name 필드 자체가 공식 primary)
            primary_name = data.get("name", "")

            # 정리된 aliases
            aliases = []
            for a in aliases_raw:
                aliases.append({
                    "name": a.get("name", ""),
                    "locale": a.get("locale"),      # "ko", "ja", None 등
                    "primary": a.get("primary") == "primary",
                    "type": a.get("type", ""),
                })

            return {
                "primaryName": primary_name,
                "aliases": aliases,
            }
    except urllib.error.HTTPError as e:
        if e.code == 503:
            print(f"  ⚠️ Rate limited (503), 5초 대기 후 재시도...")
            time.sleep(5)
            return fetch_aliases(mbid)  # 1회 재시도
        print(f"  ❌ HTTP {e.code}: {mbid}")
        return {"primaryName": "", "aliases": []}
    except Exception as e:
        print(f"  ❌ 오류: {mbid} — {e}")
        return {"primaryName": "", "aliases": []}


def is_uuid(s: str) -> bool:
    """UUID 형식(MBID) 여부 확인."""
    return bool(re.match(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        s or "", re.IGNORECASE
    ))


def main():
    # 1. 기존 결과 로드 (중단 후 재개 지원)
    existing = {}
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH) as f:
            existing = json.load(f)
        print(f"✅ 기존 결과 로드: {len(existing)}건 (재개 모드)")

    # 2. 레이아웃에서 MBID 보유 노드 추출
    with open(LAYOUT_PATH) as f:
        layout = json.load(f)

    nodes = layout["nodes"]
    mbid_nodes = [(n["id"], n.get("name", ""), n.get("nameKo", ""))
                  for n in nodes if is_uuid(n.get("id", ""))]

    print(f"\n🎯 수집 대상: {len(mbid_nodes)}명 (MBID 보유)")
    print(f"   기수집: {len(existing)}건 → 신규 수집: {len(mbid_nodes) - len(existing)}건")
    print(f"   예상 소요: ~{((len(mbid_nodes) - len(existing)) * RATE_LIMIT / 60):.1f}분\n")

    collected = 0
    skipped = 0

    for i, (mbid, name, nameKo) in enumerate(mbid_nodes, 1):
        # 이미 수집된 경우 스킵
        if mbid in existing:
            skipped += 1
            continue

        print(f"[{i}/{len(mbid_nodes)}] {nameKo or name}...", end=" ", flush=True)
        time.sleep(RATE_LIMIT)

        result = fetch_aliases(mbid)
        existing[mbid] = result
        collected += 1

        # ko locale 별칭 요약 출력
        ko_aliases = [a["name"] for a in result["aliases"] if a["locale"] == "ko"]
        if ko_aliases:
            print(f"✅ primary={result['primaryName']} | ko={ko_aliases}")
        else:
            print(f"· primary={result['primaryName']} (ko 없음)")

        # 50건마다 중간 저장
        if collected % 50 == 0:
            with open(OUTPUT_PATH, "w") as f:
                json.dump(existing, f, ensure_ascii=False, indent=2)
            print(f"\n  💾 중간 저장 ({len(existing)}건)\n")

    # 최종 저장
    with open(OUTPUT_PATH, "w") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    # 통계
    ko_count = sum(
        1 for v in existing.values()
        if any(a["locale"] == "ko" for a in v["aliases"])
    )
    print(f"\n{'='*50}")
    print(f"✅ 완료!")
    print(f"   총 수집: {len(existing)}명")
    print(f"   신규 수집: {collected}명 | 스킵(기존): {skipped}명")
    print(f"   ko locale 별칭 보유: {ko_count}명 ({ko_count/len(existing)*100:.1f}%)")
    print(f"   저장: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
