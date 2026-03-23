# 🩹 V7.7.1 Data Quality Patch

> 2026-03-24 | organic-graph.json 4대 품질 개선

---

## 문제 배경

V6.4 `batch-ingest-csvs.ts`에서 플레이리스트 CSV 일괄 수집 시, 동일 플레이리스트에 포함된 아티스트를 `GENRE_OVERLAP weight 0.5~0.6`으로 연결하던 설계적 결함이 있었음.

- **SAME_GROUP(1.0)**, **FEATURED/PRODUCER(0.7)** 수준의 강관계와 거의 동등하게 취급되어, '같은 KBS 모음집에 실렸을 뿐'인 아티스트들이 1촌 핵심 이웃으로 표시
- 전류 애니메이션(Dijkstra), 자율주행(Roulette Wheel), 라디오 큐 등 weight 의존 기능에 왜곡 발생
- 4,214개 엣지가 이 영향을 받은 역대 최대 규모 데이터 품질 이슈

---

## 수정 내역

### PATCH 1 — GENRE_OVERLAP weight 0.5/0.6 → 0.1 📉

| 항목 | Before | After |
|------|--------|-------|
| 플레이리스트 앵커 (기존 노드) | `weight: 0.5` | `weight: 0.1` |
| 플레이리스트 기원 (신규 노드) | `weight: 0.6` | `weight: 0.1` |
| 장르 유사도 엣지 | `0.05~0.15` | `0.05~0.15` (변경 없음) |
| **총 변경 엣지** | — | **4,214개** |

**근거**: 동일 플레이리스트 출현은 간접적 장르 유사성이지, 직접 협업(FEATURED 0.7)이나 그룹 멤버십(SAME_GROUP 1.0)과 동등한 관계가 아님.

### PATCH 2 — 중복 노드 병합 🔗

| 항목 | 수치 |
|------|------|
| 중복 그룹 | 26개 (한/영 이중 등록) |
| 노드 삭제 | 26개 |
| 엣지 리매핑 | 167개 |
| 중복 엣지 제거 | 6개 |

대표 사례: `넬` + `Nell`, `새소년` + `SE SO NEON`, `실리카겔` + `Silica Gel` 등

### PATCH 3 — 콜라보 노드(;) 분해 💥

| 항목 | 수치 |
|------|------|
| 분해 대상 | 39개 콜라보 노드 |
| 신규 FEATURED 엣지 | 185개 |

세미콜론(`;`)으로 연결된 복합 아티스트 노드(예: `DEAN;개코`, `에픽하이;이하이`)를 개별 아티스트로 분해하고 FEATURED 엣지로 재연결.

### PATCH 4 — previewUrl 동명이곡 오염 정리 🧹

| 항목 | 수치 |
|------|------|
| 오염 제거 | 76개 노드 |

아티스트 이름과 trackName이 동일한 경우(동명이곡 오인) previewUrl을 null로 정리.

---

## 적용 범위

### 소스 코드 수정 (향후 재수집 시에도 적용)

| 파일 | 변경 |
|------|------|
| `scripts/v6.4-batch-ingest-csvs.ts` | `weight: 0.5` → `0.1`, `weight: 0.6` → `0.1` |
| `scripts/v5.4-build-universe.ts` | `mapRelation`에 GENRE_OVERLAP 보존 추가, `autoLabel`에 "장르 유사" 라벨 추가 |

### 데이터 패치 (기존 데이터 일회성 수정)

| 파일 | 역할 |
|------|------|
| `scripts/v7.7.1-data-patch.py` | organic-graph.json 직접 패치 (4 patches) |

### 빌드 산출물 재생성

```
public/data/v5-layout.json  — 449KB
public/data/v5-edges.json   — 1,111KB
public/data/v5-details.json — 1,015KB
```

---

## 전후 비교

| 지표 | Before | After | 변화 |
|------|--------|-------|------|
| 노드 수 | 3,924 | 3,859 | −65 (−1.7%) |
| 엣지 수 | 8,636 | 8,674 | +38 (+0.4%) |
| K-Culture 빌드 노드 | 3,599 | 3,576 | −23 |
| K-Culture 빌드 엣지 | 7,114 | 7,129 | +15 |
| GENRE_OVERLAP 최대 weight | 0.6 | 0.1 | −83% |

---

## 실행 가이드

```bash
# 1. 패치 실행 (백업 자동 생성)
python3 scripts/v7.7.1-data-patch.py

# 2. 우주 재빌드
npx tsx scripts/v5.4-build-universe.ts

# 3. 로컬 확인
npm run dev
```
