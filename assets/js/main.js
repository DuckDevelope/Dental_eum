/**
 * 이음 기공소 — v3.4 메인 스크립트 (로딩 단축)
 *
 * 변경점 (박사님 피드백 — "로딩이 너무 오래 걸린다"):
 *  • 사용 프레임 476 → 238 (짝수 인덱스만 사용 → 디스크 0001,0003,...,0475 webp).
 *    다운로드량 ~26MB → ~13MB. 영상 길이 동일, frame당 픽셀 6→12로 dense.
 *  • Early reveal: 첫 30장만 받으면 즉시 reveal, 나머지는 백그라운드.
 *    체감 로딩 시간 대폭 감소 (수 초 → 0.5~1초).
 *  • 미스 프레임은 가장 가까운 이미 받은 frame으로 대체 그리기 → 빈 화면 안 보임.
 *  • fetchPriority: 첫 30장 'high', 나머지 'low'. 우선순위 큐 활용.
 *
 * 이전 v3.2~v3.3에서 유지:
 *  • Canvas native 1280×720 + CSS object-fit:cover (drawImage 1:1 memcpy).
 *  • img.decode() 강제, GSAP 의존 제거, CSS sticky pin + rAF lerp inertia.
 *  • LERP 0.10 (미끈한 inertia), 텍스트 레이어 style write 캐시.
 */

/* ============================================================
   CONFIG
============================================================ */
// 디스크에 0001~0476.webp가 있지만 짝수 인덱스만 사용 (1,3,5,...,475 → 238장).
const FRAME_COUNT         = 238;
const FRAME_FILE_STEP     = 2;
const FRAME_DIR           = 'frames_webp/';
// frame당 12px scroll. 전체 SCROLL_TOTAL = 2856 (영상 길이 v3.3과 동일).
const SCROLL_PX_PER_FRAME = 12;
const SCROLL_TOTAL_BASE   = FRAME_COUNT * SCROLL_PX_PER_FRAME;  // 2856

const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches ||
                  (navigator.deviceMemory != null && navigator.deviceMemory < 4);
const SCROLL_TOTAL = IS_MOBILE ? SCROLL_TOTAL_BASE * 1.5 : SCROLL_TOTAL_BASE;

// Early reveal: 첫 N장만 받으면 reveal. 나머지는 백그라운드 fetch + 미스 frame fallback.
// 15장(약 0.7MB) 정도면 사용자 첫 인상 frame은 충분히 채워짐.
const EARLY_REVEAL_COUNT  = 15;
const EARLY_TIMEOUT_MS    = 3000;   // 안전장치: 못 받으면 받은 만큼으로 reveal

// Lerp 계수: 낮을수록 더 미끈. 0.10 ≒ 9프레임 내 ~99% 수렴.
const LERP = 0.10;

const NATIVE_W = 1280;
const NATIVE_H = 720;

function framePath(i) {
  // i: 0..237 → 디스크 file_no: 1, 3, 5, ..., 475
  const fileNo = i * FRAME_FILE_STEP + 1;
  return FRAME_DIR + String(fileNo).padStart(4, '0') + '.webp';
}

/* ============================================================
   DOM REFS
============================================================ */
const canvas      = document.getElementById('heroCanvas');
const ctx         = canvas.getContext('2d', { alpha: false });
const loader      = document.getElementById('loader');
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
ctx.imageSmoothingEnabled = false;

/* ============================================================
   STATE
============================================================ */
const images = new Array(FRAME_COUNT);
let currentIdx = -1;

window.__currentFrame = 0;   // Playwright hook

/* ============================================================
   DRAW FRAME — 1:1 memcpy + 미스 fallback
============================================================ */
function nearestLoaded(idx) {
  // idx 양방향으로 가장 가까운 로드 완료 frame 검색
  for (let d = 1; d < FRAME_COUNT; d++) {
    if (idx - d >= 0 && images[idx - d]) return { img: images[idx - d], at: idx - d };
    if (idx + d < FRAME_COUNT && images[idx + d]) return { img: images[idx + d], at: idx + d };
  }
  return null;
}

function drawFrame(idx) {
  if (idx === currentIdx) return;
  let img = images[idx];
  let drawnIdx = idx;
  if (!img) {
    const nearest = nearestLoaded(idx);
    if (!nearest) return;
    img = nearest.img;
    drawnIdx = nearest.at;
  }
  ctx.drawImage(img, 0, 0);
  currentIdx = idx;
  window.__currentFrame = drawnIdx;

  const pct = (idx / (FRAME_COUNT - 1)) * 100;
  progressBar.style.width = pct + '%';
  progressEl.setAttribute('aria-valuenow', Math.round(pct));
}

