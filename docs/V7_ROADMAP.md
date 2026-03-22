# 🌟 K-Culture Universe V7.0 Roadmap: Crowdsourced Data Gatekeeper

## 1. 개요 (Overview)
V7.0의 핵심 목표는 **"아키텍처의 근본적인 변경 없이, 유저가 직접 데이터(아티스트 정보 및 관계)를 교정하고 팽창시킬 수 있는 자가 발전형 생태계"**를 구축하는 것입니다.
이를 위해 경량화된 LLM API(Gemini 1.5 Flash/Pro, GPT-4o-mini 등)를 활용한 **AI 데이터 게이트키퍼(Gatekeeper)** 시스템을 도입하여 무분별한 훼손을 방지하고 유효한 정보만을 판별해 데이터베이스에 편입시킵니다.

## 2. 핵심 기능 요구사항 (Core Features)

### 2.1 UI/UX: 에디트(제안) 인터페이스
- **위치**: 화면 우측 상단 아티스트 외부 링크 버튼 좌측에 작은 `✏️ 에디트(제안)` 아이콘 배치
- **기능**: 유저가 편안한 자연어로 수정/추가 요청을 보낼 수 있는 Modal 폼(Chat 형태) 제공
- **요청 텍스트 예시**:
  - *"백아의 공식 명칭은 Baek A가 아니라 백아입니다. 고쳐주세요."*
  - *"백아가 인터뷰에서 한로로의 곡 0+0을 극찬했어요. 둘을 추천 관계로 이어주세요."*

### 2.2 AI 게이트키퍼 파이프라인 (Backend)
- **프롬프트 엔진 (LLM)**: 유저의 자연어 요청을 분석하고 Intent(Name 수정, Edge 연결, 추가 등)를 데이터 포맷으로 파싱
- **검증 툴 (Web Search API & Function Calling)**:
  - LLM이 직접 검색 도구(Tavily Search API, Google Programmable Search 등)를 활용하여 팩트 교차 검증 (뉴스 기사, 인스타그램 등).
  - Spotify API 도구를 활용하여 실제 아티스트 존재 여부 및 공식 메타데이터 대조 검증.
- **권한 및 분기 처리**:
  - `Admin (관리자)`: 별도 검증 없이 즉시 승인(Approved)
  - `일반 유저 (검증 성공)`: 로직 통과 시 `Approved` 처리 후 데이터 수정 오버라이드 예약, 유저에게 "반영 처리 중입니다" 알림
  - `일반 유저 (검증 실패/모호함)`: `Pending` 처리 후 사유와 함께 게시물(Log)로만 기록 남김

### 2.3 데이터 저장 및 무중단 배포 (Database & CI/CD)
- **Zero Architecture Change**: 기존 V5 방식의 엄청나게 빠른 정적 렌더링(Static Build, d3-force 베이킹) 프레임워크 유지
- **데이터베이스 연동 (Log & Override)**:
  - Vercel Postgres, Supabase 등의 무료/경량 DB에 유저 제안 로그 및 '승인된 패치(Overrides)'만 누적 저장.
- **적용 방식 (Webhook Build)**:
  - 승인 건이 쌓이면 Github/Vercel Deploy Webhook을 호출하여 하루 1회 또는 승인 10건 도달 시 백그라운드에서 `npx tsx scripts/v5.4-build-universe.ts`를 자동 재빌드하여 우주를 갱신.

---

## 3. 예상 과제 및 해결 방안 (Challenges & Solutions)

| 예상 과제 (Challenges) | 해결 방안 (Solutions) |
| --- | --- |
| **LLM 환각 (Hallucination)**<br>거짓 정보를 진짜처럼 판단 | • 프롬프트 튜닝 강화 (`"공신력 있는 출처 2개 이상 확보 시에만 승인할 것"`).<br>• 무드/평가 등 주관적 요청은 정식 엣지(Edge)가 아닌 `USER_PROPOSED`(점선 처리)와 같은 특수 엣지로 반영해 안전판 마련. |
| **API 비용 및 어뷰징 봇 공격** | • Next.js 서버리스 API 라우트에 엄격한 Rate Limit 적용.<br>• 장난성 트래픽 방지를 위한 구글/카카오 소셜 간편 로그인 (NextAuth.js) 도입으로 최소한의 신원 확인된 유저에게만 글쓰기 권한 부여. |
| **국내 웹사이트 크롤링 방어벽** | • 나무위키, 멜론 등의 Cloudflare 봇 차단 정책 우회를 직접 시도하지 않고, 구글 검색 API 인덱싱에 의존하도록 검색 소스(Source) 정규화.<br>• MusicBrainz / Spotify API 교차 검증으로 백업. |

---

## 4. Phase별 개발 계획 (Implementation Phases)

### Phase 1: DB 및 기반 시스템 구축
- [ ] 로깅용 Vercel Postgres / Supabase 환경 셋업 및 `universe_edit_logs` 테이블 설계
- [ ] Auth.js (NextAuth) 연동으로 Admin/일반 User 권한 분리 레이어 세팅
- [ ] 클라이언트 상의 ✏️ Modals UI/UX 레이아웃 설계 및 API 연결

### Phase 2: AI 에이전트 연동 (Vercel AI SDK)
- [ ] Vercel AI SDK 연동 (Gemini 1.5 Flash 또는 GPT-4o-mini 모델 선택)
- [ ] LLM에게 쥐여줄 `search_web(query)`, `search_spotify(artist)` 외부 검증 툴(Tools) 작성
- [ ] 자연어 제안 파싱 및 판별을 위한 시스템 프롬프트(System Prompt) 정밀 최적화

### Phase 3: 데이터 파이프라인 (CI/CD) 자동화
- [ ] 승인된(Approved) 데이터만을 취합하여 정적 JSON 위에 덮어쓰는(Merge) 오버라이드 스크립트 구축
- [ ] Vercel 배포 트리거(Deploy Hook) 연동하여 유저의 데이터가 실제 우주 지도에 무중단 자동 반영되는 워크플로우 완성
