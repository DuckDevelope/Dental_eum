/**
 * 이음 기공소 — v3.2 메인 스크립트 (스크롤 부드러움 근본 개선)
 *
 * 변경점 (박사님 지시 — "프레임 끊김 끝까지 해결, 제약 해제"):
 *  • Canvas를 native 1280×720 attribute로 둠. CSS object-fit:cover로 viewport 스케일.
 *    → drawImage(img,0,0) 1:1 memcpy. GPU 컴포지터가 업스케일 처리. 메인 스레드 부담 거의 없음.
 *  • img.decode() 강제 — lazy decode로 인한 첫 draw stall 제거.
 *  • GSAP ScrollTrigger 제거. CSS sticky로 pin, requestAnimationFrame + lerp inertia.
 *    → scrub 1.2의 두 단 보간 오버헤드 + ScrollTrigger 머신 비용 모두 제거.
 *  • 매 rAF에서 window.scrollY 직접 읽고 lerp으로 목표값 추격 → 휠 스파크에도 자연스럽게 흡수.
 *  • alpha:false 컨텍스트 + imageSmoothingEnabled:false → 1:1 draw 시 가장 가벼운 경로.
 */

/* ============================================================
   CONFIG
============================================================ */
const FRAME_COUNT         = 476;
const FRAME_DIR           = 'frames_webp/';
const SCROLL_PX_PER_FRAME = 4;
const SCROLL_TOTAL_BASE   = FRAME_COUNT * SCROLL_PX_PER_FRAME;  // 1904

const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches ||
                  (navigator.deviceMemory != null && navigator.deviceMemory < 4);
// 모바일 swipe 거리 확보: 1.5x
const SCROLL_TOTAL = IS_MOBILE ? SCROLL_TOTAL_BASE * 1.5 : SCROLL_TOTAL_BASE;

const PRELOAD_TIMEOUT_MS  = 12_000;
const PRELOAD_THRESHOLD   = 0.95;

// Lerp 계수: 낮을수록 더 부드럽지만 반응 늦음. 0.18 ≒ 5프레임 내 99%.
const LERP = 0.18;

const NATIVE_W = 1280;
const NATIVE_H = 720;

function framePath(n) {
  return FRAME_DIR + String(n).padStart(4, '0') + '.webp';
}

/* ============================================================
   DOM REFS
============================================================ */
const canvas      = document.getElementById('heroCanvas');
const ctx         = canvas.getContext('2d', { alpha: false });
const loader      = document.getElementById('loader');
const loaderSub   = document.getElementById('loaderSub');
const progressBar = document.getElementById('heroProgressBar');
const progressEl  = document.getElementById('heroProgress');
const textA       = document.getElementById('textA');
const textB       = document.getElementById('textB');
const textC       = document.getElementById('textC');
const fadeBlack   = document.getElementById('heroFadeBlack');
const heroEl      = document.getElementById('hero');

/* ============================================================
   CANVAS SETUP — native res, CSS scales
============================================================ */
canvas.width  = NATIVE_W;
canvas.height = NATIVE_H;
// 1:1 draw에서는 imageSmoothing 무관. 비활성으로 가장 가벼운 경로 유지.
ctx.imageSmoothingEnabled = false;

/* ============================================================
   STATE
============================================================ */
const images = new Array(FRAME_COUNT);
let currentIdx = -1;

window.__currentFrame = 0;   // Playwright hook

/* ============================================================
   DRAW FRAME — 1:1 memcpy
============================================================ */
function drawFrame(idx) {
  if (idx === currentIdx) return;
  const img = images[idx];
  if (!img) return;
  // src와 dest size 동일 → drawImage가 GPU 텍스처 업로드 + memcpy만.
  ctx.drawImage(img, 0, 0);
  currentIdx = idx;
  window.__currentFrame = idx;

  const pct = (idx / (FRAME_COUNT - 1)) * 100;
  progressBar.style.width = pct + '%';
  progressEl.setAttribute('aria-valuenow', Math.round(pct));
}

