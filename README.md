# 🌌 K-Culture Universe Map

> K-Culture(음악, 영화, 드라마, 예술)를 구성하는 아티스트들의 **관계 우주**를 시각적으로 탐험하는 인터랙티브 웹 앱.

---

## ✨ 핵심 비전

사이트에 접속하면, 랜덤으로 선택된 아티스트를 중심으로 수많은 **별(연관 아티스트)**들이 은하수처럼 흩어져 떠 있습니다.

- **가까운 별**은 이름과 이미지가 선명하게 보이고,
- **먼 별**은 안개에 가려 뿌옇게 보입니다.
- 화면을 **드래그**하면 카메라가 이동하면서, 다가가는 쪽의 별들이 안개를 벗고 서서히 드러납니다 (Dynamic Fog).
- **심우주(Deep Space)**: 현재 우주와 직접 연관 없는 다른 허브 아티스트 37명이 먼 배경에 흐릿하게 떠 있어, 드래그할 때마다 새로운 별이 안개 속에서 나타나는 **광대한 우주**를 연출합니다.
- 아티스트 별을 **클릭**하면 즉시 음악이 흘러나오고, 하단에 연관 아티스트 카드가 나타나 옆으로 넘기며 탐험할 수 있습니다.
- 카드의 **"이 아티스트의 우주로 →"** 버튼으로 새로운 우주로 다이브하고, **"← 이전"** 버튼으로 돌아올 수 있습니다.

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **프레임워크** | Next.js 16 (App Router, Turbopack) |
| **언어** | TypeScript |
| **스타일링** | Vanilla CSS + CSS Variables |
| **애니메이션** | Framer Motion + CSS @keyframes + rAF (60fps) |
| **2.5D 효과** | CSS `perspective` + `translateZ` + Dynamic Fog (rAF 실시간) |
| **데이터** | Pre-baked JSON (외부 API 실시간 의존 0%) |
| **배포** | Vercel |

---

## 📂 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              ← 홈 (즉시 우주 진입, API 0회)
│   ├── from/[id]/page.tsx    ← 아티스트 우주 (pre-baked 우선)
│   ├── admin/page.tsx        ← Admin 아티스트 관리
│   ├── not-found.tsx         ← 커스텀 404 (우주 테마)
│   ├── error.tsx             ← 전역 에러 페이지
│   └── api/
│       ├── admin/add-artist/ ← CLI 스크립트 연동
│       ├── cosmos/[id]/      ← 위성 데이터 (캐시 헤더)
│       └── spotify/          ← 검색/미리듣기/상세
├── components/
│   ├── Cosmos.tsx            ← 2.5D 우주 시각화 (Dynamic Fog + Pan + Inertia)
│   ├── CosmosClient.tsx      ← 클라이언트 오케스트레이터
│   ├── CosmosNode.tsx        ← 개별 별 노드
│   ├── BottomSheet.tsx       ← 3단계 바텀시트 (collapsed/peek/expanded)
│   ├── ResonanceDeck.tsx     ← 가로 스크롤 캐러셀
│   ├── ArtistCard.tsx        ← 아티스트 카드 (이퀄라이저 오버레이)
│   ├── MiniPlayer.tsx        ← 미니 플레이어 (파동 인디케이터)
│   ├── FloatingSearch.tsx    ← 플로팅 검색 (로컬 인덱스 우선)
│   ├── BackButton.tsx        ← 히스토리 인식 뒤로가기 버튼
│   └── ErrorBoundary.tsx     ← React 에러 경계
├── data/
│   └── hub-artists.ts        ← 허브 아티스트 마스터 목록 (38명, 컬러 테마)
├── hooks/
│   └── useAudio.ts           ← 오디오 재생 (fadeIn/fadeOut + 자동재생 대응)
└── lib/
    ├── spotify.ts            ← Spotify + iTunes fallback
    ├── deep-space.ts         ← 심우주 노드 생성 (황금각 나선 배치)
    ├── musicbrainz.ts        ← MusicBrainz 크레딧
    ├── genius.ts             ← Genius 크레딧
    └── types.ts              ← CosmosArtist, SatelliteNode, CosmosData, DeepSpaceNode

scripts/
├── prebake.ts                ← Pre-bake (8초 딜레이, SKIP, 재시작 가능)
└── add-artist.ts             ← CLI 아티스트 추가 (검증→등록→Pre-bake→인덱스)

public/data/
├── hub/{spotifyId}.json      ← Pre-baked 우주 데이터
└── search-index.json         ← 로컬 검색 인덱스
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

### ✅ Step 2: 홈 화면 즉시 우주 진입 (완료)
- 서버 컴포넌트 전환 → `fs.readFileSync`로 API 0회 즉시 렌더링
- 산란형(Scatter) 레이아웃 — 시드 기반 결정적 오프셋
- 시간대 기반 테마 아티스트 & 허브 고유 컬러
- 플로팅 검색 (로컬 인덱스 우선 → Spotify 최후 5회/분 제한)

### ✅ Step 3: 2.5D 동적 안개 + 드래그 탐색 (완료)
- **Dynamic Fog:** 화면 정중앙 기준 실시간 blur/opacity 보간 (카메라 이동 반응)
- **드래그 팬:** Pointer Events (터치+마우스 통합), PAN_LIMIT ±1200px
- **관성(Inertia):** friction 0.91 자연 감속
- **패럴랙스 별:** near/mid/far 3레이어 속도 차등 (200개)
- **Vignette:** 화면 가장자리 어두운 그라데이션

