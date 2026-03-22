#!/usr/bin/env python3
"""
==========================================================================
🤖 K-Culture Universe — Dual Harvester Bot (V7.5)
==========================================================================
봇 1: 스포티파이 채굴 봇 (The Harvester)  — 한글 앨범 데이터 수집
봇 2: 제미나이 3.1 검증 봇 (The Curator)  — 발매일 교정 + 크레딧 추출 + 국적 판정

[실행 방법]
  caffeinate -i python3 scripts/v7.5-dual-harvester-draft.py &

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
# 제미나이 모델 폴백 체인: 1순위가 429 맞으면 자동으로 2순위로 전환
GEMINI_MODELS = [
    "gemini-3.1-flash-lite-preview",  # 1순위: 최신 성능
    "gemini-2.5-flash-lite",          # 2순위: 백업 (쿼타 독립)
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
# 📋 아티스트 목록: Supabase에서 엣지 많은 순으로 조회
# ══════════════════════════════════════════════════════════════
def fetch_artists_ordered_by_edge(progress):
    """
    Supabase album_releases 테이블에서 artist_name별로 등록 건수를 세어
    가장 많은(영향력이 높은) 아티스트부터 내림차순으로 가져옵니다.
    아직 봇 1이 수집하지 않은 아티스트만 반환합니다.
    """
    log.info("[스케줄러] Supabase에서 아티스트 목록 조회 중...")

    # 모든 고유 아티스트 이름 가져오기
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

    # 아티스트별 등장 횟수 세기 → 많은 순 정렬
    counts = {}
    for row in rows:
        name = row.get('artist_name', '')
        counts[name] = counts.get(name, 0) + 1

    all_artists = sorted(counts.keys(), key=lambda x: counts[x], reverse=True)

    # 이미 수집 완료한 아티스트는 건너뜀
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
    """
    album_releases 테이블에 앨범을 삽입합니다.
    이미 같은 (artist_name, album_title)이 존재하면 무시(중복 방지).
    """
    url = f"{SUPABASE_URL}/rest/v1/album_releases"
    headers = dict(SUPA_HEADERS)
    headers['Prefer'] = 'return=minimal,resolution=ignore-duplicates'

    row = {
        'artist_name': album_data['artist_name'],
        'artist_id': album_data['artist_name'],  # 임시: artist_name을 ID로 활용
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
            return False  # 중복 — 정상적으로 건너뜀
        log.warning(f"   DB Insert 경고: {e.code} {body[:100]}")
        return False
    except Exception as e:
        log.warning(f"   DB Insert 에러: {e}")
        return False


def supabase_update_verification(artist_name, album_title, corrected_date, is_korean, note):
    """봇 2 검증 결과를 album_releases 테이블에 PATCH 합니다."""
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
# ══════════════════════════════════════════════════════════════
def bot_1_spotify_harvester(artist_name, token):
    log.info(f"▶️ [봇 1] '{artist_name}' 스포티파이 탐색 시작")

    # 1. 아티스트 검색
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
    except Exception as e:
        log.error(f"   ❌ 검색 에러: {e}")
        return []

    # 2. 앨범 페이징 수집
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
                    # 스포티파이 발매일 형식 보정: "1986" → "1986-01-01", "2024-03" → "2024-03-01"
                    raw_date = item.get('release_date', '')
                    if len(raw_date) == 4:       # 연도만 (예: "1986")
                        raw_date = f"{raw_date}-01-01"
                    elif len(raw_date) == 7:     # 연-월만 (예: "2024-03")
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
# 🧠 봇 2: 제미나이 3.1 검증 봇 (달력 우선순위)
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
    api_key = ENV.get("GEMINI_API_KEY")
    if not api_key:
        log.error("   ❌ GEMINI_API_KEY 미설정")
        return

    # 이미 검증한 앨범 건너뜀 (이중 체크: progress.json + Supabase verified 필드)
    done_local = set(progress.get("verified_albums", []))
    # Supabase에서도 이미 verified=true인 앨범 확인 (progress.json 유실 대비)
    done_db = set()
    try:
        vurl = f"{SUPABASE_URL}/rest/v1/album_releases?artist_name=eq.{urllib.parse.quote(artist_name)}&verified=eq.true&select=album_title"
        vreq = urllib.request.Request(vurl, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
        with urllib.request.urlopen(vreq, context=CTX) as vr:
            for row in json.loads(vr.read().decode()):
                done_db.add(f"{artist_name}::{row['album_title']}")
    except: pass
    done_set = done_local | done_db  # 합집합 — 둘 중 하나라도 완료면 건너뜀
    unverified = [a for a in albums if f"{a['artist_name']}::{a['album_title']}" not in done_set]
    if not unverified:
        log.info(f"   ✅ '{artist_name}' 전체 검증 완료 상태")
        return

    sorted_albums = sort_albums_by_calendar_priority(unverified)
    log.info(f"▶️ [봇 2] '{artist_name}' 딥검증 ({len(sorted_albums)}건)")

    for i, album in enumerate(sorted_albums):
        title = album.get('album_title', '?')
        rdate = album.get('release_date', '?')
        album_key = f"{artist_name}::{title}"

        # -01로 끝나는 날짜는 스포티파이가 정확한 일자를 모를 때 대충 채운 것
        date_warning = ""
        if rdate.endswith("-01"):
            date_warning = "\n⚠️ 주의: 위 발매일은 '1일'로 끝나므로 스포티파이가 정확한 날짜를 몰라 임의로 채운 것일 가능성이 매우 높습니다. 예를 들어 '1986-01-01'은 실제로 1986년 1월 1일이 아니라 단지 1986년에 발매되었다는 뜻이고, '2003-03-01'은 2003년 3월 중 어딘가에 발매되었다는 뜻입니다. 반드시 실제 정확한 발매일을 검색하여 교정해주세요."

        prompt = f"""아티스트: {artist_name}
