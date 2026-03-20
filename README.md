# 🌌 K-Culture Universe Map

> K-Culture(음악, 드라마, 예술)를 구성하는 아티스트들의 **관계 우주**를 시각적으로 탐험하는 인터랙티브 웹 앱.

---

## ✨ 핵심 비전

사이트에 접속하면, 아티스트를 중심으로 **관계 깊이에 따라 근처에 배치된** 위성 아티스트들이 은하수처럼 흩어져 있습니다.

- **가까운 별**은 이름과 이미지가 선명하게 보이고, **먼 별**은 안개에 가려 뿌옇게 보입니다.
- 화면을 **드래그**하면 카메라가 이동하면서 다가가는 별들이 안개를 벗고 서서히 드러납니다 (Dynamic Fog).
- **심우주(Deep Space)**: 다른 허브 아티스트들이 크레딧 기반 Force-Directed 레이아웃으로 배치됩니다. 많이 협업한 아티스트끼리 가까이 모입니다.
- 아티스트를 **클릭**하면 즉시 음악이 흘러나오고 관련 아티스트 카드가 나타납니다.
- 카드의 **\"이 아티스트의 우주로 →\"** 버튼으로 새로운 우주로 다이브할 수 있습니다.

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **프레임워크** | Next.js 16 (App Router, Turbopack) |
| **언어** | TypeScript |
| **스타일링** | Vanilla CSS + CSS Variables |
| **애니메이션** | Framer Motion + CSS @keyframes + rAF (60fps) |
| **2.5D 효과** | CSS `perspective` + `translateZ` + Dynamic Fog (rAF 실시간) |
| **데이터** | Pre-baked JSON (런타임 외부 API 0회) |
| **배포** | Vercel |

---

## 📂 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    ← 홈 (즉시 우주 진입, API 0회)
│   ├── from/[id]/page.tsx          ← 아티스트 우주 (pre-baked 우선)
│   ├── admin/page.tsx              ← Admin 관리 도구 (로컬 전용)
│   ├── not-found.tsx               ← 커스텀 404
│   ├── error.tsx                   ← 전역 에러 페이지
│   └── api/
│       ├── admin/add-artist/       ← 아티스트 추가 API
│       ├── admin/rebuild-universe/ ← Universe Rebuild API (로컬 전용)
│       ├── cosmos/[id]/            ← 위성 데이터 (캐시 헤더)
│       └── spotify/                ← 검색/미리듣기
├── components/
│   ├── Cosmos.tsx                  ← 2.5D 우주 시각화 (Dynamic Fog + Pan + Torus)
│   ├── CosmosClient.tsx            ← 클라이언트 오케스트레이터
│   ├── CosmosNode.tsx              ← 개별 별 노드 (self-healing 이미지 fetch)
│   ├── BottomSheet.tsx             ← 3단계 바텀시트
│   ├── ResonanceDeck.tsx           ← 가로 스크롤 캐러셀
│   ├── ArtistCard.tsx              ← 아티스트 카드 (self-healing 이미지 fetch)
│   ├── MiniPlayer.tsx              ← 미니 플레이어
│   ├── FloatingSearch.tsx          ← 플로팅 검색
│   ├── BackButton.tsx              ← 히스토리 인식 뒤로가기
│   └── ErrorBoundary.tsx           ← React 에러 경계
├── data/
│   └── hub-artists.ts              ← 허브 아티스트 마스터 목록 (38명)
└── lib/
    ├── spotify.ts                  ← Spotify 검색 + iTunes 미리듣기 fallback
    ├── musicbrainz.ts              ← MusicBrainz v2: 앨범 크레딧 + 발매일 연표
    ├── genius.ts                   ← Genius API (현재 비활성화 — Vercel IP 차단)
    ├── deep-space.ts               ← 심우주 노드 생성 (graph.json 좌표 활용)
    ├── graph.ts                    ← UniverseGraph 타입 + 크레딧 기반 edge weight
    └── types.ts                    ← CosmosArtist, SatelliteNode, AlbumRelease 등

