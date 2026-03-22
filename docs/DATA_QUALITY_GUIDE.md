# 📐 K-Culture Universe — 데이터 품질 가이드

> 이 문서는 아티스트 데이터를 추가, 수정, 수집할 때 **반드시 확인해야 할** 규칙과
> 과거에 발생한 실수를 정리합니다. **새로운 스크립트를 작성하기 전에** 이 문서를 먼저 읽으세요.

---

## 🔴 규칙 1: 콜라보레이션 아티스트는 노드가 아니다

### 문제 정의

Spotify CSV 내보내기에서 `Artist Name(s)` 필드는 콜라보 곡을 **세미콜론(;)**으로
연결된 하나의 문자열로 표기합니다:

```
Crush;태연
10CM;이수현
JUNE;10CM;B.I
김경호;김종서;윤도현;박완규;Jeong Hongil;윤성기;Kwak dong hyun
```

**이들은 하나의 아티스트가 아닙니다.** 각각 개별 아티스트가 정식 협업한 곡입니다.

### ❌ 절대 하지 말 것

```python
# ❌ WRONG: 세미콜론이 포함된 이름을 하나의 노드로 추가
add_node("Crush;태연")
add_node("10CM;이수현")
```

### ✅ 올바른 처리 방법

```python
# ✅ CORRECT: 세미콜론으로 분리 → 개별 노드 + FEATURED 엣지
artist_name = "Crush;태연"
parts = artist_name.split(";")
# → ["Crush", "태연"]

for artist in parts:
    if not node_exists(artist):
        add_node(artist)  # 개별 노드 생성

# 모든 쌍에 대해 FEATURED 엣지 생성
add_edge("Crush", "태연", relation="FEATURED", weight=0.7,
         label="정식 협업 음원 발매")
```

### 5명 이상 콜라보 처리

5명 이상 참여한 콜라보는 모든 쌍에 엣지를 생성하면 N(N-1)/2로 폭발합니다.
**Star topology**를 사용합니다:

```python
parts = "김경호;김종서;윤도현;박완규;...".split(";")
hub = parts[0]  # 첫 번째 아티스트를 허브로
for other in parts[1:]:
    add_edge(hub, other, relation="FEATURED", weight=0.5)
```

### 검증 방법

```bash
# 우주에 세미콜론 노드가 있는지 확인
python3 -c "
import json
with open('public/data/v5-layout.json') as f:
    nodes = json.load(f)['nodes']
bad = [n for n in nodes if ';' in n['name']]
print(f'콜라보 노드: {len(bad)}건')
for b in bad[:10]: print(f'  ❌ {b[\"name\"]}')
"
# 결과가 0건이어야 정상!
```

### 역사적 참고

- **V6.9 이전**: 이 규칙이 없어서 85건의 콜라보 노드가 생성됨
- **V7.0.3**: Phase 1에서 전수 수정 예정

---

## 🟡 규칙 2: 한글/영어 이름 — 주 표기 방식 통합

### 필수 필드

모든 아티스트 노드는 반드시 **두 개의 이름 필드**를 가져야 합니다:

| 필드 | 용도 | 예시 |
|------|------|------|
| `name` | 영문 공식명 (또는 영문 주 표기) | `IU`, `BTS`, `JANNABI` |
| `nameKo` | 한글 공식명 (또는 한글 주 표기) | `아이유`, `방탄소년단`, `잔나비` |

### 주 표기 방식 결정 로직

```
1. 아티스트의 공식 활동명이 한글인가?
   → YES: 한글이 주 표기
     name="IU", nameKo="아이유"        ← 검색/표시 시 "아이유" 우선
     name="JANNABI", nameKo="잔나비"   ← 검색/표시 시 "잔나비" 우선

   → NO (영문이 공식명):
     name="BTS", nameKo="방탄소년단"   ← 검색/표시 시 "BTS" 우선
     name="ITZY", nameKo="있지"
     name="10CM", nameKo="십센치" 또는 "10CM"

2. 판단 기준 (우선순위):
   ① 한국어 위키백과/나무위키의 대표 표기
   ② MusicBrainz 공식 아티스트명
   ③ 앨범 커버/크레딧 표기
   ④ Spotify 표기 (낮은 우선순위)
```

### ❌ 절대 하지 말 것

```python
# ❌ WRONG: nameKo를 비워두거나 영문과 동일하게 설정
add_node(name="BTS", nameKo="BTS")     # nameKo가 영문과 같음
add_node(name="아이유", nameKo="")      # nameKo 누락
add_node(name="IU")                     # nameKo 필드 자체가 없음
```

### ✅ 올바른 처리 방법

