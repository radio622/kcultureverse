# 🌟 K-Culture Universe V7.0 Roadmap: Crowdsourced Data Gatekeeper

> **상태**: 📋 계획 (Planning) — 2026-03-22 작성  
> **설계자**: JitiGravity Team  
> **전제 조건**: V6.5 안정화 완료 후 착수

---

## 1. 개요 (Overview)

V7.0의 핵심 목표는 **"아키텍처의 근본적인 변경 없이, 유저가 직접 데이터(아티스트 정보 및 관계)를 교정하고 팽창시킬 수 있는 자가 발전형 생태계"**를 구축하는 것입니다.

경량화된 LLM API를 활용한 **AI 데이터 게이트키퍼(Gatekeeper)** 시스템을 도입하여 무분별한 훼손을 방지하고 유효한 정보만을 판별해 데이터에 편입시킵니다.

### 1.1 V6 → V7 달라지는 것과 달라지지 않는 것

| 항목 | V6.5 (현재) | V7.0 (계획) |
|------|------------|------------|
| 우주 렌더링 방식 | 정적 JSON + Canvas (react-force-graph-2d) | **변경 없음** (Zero Architecture Change) |
| 데이터 파이프라인 | 수동 스크립트 → 빌드 → 배포 | 유저 크라우드소싱 → AI 검증 → 자동 빌드 → 배포 |
| 아티스트 이름/관계 수정 | 개발자가 직접 스크립트 편집 | 유저가 자연어로 요청 → AI가 검증 후 반영 |
| 인증 시스템 | 없음 (퍼블릭) | 구글 로그인 + 프로필 등록 필수 |
| 외부 AI API | 없음 | GPT-5 Nano / Gemini 3.1 Flash-Lite |

---

## 2. 유저 인증 및 접근 제어 (Authentication & Access Control)

### 2.1 가입 및 인증 흐름

```
[✏ 에디트 버튼 클릭]
    ↓
[구글 소셜 로그인 (Auth.js v5 + Google OAuth)]
    ↓
[프로필 등록 — 필수 입력]
    ├─ 성별 (선택지: 남 / 여 / 기타 / 밝히지 않음)
    ├─ 연령대 (선택지: 10대 / 20대 / 30대 / 40대 / 50대+)
    └─ 뉴스레터 수신 동의 (체크박스)
    ↓
[프로필 완료 → 에디트 권한 활성화]
```

### 2.2 권한 분류

| 역할 | 조건 | 요청 제한 | AI 검증 |
|------|------|----------|---------|
| **Admin** | 관리자 지정 계정 | 무제한 | 검증 생략, 즉시 승인 |
| **일반 유저** | 구글 로그인 + 프로필 완료 | **1분에 1회**, 1일 최대 30회 | AI 검증 필수 |
| **미인증 사용자** | 로그인 없음 | 에디트 불가 (읽기/탐색만 가능) | - |

### 2.3 기술 스택

| 기능 | 기술 |
|------|------|
| 소셜 로그인 | **Auth.js v5** (구 NextAuth.js) + Google OAuth Provider |
| 세션 유지 | JWT 기반 서버리스 세션 (Vercel Edge 호환) |
| 프로필 저장 | Supabase (PostgreSQL) `user_profiles` 테이블 |
| Rate Limit | Next.js API Route 미들웨어 (`X-RateLimit-*` 헤더 기반) |

---

## 3. AI 게이트키퍼 파이프라인 (AI Gatekeeper Pipeline)

### 3.1 LLM 모델 선정

| 모델 | 역할 | 가격 (2026.03 기준) | 비고 |
|------|------|-------------------|------|
| **GPT-5 Nano** | 메인 게이트키퍼 (유료 유저 또는 비용 할당 가능 시) | Input: **$0.05/1M tokens**<br>Output: **$0.40/1M tokens** | 400K 컨텍스트, Function Calling 지원, 분류/요약에 최적화 |
| **Gemini 2.5 Flash-Lite** | 무료 백업 / 프로토타이핑 | 무료 (Free Tier, 분당 15 req) | Gemini API 무료 티어로 사용 가능. 3.1은 현재 유료만 지원(Preview)이므로 2.5 Flash-Lite를 무료 대안으로 활용 |
| **Gemini 3.1 Flash-Lite** | 고품질 검증 (유료 배정 시 전환) | Input: **$0.25/1M tokens**<br>Output: **$1.50/1M tokens** | Preview 상태, 유료만 지원. 향후 무료 티어 개방 시 전환 가능 |

