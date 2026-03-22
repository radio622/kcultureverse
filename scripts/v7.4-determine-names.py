#!/usr/bin/env python3
"""
v7.4-determine-names.py
Phase 1 Step 1-2: MB aliases 기반 메인 표시명 자동 판정

수집된 artist-aliases.json + v5-layout.json을 읽어서
name / nameKo 를 자동으로 결정합니다.

판정 로직 (LLM 0토큰, $0):
  1. MB primaryName이 영문 + ko locale 별칭 존재
     → 영문이 국제 공식명 (BTS, ITZY, aespa...)
     → nameKo = "" (nameKo 비움 → 영문이 화면 메인)
     → ko alias → ALIAS_MAP에 추가 예정

  2. MB primaryName이 한글
     → 한글이 공식명 (아이유, 잔나비, 검정치마...)
     → nameKo = primaryName

  3. MB 정보 없음 or primaryName 없음
     → 현재 nameKo에 한글이 있으면 유지
     → 없으면 name에 한글이 있으면 그것을 nameKo로
     → 그도 아니면 변경 없음

참고: DATA_QUALITY_GUIDE.md 규칙 2
"""

import json
import re
import os

LAYOUT_PATH = "public/data/v5-layout.json"
ALIASES_PATH = "public/data/artist-aliases.json"
OUTPUT_PATH = "public/data/v5-layout.json"         # 직접 업데이트
REPORT_PATH = "public/data/name-determination-report.json"


def has_korean(s: str) -> bool:
    """문자열에 한글이 포함되어 있는지 확인."""
    return bool(re.search(r'[가-힣]', s or ""))


def is_uuid(s: str) -> bool:
    return bool(re.match(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        s or "", re.IGNORECASE
    ))


def determine_names(node: dict, mb_data: dict) -> dict:
    """
    단일 노드의 name/nameKo를 판정합니다.
    { "name": ..., "nameKo": ..., "ko_alias": ..., "rule": ... } 반환
    """
    current_name = node.get("name", "")
    current_nameKo = node.get("nameKo", "")
    mbid = node.get("id", "")

    # MB 데이터가 없는 경우 (batch_ 노드 등)
    if not mbid or mbid not in mb_data:
        # Fallback: 글자 판정
        if has_korean(current_nameKo) and current_nameKo != current_name:
            return {"name": current_name, "nameKo": current_nameKo,
                    "ko_alias": None, "rule": "fallback_existing_ko"}
        elif has_korean(current_name):
            return {"name": current_name, "nameKo": current_name,
                    "ko_alias": None, "rule": "fallback_name_is_korean"}
        else:
            return {"name": current_name, "nameKo": current_nameKo,
                    "ko_alias": None, "rule": "no_change_no_korean"}

    mb = mb_data[mbid]
    primary = mb.get("primaryName", "")
    aliases = mb.get("aliases", [])

    # ko locale 별칭 찾기
    ko_aliases = [a["name"] for a in aliases if a.get("locale") == "ko"]
    ko_alias = ko_aliases[0] if ko_aliases else None

    # Rule 1: primary가 영문 + ko 별칭 존재 → 영문 메인
    if primary and not has_korean(primary) and ko_alias:
        return {
            "name": primary,
            "nameKo": "",       # 비움 → 영문이 화면 표시
            "ko_alias": ko_alias,  # ALIAS_MAP에 등록 예정
            "rule": "mb_en_primary_with_ko_alias",
        }

    # Rule 2: primary가 한글 → 한글 메인
    if primary and has_korean(primary):
        return {
            "name": current_name,   # 영문 name 유지
            "nameKo": primary,       # 한글 primary → nameKo
            "ko_alias": None,
            "rule": "mb_ko_primary",
        }

    # Rule 3: primary가 영문이지만 ko 없음 (영문만 있는 외국 아티스트 등)
    if primary and not has_korean(primary) and not ko_alias:
        # 현재 nameKo에 한글이 있으면 유지
        if has_korean(current_nameKo):
            return {
                "name": primary,
                "nameKo": current_nameKo,
                "ko_alias": None,
                "rule": "mb_en_primary_keep_existing_ko",
            }
        return {
            "name": primary,
            "nameKo": "",
            "ko_alias": None,
            "rule": "mb_en_primary_no_ko",
        }

    # Rule 4: Fallback
    return {
        "name": current_name,
        "nameKo": current_nameKo,
        "ko_alias": None,
        "rule": "fallback_no_mb_primary",
    }


