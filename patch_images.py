import json
import glob
import urllib.request
import urllib.parse
from time import sleep
import os

print("위성 아티스트 사진 패치 스크립트 시작...")
files = glob.glob('public/data/hub/*.json')
updated_count = 0

for path in files:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        changed = False
        satellites = data.get('satellites', [])
        
        for sat in satellites:
            name = sat.get('name')
            # 이름이 "..." (로딩 플레이스홀더) 이거나 이미 사진이 있는 경우 패스
            if not name or name == "..." or sat.get('imageUrl') is not None:
                continue
                
            # iTunes API로 아티스트 검색
            term = urllib.parse.quote(name)
            url = f"https://itunes.apple.com/search?term={term}&entity=song&limit=1&country=KR"
            
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    res = json.loads(response.read())
                    if res.get('results'):
                        # 100x100 이미지를 고화질(300x300)로 리사이징
                        img = res['results'][0].get('artworkUrl100', '')
                        if img:
                            sat['imageUrl'] = img.replace('100x100bb', '300x300bb')
                            changed = True
                            print(f"[+] 사진 추가됨: {name} (우주: {data['core']['name']})")
            except Exception as e:
                print(f"[-] {name} 검색 실패: {e}")
            
            # API 호출 제한 방지
            sleep(0.3)
                
        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            updated_count += 1
            
    except Exception as e:
        print(f"Error processing {path}: {e}")

print(f"\n✅ 완료! 총 {updated_count}개의 우주(JSON 파일)가 업데이트되었습니다.")
