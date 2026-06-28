#!/usr/bin/env python3
"""
==========================================================================
🤖 K-Culture Universe — Dual Harvester Bot (V7.8)
==========================================================================
봇 1: 스포티파이 채굴 봇 (The Harvester)  — 앨범 데이터 수집 (페이징 전건)
봇 2: 제미나이 검증 봇 (The Curator)      — 발매일 교정 + 크레딧 + 국적 판정

[V7.8 변경사항]
  ✅ FIX-1: 봇 1 아티스트 검색(401) → force_refresh() 후 재시도
  ✅ FIX-2: Gemini 양 모델 429 시 즉시 중단 + 다음 아티스트도 건너뜀
  ✅ FIX-3: Gemini 쿼타 소진 글로벌 플래그 → 쿨다운 대기 후 자동 복구
  ✅ 통계 리포트: 사이클 완료 시 성공/실패/건너뜀 요약

[실행 방법]
  caffeinate -i python3 scripts/v7.8-dual-harvester.py &

[진행 상황 확인]
  tail -f logs/harvester_*.log

[중단]
  kill $(jobs -p)
==========================================================================
"""

import json, ssl, time, sys, os, logging
import urllib.request, urllib.parse, urllib.error
from datetime import datetime, timedelta

# ── 프로젝트 경로 ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..')
PROGRESS_FILE = os.path.join(SCRIPT_DIR, 'progress.json')
LOG_DIR = os.path.join(PROJECT_ROOT, 'logs')

# ── 로그 시스템 ───────────────────────────────────────────────
os.makedirs(LOG_DIR, exist_ok=True)
log_filename = os.path.join(LOG_DIR, f"harvester_{datetime.now().strftime('%Y%m%d')}.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("DualHarvester")

# ── 환경변수 ──────────────────────────────────────────────────
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
SUPABASE_URL = ENV.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = ENV.get('SUPABASE_SERVICE_ROLE_KEY')

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# ── 상수 ──────────────────────────────────────────────────────
SPOTIFY_LIMIT = 10
PAGE_COOLDOWN = 32
GEMINI_COOLDOWN = 32
ARTIST_INTERVAL = 600
GEMINI_QUOTA_WAIT = 900  # V7.8: 양 모델 429 시 15분 대기 후 재시도

# 제미나이 모델 폴백 체인
GEMINI_MODELS = [
    "gemini-3.5-flash",  # 1순위: 최신 성능
    "gemini-3.1-flash-lite",          # 2순위: 백업 (쿼타 독립)
]

# ── Supabase HTTP 헤더 ────────────────────────────────────────
SUPA_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}


# ══════════════════════════════════════════════════════════════
# 📌 체크포인트 관리
# ══════════════════════════════════════════════════════════════
def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"harvested_artists": [], "verified_albums": [], "last_updated": None}

def save_progress(progress):
    """원자적 저장 — .tmp 쓴 후 os.replace()로 교체"""
    progress["last_updated"] = datetime.now().isoformat()
    tmp_path = PROGRESS_FILE + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, PROGRESS_FILE)


# ══════════════════════════════════════════════════════════════
# 🔑 스포티파이 토큰 매니저 (만료 5분 전 자동 갱신)
# ══════════════════════════════════════════════════════════════
class SpotifyTokenManager:
    def __init__(self):
        self._token = None
        self._expires_at = 0.0

    def get_token(self):
        if time.time() >= self._expires_at - 300:
            log.info("🔑 토큰 만료 임박 (or 미발급) → 재발급 시작...")
            self._refresh()
        return self._token

    def force_refresh(self):
        log.warning("🔑 토큰 강제 재발급 (401 복구)...")
        self._refresh()

    def _refresh(self):
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
                resp = json.loads(r.read().decode())
                self._token = resp['access_token']
                expires_in = resp.get('expires_in', 3600)
                self._expires_at = time.time() + expires_in
                log.info(f"✅ 토큰 갱신 완료 (유효 {expires_in // 60}분)")
        except Exception as e:
            log.error(f"❌ 스포티파이 토큰 발급 실패: {e}")
            self._token = None
            self._expires_at = 0.0