scripts/                            ← ⚠️ 로컬 전용 (Pre-bake 파이프라인)
├── prebake.ts                      ← 허브 아티스트 전체 Pre-bake
├── add-artist.ts                   ← CLI 아티스트 추가
├── ingest-playlist.ts              ← Spotify 플레이리스트 일괄 입력
├── build-graph.ts                  ← hub JSON → graph.json (크레딧 edge weight)
└── compute-layout.ts               ← Torus Force-Directed 레이아웃 계산

public/data/
├── hub/{spotifyId}.json            ← Pre-baked 우주 데이터 (위성 + 크레딧)
├── releases/{spotifyId}.json       ← 앨범 발매일 연표 (Admin LLM 팩트체크 대비)
├── graph.json                      ← 관계 그래프 + Force-Directed 좌표
└── search-index.json               ← 로컬 검색 인덱스
```

---

## 🚀 시작하기

### 1. 설치
```bash
npm install
```

### 2. 환경변수 설정 (.env.local)
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
# GENIUS_ACCESS_TOKEN은 현재 비활성화 상태 (Vercel 서버 IP 차단 확정)
```

> **Spotify API 현황 (2026년 3월):** Development Mode에서 `top-tracks`, `related-artists` 등 관계 데이터 엔드포인트가 403으로 차단됨. 현재 코드는 Spotify를 아티스트 **검색 전용**으로만 사용하며, 크레딧/관계 데이터는 **MusicBrainz**에서, 이미지/미리듣기는 **iTunes**에서 가져옵니다.

### 3. 개발 서버
```bash
npm run dev
```
→ `http://localhost:3000` 에서 확인

---

## 🗺 데이터 파이프라인 (운영 가이드)

### ⚠️ 핵심 원칙
**모든 `scripts/` 실행은 로컬에서만 합니다.**
Vercel 서버는 파일시스템 쓰기 불가 + 60초 타임아웃 제한.
데이터를 수집/갱신한 후 `git push`하면 Vercel이 새 JSON으로 자동 배포합니다.

---

### 아티스트 추가 (단건)

```bash
npm run add-artist -- "아티스트이름" "SpotifyID" "한글이름"

# 예시
npm run add-artist -- "Nell" "3WbKkfwmDLgVwR9ExchFVC" "넬"
```

완료 후 반드시 실행:
```bash
npm run universe:rebuild
git add -A && git commit -m "🎵 아티스트 추가: 넬" && git push origin main
```

---

### Spotify 플레이리스트로 아티스트 일괄 추가

```bash
npx tsx scripts/ingest-playlist.ts "https://open.spotify.com/playlist/..."
```

- Spotify API로 트랙 목록 추출 → iTunes에서 메타데이터 수집 (3초 딜레이)
- 완료 후 `npm run universe:rebuild` && `git push` 필요

---

### 전체 데이터 갱신 (Universe Rebuild)

아티스트 추가/수정 후 관계도와 레이아웃을 재계산합니다.

**방법 1 — CLI (권장):**
```bash
npm run universe:rebuild
```

**방법 2 — Admin 페이지 (GUI):**
```
http://localhost:3000/admin
```
→ "Universe Rebuild 실행" 버튼 클릭 (build-graph → compute-layout 자동 순차 실행)

**Universe Rebuild 파이프라인 내부:**
```
Step 1: build-graph.ts
  hub/*.json 읽기
  → 위성별 크레딧 참여 곡 수 기반 edge weight 계산
    (1곡=0.25, 5곡=0.45, 10곡=0.70, 15곡+=0.90)
  → 허브 간 장르 코사인 유사도 edge 추가
  → graph.json 저장

Step 2: compute-layout.ts
  graph.json 읽기
  → Torus-aware Force-Directed 시뮬레이션 (300회 반복)
    연결된 노드끼리 인력, 모든 노드 간 척력
    관계 깊은 아티스트끼리 자동으로 가깝게 배치
  → x,y 좌표를 graph.json에 저장
```

완료 후:
```bash
git add -A && git commit -m "🌌 universe rebuild" && git push origin main
```

---

### MusicBrainz 전체 앨범 크레딧 수집 (Pre-bake)

```bash
npm run prebake
```