앨범: {title}
스포티파이 발매일: {rdate}{date_warning}

다음 3가지를 신뢰할 수 있는 출처(나무위키, 네이버, MusicBrainz, 멜론, 한국음악저작권협회 등)를 검색하여 조사해주세요:
1. 이 앨범의 실제 최초 한국 발매일 (스포티파이 날짜가 틀릴 수 있음. 특히 1일로 끝나는 날짜는 높은 확률로 부정확합니다)
2. 앨범 수록곡 각각의 크레딧: 작사, 작곡, 프로듀서, 피처링 아티스트
3. 이 아티스트의 국적 (한국인 여부)

반드시 JSON으로만 응답:
{{"corrected_date": "YYYY-MM-DD" 또는 null, "is_korean_artist": true/false, "tracks": [{{"title":"곡명","writers":[],"composers":[],"producers":[],"featuring":[]}}], "confidence": 0.0-1.0, "source": "출처"}}"""

        # 모델 폴백 체인: 1순위 429 → 2순위, 400(도구 비호환) → 도구 없이 재시도
        result_parsed = None
        used_model = None
        for model in GEMINI_MODELS:
            # 1차: google_search 도구 포함 시도
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
                        break
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        log.warning(f"   ⚠️ {model} 쿼타 초과 → 다음 모델로 전환")
                        break  # 이 모델은 쿼타 소진 → 다음 모델로
                    elif e.code == 400 and use_search:
                        log.warning(f"   ⚠️ {model} google_search 비호환 → 검색 없이 재시도")
                        continue  # 같은 모델, 검색 도구 없이 재시도
                    else:
                        log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {title}: HTTP {e.code}")
                        break
                except Exception as e:
                    log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {title}: {e}")
                    break
            if result_parsed:
                break  # 성공했으면 다음 모델 시도 안 함

        if result_parsed:
            c_date = result_parsed.get('corrected_date')
            is_ko = result_parsed.get('is_korean_artist')
            tracks = result_parsed.get('tracks', [])
            conf = result_parsed.get('confidence', 0)
            # 날짜를 못 찾은 경우 명시적 기록
            date_status = f"→{c_date}" if c_date else "확인불가(원본유지)"
            note = f"model:{used_model}, date:{date_status}, tracks:{len(tracks)}, conf:{conf}"

            supabase_update_verification(artist_name, title, c_date, is_ko, note)
            log.info(
                f"   [{i+1}/{len(sorted_albums)}] ✅ {title}: "
                f"날짜={date_status}, 한국={'🇰🇷' if is_ko else '🌍'}, "
                f"트랙={len(tracks)}곡 [{used_model.split('-')[1]}]"
            )

            # ✅ 성공 깃발
            progress.setdefault("verified_albums", []).append(album_key)
            save_progress(progress)
        else:
            log.error(f"   [{i+1}/{len(sorted_albums)}] ❌ {title}: 모든 모델 실패")

        if i < len(sorted_albums) - 1:
            log.info(f"   💤 {GEMINI_COOLDOWN}초 쿨타임...")
            time.sleep(GEMINI_COOLDOWN)

    log.info(f"✅ [봇 2 완료] '{artist_name}' {len(sorted_albums)}건 완료!")


# ══════════════════════════════════════════════════════════════
# 🔄 메인 루프
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

        token = get_spotify_token()
        if not token:
            log.error("❌ 토큰 실패. 10분 후 재시도")
            time.sleep(ARTIST_INTERVAL)
            continue

        for idx, target in enumerate(artists_queue):
            log.info(f"\n🎯 [{idx+1}/{len(artists_queue)}] {target}")

            albums = bot_1_spotify_harvester(target, token)
            progress.setdefault("harvested_artists", []).append(target)
            save_progress(progress)

            if albums:
                bot_2_gemini_curator(target, albums, progress)

            if idx < len(artists_queue) - 1:
                log.info(f"\n⏳ {ARTIST_INTERVAL // 60}분 대기...")
                time.sleep(ARTIST_INTERVAL)

        log.info(f"\n🏁 [사이클 {cycle} 완료]")
        time.sleep(ARTIST_INTERVAL)


# ══════════════════════════════════════════════════════════════
# 🚀 엔트리 포인트
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    log.info("=" * 60)
    log.info("🤖 K-Culture Universe — Dual Harvester Bot")
    log.info(f"  모델 체인: {' → '.join(GEMINI_MODELS)}")
    log.info(f"  Spotify limit: {SPOTIFY_LIMIT}/page")
    log.info(f"  쿨타임: 페이지 {PAGE_COOLDOWN}s / 제미나이 {GEMINI_COOLDOWN}s / 아티스트 {ARTIST_INTERVAL//60}min")
    log.info(f"  로그: {log_filename}")
    log.info(f"  체크포인트: {PROGRESS_FILE}")
    log.info("=" * 60)

    run_dual_harvester_loop()
