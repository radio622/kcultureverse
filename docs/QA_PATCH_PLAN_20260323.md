# 🛠 V7.4.1 핫픽스 패치 플랜 (For Sonnet)

이 문서는 2026-03-23 새벽 라이브 QA에서 발견된 이슈들을 해결하기 위한 구체적인 액션 플랜입니다.  
**V7.5 개발 시작 전, V7.4 기반 코드에 핫픽스로 적용**합니다.  
Claude Sonnet이 이 문서를 읽고 각 패치를 순서대로 진행할 수 있도록 작성되었습니다.

---

## 📸 패치 1 (최우선): 우주맵 이미지 렌더링 정상화 (이슈 #2, #8)

- **목표**: 일반 줌 레벨에서도 아티스트 사진이 표시되어야 한다. 바텀시트가 열려도 우주맵 사진이 사라지지 않아야 한다.
- **대상 파일**: `src/components/GraphCosmos.tsx`
- **현재 코드 위치 (정확히 확인됨)**:
  - LOD 결정: 404행 `const lod = globalScale < 0.4 ? "far" : globalScale < 1.5 ? "mid" : "close";`
  - MID 구간: 443~478행 — 이미지 없음, 원+이니셜만 렌더링
  - CLOSE 구간: 503행 `if (node.image && (isFocused || isHop1 || isMajor))` — 조건 과도하게 엄격
- **수정 방법**:
  1. **MID LOD (443행 근처)**에서 `node.image`가 있으면 이미지를 원 안에 그리도록 추가. `getCachedImage(node.image)`를 호출하고, `img.complete && img.naturalWidth > 0` 이면 `ctx.save() → clip() → drawImage() → ctx.restore()` 패턴으로 렌더링. 이미지 로딩 중이면 기존처럼 이니셜로 fallback.
  2. **CLOSE LOD (503행)**에서 `&& (isFocused || isHop1 || isMajor)` 조건 제거. `node.image`가 있으면 무조건 이미지 표시.
  3. LOD 임계값 조정 검토: MID 상한값(`1.5`)을 낮춰서(`1.2`~`1.0`) 이미지가 더 일찍 표시되게 하는 것도 옵션.
- **예상 효과**: 패치 1만 적용해도 이슈 #8(바텀시트 열 때 사진 사라짐)도 자동 해결될 가능성 높음.
- **주의**: MID에서 이미지를 그리면 캐시 미스 → `new Image()` 생성이 많아질 수 있으므로, `getCachedImage` 캐시 제한(현재 500개)이 충분한지 확인.

---

## 🎵 패치 2: iTunes 동명 곡 오작동 수정 (이슈 #3)

- **목표**: "라이너스의 담요" 같은 밴드명 클릭 → 동명의 다른 가수 노래가 재생되는 문제 해결.
- **대상 파일 및 정확한 위치 (코드 확인 완료)**:
  - `src/lib/spotify.ts` 432행: `getArtistPreviewViaSearch()` — 서버사이드 사용
  - `src/hooks/useAutoWarp.ts` 113행: `fetchPreview()` — 자율주행 클라이언트사이드
  - 두 곳 모두 `term=${artistName}&entity=song&limit=5`로 검색 후 `previewUrl` 있는 첫 번째 트랙을 선택.
- **문제**: 검색 결과의 `artistName` 필드와 요청한 아티스트명이 일치하는지 검증하지 않음.
- **수정 방법**: 두 함수 모두 동일하게:
  ```ts
  // 변경 전
  const validTrack = data.results?.find((t: any) => t.previewUrl) ?? null;
  
  // 변경 후 — artistName 포함 여부 검증 추가
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const target = normalize(artistName);
  const validTrack =
    data.results?.find((t: any) =>
      t.previewUrl && normalize(t.artistName ?? "").includes(target)
    ) ??
    data.results?.find((t: any) => t.previewUrl) ?? // fallback: 검증 실패해도 재생은 함
    null;
  ```
  - 1차: artistName이 포함된 트랙 우선
  - 2차 fallback: 그래도 없으면 기존처럼 아무 트랙이나 (아예 재생 못 하는 것보단 나음)

---

## 🔗 패치 3: 엣지(관계선) 클릭 팝업 복구 (이슈 #4)

- **목표**: 엣지 클릭 시 관계 설명 팝업이 뜨도록 복구.
- **대상 파일**: `src/components/GraphCosmos.tsx`
- **현재 코드 위치 (정확히 확인됨)**:
  - 890행 `onLinkClick` 핸들러
  - **892행**: `if (currentScale < 0.4) return;` — 줌 너무 멀면 차단 (정상)
  - **899행**: `if (!focusedId) return;` — 포커스 아티스트 없으면 차단 ← 이것이 원인
  - **904행**: `if (!focusEdgeKeys.has(edgeKey)) return;` — 포커스 아티스트의 1촌 엣지만 허용
