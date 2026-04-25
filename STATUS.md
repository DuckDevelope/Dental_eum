# STATUS — 이음 기공소 홈페이지

> 세션 재개 시 가장 먼저 읽는 스냅샷. 의미 있는 진전·결정·블로커 변경 시 즉시 갱신.

## 현재 상태 (2026-04-26 — v4 분위기 전환: 영상 hero + 다크/라이트 교차 섹션, 아모레 톤)

박사님 지시: "아모레퍼시픽처럼 분위기 다 바꾸자". v3.x frame sequence는 보존하고 메인을 영상 기반으로 갈아엎음.

- ✅ **영상 자료 트랜스코딩 완료 (assets/video/)**
  - `cad-1080.mp4` (1.4MB, 세로 1080×1920) — 박사님 명시 메인 hero. CAD 작업 화면.
  - `closeup-1080.mp4` (940KB, 가로 1920×1080) — 보철 클로즈업 (박사님: "틀니" 단어 금지)
  - `result-1080.mp4` (2.2MB, 세로 1080×2048) — 기공 결과물 실물 트레이
  - `*-poster.jpg` 3장 — 영상 로딩 전 정적 이미지 (preload)
  - 원본 4K (~50MB)는 `_raw/`에 symlink (gitignore)
- ✅ **메인 페이지 v4 재설계** (Opus)
  - Hero: CAD 영상 풀스크린 autoplay·muted·loop·playsinline + dark vignette + SVG grain noise + top mask + 미니멀 카피
  - Section 1 (라이트 베이지) — "장인의 4단계" Process 카드 4개 (본뜨기/설계/제작/마무리)
  - Section 2 (다크) — "이음의 작업 풍경" Story 가로 스크롤 카루셀 (영상 3개 + Coming Soon 카드)
  - Section 3 (라이트 베이지) — "주력 작업 분야" Specialty 카드 4개 (크라운/지르코니아/세라믹 인레이/의치)
  - Section 4 (다크 CTA) — 거래 문의 강조 + 문의하기 / 오시는 길 버튼
  - 다크/라이트 교차로 호흡감 (아모레 패턴)
  - IntersectionObserver fade-up reveal (data-reveal + .is-visible 토글, transition 1.1s)
  - reduced-motion: 영상 정지 + reveal 즉시
- ✅ **frame sequence(v3.x) 보존**
  - `assets/js/frames-hero.js` + `assets/css/frames-hero.css` — 박사님 지시 "필요할 때 쓰자"
  - `frames_webp/` 디렉토리 그대로 (26MB, 476장)
  - 부활 시 index.html에서 main.js 자리에 frames-hero.js 로드 + main.css 자리에 frames-hero.css 로드
- ✅ **회귀 테스트 분리**
  - `_qa/check-v4-main.mjs` — 신규. 영상 hero + 섹션 reveal + 금지어 "틀니" 검사 등 27/27 PASS
  - `_qa/check-v3-final.mjs` — frames-hero 부활 시점 검증용으로 보존 (현재 메인엔 fail이 정상)
- ⏭ 박사님 카피 윤문 필요 (Hero / 4 섹션 lede / 카드 본문)
- ⏭ 소장님 실제 작업장 영상·사진 받으시면 Story 카드의 "Coming Soon" 자리 + 영상 일부 교체

## 이전 상태 (2026-04-26 — v3.2 스크롤 부드러움 + 지도 동작)

- ✅ **v3.2 히어로 스크롤 파이프라인 재설계 (Opus, 박사님 지시 — 끊김 끝까지 해결)**
  - GSAP ScrollTrigger 제거. CSS sticky pin + 자체 rAF lerp 구동
  - Canvas attribute를 native 1280×720으로 두고 CSS object-fit:cover로 viewport 스케일링
    → drawImage(img, 0, 0) 1:1 memcpy, GPU 컴포지터가 업스케일 처리 → 메인 스레드 비용 거의 0
  - `img.decode()` 강제 — 첫 paint 시 lazy decode가 잡아먹는 stall 제거
  - rAF idle 자동 정지 (lerp 수렴 시 멈췄다가 scroll 이벤트로 wake)
  - 텍스트 레이어 style write 캐시 (불변 시 skip) → compositor 부담 ↓
  - reduced-motion: lerp만 끄고 즉시 매핑 유지 → 사용자 모션 선호 반영하면서도 frame 진행
  - GSAP CDN 의존성 완전 제거 (CSP/CDN 다운 시 안전)