token_manager = SpotifyTokenManager()


# ══════════════════════════════════════════════════════════════
# 📋 아티스트 목록: Supabase에서 엣지 많은 순으로 조회
# ══════════════════════════════════════════════════════════════
def fetch_artists_ordered_by_edge(progress):
    log.info("[스케줄러] Supabase에서 아티스트 목록 조회 중...")

    url = f"{SUPABASE_URL}/rest/v1/album_releases?select=artist_name&order=artist_name"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    })
    try:
        with urllib.request.urlopen(req, context=CTX) as r:
            rows = json.loads(r.read().decode())
    except Exception as e:
        log.error(f"❌ 아티스트 목록 조회 실패: {e}")
        rows = []

    counts = {}
    for row in rows:
        name = row.get('artist_name', '')
        counts[name] = counts.get(name, 0) + 1

    all_artists = sorted(counts.keys(), key=lambda x: counts[x], reverse=True)

    done = set(progress.get("harvested_artists", []))
    remaining = [a for a in all_artists if a not in done]

    if remaining:
        log.info(f"[스케줄러] 남은 아티스트: {len(remaining)}명 (완료: {len(done)}명)")
    else:
        log.info(f"[스케줄러] 🎉 전체 1사이클 완료! 진행률 초기화 후 재순환")
        progress["harvested_artists"] = []
        save_progress(progress)
        remaining = all_artists

    return remaining


# ══════════════════════════════════════════════════════════════
# 💾 Supabase 저장 함수들
# ══════════════════════════════════════════════════════════════
def supabase_upsert_album(album_data):
    url = f"{SUPABASE_URL}/rest/v1/album_releases"
    headers = dict(SUPA_HEADERS)
    headers['Prefer'] = 'return=minimal,resolution=ignore-duplicates'

    row = {
        'artist_name': album_data['artist_name'],
        'artist_id': album_data['artist_name'],
        'album_title': album_data['album_title'],
        'album_type': album_data.get('album_type', 'Album'),
        'release_date': album_data['release_date'],
        'source': 'spotify',
        'verified': False,
    }

    req = urllib.request.Request(
        url, method='POST',
        data=json.dumps(row).encode('utf-8'),
        headers=headers
    )
    try:
        urllib.request.urlopen(req, context=CTX)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if '409' in str(e.code) or 'duplicate' in body.lower() or '23505' in body:
            return False
        log.warning(f"   DB Insert 경고: {e.code} {body[:100]}")
        return False
    except Exception as e:
        log.warning(f"   DB Insert 에러: {e}")
        return False


def supabase_update_verification(artist_name, album_title, corrected_date, is_korean, note):
    url = (
        f"{SUPABASE_URL}/rest/v1/album_releases"
        f"?artist_name=eq.{urllib.parse.quote(artist_name)}"
        f"&album_title=eq.{urllib.parse.quote(album_title)}"
    )
    data = {
        "verified": True,
        "verified_at": datetime.now().isoformat(),
        "is_korean_artist": is_korean,
        "verification_source": "dual_harvester_gemini_3.1",
        "verification_note": note[:500] if note else None,
    }
    if corrected_date:
        data["release_date"] = corrected_date

    req = urllib.request.Request(
        url, method='PATCH',
        data=json.dumps(data).encode('utf-8'),
        headers=SUPA_HEADERS
    )
    try:
        urllib.request.urlopen(req, context=CTX)
        return True
    except Exception as e:
        log.warning(f"   DB Update 에러: {e}")
        return False


