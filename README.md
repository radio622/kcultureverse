# 🌌 K-Culture Universe

> K-Culture 아티스트들의 관계망을 별자리처럼 탐험하는 인터랙티브 음악 우주 지도

**[frompangyo.vercel.app/universe](https://frompangyo.vercel.app/universe)** — 바로 우주로 이동

---

## 🚀 V6.5 르네상스 업데이트 하이라이트
- **초거대 우주 팽창**: 기존 372명에서 **989명의 아티스트(노드)**와 **2,633가닥의 연결선(엣지)**으로 규모 3배 증가
- **외로운 별 소개팅 시스템**: 장르 기반(Genre Overlap) 우연의 일치 네트워크를 통해 외톨이 노드 비율을 40%에서 5.8%로 축소, 밀도 높은 성단(Cluster) 시각화 달성
- **하이브리드 터치 & 마우스 UI**: 바텀시트 연관 아티스트 뷰 리뉴얼 (수직 흔들림(Shake) 현상 제거, 클릭&드래그 스크롤, 배경 터치 시 자동 접힘 기능)
- **음악 연쇄 자동재생 시스템**: 1,000명의 방대한 아티스트 위성 카드를 돌릴 때 중앙(`Center Position`) 기준 가장 가까운 아이템을 탐지하는 옵저버 로직으로, 스와이프 시 자동으로 음악 재생 교체 (iTunes API 미리듣기 지원)
- **동적 카메라 줌-팬(Pan/Zoom) 적용**: 바텀시트가 올라오면 디바이스 크기에 맞춰 즉각적으로 우주가 뒤로 물러나듯 줌아웃(-) 되고 위로 이동하여, 플레이어와 1촌 별들을 가리지 않고 시야를 확보

---

## 🧬 아키텍처 (V6.5)

### 핵심 원칙
| 원칙 | 설명 |
|------|------|
| **Zero Runtime Physics** | 모든 노드 좌표는 빌드 타임에 d3-force로 스태틱 렌더링. 디바이스 발열 완벽 차단 |
| **3분할 데이터 로딩** | layout(124KB) 즉시 → edges(429KB) 백그라운드 → details(295KB) 후속 |
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
# 1. 수동 / CSV 일괄 수집 (가요 톱텐, 한국락 등 수백 명 동시 주입 및 iTunes 스캔)
npx tsx scripts/v6.4-batch-ingest-csvs.ts

# 2. 딥스캔 매칭 (아이유 꽃갈피, 이찬혁비디오 등 깊은 협업망 완전 수동 하드코딩)
npx tsx scripts/v6.3-inject-deep-relations.ts

# 3. 우주 소개팅 작전 (장르가 겹치는 외톨이 노드 상호 엣지 강제 결합, Hairball 방지)
npx tsx scripts/v6.5-socialize-lonely-stars.ts

# 4. JSON 우주 파일 렌더링 및 압축 (배포 직전 필수 실행)
npx tsx scripts/v5.4-build-universe.ts
```

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