### ✅ Step 4: 바텀시트 + 음악 UX (완료)
- **3단계 바텀시트:** collapsed(숨김) / peek(72px 미니플레이어) / expanded(55vh 카드)
- 별 클릭 → 즉시 음악 재생 + expanded 전환 동시 발생
- **ArtistCard:** 활성 시 이퀄라이저 파동 오버레이 + accent 줄
- **MiniPlayer:** "탭하면 관련 아티스트 보기" 힌트, 4개 파동 바
- 우주 push-up: peek -36px / expanded -110px

### ✅ Step 5: 닫힌 우주 탐험 + 안전장치 (완료)
- **ErrorBoundary:** 전역 에러 경계 (레이아웃에 적용)
- **커스텀 404/500 페이지:** 우주 테마 UI + "우주로 돌아가기" 버튼
- **BackButton:** 히스토리 인식 뒤로가기 (직접 방문 시 홈으로 fallback)
- **from/[id]:** pre-baked JSON 우선 → Spotify fallback → 404 순서
- **이미지 도메인 확장:** Last.fm, Discogs, Wikimedia 추가
- **이미지 Fallback:** `onError` → 이니셜 원(HSL 해시 기반 고유 색상)으로 전환

### ✅ Step 6: 심우주(Deep Space) 렌더링 + 모바일 최적화 (완료)
- **심우주 레이어:** 현재 코어 제외 37개 허브 아티스트를 600~1600px 반경에 배치
- **황금각(Golden Angle) 나선 배치:** 자연스러운 산란 분포
- **경량 노드:** `next/image` 없이 이니셜 원 + CSS만 사용 → 성능 최적화
- **심우주 전용 Fog:** DEEP_FOG_CLEAR 200 / DEEP_FOG_FULL 900 / 4프레임당 1회 업데이트
- **심우주 다이브:** pre-baked JSON이 있는 노드 클릭 시 해당 우주로 이동
- **모바일 반응형:** 터치 타겟 48px, safe-area, 카드 폭 조정, hover 제거
- **허브 아티스트 확대:** 34명 → 38명 (선우정아, 리쌍, 이적, 듀스 추가)

---

## 🏗 아키텍처 원칙

### 방어적 데이터 전략 (Closed Universe)
```
Pre-bake 파이프라인 (오프라인, 안전하게):
  CLI/Admin → getArtistFull() → public/data/hub/{id}.json
                                  (8초 딜레이, iTunes fallback, 재시작 가능)

런타임 (유저 접속 시):
  홈 접속   → fs.readFile(JSON) → 즉시 렌더링 (외부 API 0회)
  별 탐험   → CSS translate + Dynamic Fog (60fps GPU 가속)
  별 클릭   → useAudio.play() + BottomSheet expanded
  Dive     → pre-baked JSON 우선 → Spotify fallback → 404
  검색      → 로컬 인덱스 우선 → Spotify 최후 수단 (분당 5회 제한)
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

## 📊 허브 아티스트 현황 (38명)

| 카테고리 | 아티스트 |
|---------|---------|
| 대형 아이돌 | BTS, BLACKPINK, 아이유, 소녀시대, 뉴진스, NMIXX, 스트레이 키즈, (여자)아이들 |
| 힙합/크로스오버 | 지코, 박재범, 에픽하이, 윤미래, 비비, pH-1, 리쌍 |
| K-인디 | 혁오, 검정치마, 백아, 가을방학, 선우정아, 언니네이발관, 한로로, 넬, 라이너스의 담요, 델리스파이스, Through the Sloe, 줄리아하트, 브로콜리너마저, 헤이즈 |
| 레전드 | 서태지, 빅뱅, 박진영, 악동뮤지션, 윤상, 토이, 이박사, 이적, 듀스 |

---

## 📝 개발 진행 기록

| 날짜 | 작업 |
|------|------|
| 2026-03-18 | 초기 세팅, Spotify/MusicBrainz 연동, Pre-bake 파이프라인 구축 |
| 2026-03-18 | Admin 패널, CLI 추가 스크립트, 아티스트 34명 확대 |
| 2026-03-19 | 홈 즉시 우주 진입, Scatter 레이아웃, 플로팅 검색 (Step 2) |
| 2026-03-19 | Dynamic Fog, 드래그 팬, 관성, 패럴랙스, Vignette (Step 3) |
| 2026-03-19 | 3단계 BottomSheet, 음악 재생 UX, ArtistCard 이퀄라이저 (Step 4) |
| 2026-03-19 | ErrorBoundary, 404/500, BackButton, 이미지 도메인 확장 (Step 5) |
| 2026-03-19 | 이미지 Fallback(HSL 이니셜), 모바일 반응형 CSS, 허브 38명 확대 |
| 2026-03-19 | ✨ 심우주(Deep Space) 렌더링 — 37개 배경 노드 + Fog + PAN_LIMIT 1200px (Step 6) |
| 2026-03-19 | 🔧 UX 개선: 홈 첫 화면 노출 최적화 (5명 한정), 심우주 노드 클릭 다이브 지원 |
| 2026-03-19 | ✨ UX 고도화 (Step 7): 위성 더블클릭 워프 패닝, 구/신 우주 교차 페이드인 효과 |
| 2026-03-19 | 🐛 버그 수정: 모바일 카드 UI 38vh 최적화, 일반 위성 다이브 시 '선우정아' 오류 로컬 스캔으로 해결 |
| 2026-03-19 | 📸 마이그레이션: 38개 허브 및 37개 심우주 노드 iTunes 고화질 프로필 사진 영구 복원 반영 |

---

*Built with 💜 by Jitigravity — 2026*