- **원인 추정**: 엣지를 클릭하는 순간 `focusedId`가 없거나, 이미 UI 레이어(`BottomSheet` 등)의 `pointerEvents`가 클릭을 가로채고 있을 가능성.
- **수정 방법**:
  1. `focusedId` 조건을 완화하거나, 포커스 없이도 팝업이 뜨도록 수정 검토.
  2. 또는 `onLinkClick`에 `console.log`를 심어서 실제로 핸들러가 호출되는지 먼저 확인.
  3. 만약 핸들러 자체가 호출 안 된다면 → `pointerEvents` 레이어 문제 (BottomSheet나 overlay div가 Canvas 위에서 클릭을 가로채는 것).

---

## 👤 패치 4: 우측 상단 로그인 아이콘 안 보임 (이슈 #5)

- **목표**: 우주맵 화면에서 유저 아바타(로그인) 버튼이 항상 보여야 한다.
- **현재 코드 위치 (확인됨)**:
  - `src/components/UserAvatar.tsx` 48행: `style={{ position: "fixed", top: 16, right: 66, zIndex: 200 }}`
  - `src/app/universe/page.tsx` 524행: `<UserAvatar />`
- **원인 추정**: 화면 우측 상단의 다른 버튼들(공유 버튼 등)과 겹침 또는 Auth.js 세션 로딩 중 렌더링 타이밍 이슈.
- **수정 방법**:
  1. 브라우저 DevTools에서 `#user-avatar-btn` 렌더링 여부 확인.
  2. 공유 버튼의 위치(`right` 값)와 `UserAvatar`의 `right: 66`이 겹치는지 확인.
  3. 겹침이 원인이라면 `right` 값을 조정하거나 두 개를 한 컨테이너 안에 묶어서 flex 배치.
  4. Auth.js 문제라면 `status === "loading"` 시에도 반투명 placeholder가 보이도록 처리.

---

## 🔍 패치 5: 전체보기(⊞) 버튼 UX 개선 (이슈 #6)

- **목표**: 전체보기 클릭 시 1,392명이 먼지처럼 보이는 현상 개선.
- **현재 코드 위치 (확인됨)**: `src/components/GraphCosmos.tsx` 712~714행
  ```ts
  const handleZoomToFit = useCallback(() => {
    const fg = fgRef.current as { zoomToFit?: (ms: number, padding: number) => void } | null;
    fg?.zoomToFit?.(800, 60);
  }, []);
  ```
- **수정 방법 옵션 A (추천)**: `focusedId`가 있을 때는 포커스 아티스트의 1촌 노드들만 fit하는 "로컬 줌":
  ```ts
  // focusedId 있으면 해당 아티스트를 적당히 줌인, 없으면 전체 fit
  if (focusedId) {
    (fgRef.current as any)?.zoom(1.2, 800);
    (fgRef.current as any)?.centerAt(
      graphData.nodes[focusedId]?.x, graphData.nodes[focusedId]?.y, 800
    );
  } else {
    fg?.zoomToFit?.(800, 60);
  }
  ```
- **수정 방법 옵션 B (간단)**: `zoomToFit` 후 최소 줌 레벨을 0.4로 강제 보정 (현재 초기 로드에 이미 유사 로직 있음 703행):
  ```ts
  fg?.zoomToFit?.(800, 60);
  setTimeout(() => {
    const cur = (fgRef.current as any)?.zoom?.();
    if (cur && cur < 0.4) (fgRef.current as any)?.zoom(0.4, 400);
  }, 900);
  ```

---

## ⏭ 패치 6: 미리듣기 UX 보완 (이슈 #7, 선택적)

- **목표**: 수동 클릭 미리듣기가 30초 후 끊기는 것은 정상 동작이나, UX 보완 검토.
- **현재 동작**: 자율주행(`isWarping`) 시에만 30초 후 다음 아티스트로 이동. 수동 클릭은 1곡 재생 후 정지.
- **확인 사항**: 수동 재생이 끝날 때 미니플레이어 상태가 깔끔하게 초기화되는지 (`isPlaying`, `progress`, `trackName` 등).
- **개선 아이디어 (선택적)**: 수동 재생 종료 후 "같은 아티스트의 다른 곡 재생" 버튼 표시 또는 자동 재생 옵션 추가.

---

## ✅ 작업 완료된 항목 (별도 조치 불필요)

| 이슈 | 상태 | 커밋 |
|------|------|------|
| #1 카드덱 하단 잘림 | ✅ 수정 완료 | `1e1be69` |
| 바텀시트 빈 공간 (auto 높이) | ✅ 수정 완료 | `2602be3` |

---

## 📁 참고 파일

- **전체 이슈 목록**: `docs/QA_ISSUES_20260323.md`
- **주요 코드 파일**:
  - `src/components/GraphCosmos.tsx` — 렌더링/엣지 팝업/줌 로직
  - `src/lib/spotify.ts` — iTunes preview 서버사이드
  - `src/hooks/useAutoWarp.ts` — iTunes preview 클라이언트사이드
  - `src/components/UserAvatar.tsx` — 로그인 아이콘
  - `src/components/BottomSheet.tsx` — 바텀시트 높이