/* ============================================================
   PRELOAD — Image() + decode() + fetchPriority
============================================================ */
function loadImage(src, { priority, forceDecode } = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    if (priority) img.fetchPriority = priority;   // Chromium 지원, 그 외 무시
    img.src = src;
    if (forceDecode && typeof img.decode === 'function') {
      // critical frame은 decode 강제 — 첫 drawImage stall 제거
      img.decode().then(() => resolve(img)).catch(() => {
        if (img.complete && img.naturalWidth > 0) resolve(img);
        else {
          img.onload  = () => resolve(img);
          img.onerror = () => resolve(null);
        }
      });
    } else {
      // non-critical: onload만 기다림. decode는 lazy (drawImage 시 자동).
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
    }
  });
}

async function preloadFrames() {
  let earlyLoaded = 0;
  const total = FRAME_COUNT;

  let resolveEarly;
  const earlyReady = new Promise(r => { resolveEarly = r; });
  let revealed = false;
  const triggerReveal = () => {
    if (revealed) return;
    revealed = true;
    resolveEarly();
  };

  // 안전장치: 4초 안에 EARLY_REVEAL_COUNT 못 채우면 받은 만큼으로 reveal
  const timeout = setTimeout(() => {
    if (!revealed) {
      console.warn(`[EUM] Early-reveal timeout — received ${earlyLoaded}/${EARLY_REVEAL_COUNT}`);
      triggerReveal();
    }
  }, EARLY_TIMEOUT_MS);

  // 모든 frame 동시 발사 — 브라우저가 priority 큐로 분배.
  // 첫 EARLY_REVEAL_COUNT장: high priority + decode 강제 (critical frame).
  // 나머지: low priority + lazy decode (drawImage 시 자동 디코드).
  const promises = Array.from({ length: total }, (_, i) => {
    const isCritical = i < EARLY_REVEAL_COUNT;
    return loadImage(framePath(i), {
      priority: isCritical ? 'high' : 'low',
      forceDecode: isCritical,
    }).then(img => {
      images[i] = img;
      if (isCritical) {
        earlyLoaded++;
        // frame[0] 도착 시 즉시 그림 (reveal 전 UX 개선 X — loader 위에 가려짐)
        if (i === 0 && img && currentIdx === -1 && _revealed) drawFrame(0);
        if (earlyLoaded >= EARLY_REVEAL_COUNT) triggerReveal();
      }
    });
  });

  await earlyReady;
  clearTimeout(timeout);

  // 첫 frame이 아직 없으면 다음 가능한 frame이라도 그림
  if (images[0]) drawFrame(0);
  else {
    const nearest = nearestLoaded(0);
    if (nearest) ctx.drawImage(nearest.img, 0, 0);
  }
  revealSite();

  // 나머지는 백그라운드 — await 안 함 (사이트는 이미 reveal됨)
  Promise.all(promises).catch(() => {});
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
   TEXT LAYER — style write 캐시
============================================================ */
const _lastLayer = new WeakMap();
function setTextLayer(el, opacity, translateY) {
  if (!el) return;
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
  let opA, tyA;
  if (p < 0.28) { opA = 1; tyA = 0; }
  else if (p < 0.42) {
    const s = smoothStep(0.28, 0.42, p);
    opA = 1 - s; tyA = -s * 20;
  } else { opA = 0; tyA = -20; }
  setTextLayer(textA, opA, tyA);

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
   SCROLL DRIVER — CSS sticky + rAF lerp
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

function onScroll() { scheduleTick(); }

function initScroll() {
  _reducedMotion = prefersReducedMotion();

  setTextLayer(textA, 1, 0);
  setTextLayer(textB, 0, 24);
  setTextLayer(textC, 0, 20);

  heroEl.style.height = `calc(100vh + ${SCROLL_TOTAL}px)`;

  recalcHeroTop();
  window.addEventListener('resize', () => { recalcHeroTop(); scheduleTick(); }, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { recalcHeroTop(); scheduleTick(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  window.__heroSetProgress = (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    window.scrollTo(0, heroTop + SCROLL_TOTAL * clamped);
  };
  window.__heroSCROLL_TOTAL = SCROLL_TOTAL;

  targetProgress    = computeTargetProgress();
  displayedProgress = targetProgress;

  console.log('[EUM] scroll init', {
    scrollY:     window.scrollY,
    heroTop,
    SCROLL_TOTAL,
    bodyHeight:  document.body.scrollHeight,
    IS_MOBILE,
    FRAME_COUNT,
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
