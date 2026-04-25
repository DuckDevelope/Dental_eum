# Sonnet 지시서 — 히어로 스크롤 시퀀스 자연스러움 개선

## 배경

박사님 피드백: "첫페이지 인터렉션이 안되고 프레임 엄청나게 끊기는 영상이 나온다."

Opus가 Playwright로 실측·웹 best practice 조사 완료. 아래 5가지를 정확히 적용하면 된다.

## 측정된 사실 (변경하지 말 것)

- phase1 60장 → 809ms, 전체 476장 → ~2초 (localhost 기준)
- 스크롤 중 RAF max 233ms (한 번 크게 stall) / p95 50ms / jank 15.5%
- SCROLL_TOTAL = 476 × 1.5 = 714px — 휠 한 번에 시퀀스 거의 전체 통과
- scrub 0.6 + 짧은 scroll → 보간이 너무 짧음

## 변경 대상 파일

- `assets/js/main.js` (전체 수정)
- 필요 시 `assets/css/main.css` (loader 진행률 텍스트 표시 보강만, 디자인 변경 X)

**다른 파일·페이지는 건드리지 말 것.** index.html DOM 구조도 그대로 유지(스크립트만 동작 변경).

## 변경 요구사항 (5건)

### 1. preload 정책 변경 — 전부 로드 후 reveal
- 기존: phase1(60장) 끝나면 즉시 `revealSite()` → phase2 416장이 background에서 메인스레드 점유.
- 변경: **476장 전부 디코드 완료 후 reveal**. phase 분리 폐기.
- 진행률은 loader에서 0–100% 텍스트 + 기존 spinner로 표현:
  - `loaderSub.textContent = \`프레임을 불러오는 중입니다… (\${loaded}/\${total})\``
  - 매 10장마다 갱신 (너무 자주 갱신하면 그 자체가 jank).
- timeout fallback: 10초 안에 95%(=453장) 이상 못 받으면 받은 만큼만으로 reveal하고 console.warn.

### 2. SCROLL_TOTAL 늘림 — 자연스러운 스크롤 거리
- 기존: `SCROLL_PX_PER_FRAME = 1.5` → 714px
- 변경: `SCROLL_PX_PER_FRAME = 4` → 476×4 = 1904px (≈ 데스크탑 휠 5–6노치, 부드럽게 풀림)
- 모바일 터치는 한 손가락 swipe로 1904px 이동 가능 — 무리 없음.

### 3. scrub 강화
- 기존: `scrub: 0.6`
- 변경: `scrub: 1.2` — 보간 폭 확대, 휠 입력의 미세 점프를 GSAP가 lerp로 흡수.

### 4. drawFrame 최적화
- 같은 idx 재요청 시 즉시 return:
  ```js
  function drawFrame(idx) {
    if (idx === currentIdx && _drawnOnce) return;  // 같은 frame 다시 그리지 않음
    ...
  }
  ```
  (단, resize 직후 강제 redraw는 유지 — flag 분리)
- `ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';` (1280×720 → viewport 확대 시 'high'는 비쌈, 'low'로 충분)

### 5. reduced-motion + 모바일 분기
- reduced-motion: ScrollTrigger 자체는 동작시키되 `scrub`을 더 짧게 (`0.3`) — 사용자 의도 반영하되 prefers-reduced-motion에선 모션 자체를 줄임. 또는 첫 frame만 정적으로 표시 + ScrollTrigger 비활성. **둘 중 후자(정적)로 통일** — 더 안전.
- 모바일(터치): 그대로 유지. 단, 콘솔에서 `navigator.deviceMemory < 4` 또는 `matchMedia('(max-width: 768px)')` 일 때 SCROLL_TOTAL을 1.5배 더 늘려 (2856px) 더 천천히 — 모바일 휠은 없고 swipe 거리 확보 필요.

## 수용 기준 (Playwright 자체 검증)

`_qa/diagnose-stutter.mjs` 다시 돌려 다음 모두 충족해야 함:
- RAF avg interval ≤ 18ms
- RAF p95 interval ≤ 22ms
- RAF max interval ≤ 60ms (단발성 GC는 어쩔 수 없음, 60 이하)
- jank 비율(>33ms) ≤ 5%
- frame index 단조 증가, 0 → ~150 (30 wheel × 30px = 900px / 1904px ≈ 47% → frame 224 근처)
- 콘솔 에러 0건

기존 `check-v3-final.mjs` 도 PASS해야 함 (회귀 방지).

## 주의 사항 (실수 방지)

- **createImageBitmap 사용하지 말 것** — 476장 RGBA 디코드 시 1.7GB 메모리, 모바일 GPU 폭발.
- **video element로 교체하지 말 것** — Firefox 호환성, 키프레임 재인코딩 환경 부재. 이번 PR 범위 밖.
- **Lenis 같은 smooth-scroll 라이브러리 도입하지 말 것** — 의존성·접근성 이슈, ScrollTrigger scrub 1.2면 충분.
- **frame 파일이나 frame 개수 변경 금지** — 476장 webp 그대로 사용.
- **STATUS.md / CLAUDE.md 갱신은 Opus가 한다** — Sonnet은 코드만.
- **새 npm 패키지 추가 금지.** GSAP CDN만 사용.

## 마무리

- `_qa/diagnose-stutter.mjs` 결과 (콘솔 + diagnose-stutter.json)를 보고에 첨부.
- `check-v3-final.mjs` 결과도 함께 첨부.
- 변경 diff는 main.js 위주로 200줄 이하 권장.
- commit 메시지: "v3 stutter fix — 전체 preload + SCROLL_TOTAL 1904 + scrub 1.2".
- 기존 `_qa/screenshots-*` 디렉토리는 손대지 말 것.
