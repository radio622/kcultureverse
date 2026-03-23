# 🌌 K-Culture Universe

> K-Culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 우주 지도

**[frompangyo.vercel.app/universe](https://frompangyo.vercel.app/universe)** — 바로 우주로 이동

---

## ✨ V7.7 — UI 폴리싱 + 데이터 안정화 (2026-03-23)

### Phase 1 — 치명적 버그 수정 ✅
- **1-1 엣지 실종 복구**: `weight >= 0.5` 강관계만 줌아웃 시 유지 → 헤어볼 방지 + 맵 가독성 회복
- **1-2 봇 401 패치**: `SpotifyTokenManager` 클래스 (만료 5분 전 자동 갱신 + 401 즉시 강제 갱신) + `progress.json` 원자적 저장
- **1-3 히트박스 교정**: PC 마우스 정밀 인식 + 줌아웃 시에도 엣지 클릭 팝업 표시 유지

### Phase 2 — 청취 몰입감 + UI 폴리싱 ✅
- **2-1 라디오식 연속 재생**: `usePlayQueue` 훅 신설 — 아티스트 포커스 시 1촌 이웃을 큐로 자동 구성. 트랙 종료 시 다음 아티스트 미리듣기 자동 재생
- **2-2 바텀시트 리팩토링**: `height` 애니메이션 → `translateY` GPU 가속 전환. 60fps 유지

### Phase 3 — 바이럴 + 지형지물 확장 ✅
- **3-1 A→B 우주 여정 자동 재생** — `useJourneyPlayer` 신설. Dijkstra 최단 경로 순회 + 미리듣기 자동 재생 + 여정 진행 바 UI + 🔗 공유 버튼. `/universe?artist=A&to=B` URL 공유 가능. 공유 제목 조사(`로부터/~에게`) 자동 처리
- **3-2 우주 데이터 수동 패치**: 
  - 백아 (Various Artists 오염 노드 교체, 적재 ↔ 백아 연결)
  - 패닉 (이적 ↔ 김진표 연결 구성)
  - 넥스트 (신해철 ↔ 넥스트 그룹 멤버십 연결)
  - 서태지와 아이들 (서태지, 양현석, 이주노 추가 및 그룹 연결)
- **3-3 검색창 UX 개선**: `Various Artists`가 `백아`의 검색어로 오인되던 문제 해결. 검색창 드롭다운 및 선택 필드에서 이름 클릭 시 바로 재검색(수정) 가능한 모드 구현.

### 🐞 핫픽스 (2026-03-23 추가)
- **json null 배열 런타임 크래시 복구**: 노드/엣지 삭제 시 `delete` 연산자로 인해 발생한 배열 구멍을 완전 필터링하여 초기 화면 로딩이 멈추는 치명적 문제 해결
- **엣지 렌더링 완전 복구**: `v5-edges.json` → 잘못된 노드 참조 엣지 자동 필터링 (`node not found` 에러 제거)
- **아티스트 포커스 전환**: 여정/자율주행 중 수동 클릭 시 즉시 정지 후 전환. previewUrl 없는 아티스트도 API fetch 후 자동 재생
- **Various Artists 오염 방지**: MusicBrainz 검색 결과 + 렌더링 양쪽에 차단 필터 추가
- **여정 공유 & UX 완벽화**: `A→B` 여정 탐색 시 조감도(Bird's Eye View, 1.8초 시네마틱)를 통해 전체 경로를 한눈에 파악 후 자동으로 줌인하여 음악과 함께 여행 시작. 모든 엣지에서 동일 속도(0.06px/ms)로 정확한 from→to 방향의 전류 애니메이션. 여정 공유 링크 우측 상단 통합. 모바일 공유 버튼 overflow 방지(maxWidth+여정 모드 시 정보수정 숨김). RAF 루프 `refresh()`+30fps 스로틀 성능 최적화
- **데이터 & UI 개선**: 패닉, 넥스트, 빅뱅/지드래곤 등 그룹 멤버십 엣지 확보. 지드래곤 등 주요 아티스트 별칭 대량 보강. 정보 수정 제안 버튼 → 우측 상단 분리 이동. 바텀시트 카드 덱 여백 축소하여 좁은 모바일 화면에서도 미리듣기 버튼 가시성 100% 확보
### 🤖 듀얼 하베스터 봇 (재가동 대기)
- **봇 1 (The Harvester)**: Spotify API → 한글 앨범명·발매일·커버 자동 수집 (10분 간격)
- **봇 2 (The Curator)**: Gemini AI → 발매일 교정 + 크레딧 추출 + 국적 판정
- **V7.7 401 패치 적용 완료** — `SpotifyTokenManager`로 토큰 자동 갱신, 재가동 시 44번 아티스트부터 이어서 진행
- 상세 설계: [`docs/DUAL_HARVESTER_BOT.md`](docs/DUAL_HARVESTER_BOT.md)

---

## 🚀 V7.0.4 최신 업데이트 하이라이트

### V7.0.4 — 우주의 일상화와 무결성 확장 (2026-03-23)

#### 📅 "오늘의 우주" 자율주행
- **과거 오늘의 발매 탐험**: 메인 화면에서 🚀 버튼 클릭 시 오늘 발매된 과거 앨범 리스트업 슬라이드 노출
- **무작위 웜홀 시작**: 매일 달라지는 발매 앨범을 클릭하여 새로운 자율주행 경험 시작
- **Admin 캘린더 뷰 (`/admin/calendar`)**: 관리자는 한눈에 이번 달의 우주 역사를 살펴보고 발매일을 수동 관리 가능

#### 🤖 AI 기반 매일 우주 청소 (GPT-5 Nano)
- **발매일 & Korean Artist 여부 판정**: 오염되기 쉬운 외부 음악DB 한계를 넘기 위해 GPT-5 Nano 모델이 매일 순차적으로 "한국 아티스트 여부"와 "진짜 발매일"을 크로스체크 (CRON)
- **100% K-Culture 영점 조율**: '15&', '에프엑스(f(x))' 같은 영문 그룹이 해외 아티스트로 오인되어 삭제되지 않도록 지속적인 관리 체계 구축

#### 🧬 콜라보 영구 해체 및 유니버스 대확장
- **1,392명 아티스트 / 8,430 가닥의 인연**: 단 1명의 완전 고립 노드도 없는 역대 최대 규모, 최다 밀집도의 우주 완성
- 기존 혼합콜라보 노드(A & B) 완전 소거. 개별 노드 환원 및 FEATURED(0.7) 엣지로 정교하게 맵핑 완료 (85건 → 0건)
- 856명 아티스트 전수 조사 후 144건의 한글 닉네임 대거 보강

---

### V7.0.1 — AI 게이트키퍼 & 프리미엄 탐험 (2026-03-22)

#### 🔐 인증 & 회원 시스템
- **Google OAuth 소셜 로그인** (Auth.js v5 + JWT 서버리스 세션)
- **온보딩 모달**: 닉네임, 성별, 연령대, 뉴스레터 동의
- **멤버십 2단계**: 준회원(로그인만) / 정회원(뉴스레터 동의) — 뉴스레터 해제 시 자동 강등
- **마이페이지**: 프로필 수정, 뉴스레터 토글, 회원탈퇴
- **개인정보 처리방침** 페이지 (`/privacy`) — PIPA 대응

#### 🛡️ Admin 관리자 대시보드 (`/admin`)
| 탭 | 기능 |
|----|------|
| 🚀 빠른 수정 | GPT 기반 AI 직통 입력 — 데이터 즉시 반영 |
| 📋 유저 요청 관리 | 에디트 로그 전체 조회, 필터, 수동 승인·거절 |
| 👥 회원 관리 | 프로필 목록, 역할 변경 |
| 📊 우주 통계 | 노드/엣지 수, 요청 추이, 승인률 |
| 🔄 빌드 제어 | merge-overrides + rebuild 원클릭 |
| ⏪ 롤백 관리 | data_overrides 개별 패치 되돌리기 |

#### 🤖 AI 게이트키퍼 (유저 에디트 제안)
- **정회원 전용**: 자연어로 아티스트 정보 수정, 관계 추가, 신규 아티스트 제안
- **Gemini Flash-Lite** 파싱 → **MusicBrainz + iTunes** 서버 사이드 교차 검증
- 자동 판정: ✅ 승인 / ⏳ 보류 / ❌ 거절 → Supabase 저장
- Rate Limit: 정회원 1분 1회

#### 🔗 관계(Edge) 심층 탐색
- **엣지 타입 13종 확장**: COVER 3종(OFFICIAL/FULL/PARTIAL), SHARED_WRITER/PRODUCER, LABEL, TV_SHOW
- **엣지 클릭 팝업**: 관계 이름, 가중치 바, glassmorphism 디자인
- **듀얼 아티스트 관계 검색** (A ↔ B): Dijkstra 최단 경로 + ⚡ 전류 애니메이션
- 포커스된 1촌 엣지만 클릭 반응 (배경 엣지 차단)

#### 🚀 자율주행 (Auto-Warp)
- **가중치 확률적 경로 탐색** — Roulette Wheel 알고리즘
- **Tabu List**(최근 5개) + **랜덤 점프**(5%)로 클러스터 고착 방지
- **iTunes 릴레이 미리듣기**: 각 정거장에서 30초 미리듣기 자동 재생
- **Flight Log 실시간 UI** + Supabase `flight_logs` 저장
- 로그인 유저 전용 게이트

#### 📦 데이터 파이프라인 자동화
- `merge-overrides.ts`: Supabase `data_overrides` → JSON 자동 머지
- `rebuild-universe`: merge → build-graph → compute-layout 3단계 파이프라인

### V6.9 — 대규모 아티스트 확장 (2026-03-22)
- **1,213명의 아티스트**, **3,196가닥의 연결선**
- 18개 CSV 플레이리스트에서 220명 신규 편입
- 163명 아티스트 한글 이름 일괄 교정

---

## 🧬 아키텍처 (V7.0.1)

### 핵심 원칙
| 원칙 | 설명 |
|------|------|
| **Zero Runtime Physics** | 모든 노드 좌표는 빌드 타임에 d3-force로 스태틱 렌더링. 디바이스 발열 완벽 차단 |
| **3분할 데이터 로딩** | layout(151KB) 즉시 → edges(511KB) 백그라운드 → details(388KB) 후속 |
| **LOD 3단계 렌더링** | Far(점) / Mid(거대별 인플루언서 폰트 노출) / Close(상세 정보 및 렌더링) |
| **AI 게이트키퍼** | 유저 자연어 → Gemini 파싱 → MusicBrainz+iTunes 검증 → 자동 승인/거절 |
| **Hybrid Auth** | Auth.js v5 + JWT 서버리스 세션 + Supabase user_profiles |
| **중앙집중형 Audio** | 싱글톤 `useAudio` + `usePlayQueue` 라디오 큐 + `useAutoWarp` 릴레이 미리듣기 |

### 데이터베이스 (Supabase PostgreSQL)
| 테이블 | 역할 |
|--------|------|
| `user_profiles` | 유저 프로필, 멤버십, 뉴스레터 상태 |
| `universe_edit_logs` | 에디트 제안 로그 + AI 판정 기록 |
| `data_overrides` | 승인된 오버라이드 패치 |
| `flight_logs` | 자율주행 비행 기록 |

### 엣지 관계 유형 (13종)
| 색상 | 관계 | 가중치 |
|------|------|--------|
| 🟢 `#86efac` | SAME_GROUP | 1.0 |
| 🟣 `#c084fc` | FEATURED | 0.7 |
| 🔵 `#60a5fa` | PRODUCER | 0.7 |
| 🟡 `#fbbf24` | WRITER | 0.7 |
| 🟠 `#fb923c` | COVER_OFFICIAL | 0.7 |
| 🟤 `#a3e635` | COVER_FULL | 0.5 |
| 🌿 `#6ee7b7` | COVER_PARTIAL | 0.3 |
| 🔷 `#38bdf8` | SHARED_WRITER | 0.3 |
| 🔶 `#818cf8` | SHARED_PRODUCER | 0.3 |
| 🏷 `#f472b6` | LABEL | 0.2 |
| 📺 `#e879f9` | TV_SHOW | 0.15 |
| ⚪ | INDIRECT | 0.1~0.3 |
| 🌫 | GENRE_OVERLAP | 0.15 |

---

## 🛠 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 인증 | Auth.js v5 (Google OAuth) + JWT |
| 렌더러 | react-force-graph-2d (Canvas) |
| AI | Gemini 3.1/2.5 Flash-Lite (유저·봇) / GPT (Admin) |
| DB | Supabase (PostgreSQL) |
| 레이아웃 계산 | d3-force (빌드 타임 오프라인) |
| 검증 API | MusicBrainz + iTunes Search |
| 스타일 | Vanilla CSS (커스텀 디자인 토큰) |
| 배포 | Vercel (Edge Functions) |

---

## 🧪 데이터 파이프라인 스크립트 모음

```bash
# 1. Supabase data_overrides → JSON 머지
npx tsx scripts/merge-overrides.ts

# 2. 수동 / CSV 일괄 수집
npx tsx scripts/v6.4-batch-ingest-csvs.ts

# 3. 딥스캔 매칭 (수동 하드코딩 관계)
npx tsx scripts/v6.3-inject-deep-relations.ts

# 4. 우주 소개팅 (외톨이 노드 장르 매칭)
npx tsx scripts/v6.5-socialize-lonely-stars.ts

# 5. 한글 이름 일괄 교정
python3 scripts/v6.5-fix-korean-names.py

# 6. JSON 우주 파일 빌드
npx tsx scripts/v5.4-build-universe.ts

# 7. 듀얼 하베스터 봇 (Spotify 수집 + Gemini 검증)
caffeinate -i python3 scripts/v7.5-dual-harvester-draft.py &
tail -f logs/harvester_*.log   # 실시간 모니터링
```

---

## 📚 버전 개발 문서

| 버전 | 문서 | 상태 |
|--------|------|------|
| V7.7 | [`docs/V7.7_ROADMAP.md`](docs/V7.7_ROADMAP.md) | ✅ Phase 1+2+3-1 완료 — Phase 3-2~3-5 남음 |
| V7.5 | [`docs/V7.5_IDEA_SKETCH.md`](docs/V7.5_IDEA_SKETCH.md) | ✅ 봇 401 패치 완료 |
| V7.5 봇 | [`docs/DUAL_HARVESTER_BOT.md`](docs/DUAL_HARVESTER_BOT.md) | ✅ 정식 가동 중 |
| V7.4.1 | [`docs/QA_PATCH_PLAN_20260323.md`](docs/QA_PATCH_PLAN_20260323.md) | ✅ 핫픽스 완료 — 이미지/엣지팝업/iTunes/줌 |
| V7.0.1 | [`docs/V7.0.1_ROADMAP.md`](docs/V7.0.1_ROADMAP.md) | ✅ 구현 완료 — 전 Phase |
| V6.9 | [`docs/V6.9_ROADMAP.md`](docs/V6.9_ROADMAP.md) | ✅ 완료 |
| V6.8 | [`docs/V6.8_ROADMAP.md`](docs/V6.8_ROADMAP.md) | ✅ 완료 |

---

## 💻 개발 환경 설정

```bash
# 클론
git clone git@github.com:radio622/kcultureverse.git
cd kcultureverse

# 패키지 설치
npm install

# 환경변수 설정 (.env.local)
# AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET,
# NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# OPENAI_API_KEY, GEMINI_API_KEY, ADMIN_EMAILS, ADMIN_PASSPHRASE
# SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

# 데이터 빌드
npx tsx scripts/v5.4-build-universe.ts

# 개발 서버
npm run dev
# → http://localhost:3000/universe
```

---

## 📜 라이선스
Private — JitiGravity K-Culture Universe Team
