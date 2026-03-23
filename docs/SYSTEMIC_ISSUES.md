# 🐛 K-Culture Universe — 시스테믹 데이터 품질 이슈

> 작성: 2026-03-24 | 상태: 일부 패치 완료, 전수조사 미완

---

## 분류 체계

| 코드 | 유형 | 심각도 |
|------|------|--------|
| `SI-1` | 한/영 이름 분열 (EN/KO Name Split) | 🔴 HIGH |
| `SI-2` | 번역명 분열 (Translation Split) | 🟠 MED |
| `SI-3` | 스펠링 오류 (Spelling Error) | 🟠 MED |
| `SI-4` | GROUP-크레딧 분열 (Edge Split) | 🔴 HIGH |
| `SI-5` | 동명이인 혼용 | 🟡 LOW |

---

## SI-1 — 한/영 이름 분열 (EN/KO Name Split)

**원인**: MusicBrainz는 영문명으로 등록. 국내 플레이리스트 CSV는 한글명으로 수집.  
→ 같은 아티스트가 두 개의 별개 노드로 등록되어 서로 관계 없는 타인 취급.

**패턴 예시:**
| 영문 노드 (MusicBrainz) | 한글 노드 (CSV) | 상태 |
|------------------------|----------------|------|
| `TAEYANG` (d84e5667) | `태양` (91ee77bb) | ✅ 2026-03-24 병합 |
| `Julia Hart` (a3f30765) | `Julia's Heart` (bdbd48f5) | ✅ 2026-03-24 병합 (+ SI-3) |
| `Autumn Vacation` (f4afb4d4) | `가을방학` | ✅ nameKo 이미 통합 |

**전수조사 필요 대상 탐지 쿼리:**
```python
# 같은 아티스트를 영문/한글 이중 등록 탐지
# 1. nameKo가 없는 영문 노드 중 한글 노드와 발음이 유사한 것
# 2. 동일 MusicBrainz mbid prefix를 공유하는 노드 쌍
# 3. 양쪽 노드가 공통 이웃을 3개 이상 가지는 경우
```

**전수조사 시 확인할 대표 패턴:**
- 빅뱅 멤버 (GD, TOP, 대성, 승리 등 — 영문 stage name + 한글명 이중 등록 가능성)
- 솔로 데뷔한 아이돌 멤버 전반
- 그룹명의 영문 번역 vs 한글 (예: 넬/Nell, 새소년/SE SO NEON 등 — V7.7.1에서 일부 처리)

---

## SI-2 — 번역명 분열 (Translation Split)

**원인**: 한국 밴드명을 영문으로 직역한 이름이 MusicBrainz에 등록될 경우,  
영문 번역명 노드와 한글 원명 노드가 공존.

**패턴 예시:**
| 한글 원명 | 영문 번역명 | 상태 |
|----------|------------|------|
| 가을방학 | Autumn Vacation | ✅ nameKo='가을방학'로 통합 완료 |
| (추가 사례 전수조사 필요) | | 🔲 미완 |

**탐지 힌트:**
- 노드 `name`이 한국어 의미를 직역한 영어일 경우 (예: Spring, Summer, Rain 등)
- `nameKo`가 비어 있는 영문 노드 전수 확인

---

## SI-3 — 스펠링 오류 (Spelling Error in Source Data)

**원인**: 크롤링/수집 소스의 오기(誤記)가 그대로 노드명으로 확정.  
수정하지 않으면 검색 실패, 연관관계 단절, 잘못된 데이터 영속화.

**확인된 오류:**
| 잘못된 이름 | 올바른 이름 | 발견 시점 | 상태 |
|------------|------------|-----------|------|
| `Julia's Heart` | `Julia Hart` (줄리아하트) | 2026-03-24 | ✅ 이름 교정 완료 |