# ══════════════════════════════════════════════════════════════
# 🤖 봇 1: 스포티파이 채굴 봇
#    V7.8 FIX-1: 아티스트 검색 401도 force_refresh() 처리
# ══════════════════════════════════════════════════════════════
def bot_1_spotify_harvester(artist_name, token):
    log.info(f"▶️ [봇 1] '{artist_name}' 스포티파이 탐색 시작")

    # 1. 아티스트 검색 (V7.8: 401 시 재발급 + 1회 재시도)
    artist_id = None
    for attempt in range(2):  # 최대 2회 (원본 + 401 재시도 1회)
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
                    log.warning(f"   ⚠️ '{artist_name}' 검색 결과 없음")
                    return []
                artist_id = artists[0]['id']
                break
        except urllib.error.HTTPError as e:
            if e.code == 401 and attempt == 0:
                log.warning("   🔑 검색 401 → 토큰 재발급 후 재시도")
                token_manager.force_refresh()
                token = token_manager.get_token()
                if not token:
                    log.error("   ❌ 토큰 재발급 실패")
                    return []
                continue
            log.error(f"   ❌ 검색 HTTP {e.code}")
            return []
        except Exception as e:
            log.error(f"   ❌ 검색 에러: {e}")
            return []

    if not artist_id:
        return []

    # 2. 앨범 페이징 수집 (전체 — 제한 없음)
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
                    raw_date = item.get('release_date', '')
                    if len(raw_date) == 4:
                        raw_date = f"{raw_date}-01-01"
                    elif len(raw_date) == 7:
                        raw_date = f"{raw_date}-01"

                    albums_collected.append({
                        'artist_name': artist_name,
                        'album_title': item.get('name', ''),
                        'release_date': raw_date,
                        'cover_image_url': item['images'][0]['url'] if item.get('images') else None,
                        'album_type': item.get('album_type', 'album').capitalize(),
                        'total_tracks': item.get('total_tracks', 0),
                    })
                log.info(f"   {page}p: {len(items)}개 (누적 {len(albums_collected)})")
                next_url = data.get('next')
                if next_url:
                    log.info(f"   💤 {PAGE_COOLDOWN}초 쿨타임...")
                    time.sleep(PAGE_COOLDOWN)
                    albums_url = next_url
                    page += 1
                else:
                    albums_url = None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = int(e.headers.get('Retry-After', 60))
                log.warning(f"   🚨 Rate Limit! {retry_after}초 대기...")
                time.sleep(retry_after)
            elif e.code == 401:
                log.warning("   🔑 토큰 만료(401) → 재발급 후 재시도")
                token_manager.force_refresh()
                token = token_manager.get_token()
                if not token:
                    log.error("   ❌ 토큰 재발급 실패 → 아티스트 건너뜀")
                    break
                continue
            else:
                log.error(f"   ❌ HTTP {e.code}")
                break
        except Exception as e:
            log.error(f"   ❌ {e}")
            break

    # 3. Supabase에 저장 (중복 자동 무시)
    saved = 0
    for album in albums_collected:
        if supabase_upsert_album(album):
            saved += 1

    log.info(f"✅ [봇 1 완료] '{artist_name}': {len(albums_collected)}개 수집, {saved}건 신규 DB 저장")
    return albums_collected


# ══════════════════════════════════════════════════════════════
# 🧠 봇 2: 제미나이 검증 봇 (달력 우선순위)
#    V7.8 FIX-2: 양 모델 429 → 즉시 중단, 글로벌 쿼타 플래그 반환
# ══════════════════════════════════════════════════════════════
def sort_albums_by_calendar_priority(albums):
    today = datetime.now()
    today_mmdd = today.strftime("%m-%d")
    def priority_key(album):
        rd = album.get('release_date', '')
        if len(rd) < 5: return 999
        try:
            album_mmdd = rd[5:10]
            diff = (datetime.strptime(album_mmdd, "%m-%d").replace(year=today.year) -
                    datetime.strptime(today_mmdd, "%m-%d").replace(year=today.year)).days
            return diff if diff >= 0 else diff + 365
        except: return 999
    sorted_a = sorted(albums, key=priority_key)
    today_count = sum(1 for a in sorted_a if a.get('release_date', '')[5:10] == today_mmdd)
    if today_count:
        log.info(f"   📅 오늘({today_mmdd}) 앨범 {today_count}개 최우선!")
    else:
        log.info(f"   📅 오늘 해당 없음 → 가까운 날짜부터 순차 검증")
    return sorted_a


