#!/usr/bin/env python3
"""
==========================================================================
🤖 K-Culture Universe — Dual Harvester Bot (V7.5 설계도)
==========================================================================
봇 1: 스포티파이 채굴 봇 (The Harvester)  — 한글 앨범 데이터 수집
봇 2: 제미나이 3.1 검증 봇 (The Curator)  — 발매일 교정 + 크레딧 추출 + 국적 판정

[실행 방법] 맥북 잠자기 방지(caffeinate) 포함:
  caffeinate -i python3 scripts/v7.5-dual-harvester-draft.py &

  - caffeinate -i : 맥북이 잠들지 않도록 강제 각성 (노트북 덮어도 유지)
  - & : 백그라운드 실행 (터미널을 닫아도 프로세스 유지)
  - 중단하려면: kill $(jobs -p) 또는 Activity Monitor에서 python3 종료

[주의사항]
  - 이 스크립트는 기획 단계의 설계도(Draft)입니다.
  - 정식 가동 전 반드시 DB 연동 코드(TODO 표시)를 완성해야 합니다.
  - 맥북 충전기를 반드시 연결한 상태에서 실행하세요.
==========================================================================
"""

import json, ssl, time, sys, os
import urllib.request, urllib.parse, urllib.error

# ── 환경변수 로드 ─────────────────────────────────────────────
def load_env():
    """프로젝트 루트의 .env.local 파일에서 API 키를 읽어옵니다."""
    env = {}
    # 스크립트 위치 기준으로 프로젝트 루트 찾기
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, '..', '.env.local')
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        print("❌ .env.local 파일을 찾을 수 없습니다.")
        sys.exit(1)
    return env

ENV = load_env()

# SSL 컨텍스트 (macOS 인증서 이슈 우회)
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# ── 상수 ──────────────────────────────────────────────────────
SPOTIFY_LIMIT = 10          # 스포티파이 페이지당 앨범 수 (잠수함 패치 대응)
PAGE_COOLDOWN = 32          # 다음 페이지 요청 전 쿨타임 (초)
GEMINI_COOLDOWN = 32        # 제미나이 앨범 검증 간 쿨타임 (초)
ARTIST_INTERVAL = 600       # 아티스트 간 대기 시간 (초) = 10분
GEMINI_MODEL = "gemini-3.1-flash-lite-preview"


# ══════════════════════════════════════════════════════════════
# 🔑 스포티파이 토큰 발급
# ══════════════════════════════════════════════════════════════
def get_spotify_token():
    """Spotify Client Credentials 방식으로 엑세스 토큰을 발급받습니다."""
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": ENV.get("SPOTIFY_CLIENT_ID"),
        "client_secret": ENV.get("SPOTIFY_CLIENT_SECRET")
    }).encode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    try:
        with urllib.request.urlopen(req, context=CTX) as r:
            return json.loads(r.read().decode())['access_token']
    except Exception as e:
        print(f"❌ 스포티파이 토큰 발급 실패: {e}")
        return None


# ══════════════════════════════════════════════════════════════
# 📋 우선순위 스케줄러: 엣지가 많은 아티스트부터 순서대로
# ══════════════════════════════════════════════════════════════
def fetch_artists_ordered_by_edge():
    """
    DB에서 edges 수가 가장 많은(영향력이 큰) 아티스트 순서대로 리스트를 불러옵니다.
    이미 스포티파이 수집이 완료된 아티스트는 건너뜁니다.
    """
    # TODO: 정식 버전에서는 아래 하드코딩 대신 실제 DB 쿼리로 교체
    # 예시 쿼리 (Supabase RPC 또는 Neo4j Cypher):
    #   SELECT artist_name, COUNT(*) as edge_count
    #   FROM edges GROUP BY artist_name
    #   ORDER BY edge_count DESC
    #   WHERE artist_name NOT IN (SELECT DISTINCT artist_name FROM album_releases WHERE source='spotify')
    print("[스케줄러] 영향력이 높은 아티스트 순서대로 스캔 대상을 불러옵니다...")
    return [
        "아이유", "태연", "방탄소년단", "에스파", "뉴진스",
        "임영웅", "박진영", "백아",  # 예시 — 정식 버전에서 DB 쿼리로 교체
    ]