- ✅ **Playwright check-v3-final.mjs 41/41 PASS** (회귀 0)
- ⚠ Playwright headless WSL2에서 diagnose-stutter는 30fps lock 패턴이 잔존 (avg 22ms / p95 33ms)
  → SwiftShader 소프트 컴포지팅 환경 한계. 실 브라우저(Intel iGPU 이상)에서는 60fps 도달 예상.
  → 알고리즘 차원 비용은 이전 대비 ↓ (drawImage 1:1, decode 강제, idle-stop)
- ✅ **지도 동작 — location 페이지** (Opus, 박사님 지시 — "네이버든 카카오든 되도록")
  - 기본: OpenStreetMap + Leaflet (API 키 불필요, 즉시 동작)
  - 골드 톤 SVG 핀 + 인포 팝업
  - Naver / Kakao / Google 지도 빠른 링크 버튼 (외부 새 탭)
  - 박사님이 카카오 JavaScript 키 입력 시 자동으로 카카오맵으로 전환되는 분기 유지

## 이전 상태 (2026-04-26 — v3 초기)

- ✅ **v3 랜딩 히어로 완료 (2026-04-26, Sonnet)** — Vanilla HTML/CSS/JS, GSAP ScrollTrigger 스크롤 시퀀스
- ✅ v2(Astro 기반) `_legacy_v2/`로 보관 완료
- ✅ Playwright 자체 검증 PASS — 데스크탑 1440×900 + 모바일 390×844 양쪽 통과
- ✅ Frame index 단조 증가: 0→48→96→143→191 (0/25/50/75/100%)
- ✅ 콘솔 에러 0건, 네트워크 실패 0건
- ✅ GSAP CDN + Pretendard CDN 정상
- ✅ 텍스트 3단계 페이드 (슬로건→메인→클로징) 동작 확인
- ⏭ 박사님 카피 윤문 필요 (아래 참조)
- ⏭ 추후: placeholder 섹션 이하 콘텐츠 추가

## 결정 로그