```python
# ✅ CORRECT
add_node(name="IU", nameKo="아이유")
add_node(name="BTS", nameKo="방탄소년단")
add_node(name="잔나비", nameKo="잔나비")  # 한글이 공식명이면 name에도 한글 가능
```

### 검색 양방향 지원

`FloatingSearch`의 `ALIAS_MAP`에 양방향 매핑을 등록합니다:

```typescript
ALIAS_MAP = {
  "bts": "방탄소년단의_node_id",
  "방탄소년단": "방탄소년단의_node_id",
  "itzy": "있지의_node_id",
  "있지": "있지의_node_id",
  "십센치": "10CM의_node_id",
}
```

### 역사적 참고

- **V6.9**: 427명의 아티스트가 영문만 설정된 채 존재
- **V7.0.3**: Phase 1에서 한글명 보강 예정

---

## 🟠 규칙 3: 발매일 데이터 — Spotify를 믿지 마라

### 문제

Spotify API의 `release_date`는 **재발매/리마스터링 날짜**를 원본 발매일로
덮어써버리는 경우가 매우 많습니다.

```
예: 이문세 - 난 아직 모르잖아요 (원본 1985년)
  → Spotify: release_date = "2020-01-15" (리마스터 발매일) ❌
  → MusicBrainz: first-release-date = "1985-03-22" ✅
```

### 신뢰 순서

| 순위 | 출처 | 신뢰도 |
|------|------|--------|
| 1 | MusicBrainz `first-release-date` | ⭐⭐⭐ 높음 |
| 2 | 나무위키 / 한국어 위키백과 | ⭐⭐⭐ 높음 |
| 3 | 영문 위키백과 | ⭐⭐ 중간 |
| 4 | GPT/LLM 교차 검증 | ⭐⭐ 중간 |
| 5 | Spotify API | ⭐ **낮음** (주의!) |

### ❌ 절대 하지 말 것

```python
# ❌ WRONG: Spotify 발매일을 그대로 사용
release_date = spotify_track["album"]["release_date"]  # 리마스터 날짜일 수 있음!
```

### ✅ 올바른 처리 방법

```python
# ✅ CORRECT: MusicBrainz first-release-date 우선 사용
mb_release = get_mb_release_group(mbid)
release_date = mb_release["first-release-date"]  # 원본 발매일

# 추가 검증이 필요하면 GPT-5 Nano로 나무위키/위키 교차 확인
```

---

## 🔵 규칙 4: 아티스트 추가 시 체크리스트

새 아티스트를 우주에 추가할 때 반드시 확인해야 할 사항:

- [ ] **이름에 세미콜론(;)이 있는가?** → 있으면 콜라보, 분리 필요! (규칙 1)
- [ ] **name과 nameKo 모두 설정했는가?** → 빈 값 없이 양쪽 다 (규칙 2)
- [ ] **이미 우주에 존재하는 아티스트인가?** → 중복 노드 생성 방지
  - `name.toLowerCase()` AND `nameKo.toLowerCase()` 양쪽으로 확인
- [ ] **발매일 데이터 출처는?** → Spotify가 아닌 MusicBrainz 사용 (규칙 3)
- [ ] **한국 아티스트인가?** → 외국 아티스트는 편입 대상이 아님 (K-Culture 전용)

---

## 📊 과거 발생한 문제 이력

| 시점 | 문제 | 규모 | 원인 |
|------|------|------|------|
| V6.4 | CSV에서 콜라보 아티스트를 분리하지 않고 단일 노드로 추가 | 85건 | 규칙 1 미구현 |
| V6.5 | 한글 이름 없이 영문만 등록 | 427명 | 규칙 2 미구현 |
| V6.9 | CSV 18개 대량 편입 시 콜라보 검증 누락 | 추가 확인 필요 | 자동화에 검증 로직 부재 |

---

## 🛠 자동 검증 스크립트

향후 모든 편입 스크립트는 아래 유틸리티 함수를 반드시 사용합니다:

```python
def validate_artist_name(name: str) -> tuple[bool, str]:
    """아티스트 이름 유효성 검증. (valid, message) 반환."""
    if ';' in name:
        return False, f"콜라보 노드 오류: '{name}' → 세미콜론 분리 필요"
    if not name.strip():
        return False, "빈 이름"
    return True, "OK"

def split_collab_artists(name: str) -> list[str]:
    """세미콜론으로 구분된 콜라보 아티스트를 개별로 분리."""
    return [a.strip() for a in name.split(';') if a.strip()]
```

```typescript
/** 아티스트 이름에 세미콜론이 있으면 콜라보 → 분리 필요 */
function isCollabName(name: string): boolean {
  return name.includes(';');
}

/** 콜라보 이름을 개별 아티스트로 분리 */
function splitCollabName(name: string): string[] {
  return name.split(';').map(s => s.trim()).filter(Boolean);
}
```