/* ============================================================
   PRELOAD — Image() + decode() 강제
   decode()로 첫 drawImage 시 lazy decode가 잡아먹는 stall 제거.
============================================================ */
function loadAndDecode(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (typeof img.decode === 'function') {
      img.decode().then(() => resolve(img)).catch(() => {
        // decode 실패해도 image 자체는 onload될 수 있음
        if (img.complete && img.naturalWidth > 0) resolve(img);
        else {
          img.onload  = () => resolve(img);
          img.onerror = () => resolve(null);
        }
      });
    } else {
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
    }
  });
}

async function preloadFrames() {
  let loaded = 0;
  const total = FRAME_COUNT;

  let resolveReveal;
  const revealPromise = new Promise(r => { resolveReveal = r; });
  let revealed = false;
  const triggerReveal = () => {
    if (revealed) return;
    revealed = true;
    resolveReveal();
  };

  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    const pct = loaded / total;
    if (pct < PRELOAD_THRESHOLD) {
      console.warn(`[EUM] Preload timeout — loaded ${loaded}/${total} (${(pct * 100).toFixed(1)}%)`);
    }
    triggerReveal();
  }, PRELOAD_TIMEOUT_MS);

  const promises = Array.from({ length: total }, (_, i) =>
    loadAndDecode(framePath(i + 1)).then(img => {
      images[i] = img;
      loaded++;
      if (loaded % 10 === 0 || loaded === total) {
        loaderSub.textContent = `프레임을 불러오는 중입니다… (${loaded}/${total})`;
      }
    })
  );

  const interval = setInterval(() => {
    if (!revealed && (loaded / total) >= PRELOAD_THRESHOLD) {
      clearInterval(interval);
      triggerReveal();
    } else if (timedOut) {
      clearInterval(interval);
    }
  }, 50);

  Promise.all(promises).then(() => {
    clearInterval(interval);
    clearTimeout(timeoutHandle);
    triggerReveal();
  });

  await revealPromise;
  clearTimeout(timeoutHandle);

  if (images[0]) drawFrame(0);
  revealSite();

  // 나머지도 백그라운드로 완료
  await Promise.all(promises).catch(() => {});
}

/* ============================================================
   REVEAL
============================================================ */
let _revealed = false;
function revealSite() {
  if (_revealed) return;
  _revealed = true;
  initScroll();
  loader.classList.add('hidden');
  setTimeout(() => { loader.style.display = 'none'; }, 900);
}

/* ============================================================
   TEXT LAYER — 불필요한 style write 차단 (불변 시 skip)
============================================================ */
const _lastLayer = new WeakMap();
function setTextLayer(el, opacity, translateY) {
  if (!el) return;
  // 0.001 미만 변화는 스킵 — visual 영향 없음, compositor 부담 절감
  const last = _lastLayer.get(el);
  if (last && Math.abs(last.o - opacity) < 0.005 && Math.abs(last.t - translateY) < 0.5) return;
  el.style.opacity   = opacity;
  el.style.transform = `translateY(${translateY}px)`;
  _lastLayer.set(el, { o: opacity, t: translateY });
}

