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

## 🟡 규칙 2: 한글/영어 이름 — 표시, 검색, 별칭

### 이름의 3계층 구조

검색은 **세 가지 소스**를 합쳐서 동작합니다:

```typescript
searchTokens = [name, nameKo, ...ALIAS_MAP[name/nameKo]]
```

| 계층 | 필드 | 역할 | 예시 (BTS) |
|------|------|------|-----------|
| **1. `name`** | 영문 공식명 | 노드 ID, 영문 검색 | `"BTS"` |
| **2. `nameKo`** | 한글 공식명 | **화면 메인 표시** + 한글 검색 | `"방탄소년단"` |
| **3. `ALIAS_MAP`** | 추가 별칭 | 약칭/외래어/본명 등 **검색만** 가능 | `["방탄", "비티에스"]` |

### 화면 표시 로직 (코드 전체에서 일관)

```typescript
const displayName = node.nameKo || node.name;
// → nameKo가 있으면 한글이 메인 / 없으면 영문이 메인
```

**에러는 나지 않습니다.** `nameKo`가 없으면 `name`으로 조용히 fallback.

### ⭐ BTS 케이스 완전 정리

BTS는 "BTS"가 메인이지만, "방탄소년단", "방탄"으로도 검색되어야 합니다.

**현재 설정:**
```
name = "BTS" (또는 MusicBrainz에서 온 영문명)
nameKo = "방탄소년단"
ALIAS_MAP["BTS"] = ["방탄소년단", "방탄"]
```

**결과:**
| 동작 | 결과 |
|------|------|
| 화면 표시 | **방탄소년단** (`nameKo \|\| name` → nameKo 존재하므로 한글 표시) |
| "BTS" 검색 | ✅ (name에서 매칭) |
| "방탄소년단" 검색 | ✅ (nameKo + ALIAS_MAP 모두에서 매칭) |
| "방탄" 검색 | ✅ (ALIAS_MAP에서 매칭) |
| "비티에스" 검색 | ❌ (아직 ALIAS_MAP에 미등록) |

> **⚠️ 주의**: 이 경우 화면에는 "방탄소년단"이 표시됩니다!
> **"BTS"를 메인으로 표시하고 싶다면**, `nameKo`를 비우고 ALIAS_MAP에만 한글을 넣어야 합니다.
> 하지만 이것은 "더 많이 쓰이는 이름"과 "공식명" 사이의 트레이드오프입니다.

### 메인 표시명 제어 전략

| 원하는 메인 표시 | 설정 방법 | 검색 보장 |
|----------------|----------|----------|
| **한글 메인** (아이유) | `name="IU"`, `nameKo="아이유"` | IU ✅ 아이유 ✅ |
| **영문 메인** (BTS) | `name="BTS"`, `nameKo=""`, ALIAS_MAP에 한글 등록 | BTS ✅ 방탄소년단 ✅ |
| **한글이 공식명** (잔나비) | `name="JANNABI"`, `nameKo="잔나비"` | 잔나비 ✅ JANNABI ✅ |

### ALIAS_MAP이 핵심인 이유

`name`과 `nameKo` 2개 필드만으로는 표현 불가능한 **검색용 별칭**들:

```typescript
// FloatingSearch.tsx ALIAS_MAP 예시
"BTS": ["방탄소년단", "방탄"],        // 영문 메인 + 한글 검색
"아이유": ["IU", "이지은"],           // 한글 메인 + 영문/본명 검색
"SUGA": ["민윤기", "슈가", "Agust D"], // 영문 메인 + 본명/닉네임 검색
"검정치마": ["The Black Skirts", "black skirt", "조휴일"],  // 한글 메인 + 영문/본명
```

**ALIAS_MAP에 등록된 값은 검색에만 쓰이고, 화면에 표시되지 않습니다.**

### 실전 결정 플로차트

```
Q: 이 아티스트의 "가장 널리 쓰이는 이름"이 한글인가 영문인가?

A: 한글이 더 널리 쓰임 (예: 아이유, 잔나비, 검정치마)
   → nameKo = 한글 공식명 (화면 메인)
   → name = 영문명
   → ALIAS_MAP에 추가 별칭 (본명, 약칭 등)

A: 영문이 더 널리 쓰임 (예: BTS, ITZY, aespa)
   → name = 영문 공식명
   → nameKo = "" (비움) ← 이래야 영문이 화면 메인!
   → ALIAS_MAP[영문명] = ["한글명", "약칭", ...] ← 한글 검색은 여기서 보장

A: 한글과 영문이 대등 (예: 방탄소년단/BTS)
   → 팀 판단. 현재 BTS는 nameKo="방탄소년단"으로 되어있어 화면에 "방탄소년단" 표시 중
   → 영문 메인으로 바꾸고 싶다면 nameKo를 비우고 ALIAS_MAP으로 이동
```

### 자동 판정: MusicBrainz Aliases 기반 (V7.0.4)

메인 표시명을 **LLM 없이** MusicBrainz aliases 데이터로 자동 결정합니다:

```
MB aliases API → { primary: "BTS", aliases: [{ name: "방탄소년단", locale: "ko" }] }

판정 로직:
  1. MB primary가 영문 + ko locale 별칭 존재
     → 영문 메인 (nameKo 비움), 한글은 ALIAS_MAP으로
     예) BTS → 화면: "BTS", 검색: "방탄소년단" ✅

  2. MB primary가 한글
     → 한글 메인 (nameKo에 설정)
     예) 아이유 → 화면: "아이유", 검색: "IU" ✅

  3. MB 정보 없음 → 이름에 한글 포함 여부로 판정 (regex)
```

비용: **$0** (LLM 불필요)

### ALIAS_MAP 병합 전략 (V7.0.4)

> ⚠️ **절대 덮어쓰지 않는다!** 기존 수동 데이터를 보존하고 MB 데이터를 **병합(merge)**.

```
기존 수동 ALIAS_MAP (110쌍, 닉네임 포함):
  "BTS": ["방탄소년단", "방탄"]        ← "방탄"은 MB에 없음! 보존 필수!
  "SUGA": ["민윤기", "슈가", "Agust D"] ← 닉네임은 MB에 없음! 보존 필수!

+ MB aliases 자동 추출분 (~400쌍):
  "DAY6": ["데이식스"]                  ← MB에서 새로 추출
  "Crush": ["크러쉬"]

= 최종 병합 결과 (~500쌍+):
  기존 수동 유지 + MB 추가분 append
```

### 역사적 참고

- **V6.9**: 427명의 아티스트가 영문만 설정, ALIAS_MAP 미등록 → 한글 검색 불가
- **V7.0.4**: Phase 1에서 MB aliases 자동 판정 + ALIAS_MAP 병합 예정
- **ALIAS_MAP 현재:** ~110쌍 수동 등록 (FloatingSearch.tsx 14~124줄)

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
