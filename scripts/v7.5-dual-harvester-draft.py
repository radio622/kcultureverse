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
  - 중단 후 재실행하면 progress.json 체크포인트에서 자동으로 이어갑니다.

[주의사항]
  - 이 스크립트는 기획 단계의 설계도(Draft)입니다.
  - 정식 가동 전 반드시 DB 연동 코드(TODO 표시)를 완성해야 합니다.
  - 맥북 충전기를 반드시 연결한 상태에서 실행하세요.
  
[진행 상황 확인 방법]
  - 로그 파일: logs/harvester_YYYYMMDD.log (날짜별 자동 생성)
  - 체크포인트: scripts/progress.json (아티스트별 수집 완료 여부)
  - 터미널에서 실시간 확인: tail -f logs/harvester_*.log
==========================================================================
"""

import json, ssl, time, sys, os, logging
import urllib.request, urllib.parse, urllib.error
from datetime import datetime, timedelta

# ── 프로젝트 루트 경로 ────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..')
PROGRESS_FILE = os.path.join(SCRIPT_DIR, 'progress.json')
LOG_DIR = os.path.join(PROJECT_ROOT, 'logs')

# ── 로그 시스템 세팅 ─────────────────────────────────────────
os.makedirs(LOG_DIR, exist_ok=True)

log_filename = os.path.join(LOG_DIR, f"harvester_{datetime.now().strftime('%Y%m%d')}.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)  # 터미널에도 동시 출력
    ]
)
log = logging.getLogger("DualHarvester")

# ── 환경변수 로드 ─────────────────────────────────────────────
def load_env():
    env = {}
    env_path = os.path.join(PROJECT_ROOT, '.env.local')
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        log.error("❌ .env.local 파일을 찾을 수 없습니다.")
        sys.exit(1)
    return env

ENV = load_env()

# SSL 컨텍스트
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
# 📌 체크포인트(진행률) 관리 — 중단 후 이어서 하기
# ══════════════════════════════════════════════════════════════
def load_progress():
    """progress.json 에서 이전 진행 상태를 복원합니다."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "harvested_artists": [],   # 봇 1이 수집 완료한 아티스트 목록
        "verified_albums": [],     # 봇 2가 검증 완료한 앨범 (artist_name + album_title)
        "last_updated": None
    }

def save_progress(progress):
    """현재 진행 상태를 progress.json 에 즉시 저장합니다."""
    progress["last_updated"] = datetime.now().isoformat()
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


# ══════════════════════════════════════════════════════════════
# 🔑 스포티파이 토큰 발급
# ══════════════════════════════════════════════════════════════
def get_spotify_token():
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
        log.error(f"❌ 스포티파이 토큰 발급 실패: {e}")
        return None


# ══════════════════════════════════════════════════════════════
# 📋 우선순위 스케줄러: 엣지 많은 아티스트부터, 이미 한 사람은 건너뜀
# ══════════════════════════════════════════════════════════════
def fetch_artists_ordered_by_edge(progress):
    """
    DB에서 엣지 수 내림차순으로 아티스트를 가져오되,
    이미 봇 1이 수집 완료한 아티스트는 제외합니다.
    """
    # TODO: 정식 버전에서는 DB 쿼리로 교체
    all_artists = [
        "아이유", "태연", "방탄소년단", "에스파", "뉴진스",
        "임영웅", "박진영", "백아",
    ]

    # ✅ 이미 수집 완료한 아티스트는 건너뜀 (재수집 방지)
    done = set(progress.get("harvested_artists", []))
    remaining = [a for a in all_artists if a not in done]

    if remaining:
        log.info(f"[스케줄러] 남은 아티스트: {len(remaining)}명 (완료: {len(done)}명)")
    else:
        log.info(f"[스케줄러] 🎉 전체 {len(all_artists)}명 1사이클 완료! 진행률 초기화 후 재순환")
        progress["harvested_artists"] = []  # 한 바퀴 다 돌면 리셋 (신규 앨범 체크)
        save_progress(progress)
        remaining = all_artists

    return remaining