| 일자 | 결정 | 근거 |
|------|------|------|
| 2026-04-26 | B안 채택 | 박사님 결정 — 최신 기술 + 인터랙션 적극 활용 |
| 2026-04-26 | 계좌번호 공개 | B2B 거래 편의 |
| 2026-04-26 | 단일 파일 정책 폐기, 외부 fetch 허용 | 박사님 지시 |
| 2026-04-26 | **Astro v5** 채택 | 박사님 확정 (권장안 #1) |
| 2026-04-26 | **Giscus** 게시판 채택 | 박사님 확정 (권장안 #2) |
| 2026-04-26 | **Tally** 문의 폼 채택 | 박사님 확정 (권장안 #3) |
| 2026-04-26 | 무료 스톡 이미지 임시 사용 | 박사님 확정 (권장안 #4), 추후 소장님 실사 교체 |
| 2026-04-26 | **GitHub Pages** 호스팅 | 박사님 확정 (권장안 #5) |
| 2026-04-26 | **Pretendard Variable + KoPub바탕** 폰트 | 박사님 확정 (권장안 #6) + Cormorant Garamond 영문 세리프 추가 |
| 2026-04-26 | 게시판 저빈도 운영 가정 | 박사님 확정 (권장안 #7) |

## v2 빌드 체크리스트

- [x] `_legacy_v1/` 보관 완료
- [x] Astro v5 프로젝트 초기화 (package.json 직접 작성)
- [x] `src/layouts/BaseLayout.astro` — 헤더·푸터·폰트·커스텀 커서·모바일 햄버거
- [x] `src/styles/global.css` — CSS 변수, 폰트 @import, 리셋, 유틸리티
- [x] `src/components/Hero.astro` — 풀스크린 + Ken Burns 줌 (25s) + fade-up
- [x] `src/components/StepSection.astro` — 4 step 이미지+텍스트 오버레이 그리드
- [x] `src/components/GalleryGrid.astro` — 호버 줌 + 캡션 오버레이
- [x] `src/components/ContactCard.astro` — 연락처 카드 (공통)
- [x] `src/components/KakaoMap.astro` — placeholder 상태 안내 + 실 API 초기화 분기
- [x] `src/components/Giscus.astro` — placeholder 안내 + 실 Giscus 스크립트 분기
- [x] `src/components/TallyForm.astro` — placeholder 안내 + 실 iframe 분기
- [x] `src/pages/index.astro` — 메인 (히어로 + trust strip + steps + about teaser + gallery + contact CTA)
- [x] `src/pages/about.astro` — 기업소개 (인사말 + 가치 4개 + 갤러리 + 제작 목록)
- [x] `src/pages/location.astro` — 오시는 길 (카카오맵 + 교통 + 영업시간)
- [x] `src/pages/board.astro` — 일반게시판 (Giscus General)
- [x] `src/pages/qna.astro` — Q&A (FAQ 4개 + Giscus Q&A)
- [x] `src/pages/contact.astro` — 문의하기 (Tally 폼 + 연락처 카드 + 빠른 링크)
- [x] `public/img/` — 스톡 이미지 13장 (Unsplash License)
- [x] `public/favicon.svg`
- [x] `.github/workflows/deploy.yml` — GitHub Actions 자동 배포
- [x] `src/data/photo-credits.md` — 이미지 출처·라이선스
- [x] `README.md` — placeholder 7건 설명 포함 가이드
- [x] `npm run build` 경고 없이 성공 ✅
- [ ] Lighthouse 접근성 ≥ 90 — 브라우저 환경 필요
- [ ] 소장님 실사 이미지 교체
- [ ] Placeholder 7건 입력 (박사님)

## 박사님이 채워야 할 Placeholder 7건

| # | 항목 | 파일 | 변경할 값 |
|---|------|------|----------|
| 1 | Giscus 레포 & 레포 ID | `src/components/Giscus.astro` L5–6 | `REPO`, `REPO_ID` |
| 2 | Giscus General 카테고리 ID | `src/pages/board.astro` | `categoryId="YOUR_CATEGORY_ID"` |
| 3 | Giscus Q&A 카테고리 ID | `src/pages/qna.astro` | `categoryId="YOUR_QNA_CATEGORY_ID"` |
| 4 | 카카오맵 앱 키 | `src/components/KakaoMap.astro` L11 | `KAKAO_APP_KEY` |
| 5 | 카카오맵 좌표 | `src/components/KakaoMap.astro` L12–13 | `LAT`, `LNG` |
| 6 | Tally 폼 ID | `src/components/TallyForm.astro` L15 | `FORM_ID` |
| 7 | GitHub Pages 사이트 URL | `astro.config.mjs` L4 | `site:` 값 |

자세한 입력 방법은 `README.md` 참조.

## 인터랙션 보존 현황 (v1 → v2)

| 인터랙션 | v1 | v2 |
|----------|----|----|
| Ken Burns 히어로 줌 | ✅ | ✅ (25s, 더 느리게) |
| 히어로 fade-up 텍스트 | ✅ | ✅ (@keyframes + delay) |
| 작업단계 4 step | ✅ SVG 모프 | ✅ 실사 이미지 오버레이로 고급화 |
| 갤러리 호버 줌 + 오버레이 | ✅ | ✅ (0.8s ease, 더 천천히) |
| 페이지 전환 | 단순 | ✅ CSS @view-transition (cross-document) |
| 골드 닷 커스텀 커서 | ✅ | ✅ (lerp 스무딩 추가) |
| 스크롤 IntersectionObserver 폴백 | ✅ | ✅ |
| 모바일 햄버거 메뉴 | ❌ (단일 페이지) | ✅ 신규 |
| 다크모드 자동 | ❌ | ✅ CSS prefers-color-scheme |
| prefers-reduced-motion | ✅ | ✅ |

## 산출물 트리 (2026-04-26 v2 기준)

```
dental_laboratory/
├── CLAUDE.md
├── STATUS.md  ← 이 파일
├── README.md
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── _legacy_v1/
│   ├── index.html
│   └── assets/
├── docs/
│   └── business_card.jpg
├── src/
│   ├── layouts/BaseLayout.astro
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── StepSection.astro
│   │   ├── GalleryGrid.astro
│   │   ├── ContactCard.astro
│   │   ├── KakaoMap.astro
│   │   ├── Giscus.astro
│   │   └── TallyForm.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── location.astro
│   │   ├── board.astro
│   │   ├── qna.astro
│   │   └── contact.astro
│   ├── styles/global.css
│   └── data/photo-credits.md
├── public/
│   ├── favicon.svg
│   └── img/ (13장)
├── .github/workflows/deploy.yml
└── dist/ (빌드 결과, 2.2MB)
```
