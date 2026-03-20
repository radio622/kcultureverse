# 🌌 K-Culture Universe

> K-culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 우주 지도

**[frompangyo.vercel.app](https://frompangyo.vercel.app)** — 바로 우주로 이동

---

## 개요

BTS, BLACKPINK, NewJeans 등 **372명의 K-culture 아티스트**와 그들의 협업·피처링·작곡·프로듀서 관계를 별자리 우주로 시각화합니다.

- 노드 클릭 → 해당 아티스트 Fly-To + 1촌(직접 연결) 목록 표시
- 1촌 목록 탭 → 해당 아티스트로 워프
- 우클릭 두 노드 → 두 아티스트 간 최단 경로 탐색
- 전체 보기 (⊞), 색상 범례

---

## 아키텍처 (V5.3)

### 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **Zero Runtime Physics** | 모든 노드 좌표는 빌드 타임에 d3-force로 계산. 브라우저에서 물리엔진 완전 OFF |
| **3분할 데이터 로딩** | layout(42KB) 즉시 → edges(73KB) 백그라운드 → details(71KB) 후속 |
| **LOD 3단계 렌더링** | Far(점) / Mid(원+이름) / Close(사진+정보) |
| **BFS 포커스** | 클릭 시 1촌/2촌 BFS, Hairball 방지(top 15 엣지만) |
| **MusicBrainz 우선** | Spotify API 403 제한 → MusicBrainz 오픈 DB로 크레딧 수집 |

### 그래프 데이터

```
public/data/
  v5-layout.json    — 좌표 + tier (42KB, 즉시 로드)
  v5-edges.json     — 관계 엣지 (73KB, 백그라운드)
  v5-details.json   — 이미지/장르/미리듣기 (71KB, 후속)
  hub/              — 허브 아티스트별 위성 데이터 (62개 JSON)
  releases/         — 앨범 발매일 데이터 (MusicBrainz)
```

### 엣지 관계 유형

| 색상 | 관계 | 설명 |
|------|------|------|
| 🟢 `#86efac` | SAME_GROUP | 같은 그룹 멤버 |
| 🟣 `#c084fc` | FEATURED | 피처링 (최소 1곡) |
| 🔵 `#60a5fa` | PRODUCER | 프로듀서 (2곡+) |
| 🟡 `#fbbf24` | WRITER | 작곡·작사 (2곡+) |
| ⚪ | GENRE_OVERLAP | 장르 유사도 기반 간접 연결 |

### 노드 계층 (Tier)

| Tier | 설명 | 현재 수 |
|------|------|---------|
| 0 (Hub) | 메인 등록 아티스트 | 62명 |
| 1 (Direct) | SAME_GROUP / PRODUCER 직접 연결 | 160명 |
| 2 (Indirect) | MusicBrainz 크레딧 2촌 | 150명 |

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 렌더러 | react-force-graph-2d (Canvas) |
| 레이아웃 계산 | d3-force (빌드 타임 오프라인) |
| 데이터 소스 | MusicBrainz API + Spotify API + iTunes API |
| 스타일 | Vanilla CSS (Tailwind 없음) |
| 배포 | Vercel |
| 언어 | TypeScript |

---

## 개발 환경 설정

```bash
# 클론
git clone git@github.com:radio622/kcultureverse.git
cd kcultureverse

# 패키지 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET 입력

# 개발 서버
npm run dev
# → http://localhost:3000 (자동으로 /universe 이동)
```

---

## 스크립트 (데이터 파이프라인)

```bash
# 1. WRITER/PRODUCER 전곡 크레딧 크롤링 (MusicBrainz, ~3시간)
npm run v5:crawl-writers

# 2. 앨범 발매일 수집 (MusicBrainz, ~18분)
npm run v5:prebake-disco

# 3. 그래프 빌드 (위 두 작업 완료 후)
npm run v5:build

# 위 세 가지 순차 실행 (한 번에)
npm run v5:full-gap-fix

# 피처링/간접 크레딧 크롤링 (선택)
npm run v5:crawl-credits

# 허브 아티스트 CosmosData prebake
npm run prebake

# 아티스트 추가
npm run add-artist
```

---

## 아티스트 추가 방법

`src/data/hub-artists.ts`에 아티스트 정보 추가 후:

```bash
npm run prebake        # hub JSON 생성
npm run v5:build       # 그래프 재빌드
```

---

## 환경변수

```env
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

> Spotify API는 Client Credentials Flow만 사용 (사용자 인증 불필요).
> **클라이언트에 절대 노출되지 않음** (서버/빌드 스크립트 전용).

---

## 라이선스

Private — K-Culture Universe Team
