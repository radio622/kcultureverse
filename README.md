# 🌌 K-Culture Universe Map

> K-Culture(음악, 영화, 드라마, 예술)를 구성하는 아티스트들의 **관계 우주**를 시각적으로 탐험하는 인터랙티브 웹 앱.

---

## ✨ 핵심 비전

사이트에 접속하면, 랜덤으로 선택된 아티스트를 중심으로 수많은 **별(연관 아티스트)**들이 은하수처럼 흩어져 떠 있습니다.

- **가까운 별**은 이름과 이미지가 선명하게 보이고,
- **먼 별**은 안개에 가려 뿌옇게 보입니다.
- 화면을 **드래그/스크롤**하면 카메라가 이동하면서, 다가가는 쪽의 별들이 안개를 벗고 서서히 드러납니다.
- 아티스트 별을 **클릭**하면 즉시 음악이 흘러나오고, 하단에 연관 아티스트 카드가 나타나 옆으로 넘기며 다른 곡들을 미리 들을 수 있습니다.

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **프레임워크** | Next.js 15 (App Router) |
| **언어** | TypeScript |
| **스타일링** | Vanilla CSS + CSS Variables |
| **애니메이션** | Framer Motion + CSS @keyframes + rAF |
| **3D/2.5D** | CSS `perspective` + `translateZ` + Dynamic Fog (Three.js 미사용) |
| **데이터** | Pre-baked JSON (외부 API 실시간 의존 0%) |
| **배포** | Vercel |

---

## 📂 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              ← 홈 (즉시 우주 진입)
│   ├── from/[id]/page.tsx    ← 아티스트 우주 (서버 컴포넌트)
│   ├── admin/page.tsx        ← Admin 아티스트 관리
│   └── api/
│       ├── admin/add-artist/ ← CLI 스크립트 연동
│       ├── cosmos/[id]/      ← 위성 데이터 (캐시 헤더 적용)
│       └── spotify/          ← 검색/미리듣기/상세
├── components/
│   ├── Cosmos.tsx            ← 2.5D 우주 시각화 (Dynamic Fog + Pan)
│   ├── CosmosClient.tsx      ← 클라이언트 오케스트레이터
│   ├── CosmosNode.tsx        ← 개별 별 노드
│   ├── BottomSheet.tsx       ← 3단계 바텀시트 (collapsed/peek/expanded)
│   ├── ResonanceDeck.tsx     ← 가로 스크롤 캐러셀
│   ├── ArtistCard.tsx        ← 아티스트 카드
│   └── MiniPlayer.tsx        ← 미니 플레이어
├── data/
│   └── hub-artists.ts        ← 허브 아티스트 마스터 목록 (34명, 컬러 테마 포함)
├── hooks/
│   └── useAudio.ts           ← 오디오 재생 (fadeIn/fadeOut + 자동재생 차단 대응)
└── lib/
    ├── spotify.ts            ← Spotify + iTunes fallback
    ├── musicbrainz.ts        ← MusicBrainz 크레딧
    ├── genius.ts             ← Genius 크레딧
    └── types.ts              ← CosmosArtist, SatelliteNode, CosmosData

scripts/
├── prebake.ts                ← 안전한 Pre-bake (8초 딜레이, SKIP, 재시작 가능)
└── add-artist.ts             ← CLI 아티스트 추가 (검증→등록→Pre-bake→인덱스)

public/data/
├── hub/{spotifyId}.json      ← 34개의 Pre-baked 우주 데이터
└── search-index.json         ← 로컬 검색 인덱스 (37명+)
```

---

## 🚀 시작하기

### 1. 설치
```bash
npm install
```

### 2. 환경변수 (.env.local)
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
GENIUS_ACCESS_TOKEN=your_genius_token
```

### 3. Pre-bake 데이터 생성
```bash
npm run prebake
```
> 기존 JSON이 있으면 자동 SKIP. 새 아티스트만 처리합니다. (아티스트 간 8초 대기)

### 4. 개발 서버
```bash
npm run dev
```
→ `http://localhost:3000` 에서 확인

### 5. 아티스트 추가 (2가지 방법)

**CLI (추천):**
```bash
# Spotify 웹에서 아티스트 검색 → URL의 ID 복사
npm run add-artist -- "아티스트이름" "SpotifyID" "한글이름"

# 예시:
npm run add-artist -- "Nell" "3WbKkfwmDLgVwR9ExchFVC" "넬"
```
> 자동으로: iTunes 교차검증 → 중복검사 → 컬러 생성 → hub-artists.ts 추가 → Pre-bake → 인덱스 갱신