def bot_2_gemini_curator(artist_name, albums, progress):
    """
    Returns: "ok" | "quota_exhausted"
    V7.8: 양 모델 모두 429이면 "quota_exhausted" 반환 → 메인 루프에서 대기
    """
    api_key = ENV.get("GEMINI_API_KEY")
    if not api_key:
        log.error("   ❌ GEMINI_API_KEY 미설정")
        return "ok"

    # 이미 검증한 앨범 건너뜀 (progress.json + Supabase 이중 체크)
    done_local = set(progress.get("verified_albums", []))
    done_db = set()
    try:
        vurl = f"{SUPABASE_URL}/rest/v1/album_releases?artist_name=eq.{urllib.parse.quote(artist_name)}&verified=eq.true&select=album_title"
        vreq = urllib.request.Request(vurl, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
        with urllib.request.urlopen(vreq, context=CTX) as vr:
            for row in json.loads(vr.read().decode()):
                done_db.add(f"{artist_name}::{row['album_title']}")
    except: pass
    done_set = done_local | done_db
    unverified = [a for a in albums if f"{a['artist_name']}::{a['album_title']}" not in done_set]
    if not unverified:
        log.info(f"   ✅ '{artist_name}' 전체 검증 완료 상태")
        return "ok"

    sorted_albums = sort_albums_by_calendar_priority(unverified)
    log.info(f"▶️ [봇 2] '{artist_name}' 딥검증 ({len(sorted_albums)}건)")

    # V7.8: 연속 429 카운터 — 양 모델 모두 429이면 조기 중단
    consecutive_all_model_429 = 0
    verified_count = 0
    failed_count = 0

    for i, album in enumerate(sorted_albums):
        title = album.get('album_title', '?')
        rdate = album.get('release_date', '?')
        album_key = f"{artist_name}::{title}"

        date_warning = ""
        if rdate.endswith("-01"):
            date_warning = "\n⚠️ 주의: 위 발매일은 '1일'로 끝나므로 스포티파이가 정확한 날짜를 몰라 임의로 채운 것일 가능성이 매우 높습니다. 반드시 실제 정확한 발매일을 검색하여 교정해주세요."

        prompt = f"""아티스트: {artist_name}
앨범: {title}
스포티파이 발매일: {rdate}{date_warning}

다음 3가지를 신뢰할 수 있는 출처(나무위키, 네이버, MusicBrainz, 멜론, 한국음악저작권협회 등)를 검색하여 조사해주세요:
1. 이 앨범의 실제 최초 한국 발매일 (스포티파이 날짜가 틀릴 수 있음)
2. 앨범 수록곡 각각의 크레딧: 작사, 작곡, 프로듀서, 피처링 아티스트
3. 이 아티스트의 국적 (한국인 여부)

반드시 JSON으로만 응답:
{{"corrected_date": "YYYY-MM-DD" 또는 null, "is_korean_artist": true/false, "tracks": [{{"title":"곡명","writers":[],"composers":[],"producers":[],"featuring":[]}}], "confidence": 0.0-1.0, "source": "출처"}}"""

        # 모델 폴백 체인
        result_parsed = None
        used_model = None
        all_models_429 = True  # V7.8: 양 모델 모두 429인지 추적

        for model in GEMINI_MODELS:
            for use_search in [True, False]:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                }
                if use_search:
                    payload["tools"] = [{"google_search": {}}]
                body = json.dumps(payload).encode('utf-8')

                req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
                try:
                    with urllib.request.urlopen(req, context=CTX) as r:
                        result = json.loads(r.read().decode())
                        text = result['candidates'][0]['content']['parts'][0]['text']
                        result_parsed = json.loads(text)
                        used_model = f"{model}{'(+search)' if use_search else '(no-search)'}"
                        all_models_429 = False
                        break
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        log.warning(f"   ⚠️ {model} 쿼타 초과 → 다음 모델로 전환")
                        break  # 이 모델은 쿼타 소진 → 다음 모델로
                    elif e.code == 400 and use_search:
                        log.warning(f"   ⚠️ {model} google_search 비호환 → 검색 없이 재시도")
                        all_models_429 = False
                        continue
                    else:
                        log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {title}: HTTP {e.code}")
                        all_models_429 = False
                        break
                except Exception as e:
                    log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {title}: {e}")
                    all_models_429 = False
                    break
            if result_parsed:
                break

        # V7.8 FIX-2: 양 모델 모두 429이면 즉시 중단
        if all_models_429 and not result_parsed:
            consecutive_all_model_429 += 1
            failed_count += 1
            log.warning(
                f"   [{i+1}/{len(sorted_albums)}] 🚫 {title}: "
                f"양 모델 쿼타 소진 (연속 {consecutive_all_model_429}회)"
            )
            if consecutive_all_model_429 >= 2:
                remaining = len(sorted_albums) - i - 1
                log.warning(
                    f"   ⛔ Gemini 쿼타 완전 소진! "
                    f"나머지 {remaining}건 건너뜀 → 쿨다운 대기"
                )
                return "quota_exhausted"
            # 첫 번째 429에서는 60초 대기 후 한 번 더 시도
            log.info("   💤 60초 대기 후 재시도...")
            time.sleep(60)
            continue

        # 429가 아닌 다른 이유로 실패하면 카운터 리셋
        if not result_parsed:
            consecutive_all_model_429 = 0
            failed_count += 1

        if result_parsed:
            consecutive_all_model_429 = 0  # 성공 시 리셋
            verified_count += 1
            c_date = result_parsed.get('corrected_date')
            is_ko = result_parsed.get('is_korean_artist')
            tracks = result_parsed.get('tracks', [])
            conf = result_parsed.get('confidence', 0)
            date_status = f"→{c_date}" if c_date else "확인불가(원본유지)"
            note = f"model:{used_model}, date:{date_status}, tracks:{len(tracks)}, conf:{conf}"

            supabase_update_verification(artist_name, title, c_date, is_ko, note)
            log.info(
                f"   [{i+1}/{len(sorted_albums)}] ✅ {title}: "
                f"날짜={date_status}, 한국={'🇰🇷' if is_ko else '🌍'}, "
                f"트랙={len(tracks)}곡 [{used_model.split('-')[1]}]"
            )

            progress.setdefault("verified_albums", []).append(album_key)
            save_progress(progress)
        else:
            log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {title}: 모든 모델 실패")

        if i < len(sorted_albums) - 1:
            log.info(f"   💤 {GEMINI_COOLDOWN}초 쿨타임...")
            time.sleep(GEMINI_COOLDOWN)

    log.info(
        f"✅ [봇 2 완료] '{artist_name}' — "
        f"성공 {verified_count} / 실패 {failed_count} / "
        f"총 {len(sorted_albums)}건"
    )
    return "ok"