### 3.2 월간 비용 시뮬레이션 (GPT-5 Nano 기준)

| 시나리오 | 일일 요청 수 | 요청 당 토큰 (In/Out) | 월간 비용 |
|---------|------------|---------------------|----------|
| 초기 (소규모) | 30건 | ~800 / ~400 | **$0.02** (거의 무료) |
| 성장 (중규모) | 200건 | ~800 / ~400 | **$0.10** |
| 폭발 (대규모) | 1,000건 | ~1,000 / ~600 | **$0.90** |

> 💡 GPT-5 Nano의 가격이 극도로 저렴($0.05/1M input)하여, 하루 1,000건의 유저 요청을 처리해도 **월 $1 미만**의 비용으로 운영이 가능합니다. 비용은 사실상 우려 대상이 아닙니다.

### 3.3 파이프라인 처리 흐름

```
[유저 자연어 입력]
    ↓
[Step 1: Intent 분류 (LLM)]
    ├─ NAME_CORRECTION  : 아티스트 이름 수정 요청
    ├─ EDGE_PROPOSAL    : 아티스트 간 관계 추가 요청
    ├─ ARTIST_ADDITION  : 신규 아티스트 추가 요청
    ├─ DATA_CORRECTION  : 기타 데이터 오류 정정 (장르, 이미지 등)
    └─ IRRELEVANT       : 관련 없는 입력 (거절)
    ↓
[Step 2: 팩트 검증 — Function Calling (Tools)]
    ├─ search_web(query)      → Google Search API로 기사/공식 출처 교차 검증
    ├─ search_spotify(name)   → Spotify API로 아티스트 존재 여부 및 공식 메타데이터 대조
    ├─ search_musicbrainz(name) → MusicBrainz로 MBID 및 크레딧 대조
    └─ search_itunes(name)    → iTunes API로 앨범/트랙 존재 확인
    ↓
[Step 3: 판정]
    ├─ ✅ APPROVED  : 검증 성공 → DB 오버라이드 큐에 등록 + "반영 예정입니다" 피드백
    ├─ ⏳ PENDING   : 검증 모호/불충분 → 로그 기록 + "검토 기록으로 남겼습니다" 피드백
    └─ ❌ REJECTED  : 명백한 허위/관련 없음 → 거절 메시지 + 로그 기록
    ↓
[Step 4: 게시물(Log) 기록]
    → Supabase `universe_edit_logs` 테이블에 저장
    → 관리자 대시보드에서 전체 히스토리 조회 가능
```

### 3.4 Function Calling(Tools) 구현 상세

Vercel AI SDK v5의 `tool()` 함수를 사용하여 다음 4개의 외부 검증 도구를 LLM에게 선언합니다:

```typescript
// 예시: Vercel AI SDK tool 선언 (개념 설계)
const tools = {
  search_web: tool({
    description: "웹 검색으로 아티스트 관련 뉴스, 인터뷰, 공식 발표를 팩트체크",
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => { /* Google Programmable Search API 호출 */ }
  }),
  search_spotify: tool({
    description: "Spotify에서 아티스트 공식 이름, 장르, 인기도를 조회",
    parameters: z.object({ artistName: z.string() }),
    execute: async ({ artistName }) => { /* Spotify Search API 호출 */ }
  }),
  search_musicbrainz: tool({
    description: "MusicBrainz에서 MBID, 크레딧, 협업 관계를 조회",
    parameters: z.object({ artistName: z.string() }),
    execute: async ({ artistName }) => { /* MusicBrainz API 호출 */ }
  }),
  search_itunes: tool({
    description: "iTunes/Apple Music에서 앨범, 트랙, 미리듣기 URL을 조회",
    parameters: z.object({ artistName: z.string() }),
    execute: async ({ artistName }) => { /* iTunes Search API 호출 */ }
  }),
};
```

---

## 4. 데이터베이스 설계 (Database Schema)

