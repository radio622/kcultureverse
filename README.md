# 🌌 K-Culture Universe

> K-Culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 우주 지도

**[frompangyo.vercel.app/universe](https://frompangyo.vercel.app/universe)** — 바로 우주로 이동

---

## 🚀 V6.9 최신 업데이트 하이라이트

### V6.9 — 대규모 아티스트 확장 (2026-03-22)
- **우주 규모 대폭발**: **1,213명의 아티스트(노드)**, **3,196가닥의 연결선(엣지)**
- 18개 CSV 플레이리스트에서 **220명 신규 아티스트** 일괄 편입 (OST 65명, 2010년대 39명, 인디 42명, K-Rock 32명 등)
- **163명 아티스트 한글 이름 일괄 교정** (최재훈, 안재욱, 이지형, 송골매, 패닉, 윤도현밴드 등)
- **검색 ALIAS 100쌍+ 확장**: 한글↔영문 양방향 검색 완전 지원

### V6.8 — 데이터 품질 개선 (2026-03-22)
- GENRE_OVERLAP 1,413개 엣지 가중치 0.4→0.15 하향 (막연한 연결 투명화)
- "동시대 음악적 파형 공유" 라벨 → "장르 유사성"으로 솔직하게 교체

### V6.5 — 르네상스 업데이트 (2026-03-21)
- 초거대 우주 팽창: 기존 372명 → 989명으로 3배 증가
- 외로운 별 소개팅 시스템, 하이브리드 터치/마우스 UI, 동적 카메라 줌-패
- Web Share API, 지능형 유연 검색 (Alias 매핑)

---

## 🧬 아키텍처 (V6.9)

### 핵심 원칙
| 원칙 | 설명 |
|------|------|
| **Zero Runtime Physics** | 모든 노드 좌표는 빌드 타임에 d3-force로 스태틱 렌더링. 디바이스 발열 완벽 차단 |
| **3분할 데이터 로딩** | layout(151KB) 즉시 → edges(511KB) 백그라운드 → details(388KB) 후속 |
| **LOD 3단계 렌더링** | Far(점) / Mid(거대별 인플루언서 폰트 노출) / Close(상세 정보 및 렌더링) |
| **API 이중 스파이더** | Spotify API 한계 돌파를 위해 **MusicBrainz(MBID 발급)** + **iTunes(Cover & Audio)** 결합 |
| **중앙집중형 Audio** | 싱글톤 useAudio 훅을 통한 끊김 없는 크로스페이드(Fade in/out) 플레이어 경험 |

### 엣지 관계 유형
| 색상 | 관계 | 설명 |
|------|------|------|
| 🟢 `#86efac` | SAME_GROUP | 같은 그룹 멤버 |
| 🟣 `#c084fc` | FEATURED | 피처링 앨범 및 콜라보 활동 |
| 🔵 `#60a5fa` | PRODUCER | 주요 프로듀싱 담당 |
| 🟡 `#fbbf24` | WRITER | 작사/작곡 |
| ⚪ | COVER / INDIRECT | 리메이크 및 간접 영감 교류 |
| 🌫 | GENRE_OVERLAP | 딥스캔 스크립트를 통한 장르 및 플레이리스트(가요톱텐, 인디 라디오 등) 유대감 엣지 |

---

## 🛠 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 렌더러 | react-force-graph-2d (Canvas) + framer-motion |
| 레이아웃 계산 | d3-force (빌드 타임 오프라인) |
| 자동화 스크립트 | TSX (TypeScript Execute) 런타임 |
| 데이터 소스 | MusicBrainz API + iTunes API (+ Spotify API) |
| 스타일 | Vanilla CSS (커스텀 디자인 토큰) |
| 배포 | Vercel |

---

## 🧪 데이터 파이프라인 스크립트 모음

우주를 팽창시키거나 빌드할 때 사용하는 관리 스크립트들입니다. 모두 `npm run` 또는 `npx tsx`로 실행 가능합니다.

```bash
# 1. 수동 / CSV 일괄 수집 (가요 톱텐, 한국락, OST 등 수백 명 동시 주입 및 iTunes 스캔)
npx tsx scripts/v6.4-batch-ingest-csvs.ts

# 2. 딥스캔 매칭 (아이유 꽃갈피, 이찬혁비디오 등 깊은 협업망 완전 수동 하드코딩)
npx tsx scripts/v6.3-inject-deep-relations.ts

# 3. 우주 소개팅 작전 (장르가 겹치는 외톨이 노드 상호 엣지 강제 결합, Hairball 방지)
npx tsx scripts/v6.5-socialize-lonely-stars.ts

# 4. 한글 이름 일괄 교정 (163명+ 아티스트 한글 공식명 주입)
python3 scripts/v6.5-fix-korean-names.py

# 5. JSON 우주 파일 렌더링 및 압축 (배포 직전 필수 실행)
npx tsx scripts/v5.4-build-universe.ts
```

---

## 📚 버전 개발 문서

| 버전 | 문서 | 상태 |
|--------|------|------|
| V7.0 | [`docs/V7_ROADMAP.md`](docs/V7_ROADMAP.md) | 📋 계획 중 — AI 게이트키퍼 + 프리미엄 탐험(자율주행) |
| V6.9 | [`docs/V6.9_ROADMAP.md`](docs/V6.9_ROADMAP.md) | ✅ 완료 — 대규모 아티스트 추가 (220명) |
| V6.8 | [`docs/V6.8_ROADMAP.md`](docs/V6.8_ROADMAP.md) | ✅ 완료 — 데이터 품질 개선 |

---

## 💻 개발 환경 설정

```bash
# 클론
git clone git@github.com:radio622/kcultureverse.git
cd kcultureverse

# 패키지 설치
npm install

# 데이터 압축 빌드
npx tsx scripts/v5.4-build-universe.ts

# 개발 서버 실행
npm run dev
# → http://localhost:3000/universe
```

---

## 📜 라이선스
Private — JitiGravity K-Culture Universe Team