# ══════════════════════════════════════════════════════════════
# 🔄 메인 루프
#    V7.8 FIX-3: Gemini 쿼타 소진 시 15분 쿨다운
# ══════════════════════════════════════════════════════════════
def run_dual_harvester_loop():
    progress = load_progress()
    log.info(f"📂 체크포인트 로드 (마지막: {progress.get('last_updated','신규')})")

    cycle = 0
    while True:
        cycle += 1
        log.info(f"\n{'='*60}")
        log.info(f"🔄 [사이클 {cycle}]")
        log.info(f"{'='*60}")

        artists_queue = fetch_artists_ordered_by_edge(progress)

        token = token_manager.get_token()
        if not token:
            log.error("❌ 토큰 실패. 10분 후 재시도")
            time.sleep(ARTIST_INTERVAL)
            continue

        # V7.8: 사이클 통계
        stats = {"spotify_ok": 0, "spotify_empty": 0, "gemini_ok": 0, "gemini_quota": 0, "skipped": 0}
        gemini_paused_until = 0  # V7.8: 쿼타 소진 시 일시정지 타임스탬프

        for idx, target in enumerate(artists_queue):
            log.info(f"\n🎯 [{idx+1}/{len(artists_queue)}] {target}")

            # 매 아티스트마다 토큰 유효성 확인
            token = token_manager.get_token()
            if not token:
                log.error("❌ 토큰 없음 → 아티스트 건너뜀")
                stats["skipped"] += 1
                continue

            albums = bot_1_spotify_harvester(target, token)
            progress.setdefault("harvested_artists", []).append(target)
            save_progress(progress)

            if albums:
                stats["spotify_ok"] += 1

                # V7.8 FIX-3: Gemini 쿨다운 중이면 봇 2 건너뜀
                now = time.time()
                if now < gemini_paused_until:
                    remaining_wait = int(gemini_paused_until - now)
                    log.info(
                        f"   ⏸️ Gemini 쿼타 쿨다운 중 "
                        f"(잔여 {remaining_wait}초) → 봇 2 건너뜀"
                    )
                    stats["gemini_quota"] += 1
                else:
                    result = bot_2_gemini_curator(target, albums, progress)
                    if result == "quota_exhausted":
                        gemini_paused_until = time.time() + GEMINI_QUOTA_WAIT
                        log.warning(
                            f"   ⏸️ Gemini 쿼타 소진 → "
                            f"{GEMINI_QUOTA_WAIT // 60}분 쿨다운 시작"
                        )
                        stats["gemini_quota"] += 1
                    else:
                        stats["gemini_ok"] += 1
            else:
                stats["spotify_empty"] += 1

            if idx < len(artists_queue) - 1:
                log.info(f"\n⏳ {ARTIST_INTERVAL // 60}분 대기...")
                time.sleep(ARTIST_INTERVAL)

        # V7.8: 사이클 완료 리포트
        log.info(f"\n{'='*60}")
        log.info(f"🏁 [사이클 {cycle} 완료] 통계:")
        log.info(f"   Spotify: {stats['spotify_ok']}명 성공 / {stats['spotify_empty']}명 결과없음")
        log.info(f"   Gemini:  {stats['gemini_ok']}명 검증 / {stats['gemini_quota']}명 쿼타초과")
        log.info(f"   건너뜀:  {stats['skipped']}명")
        log.info(f"{'='*60}")
        time.sleep(ARTIST_INTERVAL)


# ══════════════════════════════════════════════════════════════
# 🚀 엔트리 포인트
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    log.info("=" * 60)
    log.info("🤖 K-Culture Universe — Dual Harvester Bot V7.8")
    log.info(f"  모델 체인: {' → '.join(GEMINI_MODELS)}")
    log.info(f"  Spotify limit: {SPOTIFY_LIMIT}/page (전건 페이징)")
    log.info(f"  쿨타임: 페이지 {PAGE_COOLDOWN}s / 제미나이 {GEMINI_COOLDOWN}s / 아티스트 {ARTIST_INTERVAL//60}min")
    log.info(f"  Gemini 쿼타 소진 대기: {GEMINI_QUOTA_WAIT // 60}분")
    log.info(f"  로그: {log_filename}")
    log.info(f"  체크포인트: {PROGRESS_FILE}")
    log.info("=" * 60)

    run_dual_harvester_loop()
