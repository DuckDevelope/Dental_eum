# Dental Laboratory — 이음 기공소 (EUM DENTAL LABORATORY)

이 폴더는 첫 클라이언트인 **이음 기공소(EUM Dental Laboratory)** 홈페이지를 만든다.
상위 규칙은 [`../CLAUDE.md`](../CLAUDE.md) 를 상속한다. 여기엔 이 클라이언트에 한정된 결정만 둔다.

## 산출물 정책 (2026-04-26 — 박사님 결정으로 변경)

이전의 "단일 HTML + assets 동봉 zip 배포" 정책은 **폐기**됐다. 새 정책:

- **정적 호스팅 전제** (예정: GitHub Pages 또는 Netlify). 도메인은 추후 결정.
- **외부 fetch / CDN / SaaS 자유롭게 허용**. 게시판·Q&A·문의 같은 동적 기능은 외부 서비스(Giscus, Tally, Firebase 등 — 아래 §결정 필요)에 위임.
- **로컬 개발**: dev server 권장 (`python3 -m http.server 8000` 또는 정적 사이트 생성기의 dev 명령). file:// 더블클릭은 라우팅·module import 때문에 일부 페이지만 동작할 수 있음 — 절대 요구사항 아님.
- 1차 빌드(`index.html` 단일 페이지)는 **메인페이지로 흡수**하면서 멀티페이지 구조로 확장한다. 폐기 X.

## 카테고리 구조 (박사님 결정)

| # | 카테고리 | 페이지 | 비고 |
|---|----------|--------|------|
| 1 | **메인페이지** | `/` (`index.html`) | 1차 빌드의 디자인·인터랙션 흡수 |
| 2 | **서브페이지** | `/about/` (기업소개), `/location/` (오시는 길) | 정적 |
| 3 | **게시판** | `/board/` (일반게시판), `/qna/` (Q&A) | 외부 SaaS 백엔드 (아래 §결정 필요) |
| 4 | **문의하기** | `/contact/` | 외부 폼 서비스 |

## 디자인 방향 (B안 — "장인의 작업장") + 고급스러움 ⭐ 신규

박사님이 "**고급스러워야 한다**"고 명시. B안의 스토리텔링·인터랙션을 유지하되, 톤을 한 단계 더 prestige 쪽으로:

- **럭셔리 호텔 / 프리미엄 의료** 톤 참고. Awwwards 의료 SOTD의 차분함 + 갤러리 톤.
- **여백 더 넓게**, **타이포 더 크고 우아하게**, 골드는 액센트로만 (배경에 도배 X).
- **모션은 절제**. 빠른 휙휙 X. 천천히 부드럽게 (cubic-bezier 우아한 ease).
- **실사 이미지 적극 활용** (아래 §실사 이미지 정책).
- 본문 한국어는 격식 있는 ~합니다체. 영문 보조 워드마크 EUM DENTAL LABORATORY.

### 컬러 (1차안 — 박사님 검토 필요)
- 골드 액센트: `#B89A5E` (또는 더 차분한 `#A88B4D` / 샴페인 골드 `#C9B582`)
- 배경: 따뜻한 오프화이트 `#FAF7F0` / 다크 모드 `#0F0F10`
- 본문: `#1A1A1A` / `#E8E5DE`
- 보조 톤은 `color-mix()` / `oklch()` 자동 파생

### 타이포
- 한글: **Pretendard Variable** (SIL OFL) — 본문
- 한글 디스플레이: **검토 필요** — 명조 계열(KoPub바탕, 본명조 Source Han Serif)이 고급감에 더 어울릴 가능성 ↑. 영문 디스플레이는 세리프 한 종(Cormorant Garamond, Playfair Display 등) 검토.

## 실사 이미지 정책 ⭐ 신규

박사님이 "**어느정도 실사 이미지가 있으면 좋겠다**"고 명시.

### 단계별 사용 (권장 순서)
1. **박사님(또는 소장님) 실제 촬영** — 작업장, 도구, 손, 보철물 클로즈업. 가장 진정성 있음. 추후 업데이트.
2. **무료 스톡** (즉시 가능) — Unsplash, Pexels (CC0). 치과 기공소 관련 키워드: dental lab, ceramist, dental technician, prosthodontics. 실제 작업 분위기 있는 사진을 큐레이션.
3. **AI 생성 이미지** — 가능하나 라이선스·인물권 이슈로 후순위. 필요 시 별도 협의.

### 보안/개인정보
- 환자 식별 가능 이미지 절대 금지.
- 직원 얼굴 노출은 동의 확인 후에만.
- 명함 정보 외의 개인정보(소장님 사진 포함)는 박사님 사전 승인 필요.

## 인터랙션 명세 (B안 유지 + 고급화)