> **참고**: "Julia's Heart"라는 밴드는 실존하지 않음. 아포스트로피(')가 포함된 스펠링 오류.  
> 수집 소스(MusicBrainz 또는 CSV)의 오기가 1년 이상 방치된 사례.

**탐지 방법:**
- 특수문자(`'`, `&`, `.`) 포함 노드명 전수 확인
- 팬덤/공식 표기와 다른 이름은 Google Knowledge Graph API로 교차검증

---

## SI-4 — GROUP-크레딧 엣지 분열 (Edge Split)

**원인**: SI-1/SI-3으로 인해 같은 밴드가 두 노드로 쪼개지면,  
- **멤버십(GROUP) 엣지** → 노드 A에 연결  
- **COMPOSER/FEATURED 크레딧 엣지** → 노드 B에 연결  

→ 둘 다 연결하는 허브(정바비 등)가 있어도, 관계 체인이 서로 다른 노드로 분산되어 끊김.

**정바비/가을방학/줄리아하트 케이스:**
```
Before:
  정바비 → Julia Hart (GROUP, w=0.2)       ← 유령 노드
  정바비 → Autumn Vacation (GROUP, w=0.2)
  Julia's Heart ← 크레딧 80개              ← 실제 활동 노드
  
  가을방학 ↔ 줄리아하트: 연결 없음 ❌

After (2026-03-24 패치):
  정바비 → Julia Hart (GROUP, 노드 통합)
  Julia Hart nameKo='줄리아하트', 크레딧 80개 흡수
  가을방학 ↔ 줄리아하트 SHARED_WRITER(0.7) ✅
```

**재발 방지 원칙:**
- 같은 아티스트에 GROUP 엣지와 크레딧 엣지가 모두 있으면 반드시 mbid를 확인
- GROUP 멤버십은 MusicBrainz mbid 기준, 크레딧은 실제 앨범 데이터 기준으로 수집되므로 불일치 발생 가능

---

## SI-6 — 그룹 멤버 간 직접 연결 누락 (Intra-Group Direct Edge Missing)

**원인**: 같은 그룹의 멤버들이 그룹 노드를 통한 2홉 경로는 존재하지만,  
멤버 ↔ 멤버 간 직접 엣지가 없어서 UI상 "관련 없음"으로 표시되는 문제.  
특히 솔로 활동이 있거나 같이 피처링/듀엣곡을 낸 멤버 사이에서 두드러짐.

**플레이리스트/크레딧 기반 수집의 한계**: 수집 파이프라인이 아티스트 ↔ 그룹 연결만 생성하고,  
멤버 ↔ 멤버 SAME_GROUP 엣지는 자동 생성되지 않음.

**확인된 사례:**
| 멤버 A | 멤버 B | 그룹 | 관계 근거 | 상태 |
|--------|--------|------|-----------|------|
| 태양 (TAEYANG) | G-DRAGON (지드래곤) | 빅뱅 | 같은 그룹 멤버 + 듀엣곡 발매 | 🔲 미수정 |
| (빅뱅 전체 멤버간 교차 엣지) | | 빅뱅 | SAME_GROUP | 🔲 전수조사 필요 |

**전수조사 필요 그룹 (멤버 간 교차 엣지 미비 가능성 높음):**
- 빅뱅 (GD, 태양, TOP, 대성, 승리 — 솔로 활동 모두 있음)
- BTS (전 멤버 솔로 활동/피처링 다수)
- EXO / 엑소-K / 엑소-M
- 2NE1
- HIGHLIGHT (비스트)

**근본 해결 방안:**
```python
# 같은 그룹 소속 멤버들 간 자동으로 SAME_GROUP 엣지 생성
for group_node in get_group_nodes():
    members = get_members(group_node)  # MEMBER/SAME_GROUP 역방향
    for i, a in enumerate(members):
        for b in members[i+1:]:
            add_edge(a, b, 'SAME_GROUP', 1.0)
```

---

## SI-5 — 동명이인 혼용

**원인**: 같은 이름을 가진 다른 아티스트가 하나의 노드로 합쳐지는 반대 패턴.

**탐지 필요 사례:**
- 영어권 동명이인 (예: `Julia Hart` — 캐나다 팝 싱어와 한국 밴드 동명)
- 한국 동명이인 솔로이스트

---

## 전수조사 계획 (TODO)

### Phase 1 — 자동 탐지 스크립트 작성
```bash
# 목표: organic-graph.json에서 잠재적 중복 쌍 자동 출력
python3 scripts/detect-duplicate-nodes.py
```

탐지 기준:
1. `nameKo`가 없는 노드 + 동일한 한글 발음의 노드가 별개 존재
2. 공통 이웃 노드 3개 이상인 노드 쌍 (실질적 동일인 가능성)
3. 특수문자/번역 패턴 스펠링 오류 후보

### Phase 2 — 수동 확인 & 병합
- 탐지된 후보를 `docs/DUPLICATE_CANDIDATES.md`에 기록
- 각 쌍을 MusicBrainz, Melon, Bugs 교차검증 후 병합 여부 결정

### Phase 3 — 파이프라인 개선
- `v6.4-batch-ingest-csvs.ts`에 수집 시 alias 매핑 적용
- 수집 전 기존 노드와 이름 유사도(levenshtein + 한글 romanization) 비교
- `artist-aliases.json` 명시적 alias 파일 관리

---

## 관련 패치 이력

| 일시 | 패치 | 관련 이슈 |
|------|------|----------|
| 2026-03-24 | V7.7.1 — 중복 노드 26건 병합 | SI-1 |
| 2026-03-24 | TAEYANG/태양 병합 | SI-1 |
| 2026-03-24 | Julia Hart/Julia's Heart 병합 + 이름 교정 | SI-1, SI-3, SI-4 |
| 2026-03-24 | 가을방학 ↔ 줄리아하트 SHARED_WRITER 연결 | SI-4 |