function smoothStep(edge0, edge1, t) {
  const x = Math.max(0, Math.min(1, (t - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function updateTextLayers(p) {
  // Text A: 0–35%
  let opA, tyA;
  if (p < 0.28) { opA = 1; tyA = 0; }
  else if (p < 0.42) {
    const s = smoothStep(0.28, 0.42, p);
    opA = 1 - s; tyA = -s * 20;
  } else { opA = 0; tyA = -20; }
  setTextLayer(textA, opA, tyA);

  // Text B: 30–70%
  let opB, tyB;
  if (p < 0.30) { opB = 0; tyB = 24; }
  else if (p < 0.42) {
    opB = smoothStep(0.30, 0.42, p);
    tyB = (1 - opB) * 24;
  } else if (p < 0.60) { opB = 1; tyB = 0; }
  else if (p < 0.72) {
    const s = smoothStep(0.60, 0.72, p);
    opB = 1 - s; tyB = -s * 16;
  } else { opB = 0; tyB = -16; }
  setTextLayer(textB, opB, tyB);

  // Text C: 68–100%
  let opC, tyC;
  if (p < 0.68) { opC = 0; tyC = 20; }
  else {
    opC = smoothStep(0.68, 0.82, p);
    tyC = (1 - opC) * 20;
  }
  setTextLayer(textC, opC, tyC);

  if (fadeBlack) {
    const blackOp = p < 0.85 ? 0 : smoothStep(0.85, 1.0, p) * 0.92;
    if (Math.abs((fadeBlack._lastOp ?? -1) - blackOp) > 0.005) {
      fadeBlack.style.opacity = blackOp;
      fadeBlack._lastOp = blackOp;
    }
  }
}

/* ============================================================
   SCROLL DRIVER — CSS sticky + rAF lerp (no GSAP)
   rAF는 (a) scroll 이벤트 시 wake-up, (b) lerp 수렴 시 자동 정지.
   → idle 시 work 0, 스크롤 중에만 active.
============================================================ */
let targetProgress = 0;
let displayedProgress = 0;
let heroTop = 0;
let rafScheduled = false;
let _firstUpdate = true;
let _reducedMotion = false;

function recalcHeroTop() {
  heroTop = heroEl.offsetTop;
}

function computeTargetProgress() {
  const scrolled = window.scrollY - heroTop;
  return Math.max(0, Math.min(1, scrolled / SCROLL_TOTAL));
}

function scheduleTick() {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(tick);
}

function tick() {
  rafScheduled = false;

  targetProgress = computeTargetProgress();
  const delta = targetProgress - displayedProgress;
  let needNext = false;

  if (_reducedMotion) {
    // reduced-motion: 즉시 매핑(스무스 보간 X). 사용자 모션 선호 반영.
    displayedProgress = targetProgress;
  } else if (Math.abs(delta) < 0.0005) {
    displayedProgress = targetProgress;
  } else {
    displayedProgress += delta * LERP;
    needNext = true;
  }

  const idx = Math.round(displayedProgress * (FRAME_COUNT - 1));
  drawFrame(idx);
  updateTextLayers(displayedProgress);

  if (_firstUpdate) {
    console.log('[EUM] first tick — progress:', displayedProgress.toFixed(3));
    _firstUpdate = false;
  }

  if (needNext) scheduleTick();
}

function onScroll() {
  // scroll 이벤트 시 lerp 깨우기. rAF 안에서 실제 progress 갱신.
  scheduleTick();
}

function initScroll() {
  _reducedMotion = prefersReducedMotion();
  // reduced-motion이라도 스크롤 → frame 매핑은 유지 (사용자가 휠로 진행 가능).
  // 단, lerp 보간을 끔으로써 부드러운 가속/감속 모션 자체는 제거.

  // 초기 텍스트 레이어 상태
  setTextLayer(textA, 1, 0);
  setTextLayer(textB, 0, 24);
  setTextLayer(textC, 0, 20);

  // Hero 전체 높이 = 100vh + SCROLL_TOTAL. 내부 .hero__pin이 sticky로 pin.
  heroEl.style.height = `calc(100vh + ${SCROLL_TOTAL}px)`;

  recalcHeroTop();
  window.addEventListener('resize', () => { recalcHeroTop(); scheduleTick(); }, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { recalcHeroTop(); scheduleTick(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // 테스트용 hook (Playwright 검증 스크립트가 사용)
  window.__heroSetProgress = (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    window.scrollTo(0, heroTop + SCROLL_TOTAL * clamped);
  };
  window.__heroSCROLL_TOTAL = SCROLL_TOTAL;

  // 새로고침 시 scroll 위치 보존 대응 + 첫 frame 즉시 그리기
  targetProgress   = computeTargetProgress();
  displayedProgress = targetProgress;

  console.log('[EUM] scroll init', {
    scrollY:     window.scrollY,
    heroTop,
    SCROLL_TOTAL,
    bodyHeight:  document.body.scrollHeight,
    IS_MOBILE,
  });

  scheduleTick();
}

function staticFallback() {
  if (images[0]) drawFrame(0);
  if (textA) { textA.style.opacity = '1'; textA.style.transform = 'translateY(-42%)'; }
  if (textB) { textB.style.opacity = '0'; textB.style.transform = 'none'; }
  if (textC) { textC.style.opacity = '0'; textC.style.transform = 'none'; }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ============================================================
   ENTRY
============================================================ */
(async function main() {
  try {
    await preloadFrames();
  } catch (err) {
    console.error('[EUM] Preload error:', err);
    staticFallback();
    revealSite();
  }
})();