# ══════════════════════════════════════════════════════════════
# 🤖 봇 1: 스포티파이 채굴 봇 (The Harvester)
# ══════════════════════════════════════════════════════════════
def bot_1_spotify_harvester(artist_name, token):
    """
    스포티파이에서 아티스트의 앨범을 10개씩 안전하게 긁어옵니다.
    수집 데이터: 한글 앨범명, 발매일, 커버 이미지 URL, 앨범 타입, 트랙 수
    다음 페이지가 있으면 32초 쿨타임 후 이어서 수집합니다.
    """
    print(f"\n▶️ [봇 1 작동] '{artist_name}' 스포티파이 한글 앨범 탐색 시작")

    # 1. 아티스트 ID 검색
    search_url = (
        f"https://api.spotify.com/v1/search?"
        f"{urllib.parse.urlencode({'q': artist_name, 'type': 'artist', 'limit': 1, 'market': 'KR'})}"
    )
    req = urllib.request.Request(search_url, headers={
        "Authorization": f"Bearer {token}",
        "Accept-Language": "ko-KR,ko;q=0.9"
    })
    try:
        with urllib.request.urlopen(req, context=CTX) as r:
            artists = json.loads(r.read().decode())['artists']['items']
            if not artists:
                print(f"   ↳ ⚠️ '{artist_name}' 스포티파이 검색 결과 없음. 건너뜁니다.")
                return []
            artist_id = artists[0]['id']
    except Exception as e:
        print(f"   ↳ ❌ 스포티파이 검색 에러: {e}")
        return []

    # 2. 앨범 페이징 수집 (limit=10, 32초 쿨타임)
    albums_collected = []
    params = urllib.parse.urlencode({'market': 'KR', 'limit': SPOTIFY_LIMIT})
    albums_url = f"https://api.spotify.com/v1/artists/{artist_id}/albums?{params}"
    page = 1

    while albums_url:
        req = urllib.request.Request(albums_url, headers={
            "Authorization": f"Bearer {token}",
            "Accept-Language": "ko-KR,ko;q=0.9"
        })
        try:
            with urllib.request.urlopen(req, context=CTX) as r:
                data = json.loads(r.read().decode())
                items = data.get('items', [])

                for item in items:
                    album_data = {
                        'artist_name': artist_name,
                        'album_title': item.get('name', ''),
                        'release_date': item.get('release_date', ''),
                        'cover_image_url': item['images'][0]['url'] if item.get('images') else None,
                        'album_type': item.get('album_type', ''),
                        'total_tracks': item.get('total_tracks', 0),
                        'source': 'spotify',
                        'verified': False,  # 봇 2가 검증할 때까지 미검증 상태
                    }
                    albums_collected.append(album_data)

                print(f"   ↳ {page}페이지: {len(items)}개 수집 (누적 {len(albums_collected)}개)")

                # 다음 페이지 여부 확인
                next_url = data.get('next')
                if next_url:
                    print(f"   💤 다음 페이지 발견! {PAGE_COOLDOWN}초 쿨타임 가동 중...")
                    time.sleep(PAGE_COOLDOWN)
                    albums_url = next_url
                    page += 1
                else:
                    albums_url = None

        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = int(e.headers.get('Retry-After', 60))
                print(f"   🚨 Rate Limit 감지! {retry_after}초 대기 후 재시도...")
                time.sleep(retry_after)
            else:
                print(f"   ❌ HTTP 에러 {e.code}: {e.read().decode()}")
                break
        except Exception as e:
            print(f"   ❌ 예외 발생: {e}")
            break

    # 3. Supabase에 저장 (중복 방지)
    saved_count = 0
    for album in albums_collected:
        # TODO: 정식 버전에서 Supabase upsert 로직 구현
        # 예시:
        #   supabase.from('album_releases').upsert(
        #       album, on_conflict='artist_name,album_title'
        #   ).execute()
        # → ON CONFLICT 로 이미 존재하는 앨범은 자동 건너뜀 (중복 Insert 방어)
        saved_count += 1

    print(f"✅ [봇 1 완료] '{artist_name}': {len(albums_collected)}개 앨범 수집, {saved_count}건 DB 적재 예정")
    return albums_collected


