import json, os, urllib.request, ssl, time

env = {}
try:
    with open('.env.local') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
except:
    pass

SUPABASE_URL = env.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = env.get('SUPABASE_SERVICE_ROLE_KEY')
OPENAI_API_KEY = env.get('OPENAI_API_KEY')

if not SUPABASE_URL or not SUPABASE_KEY or not OPENAI_API_KEY:
    print("❌ 환경변수 누락 오류")
    exit(1)

def get_unverified():
    url = f"{SUPABASE_URL}/rest/v1/album_releases?verified=eq.false&select=id,artist_name,artist_name_ko,album_title,release_date"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'
    })
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, context=ctx) as r:
        return json.loads(r.read().decode())

def update_db(id, date, is_ko, note):
    url = f"{SUPABASE_URL}/rest/v1/album_releases?id=eq.{id}"
    data = {
        "release_date": date,
        "is_korean_artist": is_ko,
        "verified": True,
        "verification_source": "antigravity_mass_cron",
        "verification_note": note
    }
    req = urllib.request.Request(url, method='PATCH', data=json.dumps(data).encode(), headers={
        'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json', 'Prefer': 'return=minimal'
    })
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, context=ctx) as r:
        pass

def check_llm(album):
    prompt = f"Artist: {album['artist_name']} ({album.get('artist_name_ko','')})\nAlbum: {album['album_title']}\nCurrent Date: {album['release_date']}\nIs release date correct? If remaster, give original. Is this artist Korean?"
    sys = "You are K-pop/K-indie data expert. Return ONLY valid JSON: { \"verified\": bool, \"corrected_date\": \"YYYY-MM-DD\" or null, \"is_korean_artist\": bool, \"note\": \"...\" }"
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={env.get('GEMINI_API_KEY')}"
    data = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": sys + "\n\n" + prompt}]}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
    })
    
    req = urllib.request.Request(url, method='POST', headers={'Content-Type': 'application/json'}, data=data.encode())
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    with urllib.request.urlopen(req, context=ctx) as r:
        resp_data = json.loads(r.read().decode())
        res = resp_data['candidates'][0]['content']['parts'][0]['text'].strip()
        if res.startswith('```json'): res = res[7:]
        if res.endswith('```'): res = res[:-3]
        return json.loads(res.strip())

# ====== 메인 실행 루프 ======
print("🚀 안티그래비티 대규모 전수 검증 프로세스 시작...")
albums = get_unverified()
print(f"📦 남은 미검증 앨범: {len(albums)}건")
print("-" * 50)

success_count = 0
for i, a in enumerate(albums):
    try:
        res = check_llm(a)
        is_ko = res.get('is_korean_artist')
        date = res.get('corrected_date') if res.get('corrected_date') and not res.get('verified') else a['release_date']
        note = res.get('note', '')
        
        update_db(a['id'], date, is_ko, note)
        success_count += 1
        print(f"[{i+1}/{len(albums)}] ✅ {a['artist_name']} - 완료 (K-팝: {'🇰🇷' if k_ko else '🌍'})" if 'k_ko' in locals() else f"[{i+1}/{len(albums)}] ✅ {a['artist_name']} - 완료 (K-팝: {is_ko})")
        
        if (i+1) % 100 == 0:
            print(f"💤 100건 달성. API 과부하 방지 휴식 (3초)...")
            time.sleep(3)
            
    except Exception as e:
        print(f"[{i+1}/{len(albums)}] ❌ 에러 발생 ({a['artist_name']}): {e}")
    
    time.sleep(0.5) # 안전한 Rate Limit 방어

print("-" * 50)
print(f"🎉 전수 검증 완료! (총 {success_count}건 정제 성공)")
