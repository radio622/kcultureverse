#!/usr/bin/env python3
"""
v7.4-insert-releases.py
Phase 3 Step 3-2: MusicBrainz 릴리즈 데이터 → Supabase album_releases 일괄 INSERT

수집된 public/data/new-artists-data.json의 릴리즈 데이터를 Supabase에 삽입합니다.
- Spotify 날짜 사용 안 함 (DATA_QUALITY_GUIDE.md 규칙 3)
- MusicBrainz first-release-date 사용
- MBID가 있는 기존 우주 아티스트도 포함 (v5-layout.json)

실행 전 필요:
  export SUPABASE_URL="https://xxx.supabase.co"
  export SUPABASE_SERVICE_KEY="eyJ..."

  또는 .env.local 파일의 값을 사용:
  python3 scripts/v7.4-insert-releases.py
"""

import json
import os
import re
import urllib.request
import urllib.error
from typing import Optional, List, Dict
from datetime import datetime

# .env.local 수동 파싱 (dotenv 의존성 없음)
def load_env_local(path=".env.local"):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

_env = load_env_local()

SUPABASE_URL = _env.get("NEXT_PUBLIC_SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = _env.get("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 환경 변수 없음! NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요")
    exit(1)

NEW_ARTISTS_PATH = "public/data/new-artists-data.json"
LAYOUT_PATH      = "public/data/v5-layout.json"
BATCH_SIZE = 200  # Supabase 한 번에 삽입할 최대 행 수


def is_valid_date(d):
    """YYYY-MM-DD 또는 YYYY-MM 또는 YYYY 형식 확인."""
    if not d:
        return False
    return bool(re.match(r'^\d{4}(-\d{2}(-\d{2})?)?$', d))


def normalize_date(d):
    """
    MusicBrainz 날짜를 DATE 타입으로 변환.
    '1985' → '1985-01-01', '1985-03' → '1985-03-01', '1985-03-22' → '1985-03-22'
    """
    if not d or not is_valid_date(d):
        return None
    parts = d.split("-")
    if len(parts) == 1:
        return f"{parts[0]}-01-01"
    elif len(parts) == 2:
        return f"{parts[0]}-{parts[1]}-01"
    return d


def supabase_upsert(table, rows):
    """Supabase REST API를 통한 upsert."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    payload = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return {"status": resp.status, "ok": True}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {"status": e.code, "ok": False, "error": body[:200]}


def main():
    print("🎵 album_releases 일괄 INSERT 시작\n")

    # 1. 신규 아티스트 데이터 로드
    rows_to_insert = []
    skipped = 0

    if os.path.exists(NEW_ARTISTS_PATH):
        with open(NEW_ARTISTS_PATH) as f:
            new_artists = json.load(f)

        print(f"📂 신규 아티스트 데이터: {len(new_artists)}명")

        for artist_id, artist_data in new_artists.items():
            artist_name    = artist_data.get("name", "")
            artist_name_ko = artist_data.get("nameKo", "") or ""
            # mb_releases 우선, 없으면 releases fallback
            releases = artist_data.get("mb_releases", []) or artist_data.get("releases", [])

            # 세미콜론 포함 → 콜라보 노드, 스킵
            if ";" in artist_name:
                skipped += 1
                continue

            for rel in releases:
                date_str = rel.get("date") or rel.get("first_release_date", "")
                norm_date = normalize_date(date_str)
                if not norm_date:
                    continue  # 날짜 없는 릴리즈는 스킵

                rows_to_insert.append({
                    "artist_id":       artist_id,
                    "artist_name":     artist_name,
                    "artist_name_ko":  artist_name_ko or None,
                    "album_title":     rel.get("title", "Unknown"),
                    "album_type":      rel.get("type", "Album"),
                    "release_date":    norm_date,
                    "mbid":            rel.get("id") or rel.get("mbid") or None,
                    "source":          "musicbrainz",
                    "verified":        False,
                })

    print(f"   콜라보 노드 스킵: {skipped}명")
    print(f"   총 릴리즈 행: {len(rows_to_insert)}건\n")

    # 2. 배치 INSERT
    total_inserted = 0
    print(f"📤 Supabase INSERT 시작 (배치 {BATCH_SIZE}건씩)...")

    for i in range(0, len(rows_to_insert), BATCH_SIZE):
        batch = rows_to_insert[i:i + BATCH_SIZE]
        result = supabase_upsert("album_releases", batch)
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(rows_to_insert) + BATCH_SIZE - 1) // BATCH_SIZE

        if result["ok"]:
            total_inserted += len(batch)
            print(f"  ✅ 배치 {batch_num}/{total_batches}: {len(batch)}건 삽입")
        else:
            print(f"  ❌ 배치 {batch_num} 실패 (HTTP {result['status']}): {result.get('error','')}")

    # 3. 결과
    print(f"\n{'='*50}")
    print(f"✅ 완료!")
    print(f"   총 삽입: {total_inserted}건")
    print(f"   스킵 (콜라보): {skipped}명")
    print(f"\n다음 단계: Admin 캘린더에서 데이터 확인 후 CRON 검증 활성화")


if __name__ == "__main__":
    main()
