"""
K-Culture Universe — 신규 아티스트 데이터 수집 스크립트
CSV 파일들에서 신규 한국 아티스트를 추출하고,
MusicBrainz에서 앨범/크레딧/피처링 정보를 수집합니다.

실행: python3 scripts/v7.1-collect-new-artists.py
"""

import csv, os, json, glob, time, urllib.request, urllib.parse, re, sys

ARTISTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'artists')
LAYOUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'v5-layout.json')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'new-artists-data.json')

KOREAN_KEYWORDS = ['K-', '한국', 'korean', 'k-pop', 'k-발라드', 'k-인디', 'k-록',
                   '사운드트랙', '인디', 'K-발라드', 'K-인디', '케이팝', '한국 록',
                   '한국 랩', '한국 발라드', '인디 R&B']

MB_USER_AGENT = 'KCultureUniverse/7.0 (contact@kcultureverse.com)'

def is_korean(genres):
    for g in genres:
        for kw in KOREAN_KEYWORDS:
            if kw.lower() in g.lower():
                return True
    return False

def mb_search_artist(name):
    """MusicBrainz에서 아티스트 검색 → MBID 반환"""
    time.sleep(1.1)  # rate limit
    url = f'https://musicbrainz.org/ws/2/artist/?query=artist:{urllib.parse.quote(name)}&fmt=json&limit=3'
    req = urllib.request.Request(url, headers={'User-Agent': MB_USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
            for a in data.get('artists', []):
                # 한국 아티스트 우선
                if a.get('country') in ('KR', None) or a.get('area', {}).get('name') in ('South Korea', 'Korea', None):
                    return {'mbid': a['id'], 'name': a['name'], 'country': a.get('country', ''), 'type': a.get('type', '')}
            # 첫 번째 결과 fallback
            if data.get('artists'):
                a = data['artists'][0]
                return {'mbid': a['id'], 'name': a['name'], 'country': a.get('country', ''), 'type': a.get('type', '')}
    except Exception as e:
        print(f'  ⚠️ MB search error for {name}: {e}')
    return None

def mb_get_releases(mbid):
    """MusicBrainz에서 아티스트의 릴리즈(앨범) 목록 가져오기"""
    time.sleep(1.1)
    url = f'https://musicbrainz.org/ws/2/release-group?artist={mbid}&type=album|single|ep&fmt=json&limit=100'
    req = urllib.request.Request(url, headers={'User-Agent': MB_USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
            releases = []
            for rg in data.get('release-groups', []):
                releases.append({
                    'title': rg['title'],
                    'type': rg.get('primary-type', ''),
                    'date': rg.get('first-release-date', ''),
                    'mbid': rg['id'],
                })
            return releases
    except Exception as e:
        print(f'  ⚠️ MB releases error: {e}')
    return []

def main():
    # 1. CSV에서 아티스트 추출
    csv_artists = {}
    for f in sorted(glob.glob(os.path.join(ARTISTS_DIR, '*.csv'))):
        try:
            with open(f, 'r', encoding='utf-8-sig') as fp:
                for row in csv.DictReader(fp):
                    name = row.get('Artist Name(s)', '').strip()
                    if not name:
                        continue
                    # 세미콜론으로 구분된 피처링 아티스트 분리
                    for a in re.split(r'[;]', name):
                        a = a.strip()
                        if not a:
                            continue
                        if a not in csv_artists:
                            csv_artists[a] = {'genres': set(), 'albums': set(), 'release_dates': [], 'spotify_uri': ''}
                        genre = row.get('Genres', '')
                        if genre:
                            for g in genre.split(','):
                                csv_artists[a]['genres'].add(g.strip())
                        album = row.get('Album Name', '')
                        if album:
                            csv_artists[a]['albums'].add(album)
                        rd = row.get('Release Date', '')
                        if rd and rd != '1970-01-01':
                            csv_artists[a]['release_dates'].append(rd)
                        uri = row.get('Track URI', '')
                        if uri and not csv_artists[a]['spotify_uri']:
                            csv_artists[a]['spotify_uri'] = uri
        except Exception as e:
            print(f'ERR {f}: {e}')

    # 2. 기존 우주 노드
    with open(LAYOUT_PATH, 'r') as fp:
        layout = json.load(fp)
    existing = set()
    for n in layout['nodes']:
        existing.add(n['name'].lower())
        if n.get('nameKo'):
            existing.add(n['nameKo'].lower())

    # 3. 신규 한국 아티스트만 필터
    new_korean = {}
    for name, info in csv_artists.items():
        if name.lower() not in existing and is_korean(list(info['genres'])):
            new_korean[name] = info

    print(f'\n🌌 신규 한국 아티스트 {len(new_korean)}명 → MusicBrainz 데이터 수집 시작\n')

    # 4. MusicBrainz 데이터 수집
    results = {}
    for i, (name, info) in enumerate(sorted(new_korean.items())):
        print(f'[{i+1}/{len(new_korean)}] {name}...', end=' ', flush=True)

        mb_artist = mb_search_artist(name)
        if not mb_artist:
            print('❌ MB 미발견')
            results[name] = {
                'name': name,
                'genres': list(info['genres']),
                'csv_albums': list(info['albums']),
                'release_dates': sorted(set(info['release_dates'])),
                'mb_found': False,
                'mb_releases': [],
            }
            continue

        releases = mb_get_releases(mb_artist['mbid'])
        print(f"✅ MBID={mb_artist['mbid'][:8]}... | 릴리즈 {len(releases)}개")

        results[name] = {
            'name': name,
            'mb_name': mb_artist['name'],
            'mbid': mb_artist['mbid'],
            'country': mb_artist['country'],
            'type': mb_artist['type'],
            'genres': list(info['genres']),
            'csv_albums': list(info['albums']),
            'release_dates': sorted(set(info['release_dates'])),
            'mb_found': True,
            'mb_releases': releases,
        }

        # 중간 저장 (10명마다)
        if (i + 1) % 10 == 0:
            with open(OUTPUT_PATH, 'w', encoding='utf-8') as fp:
                json.dump(results, fp, ensure_ascii=False, indent=2)
            print(f'  💾 중간 저장 ({i+1}명)')

    # 5. 최종 저장
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as fp:
        json.dump(results, fp, ensure_ascii=False, indent=2)

    found = sum(1 for r in results.values() if r.get('mb_found'))
    total_releases = sum(len(r.get('mb_releases', [])) for r in results.values())
    print(f'\n📊 결과: {len(results)}명 처리')
    print(f'  MB 발견: {found}명')
    print(f'  총 릴리즈: {total_releases}건')
    print(f'💾 저장: {OUTPUT_PATH}')

if __name__ == '__main__':
    main()