### 4.1 테이블 구조

```sql
-- 유저 프로필
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  display_name  TEXT,
  gender        TEXT CHECK (gender IN ('male','female','other','undisclosed')),
  age_group     TEXT CHECK (age_group IN ('10s','20s','30s','40s','50s+')),
  newsletter    BOOLEAN DEFAULT false,
  role          TEXT DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 유저 제안 로그 및 AI 판정 기록
CREATE TABLE universe_edit_logs (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES user_profiles(id),
  intent        TEXT NOT NULL,          -- NAME_CORRECTION, EDGE_PROPOSAL, etc.
  raw_input     TEXT NOT NULL,          -- 유저 원문
  parsed_data   JSONB,                  -- AI가 파싱한 구조화 데이터
  status        TEXT DEFAULT 'pending', -- approved / pending / rejected
  ai_reasoning  TEXT,                   -- AI의 판정 근거 (사유)
  ai_sources    JSONB,                  -- 검증에 사용된 출처 URL 목록
  applied_at    TIMESTAMPTZ,            -- 실제 데이터에 반영된 시각 (nullable)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 승인된 오버라이드 패치 (빌드 시 organic-graph.json에 머지)
CREATE TABLE data_overrides (
  id            SERIAL PRIMARY KEY,
  edit_log_id   INT REFERENCES universe_edit_logs(id),
  target_type   TEXT NOT NULL,          -- 'node_name', 'edge', 'node_add', etc.
  target_id     TEXT,                   -- 대상 mbid (있는 경우)
  patch_data    JSONB NOT NULL,         -- 실제 적용할 데이터 (이름, 엣지 정보 등)
  applied       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. 확장성: 아티스트 수 증가 대응 전략 (Scalability Plan)

### 5.1 현재 규모와 예상 성장

| 항목 | V6.5 현재 | V7.0 예상 (1년 후) | V7.x 장기 (2년 후) |
|------|----------|-------------------|-------------------|
| 아티스트(노드) | 989명 | 2,000~3,000명 | 5,000~10,000명 |
| 연결선(엣지) | 2,633개 | 6,000~10,000개 | 20,000~50,000개 |
| v5-layout.json | 124KB | ~300KB | ~800KB |
| v5-edges.json | 441KB | ~1MB | ~3MB |
| v5-details.json | 295KB | ~700KB | ~2MB |
| d3-force 빌드 시간 | ~30초 | ~2분 | ~10분 |

### 5.2 JSON 정적 파일 크기 증가 해법

| 문제 | 영향 시점 | 해결 방안 |
|------|---------|----------|
| layout.json > 500KB | ~3,000명 | gzip 전송(Vercel 기본 지원)으로 실질 전송량 80% 감소. 500KB gzip → ~100KB |
| edges.json > 3MB | ~5,000명 | **Spatial Chunking**: 전체 엣지 대신 현재 뷰포트 근처의 엣지만 지연 로딩 (Tile 방식) |
| details.json > 2MB | ~5,000명 | 이미 Phase C에서 백그라운드 로딩 중이므로 UX 영향 미미. 필요 시 ID 범위별 분할 |
| d3-force 빌드 > 5분 | ~5,000명 | tick 횟수 3,000→1,500으로 줄이거나, 사전 계산된 좌표를 증분(Incremental) 업데이트 방식으로 전환 (신규 노드만 추가 시뮬레이션) |
| Canvas 렌더링 FPS 저하 | ~8,000명 | WebGL 기반 렌더러(react-force-graph-3d의 2D 모드 또는 pixi-viewport)로 전환 검토 |

### 5.3 증분 빌드 (Incremental Build) 전략

아티스트가 5,000명을 초과할 경우, 매번 전체 빌드를 돌리면 시간과 자원 낭비가 큽니다.

```
[기존] 전체 빌드 (Full Build)
organic-graph.json → 전체 d3-force (3000 ticks) → 전체 JSON 출력