def main():
    # 데이터 로드
    with open(LAYOUT_PATH) as f:
        layout = json.load(f)

    if not os.path.exists(ALIASES_PATH):
        print("❌ artist-aliases.json 없음! 먼저 v7.4-collect-aliases.py 실행 필요")
        return

    with open(ALIASES_PATH) as f:
        aliases_data = json.load(f)

    nodes = layout["nodes"]
    print(f"🎯 판정 대상: {len(nodes)}명")
    print(f"   aliases 보유: {len(aliases_data)}명\n")

    # 통계
    stats = {
        "mb_en_primary_with_ko_alias": 0,
        "mb_ko_primary": 0,
        "mb_en_primary_keep_existing_ko": 0,
        "mb_en_primary_no_ko": 0,
        "fallback_existing_ko": 0,
        "fallback_name_is_korean": 0,
        "no_change_no_korean": 0,
        "fallback_no_mb_primary": 0,
    }

    report = []  # 변경된 항목 기록
    pending_alias_map = {}  # ALIAS_MAP에 추가할 항목들

    for node in nodes:
        result = determine_names(node, aliases_data)
        rule = result["rule"]
        stats[rule] = stats.get(rule, 0) + 1

        old_name = node.get("name", "")
        old_nameKo = node.get("nameKo", "")
        new_name = result["name"]
        new_nameKo = result["nameKo"]
        ko_alias = result.get("ko_alias")

        # 실제 변경 여부 확인
        changed = (old_name != new_name or old_nameKo != new_nameKo)
        if changed:
            report.append({
                "id": node["id"],
                "old_name": old_name,
                "old_nameKo": old_nameKo,
                "new_name": new_name,
                "new_nameKo": new_nameKo,
                "ko_alias": ko_alias,
                "rule": rule,
            })
            node["name"] = new_name
            node["nameKo"] = new_nameKo

        # ALIAS_MAP 후보 수집
        if ko_alias:
            # 영문 메인 → 한글은 ALIAS_MAP
            pending_alias_map[new_name] = pending_alias_map.get(new_name, [])
            if ko_alias not in pending_alias_map[new_name]:
                pending_alias_map[new_name].append(ko_alias)

        # 영문 메인인데 nameKo가 있던 경우도 ALIAS_MAP 후보
        if old_nameKo and old_nameKo != old_name and not has_korean(new_name):
            pending_alias_map[new_name] = pending_alias_map.get(new_name, [])
            if old_nameKo not in pending_alias_map[new_name]:
                pending_alias_map[new_name].append(old_nameKo)

    # 저장
    layout["nodes"] = nodes
    with open(OUTPUT_PATH, "w") as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)

    # 리포트 저장
    report_data = {
        "stats": stats,
        "changed_count": len(report),
        "pending_alias_map": pending_alias_map,
        "changes": report,
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)

    # 결과 출력
    print("=" * 50)
    print(f"✅ 판정 완료!")
    print(f"\n📊 판정 규칙별 통계:")
    print(f"   [Rule 1] 영문 메인 + ko alias: {stats.get('mb_en_primary_with_ko_alias',0)}명")
    print(f"            (BTS, ITZY 등 → 화면엔 영문, 한글은 ALIAS_MAP)")
    print(f"   [Rule 2] 한글 메인:            {stats.get('mb_ko_primary',0)}명")
    print(f"            (아이유, 잔나비 등 → 화면엔 한글)")
    print(f"   [Rule 3] 영문 기존 ko 유지:    {stats.get('mb_en_primary_keep_existing_ko',0)}명")
    print(f"   [Rule 3] 영문 ko 없음:         {stats.get('mb_en_primary_no_ko',0)}명")
    print(f"   [Fallback] 기존 한글 유지:     {stats.get('fallback_existing_ko',0)}명")
    print(f"   [Fallback] name이 한글:        {stats.get('fallback_name_is_korean',0)}명")
    print(f"   [Fallback] 변경 없음:          {stats.get('no_change_no_korean',0) + stats.get('fallback_no_mb_primary',0)}명")
    print(f"\n📝 변경된 노드: {len(report)}명")
    print(f"🔗 ALIAS_MAP 추가 후보: {len(pending_alias_map)}개")
    print(f"\n💾 저장:")
    print(f"   {OUTPUT_PATH} (layout 업데이트)")
    print(f"   {REPORT_PATH} (변경 리포트)")
    print(f"\n다음 단계: python3 scripts/v7.4-merge-alias-map.py 실행")


if __name__ == "__main__":
    main()