**Admin 페이지:**
```
http://localhost:3000/admin
```
> 웹 UI에서 이름과 Spotify ID를 입력하면 동일한 파이프라인이 실행됩니다.

---

## 🗺 개발 로드맵

### ✅ Step 1: Pre-bake 데이터 파이프라인 (완료)
- 34명의 허브 아티스트 Pre-baked JSON 생성
- CLI & Admin 아티스트 추가 자동화
- Wikidata API 기반 Spotify ID 자동 추출

### 🔲 Step 2: 홈 화면 리디자인
- 검색창 → 즉시 우주 진입 (API 호출 0회)
- 산란형(Scatter) 레이아웃으로 자연스러운 별 배치
- 시간대 기반 테마 아티스트 & 컬러 교체
- 시네마틱 진입 애니메이션

### 🔲 Step 3: 2.5D 동적 안개 + 드래그 탐색
- CSS perspective 기반 깊이감
- **Dynamic Fog:** 카메라 이동 시 가까운 별이 안개를 벗고 드러남 (rAF 실시간 계산)
- 드래그 팬 + 관성(inertia) + 배경 별 패럴랙스

### 🔲 Step 4: 바텀시트 + 음악 UX
- 3단계 바텀시트 (collapsed/peek/expanded)
- 별 클릭 → 음악 재생 + 카드 스크롤 + 카메라 이동 동시 발생
- 캐러셀 스와이프 시 크로스페이드 곡 전환

### 🔲 Step 5: 닫힌 우주 탐험 + 안전장치
- Dive: pre-baked 아티스트만 우주 전환 (실시간 API 0회)
- 히스토리 스택 + 뒤로가기
- 에러 경계 + 이미지 fallback

---

## 🏗 아키텍처 원칙

### 방어적 데이터 전략
```
Pre-bake 파이프라인 (오프라인, 안전하게):
  CLI/Admin → getArtistFull() → public/data/hub/{id}.json
                                  (8초 딜레이, iTunes fallback, 재시작 가능)

런타임 (유저 접속 시):
  홈 접속   → fs.readFile(JSON) → 즉시 렌더링 (외부 API 0회)
  별 탐험   → CSS translate + Dynamic Fog (60fps GPU 가속)
  별 클릭   → useAudio.play() (API 0회)
  Dive     → fetch(/data/hub/{id}.json) → 200이면 전환, 404이면 Spotify 링크
  검색      → 로컬 인덱스 우선 → Spotify는 최후 수단 (분당 5회 제한)
```

> **Spotify가 완전히 서비스를 중단해도, 이 사이트는 정상 운영됩니다.**

### API 리스크 대응 현황
| API | 현재 상태 | 대응 |
|-----|----------|------|
| Spotify Search/Artists | 🔴 403 차단 | iTunes fallback 100% 대체 |
| MusicBrainz | 🟡 1req/s 제한 | Pre-bake 8초 딜레이 |
| iTunes Search | 🟢 정상 | 주 데이터 소스 |
| Genius | 🟡 일부 제한 | 크레딧 보조 데이터 |
| Wikidata | 🟢 정상 | Spotify ID 자동 추출 |

---

## 🔮 장기 비전

- **Neo4j 그래프 DB 전환:** 아티스트 관계를 그래프 DB에 저장하여 진정한 무한 탐험
- **LLM 연동 (Gemini Flash / GPT-5 Mini):** 아티스트 관계/컬러 자동 추천
- **유저 참여:** 관계 제안, 리뷰, 평점 기능
- **콘텐츠 확장:** 영화, 드라마, 웹툰, 인플루언서까지 영역 확대
- **수익화:** OTT 제휴 링크, 공연 티켓 연동

---

## 📊 허브 아티스트 현황 (34명)

| 카테고리 | 아티스트 |
|---------|---------|
| 대형 아이돌 | BTS, BLACKPINK, 아이유, 소녀시대, 뉴진스, NMIXX, 스트레이 키즈, (여자)아이들 |
| 힙합/크로스오버 | 지코, 박재범, 에픽하이, 윤미래, 비비, pH-1 |
| K-인디 | 혁오, 검정치마, 백아, 가을방학, 언니네이발관, 한로로, 넬, 라이너스의 담요, 델리스파이스, Through the Sloe, 줄리아하트, 브로콜리너마저, 헤이즈 |
| 레전드 | 서태지, 빅뱅, 박진영, 악동뮤지션, 윤상, 토이, 이박사 |

---

*Built with 💜 by Jitigravity — 2026*