[목표] 증분 빌드 (Incremental Build)
기존 좌표 유지 + 신규/수정 노드만 삽입 → 부분 d3-force (500 ticks) → 패치 머지
```

이를 통해 빌드 시간을 **10분 → 30초** 수준으로 단축할 수 있으며, Vercel Deploy Hook과 결합하면 유저 요청 승인 후 1분 내 배포가 가능합니다.

---

## 6. 기술적 과제 상세 분석 (Technical Challenges)

### 6.1 LLM 환각 (Hallucination) 방어

| 위험도 | 시나리오 | 방어 수단 |
|--------|---------|----------|
| 🟡 중간 | 존재하지 않는 콜라보를 실재로 판정 | `search_web` 도구가 **공신력 있는 출처(뉴스 기사) 2개 이상**을 반환했을 때만 승인하도록 시스템 프롬프트에 하드코딩 |
| 🟡 중간 | 아티스트 이름을 잘못된 한글로 변환 | `search_spotify` 결과의 공식명과 유저 제안명을 **정확히 문자열 비교**하여 불일치 시 자동 보류 |
| 🟢 낮음 | 무드/감상 기반 연결 요청 | 주관적 관계는 `USER_PROPOSED` 엣지 타입(점선, 반투명)으로 별도 시각화. 정식 엣지와 구분 |

### 6.2 국내 웹사이트 크롤링 제약

- 나무위키, 멜론 등은 Cloudflare/봇 차단이 강력하여 LLM의 `search_web` 도구가 직접 접근 불가
- **해법**: Google Programmable Search Engine(CSE) API를 검색 소스로 통일. 구글 인덱스에 캐싱된 국내 사이트 스니펫을 간접적으로 활용
- Spotify + MusicBrainz + iTunes의 3중 API 교차 검증으로 이미 대부분의 팩트 확인이 가능

### 6.3 동시성 및 Race Condition

- 같은 아티스트에 대해 동시에 상충되는 2건의 수정 요청("백아" vs "Baek A")이 들어올 경우
- **해법**: `data_overrides` 테이블에 `target_id` 기준 UNIQUE 제약 + UPSERT(ON CONFLICT DO UPDATE) 사용. 먼저 승인된 건이 우선권

### 6.4 Vercel 서버리스 실행 시간 제한

- Vercel Hobby 플랜의 서버리스 함수 제한 시간: **10초**
- LLM 호출 + 웹 검색 + DB 저장을 10초 안에 완수해야 함
- **해법**:
  - GPT-5 Nano의 응답 속도가 매우 빠릅니다 (TTFT < 1초, 전체 < 3초)
  - 검증 도구를 **병렬 호출** (Promise.all)하여 총 소요 시간 5~7초로 압축 가능
  - Pro 플랜($20/월) 전환 시 제한 시간 60초로 여유 확보

---

## 7. Phase별 개발 계획 (Implementation Phases)

### Phase 1: 인증 및 DB 기반 구축 (예상 1~2주)
- [ ] Supabase 프로젝트 생성 및 위 3개 테이블 (`user_profiles`, `universe_edit_logs`, `data_overrides`) 마이그레이션
- [ ] Auth.js v5 (Google OAuth) 연동: `.env.local`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 세팅
- [ ] 로그인 후 프로필 등록(성별, 연령대, 뉴스레터) 온보딩 스크린 구현
- [ ] Admin 계정 지정 메커니즘 (DB의 `role` 컬럼 수동 세팅 또는 환경변수 화이트리스트)

### Phase 2: UI — 에디트 제안 모달 (예상 1주)
- [ ] 우측 상단 `✏️` 에디트 아이콘 배치 (공유 버튼 좌측)
- [ ] 에디트 입력 Modal 디자인: 자연어 입력 필드 + 제출 버튼 + 이전 요청 히스토리 표시
- [ ] API Route `POST /api/universe/suggest` 엔드포인트 생성 (Rate Limit 미들웨어 포함)
- [ ] 유저 미인증/프로필 미완성 시 로그인/프로필 등록 유도 플로우

### Phase 3: AI 에이전트 엔진 (예상 2~3주)
- [ ] Vercel AI SDK v5 설치 및 GPT-5 Nano Provider 연동
- [ ] 시스템 프롬프트(System Prompt) 정밀 작성 — Intent 분류, 검증 기준, 출력 JSON 스키마 정의
- [ ] Function Calling 도구 4종 구현 (`search_web`, `search_spotify`, `search_musicbrainz`, `search_itunes`)
- [ ] 판정 결과(Approved/Pending/Rejected)를 DB에 저장하고 유저에게 실시간 피드백하는 API 파이프라인 완성
- [ ] Gemini 2.5 Flash-Lite 무료 백업 Provider 추가 (GPT-5 Nano 장애/쿼터 소진 시 자동 전환)

### Phase 4: 데이터 파이프라인 자동화 (예상 1~2주)
- [ ] `data_overrides` → `organic-graph.json` 머지(Merge) 스크립트 작성
- [ ] Vercel Deploy Hook 트리거 연동 (승인 건 누적 10건 또는 하루 1회 주기 빌드)
- [ ] 증분 빌드(Incremental Build) 프로토타입 — 기존 좌표 유지 + 신규 노드만 추가 시뮬레이션
- [ ] 빌드 완료 후 관리자에게 Slack/Discord 알림 발송 (선택)

### Phase 5: QA 및 안정화 (예상 1주)
- [ ] 환각(Hallucination) 에지 케이스 스트레스 테스트 (50건 이상의 다양한 요청으로 판정 정확도 측정)
- [ ] Rate Limit, 어뷰징 봇 방어 테스트
- [ ] 모바일/PC 양플랫폼 에디트 모달 UX 검수
- [ ] 관리자 대시보드에서 전체 로그 조회 및 수동 승인/거절 기능 확인

---

## 8. 최종 아키텍처 다이어그램 (Architecture Overview)

```
┌──────────────────────────────────────────────────────────┐
│                    K-Culture Universe V7.0                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   [유저 브라우저]                                          │
│     ├─ Canvas 우주 렌더링 (기존 V6.5 그대로)                │
│     ├─ ✏️ 에디트 버튼 → 제안 Modal                        │
│     └─ 🔗 공유 버튼 → Web Share API                       │
│                                                          │
│   [Next.js App Router — Vercel Edge]                     │
│     ├─ Auth.js v5 (Google OAuth)                         │
│     ├─ POST /api/universe/suggest                        │
│     │    ├─ Rate Limit 미들웨어 (1req/min)                │
│     │    ├─ Vercel AI SDK → GPT-5 Nano                   │
│     │    │    ├─ tool: search_web()                       │
│     │    │    ├─ tool: search_spotify()                   │
│     │    │    ├─ tool: search_musicbrainz()               │
│     │    │    └─ tool: search_itunes()                    │
│     │    └─ 판정 결과 → Supabase DB                       │
│     └─ GET /data/v5-*.json (정적 우주 데이터)              │
│                                                          │
│   [Supabase (PostgreSQL)]                                │
│     ├─ user_profiles                                     │
│     ├─ universe_edit_logs                                │
│     └─ data_overrides → Merge Script → Rebuild Trigger   │
│                                                          │
│   [GitHub Actions / Vercel Deploy Hook]                   │
│     └─ organic-graph.json + overrides → d3-force rebuild  │
│        → v5-layout/edges/details.json 재배포              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 9. 위험 요소 요약 (Risk Assessment)

| 위험 | 확률 | 영향 | 완화 수단 |
|------|------|------|----------|
| LLM 환각으로 잘못된 데이터 승인 | 중간 | 높음 | 시스템 프롬프트 하드코딩 + 출처 2건 이상 필수 |
| GPT-5 Nano API 장애/쿼터 소진 | 낮음 | 중간 | Gemini 2.5 Flash-Lite 자동 Fallback |
| Vercel 10초 서버리스 타임아웃 | 낮음 | 중간 | 병렬 Tool 호출 + Pro 플랜 전환 대비 |
| 아티스트 5,000명+ 시 빌드 지연 | 중간 | 낮음 | 증분 빌드(Incremental) 전략 선대응 |
| 어뷰징 봇의 대량 허위 요청 | 낮음 | 높음 | 구글 로그인 필수 + 프로필 완료 + 분당 1회 제한 |
| 동시 상충 수정 요청 (Race Condition) | 낮음 | 낮음 | DB UPSERT + 선착순 우선 |

---

> **다음 단계**: V6.5 안정화를 마무리한 뒤, Phase 1(인증 및 DB 구축)부터 착수합니다.