**내부 동작 (아티스트 1명 기준, 약 3분 소요):**
```
① MusicBrainz MBID 검색 (1 call)
② Release Group 목록 (앨범/EP/싱글) 수집
   → first-release-date(최초 발매일) 추출
   → public/data/releases/{id}.json 저장 (발매일 연표)
③ 각 앨범의 트랙별 Recording 크레딧 수집
   - Recording 레벨: 프로듀서, 편곡, 피처링
   - Work 레벨: ★ 작곡(composer), ★ 작사(lyricist)
④ 아티스트별 참여 곡 수 집계 → creditCount 저장
⑤ iTunes API로 이미지 + 미리듣기 URL 부착 (3초 딜레이)
⑥ public/data/hub/{id}.json 저장
```

> **MusicBrainz Rate Limit:** 1 req/s 강제 준수. 위반 시 IP 503 차단.

---

### 앨범 발매일 팩트체크 (Admin LLM 연동 준비)

발매일 데이터는 `public/data/releases/{spotifyId}.json`에 별도 저장됩니다.
우주 데이터(`hub/*.json`, `graph.json`)와 완전히 분리되어 있어 LLM이 수정해도 우주가 깨지지 않습니다.

```json
{
  "spotifyId": "...",
  "name": "BLACKPINK",
  "albums": [
    {
      "title": "THE ALBUM",
      "releaseDate": "2020-10-02",
      "type": "Album",
      "source": "musicbrainz",
      "verifyStatus": "auto"
    }
  ]
}
```

`verifyStatus` 값:
- `"auto"` — MusicBrainz에서 자동 수집한 상태
- `"verified"` — Admin/LLM이 외부 출처(나무위키 등)와 교차 확인 완료
- `"corrected"` — Admin/LLM이 날짜를 수정한 상태 (수정 전 날짜는 `originalDate`에 보존)

---

## 🏗 아키텍처 원칙

### 방어적 데이터 전략 (Closed Universe)

```
Pre-bake 파이프라인 (로컬, 오프라인):
  MusicBrainz → 관계 크레딧 (작곡/작사/프로듀서/피처링)
  iTunes Search → 이미지 + 미리듣기 URL (3초 딜레이, CORS OK)
  → public/data/hub/{id}.json 저장

런타임 (유저 접속, 외부 API 0회):
  홈 접속    → fs.readFile(JSON) → 즉시 렌더링
  별 탐험    → CSS translate + Dynamic Fog (60fps)
  별 클릭    → useAudio.play() + BottomSheet
  이미지 없음 → 브라우저(유저 IP)에서 iTunes 직접 fetch (self-healing)
  검색       → 로컬 인덱스 우선 → Spotify 최후 수단
```

> **Spotify가 완전히 차단되어도 이 사이트는 정상 운영됩니다.**

---

### API 리스크 대응 현황 (2026년 3월)

| API | 현재 상태 | 역할 | 대응 |
|-----|----------|------|------|
| **Spotify Search** | 🟡 제한적 | 아티스트 검색/ID 매핑 | 검색 전용으로 최소화 |
| **Spotify top-tracks** | 🔴 403 확정 | (제거됨) | MusicBrainz로 완전 대체 |
| **Spotify related-artists** | 🔴 403 확정 | (제거됨) | Last.fm 추후 도입 예정 |
| **MusicBrainz** | 🟢 정상 | 작곡/작사/프로듀서 크레딧 | 1 req/s 준수 필수 |
| **iTunes Search** | 🟢 정상 | 이미지 + 미리듣기 URL | 3초 딜레이 (20회/분 제한) |
| **Genius** | 🔴 Vercel 차단 | (비활성화) | Vercel IP CAPTCHA 차단 |
| **Last.fm** | 🟡 이미지 없음 | 유사 아티스트 (추후 도입) | getSimilar → 위성 보강 |

---

### Self-Healing 이미지 아키텍처

```
서버 → Pre-baked imageUrl 있음:
  CosmosNode / ArtistCard → 즉시 이미지 표시

서버 → imageUrl null (Pre-bake 미실행 또는 수집 실패):
  1. 이니셜 아이콘 즉시 표시 (HSL 해시 기반 고유 색상)
  2. 마운트 후 브라우저에서 직접 iTunes API 호출 (유저 IP)
  3. 결과 있으면 400px 이미지로 자동 교체
  4. 실패시 이니셜 유지 (조용한 실패)

효과: Vercel IP 차단 위험 완전 제거
     유저 10만 명 = 10만 개의 IP로 분산
```

