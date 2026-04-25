/**
 * 이음 기공소 — v3 메인 스크립트
 * Apple-style scroll-sequenced canvas + GSAP ScrollTrigger text layers
 */

/* ============================================================
   CONFIG
============================================================ */
const FRAME_COUNT         = 192;
const FRAME_DIR           = 'frames/';
const SCROLL_PX_PER_FRAME = 8;                              // 192 × 8 = 1536px
const SCROLL_TOTAL        = FRAME_COUNT * SCROLL_PX_PER_FRAME;
const LOAD_PRIORITY       = 30;

function framePath(n) {
  return FRAME_DIR + String(n).padStart(4, '0') + '.jpg';
}

/* ============================================================
   DOM REFERENCES
============================================================ */
const canvas      = document.getElementById('heroCanvas');
const ctx         = canvas.getContext('2d');
const loader      = document.getElementById('loader');
const loaderSub   = document.getElementById('loaderSub');
const progressBar = document.getElementById('heroProgressBar');
const progressEl  = document.getElementById('heroProgress');
const textA       = document.getElementById('textA');
const textB       = document.getElementById('textB');
const textC       = document.getElementById('textC');
const fadeBlack   = document.getElementById('heroFadeBlack');

/* ============================================================
   STATE
============================================================ */
const images   = new Array(FRAME_COUNT);
let   ready    = false;
let   currentIdx = 0;

window.__currentFrame = 0;   // Playwright hook

/* ============================================================
   CANVAS SIZING (object-fit: cover)
============================================================ */
const NATIVE_W = 1280;
const NATIVE_H = 720;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  if (ready) drawFrame(currentIdx);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ============================================================
   DRAW FRAME
============================================================ */
function drawFrame(idx) {
  const img = images[idx];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.max(cw / NATIVE_W, ch / NATIVE_H);
  const sw = NATIVE_W * scale;
  const sh = NATIVE_H * scale;
  const sx = (cw - sw) / 2;
  const sy = (ch - sh) / 2;

  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, sx, sy, sw, sh);

  currentIdx          = idx;
  window.__currentFrame = idx;   // 0-based

  const pct = (idx / (FRAME_COUNT - 1)) * 100;
  progressBar.style.width = pct + '%';
  progressEl.setAttribute('aria-valuenow', Math.round(pct));
}

/* ============================================================
   IMAGE PRELOAD
============================================================ */
function loadImage(src) {
  return new Promise((resolve) => {
    const img  = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src     = src;
  });
}

async function preloadFrames() {
  // Phase 1 — first LOAD_PRIORITY frames (fast reveal)
  const phase1 = [];
  for (let i = 0; i < LOAD_PRIORITY && i < FRAME_COUNT; i++) {
    const idx = i;
    phase1.push(
      loadImage(framePath(idx + 1)).then(img => { images[idx] = img; })
    );
  }
  await Promise.all(phase1);

  loaderSub.textContent = '첫 장면을 준비하고 있습니다…';
  if (images[0]) drawFrame(0);

  // Reveal site immediately after phase 1
  revealSite();

  // Phase 2 — rest of frames (background)
  const phase2 = [];
  for (let i = LOAD_PRIORITY; i < FRAME_COUNT; i++) {
    const idx = i;
    phase2.push(
      loadImage(framePath(idx + 1)).then(img => { images[idx] = img; })
    );
  }
  await Promise.all(phase2);
}

/* ============================================================
   REVEAL SITE
============================================================ */
function revealSite() {
  ready = true;
  loader.classList.add('hidden');
  setTimeout(() => { loader.style.display = 'none'; }, 900);
  initScrollTrigger();
}

/* ============================================================
   TEXT LAYER HELPER
   Sets opacity + translateY for a text element (0..1 values)
============================================================ */
function setTextLayer(el, opacity, translateY) {
  if (!el) return;
  el.style.opacity   = opacity;
  el.style.transform = `translateY(${translateY}px)`;
}