| # | 영역 | 인터랙션 | 구현 수단 |
|---|------|----------|-----------|
| 1 | 히어로 (메인) | 풀스크린 실사 이미지 + 워드마크 + 차분한 카피. 천천히 ken burns 줌. | CSS `transform` + 긴 duration |
| 2 | 히어로 텍스트 | fade-up + 글자 clip 등장 (느리게) | `@starting-style` + `view()` timeline |
| 3 | "작업 단계" 섹션 (메인) | 스크롤 진행도에 따라 4 step (본뜨기→설계→제작→마무리) 일러스트 모프 + 실사 사진 페이드 | `animation-timeline: view()`, IntersectionObserver 폴백 |
| 4 | 갤러리 (메인 또는 about) | 작업물 그리드, 호버 시 부드러운 줌·정보 오버레이 | CSS hover + Motion |
| 5 | 페이지 간 전환 | 서브페이지 클릭 시 부드러운 cross-fade 또는 view-transition 모프 | View Transitions API (cross-document, Astro 사용 시 자동) |
| 6 | 전역 | 골드 닷 커스텀 커서 (호버 확장). 모바일 비활성. | vanilla JS + `@media (hover:hover)` |
| 7 | 연락처/오시는 길 | 카카오맵 임베드 (외부 fetch 허용됨) | 카카오맵 SDK |
| 8 | 문의 폼 | 실시간 validation + 제출 시 부드러운 success 모핑 | 외부 폼 SaaS + 약간의 vanilla JS |

## 클라이언트 정보 (콘텐츠 소스)

| 항목 | 값 | 공개 |
|------|----|------|
| 상호 | 이음 기공소 / EUM DENTAL LABORATORY | ✅ |
| 소장 | 김규홍 | ✅ |
| 주소 | 경기도 용인시 기흥구 중부대로 184, 힉스유타워 A동 523-2호 | ✅ |
| Mobile | 010-4007-2804 | ✅ |
| Email | eumdentallab@gmail.com | ✅ |
| 거래은행 | 국민은행 698937-01-016816 | ✅ |

원본 명함: [`docs/business_card.jpg`](./docs/business_card.jpg)

## 결정 필요 (박사님)

이번 변경으로 새로 떠오른 결정 항목:

1. **아키텍처**
   - (A) 단순 멀티 HTML + Vanilla (`index.html`, `about.html`, …) — 빌드 도구 없음, 가장 단순
   - (B) **Astro 정적 사이트 생성기** ⭐ 추천 — 컴포넌트 재사용, view-transition 자동, MDX로 게시판 글 관리, GitHub Pages 호환
   - (C) Next.js — 풀스택. 게시판 자체 구현까지 가려면. 운영 부담 ↑
2. **게시판/Q&A 백엔드**
   - (A) **Giscus** ⭐ 추천 (GitHub Discussions 기반, 무료, 광고 없음, 댓글·Q&A 모두 가능. 사용자 GitHub 가입 필요)
   - (B) Disqus (광고 표시 — 비추)
   - (C) Notion DB 임베드 (관리자 친화)
   - (D) 자체 Firebase/Supabase (가장 자유롭지만 운영·보안 부담)
3. **문의 폼**
   - (A) **Tally** ⭐ 추천 (무료, 한국어 OK, 디자인 우수, 임베드 가능)
   - (B) Google Forms (브랜드 톤 ↓)
   - (C) Netlify Forms (Netlify 호스팅일 때만)
   - (D) Formspree (이메일 직배송)
4. **실사 이미지 1차 소스**
   - (A) 박사님이 소장님께 사진 요청 → 받을 때까지 무료 스톡 임시 사용 ⭐ 추천
   - (B) 처음부터 무료 스톡만
   - (C) AI 생성 이미지 (라이선스·진정성 검토 필요)
5. **호스팅**
   - (A) **GitHub Pages** ⭐ 추천 (무료, 단순, 도메인 연결 OK)
   - (B) Netlify (폼 서비스 묶을 때 유리)
   - (C) Vercel (Next.js일 때)
6. **디스플레이 폰트** (고급감 위해 명조 계열 도입 여부)
   - (A) Pretendard 한 종 + 영문 세리프 보조
   - (B) Pretendard + KoPub바탕(한글 명조) 혼용 ⭐ 추천
   - (C) Pretendard만 + weight 변화로만 위계
7. **게시판 콘텐츠 운영**
   - 누가 글을 쓰는가? 박사님? 소장님? 글 빈도? → 백엔드 선택에 영향

## 코드 작성 워크플로우 (이 클라이언트에 적용)

상위 [`../../WORKFLOW.md`](../../WORKFLOW.md) 상속.
1. **Opus(지시)** ← 현재. 정책 변경 반영 + 결정 옵션 제시 단계.
2. **박사님 결정** — 위 §결정 필요 7건.
3. **Sonnet(재구현)** — 결정 반영하여 멀티페이지로 재빌드.
4. **Codex(검토)**.
5. **Opus(승인)**.

## 의존성 (재정의 예정 — 박사님 결정 후 확정)

당장 확정된 것:
- **Pretendard Variable** (SIL OFL) — CDN 사용으로 변경 가능 (jsdelivr)
- (검토 중) **Astro** — 정적 사이트 생성기
- (검토 중) **Giscus** / **Tally** — 게시판/폼
- 1차 빌드의 `assets/js/motion.min.js`는 미사용 → 제거 검토