---

## 📊 허브 아티스트 현황 (38명)

| 카테고리 | 아티스트 |
|---------|---------|
| 대형 아이돌 | BTS, BLACKPINK, 아이유, 소녀시대, 뉴진스, NMIXX, 스트레이 키즈, (여자)아이들 |
| 힙합/크로스오버 | 지코, 박재범, 에픽하이, 윤미래, 비비, pH-1, 리쌍 |
| K-인디 | 혁오, 검정치마, 백아, 가을방학, 선우정아, 언니네이발관, 한로로, 넬, 라이너스의 담요, 델리스파이스, Through the Sloe, 줄리아하트, 브로콜리너마저, 헤이즈 |
| 레전드 | 서태지, 빅뱅, 박진영, 악동뮤지션, 윤상, 토이, 이박사, 이적, 듀스 |

---

## 📋 CLI 명령어 전체 목록

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 (localhost:3000) |
| `npm run build` | 프러덕션 빌드 |
| `npm run prebake` | 허브 아티스트 전체 Pre-bake (기존 JSON SKIP) |
| `npm run add-artist` | 단일 아티스트 추가 → Pre-bake |
| `npm run build-graph` | hub/*.json → graph.json 생성 (크레딧 edge weight) |
| `npm run compute-layout` | graph.json → Force-Directed 좌표 계산 |
| `npm run universe:rebuild` | build-graph + compute-layout 순차 실행 |
| `npx tsx scripts/ingest-playlist.ts <URL>` | 플레이리스트 일괄 입력 |

---

## 📝 개발 진행 기록

| 날짜 | 작업 |
|------|------|
| 2026-03-18 | 초기 세팅, Spotify/MusicBrainz 연동, Pre-bake 파이프라인 구축 |
| 2026-03-18 | Admin 패널, CLI 추가 스크립트, 아티스트 34명 확대 |
| 2026-03-19 | 홈 즉시 우주 진입, Scatter 레이아웃, 플로팅 검색 |
| 2026-03-19 | Dynamic Fog, 드래그 팬, 관성, 패럴랙스, Vignette |
| 2026-03-19 | 3단계 BottomSheet, 음악 재생 UX, ArtistCard 이퀄라이저 |
| 2026-03-19 | ErrorBoundary, 404/500, BackButton, 이미지 도메인 확장 |
| 2026-03-19 | 심우주(Deep Space) 렌더링 + Torus Force-Directed 레이아웃 |
| 2026-03-19 | 위성 이미지 자동 보완, 줌 레이어 동기화, Torus 카메라 래핑 |
| 2026-03-19 | 음악 겹침 버그 수정, 카드 탭=재생/정지 토글, API Rate Limit 보호 |
| 2026-03-20 | **Phase 1:** Spotify top-tracks + Genius 제거, iTunes 3초 딜레이 |
| 2026-03-20 | **Phase 2:** MusicBrainz v2 — Release Group + Work 레벨 작곡/작사 크레딧 + 앨범 발매일 연표 |
| 2026-03-20 | **Phase 3:** 크레딧 기반 Edge Weight + `universe:rebuild` 자동화 |
| 2026-03-20 | **Phase 4:** Self-Healing 클라이언트 Lazy Image Fetch (Vercel IP 분산) |
| 2026-03-20 | Admin 페이지 개선: Universe Rebuild GUI + CLI 참조 가이드 |

---

## 🔮 장기 비전

- **앨범 발매일 연표 서비스:** "N년 전 오늘 발매된 명반" 기능 (releases/*.json 활용)
- **Admin LLM 연동:** Gemini로 발매일 팩트체크 자동화 (verifyStatus 파이프라인)
- **Last.fm 연동:** artist.getSimilar로 위성 아티스트 추가 보강
- **Neo4j 그래프 DB 전환:** 진정한 무한 탐험 그래프
- **콘텐츠 확장:** 영화, 드라마, 웹툰, 인플루언서까지

---

*Built with 💜 by Jitigravity — 2026*