# ══════════════════════════════════════════════════════════════
# 🧠 봇 2: 제미나이 3.1 딥검증 봇 (The Curator)
# ══════════════════════════════════════════════════════════════
def bot_2_gemini_curator(artist_name, albums):
    """
    봇 1이 가져온 앨범들을 하나씩 제미나이 3.1에게 던져서 딥 검증합니다.
    google_search 도구를 켜서 실시간 웹(나무위키, 네이버 등) 검색이 가능합니다.

    검증 임무 3대 목표:
      1) 최초 한국 실물 발매일 검증 및 수정
      2) 수록곡별 작사/작곡/프로듀싱/피처링 크레딧 추출
      3) 아티스트 국적(Korean 여부) 확인
    """
    api_key = ENV.get("GEMINI_API_KEY")
    if not api_key:
        print("   ❌ GEMINI_API_KEY 미설정. 봇 2 건너뜁니다.")
        return

    print(f"\n▶️ [봇 2 작동] '{artist_name}' 제미나이 3.1 딥검증 시작 ({len(albums)}건)")

    for i, album in enumerate(albums):
        album_title = album.get('album_title', '?')
        release_date = album.get('release_date', '?')

        prompt = f"""아티스트: {artist_name}
앨범: {album_title}
스포티파이 발매일: {release_date}

다음 3가지를 신뢰할 수 있는 출처(나무위키, 네이버, MusicBrainz, 멜론, 한국음악저작권협회 등)를 검색하여 조사해주세요:

1. 이 앨범의 실제 최초 한국 발매일 (스포티파이 날짜가 틀릴 수 있음. 재발매/리마스터는 원본 날짜로)
2. 앨범 수록곡 각각의 크레딧: 작사, 작곡, 프로듀서, 피처링 아티스트
3. 이 아티스트의 국적 (한국인 여부)

반드시 JSON으로만 응답하세요:
{{
  "corrected_date": "YYYY-MM-DD" 또는 null,
  "is_korean_artist": true/false,
  "tracks": [
    {{
      "title": "곡명",
      "writers": ["작사가1"],
      "composers": ["작곡가1"],
      "producers": ["프로듀서1"],
      "featuring": ["피처링 아티스트1"]
    }}
  ],
  "confidence": 0.0-1.0,
  "source": "출처 URL 또는 설명"
}}"""

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
        body = json.dumps({
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],  # 실시간 웹 검색 활성화
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }).encode('utf-8')

        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req, context=CTX) as r:
                result = json.loads(r.read().decode())
                text = result['candidates'][0]['content']['parts'][0]['text']
                parsed = json.loads(text)
                print(f"   [{i+1}/{len(albums)}] ✅ {album_title}: 날짜={parsed.get('corrected_date','유지')}, 한국={parsed.get('is_korean_artist')}, 트랙={len(parsed.get('tracks',[]))}곡")

                # TODO: 정식 버전에서 Supabase 업데이트 + Neo4j 엣지 생성 로직
                # 예시:
                #   if parsed.get('corrected_date'):
                #       supabase.from('album_releases').update({'release_date': parsed['corrected_date']}).eq(...)
                #   for track in parsed.get('tracks', []):
                #       for producer in track.get('producers', []):
                #           neo4j.run("MERGE (a)-[:PRODUCER {weight:0.7}]->(b)", ...)

        except Exception as e:
            print(f"   [{i+1}/{len(albums)}] ❌ {album_title}: 에러 - {e}")

        # 32초 쿨타임 (마지막 앨범은 불필요)
        if i < len(albums) - 1:
            print(f"   💤 제미나이 API 보호를 위한 {GEMINI_COOLDOWN}초 쿨타임...")
            time.sleep(GEMINI_COOLDOWN)

    print(f"✅ [봇 2 완료] '{artist_name}' 전체 {len(albums)}건 딥검증 완료!")