# ══════════════════════════════════════════════════════════════
# 🤖 봇 1: 스포티파이 채굴 봇 (The Harvester)
# ══════════════════════════════════════════════════════════════
def bot_1_spotify_harvester(artist_name, token):
    log.info(f"▶️ [봇 1] '{artist_name}' 스포티파이 한글 앨범 탐색 시작")

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
                log.warning(f"   ⚠️ '{artist_name}' 스포티파이 검색 결과 없음")
                return []
            artist_id = artists[0]['id']
    except Exception as e:
        log.error(f"   ❌ 검색 에러: {e}")
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
                        'verified': False,
                    }
                    albums_collected.append(album_data)

                log.info(f"   {page}페이지: {len(items)}개 수집 (누적 {len(albums_collected)}개)")

                next_url = data.get('next')
                if next_url:
                    log.info(f"   💤 다음 페이지 발견! {PAGE_COOLDOWN}초 쿨타임...")
                    time.sleep(PAGE_COOLDOWN)
                    albums_url = next_url
                    page += 1
                else:
                    albums_url = None

        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = int(e.headers.get('Retry-After', 60))
                log.warning(f"   🚨 Rate Limit! {retry_after}초 대기 후 재시도...")
                time.sleep(retry_after)
            else:
                log.error(f"   ❌ HTTP {e.code}: {e.read().decode()}")
                break
        except Exception as e:
            log.error(f"   ❌ 예외: {e}")
            break

    # 3. Supabase에 저장 (중복 방지: upsert)
    # TODO: 정식 버전에서 Supabase 연동
    # supabase.from('album_releases').upsert(album, on_conflict='artist_name,album_title').execute()

    log.info(f"✅ [봇 1 완료] '{artist_name}': {len(albums_collected)}개 앨범 수집 완료")
    return albums_collected


# ══════════════════════════════════════════════════════════════
# 🧠 봇 2: 제미나이 3.1 딥검증 봇 (The Curator)
#   우선순위: 오늘 날짜와 월/일이 같은 앨범 → 내일 → 모레 → 나머지 미검증
# ══════════════════════════════════════════════════════════════
def sort_albums_by_calendar_priority(albums):
    """
    봇 2의 검증 순서를 결정합니다.
    1순위: 오늘과 월/일이 같은 앨범 (오늘의 우주 달력에 바로 떠야 함)
    2순위: 내일(+1일) → 모레(+2일) → ... 순으로 가까운 날짜
    3순위: 해당 없는 앨범 (가장 나중에 순차 처리)
    """
    today = datetime.now()
    today_mmdd = today.strftime("%m-%d")

    def priority_key(album):
        rd = album.get('release_date', '')
        if len(rd) < 5:
            return 999  # 날짜 없으면 맨 뒤로

        try:
            album_mmdd = rd[5:10]  # "YYYY-MM-DD" → "MM-DD"
            album_md = datetime.strptime(album_mmdd, "%m-%d").replace(year=today.year)
            today_md = datetime.strptime(today_mmdd, "%m-%d").replace(year=today.year)
            diff = (album_md - today_md).days
            if diff < 0:
                diff += 365  # 지난 날짜는 내년 것으로 간주
            return diff
        except ValueError:
            return 999

    sorted_albums = sorted(albums, key=priority_key)

    # 로그: 우선순위 결정 결과
    today_count = sum(1 for a in sorted_albums if a.get('release_date', '')[5:10] == today_mmdd)
    if today_count:
        log.info(f"   📅 오늘({today_mmdd}) 발매 앨범 {today_count}개 최우선 검증!")
    else:
        log.info(f"   📅 오늘({today_mmdd}) 해당 앨범 없음 → 가장 가까운 날짜부터 순차 검증")

    return sorted_albums