/* Smooth step between two values given t in [0,1] */
function smoothStep(edge0, edge1, t) {
  const x = Math.max(0, Math.min(1, (t - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

/* ============================================================
   GSAP SCROLL TRIGGER
============================================================ */
function initScrollTrigger() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('[EUM] GSAP unavailable — static fallback');
    staticFallback();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const hero = document.getElementById('hero');

  // Show textA immediately at progress 0 so it's visible on load
  setTextLayer(textA, 1, 0);
  setTextLayer(textB, 0, 24);
  setTextLayer(textC, 0, 20);

  ScrollTrigger.create({
    trigger: hero,
    start:   'top top',
    end:     `+=${SCROLL_TOTAL}`,
    pin:     true,
    scrub:   1.2,
    anticipatePin: 1,

    onUpdate(self) {
      const p = self.progress;               // 0 → 1

      // ---- Canvas frame ----
      const frameIdx = Math.round(p * (FRAME_COUNT - 1));
      drawFrame(frameIdx);

      // ---- Text A: visible 0–35%, full at entry, out by 38% ----
      // Immediately visible at p=0 (no fade-in — it's the opening slate)
      // fade-out 0.28 → 0.40
      let opA = 0, tyA = 0;
      if (p < 0.28) {
        opA = 1;
        tyA = 0;
      } else if (p < 0.42) {
        opA = 1 - smoothStep(0.28, 0.42, p);
        tyA = -(smoothStep(0.28, 0.42, p) * 20);
      } else {
        opA = 0;
        tyA = -20;
      }
      setTextLayer(textA, opA, tyA);

      // ---- Text B: visible 30–70%, peak at 45–60%, out by 72% ----
      let opB = 0, tyB = 0;
      if (p < 0.30) {
        opB = 0;
        tyB = 24;
      } else if (p < 0.42) {
        opB = smoothStep(0.30, 0.42, p);
        tyB = (1 - opB) * 24;
      } else if (p < 0.60) {
        opB = 1;
        tyB = 0;
      } else if (p < 0.72) {
        opB = 1 - smoothStep(0.60, 0.72, p);
        tyB = -(smoothStep(0.60, 0.72, p) * 16);
      } else {
        opB = 0;
        tyB = -16;
      }
      setTextLayer(textB, opB, tyB);

      // ---- Text C: visible 68–100% ----
      let opC = 0, tyC = 0;
      if (p < 0.68) {
        opC = 0;
        tyC = 20;
      } else {
        opC = smoothStep(0.68, 0.82, p);
        tyC = (1 - opC) * 20;
      }
      setTextLayer(textC, opC, tyC);

      // ---- Fade-to-black overlay (권고안 2): progress > 0.85 ----
      if (fadeBlack) {
        const blackOp = p < 0.85 ? 0 : smoothStep(0.85, 1.0, p) * 0.92;
        fadeBlack.style.opacity = blackOp;
      }
    },

    onLeaveBack() {
      // Scrolled back to top — restore textA
      setTextLayer(textA, 1, 0);
      setTextLayer(textB, 0, 24);
      setTextLayer(textC, 0, 20);
    },
  });
}

/* ============================================================
   STATIC FALLBACK (reduced-motion or GSAP failure)
   — textA only visible; textB, textC stay hidden
============================================================ */
function staticFallback() {
  if (textA) { textA.style.opacity = '1'; textA.style.transform = 'translateY(-42%)'; }
  if (textB) { textB.style.opacity = '0'; textB.style.transform = 'none'; }
  if (textC) { textC.style.opacity = '0'; textC.style.transform = 'none'; }
  drawFrame(0);
}

/* ============================================================
   REDUCED-MOTION CHECK
============================================================ */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ============================================================
   ENTRY POINT
============================================================ */
(async function main() {
  if (prefersReducedMotion()) {
    const img = await loadImage(framePath(1));
    images[0] = img;
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 900);
    staticFallback();
    return;
  }

  try {
    await preloadFrames();
  } catch (err) {
    console.error('[EUM] Preload error:', err);
    staticFallback();
  }
})();