# ══════════════════════════════════════════════════════════════
# 🔄 메인 루프: 무한 순환 듀얼 하베스터
# ══════════════════════════════════════════════════════════════
def run_dual_harvester_loop():
    """
    무한 순환하며 10분마다 1명의 아티스트를 타겟팅,
    봇 1(스포티파이 수집) → 봇 2(제미나이 검증)를 연달아 실행합니다.
    모든 아티스트를 한 바퀴 돌면, 다시 처음부터 순회합니다(신규 앨범 체크).
    """
    cycle = 0
    while True:
        cycle += 1
        print(f"\n{'='*60}")
        print(f"🔄 [사이클 {cycle}] 아티스트 목록 갱신 중...")
        print(f"{'='*60}")

        artists_queue = fetch_artists_ordered_by_edge()

        if not artists_queue:
            print("⚠️ 스캔 대상 아티스트가 없습니다. 10분 후 재시도...")
            time.sleep(ARTIST_INTERVAL)
            continue

        # 스포티파이 토큰 발급 (사이클마다 갱신 — 1시간 만료 방어)
        token = get_spotify_token()
        if not token:
            print("❌ 스포티파이 토큰 발급 실패. 10분 후 재시도합니다.")
            time.sleep(ARTIST_INTERVAL)
            continue

        for idx, target_artist in enumerate(artists_queue):
            print(f"\n🎯 [{idx+1}/{len(artists_queue)}] ═══ 타겟: {target_artist}")

            # 1. 스포티파이 한글 데이터 수집
            albums = bot_1_spotify_harvester(target_artist, token)

            # 2. 수집된 앨범이 있으면 제미나이 딥 검증
            if albums:
                bot_2_gemini_curator(target_artist, albums)
            else:
                print(f"   ↳ 수집된 앨범이 없으므로 봇 2 건너뜁니다.")

            # 다음 아티스트까지 10분 대기
            if idx < len(artists_queue) - 1:
                print(f"\n⏳ 다음 아티스트까지 {ARTIST_INTERVAL // 60}분 대기...")
                time.sleep(ARTIST_INTERVAL)

        print(f"\n🏁 [사이클 {cycle} 완료] 전체 {len(artists_queue)}명 순회 완료!")
        print(f"   ↳ 10분 후 사이클 {cycle+1} 시작 (신규 앨범 체크)...")
        time.sleep(ARTIST_INTERVAL)


# ══════════════════════════════════════════════════════════════
# 🚀 엔트리 포인트
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("🤖 K-Culture Universe — Dual Harvester Bot (V7.5 Draft)")
    print("=" * 60)
    print(f"  모델: {GEMINI_MODEL}")
    print(f"  스포티파이 페이지 한도: {SPOTIFY_LIMIT}개/페이지")
    print(f"  페이지 쿨타임: {PAGE_COOLDOWN}초")
    print(f"  제미나이 쿨타임: {GEMINI_COOLDOWN}초")
    print(f"  아티스트 간격: {ARTIST_INTERVAL // 60}분")
    print("=" * 60)
    print("\n⚠️ [Draft 모드] 아래 주석을 해제하면 무한 루프가 시작됩니다.")
    print("   정식 가동 시: caffeinate -i python3 scripts/v7.5-dual-harvester-draft.py &\n")

    # TODO: DB 연동 코드 완성 후 아래 주석 해제
    # run_dual_harvester_loop()