def bot_2_gemini_curator(artist_name, albums, progress):
    api_key = ENV.get("GEMINI_API_KEY")
    if not api_key:
        log.error("   ❌ GEMINI_API_KEY 미설정")
        return

    # ✅ 이미 검증한 앨범은 건너뜀 (재처리 방지)
    done_set = set(progress.get("verified_albums", []))
    unverified = [a for a in albums if f"{a['artist_name']}::{a['album_title']}" not in done_set]

    if not unverified:
        log.info(f"   ✅ '{artist_name}' 모든 앨범 검증 완료 상태. 건너뜁니다.")
        return

    # 📅 오늘 달력 우선순위로 정렬
    sorted_albums = sort_albums_by_calendar_priority(unverified)

    log.info(f"▶️ [봇 2] '{artist_name}' 딥검증 시작 (미검증 {len(sorted_albums)}건)")

    for i, album in enumerate(sorted_albums):
        album_title = album.get('album_title', '?')
        release_date = album.get('release_date', '?')
        album_key = f"{artist_name}::{album_title}"

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
      "writers": ["작사가"],
      "composers": ["작곡가"],
      "producers": ["프로듀서"],
      "featuring": ["피처링"]
    }}
  ],
  "confidence": 0.0-1.0,
  "source": "출처"
}}"""

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
        body = json.dumps({
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
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
                tracks_count = len(parsed.get('tracks', []))
                log.info(
                    f"   [{i+1}/{len(sorted_albums)}] ✅ {album_title}: "
                    f"날짜={parsed.get('corrected_date','유지')}, "
                    f"한국={parsed.get('is_korean_artist')}, "
                    f"트랙={tracks_count}곡"
                )

                # TODO: Supabase 업데이트 + Neo4j 엣지 생성
                #   supabase.from('album_releases').update({...}).eq('artist_name', ...).eq('album_title', ...)
                #   for track in parsed.get('tracks', []):
                #       for producer in track.get('producers', []):
                #           neo4j.run("MERGE ...", ...)

        except Exception as e:
            log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {album_title}: {e}")

        # ✅ 검증 완료 표시 (재처리 방지) — 성공이든 실패든 기록
        progress.setdefault("verified_albums", []).append(album_key)
        save_progress(progress)

        # 32초 쿨타임 (마지막 앨범은 불필요)
        if i < len(sorted_albums) - 1:
            log.info(f"   💤 {GEMINI_COOLDOWN}초 쿨타임...")
            time.sleep(GEMINI_COOLDOWN)

    log.info(f"✅ [봇 2 완료] '{artist_name}' {len(sorted_albums)}건 딥검증 완료!")


# ══════════════════════════════════════════════════════════════
# 🔄 메인 루프: 무한 순환 듀얼 하베스터
# ══════════════════════════════════════════════════════════════
def run_dual_harvester_loop():
    progress = load_progress()
    log.info(f"📂 체크포인트 로드 완료 (마지막: {progress.get('last_updated','신규')})")

    cycle = 0
    while True:
        cycle += 1
        log.info(f"\n{'='*60}")
        log.info(f"🔄 [사이클 {cycle}] 시작")
        log.info(f"{'='*60}")

        artists_queue = fetch_artists_ordered_by_edge(progress)

        # 스포티파이 토큰 발급 (사이클마다 갱신)
        token = get_spotify_token()
        if not token:
            log.error("❌ 토큰 실패. 10분 후 재시도")
            time.sleep(ARTIST_INTERVAL)
            continue

        for idx, target_artist in enumerate(artists_queue):
            log.info(f"\n🎯 [{idx+1}/{len(artists_queue)}] 타겟: {target_artist}")

            # 봇 1: 스포티파이 수집
            albums = bot_1_spotify_harvester(target_artist, token)

            # ✅ 봇 1 완료 표시 (재수집 방지)
            progress.setdefault("harvested_artists", []).append(target_artist)
            save_progress(progress)

            # 봇 2: 제미나이 딥 검증
            if albums:
                bot_2_gemini_curator(target_artist, albums, progress)
            else:
                log.info(f"   수집 앨범 없음 → 봇 2 건너뜀")

            # 다음 아티스트까지 10분 대기
            if idx < len(artists_queue) - 1:
                log.info(f"\n⏳ 다음 아티스트까지 {ARTIST_INTERVAL // 60}분 대기...")
                time.sleep(ARTIST_INTERVAL)

        log.info(f"\n🏁 [사이클 {cycle} 완료] {len(artists_queue)}명 순회 완료!")
        log.info(f"   10분 후 사이클 {cycle+1} 시작 (신규 앨범 체크)...")
        time.sleep(ARTIST_INTERVAL)


# ══════════════════════════════════════════════════════════════
# 🚀 엔트리 포인트
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    log.info("=" * 60)
    log.info("🤖 K-Culture Universe — Dual Harvester Bot (V7.5 Draft)")
    log.info("=" * 60)
    log.info(f"  모델: {GEMINI_MODEL}")
    log.info(f"  스포티파이 한도: {SPOTIFY_LIMIT}개/페이지")
    log.info(f"  페이지 쿨타임: {PAGE_COOLDOWN}초")
    log.info(f"  제미나이 쿨타임: {GEMINI_COOLDOWN}초")
    log.info(f"  아티스트 간격: {ARTIST_INTERVAL // 60}분")
    log.info(f"  체크포인트: {PROGRESS_FILE}")
    log.info(f"  로그 파일: {log_filename}")
    log.info("=" * 60)
    log.info("")
    log.info("⚠️ [Draft 모드] 아래 주석을 해제하면 무한 루프가 시작됩니다.")
    log.info("   가동: caffeinate -i python3 scripts/v7.5-dual-harvester-draft.py &")
    log.info("")

    # TODO: DB 연동 코드 완성 후 아래 주석 해제
    # run_dual_harvester_loop()
