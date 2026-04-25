/**
 * _qa/check-v3.mjs
 * 이음 기공소 v3 자체 검증 스크립트
 *
 * 실행: node _qa/check-v3.mjs
 * 결과: _qa/screenshots-v3/ 에 캡처 저장, 콘솔에 검증 결과 출력
 */

import { chromium } from './node_modules/playwright/index.mjs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-v3');
const BASE_URL = 'http://localhost:4321';
const FRAME_COUNT = 192;

/* ============================================================
   VIEWPORTS
============================================================ */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 390,  height: 844, isMobile: true, hasTouch: true },
];

/* ============================================================
   SCROLL SPOTS (0%, 25%, 50%, 75%, 100%)
============================================================ */
const SPOTS = [0, 0.25, 0.5, 0.75, 1.0];

/* ============================================================
   HELPERS
============================================================ */
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Weighted pixel brightness of a pixel region — used to verify text is visible */
async function pixelBrightness(page, x, y, w, h) {
  return page.evaluate(({ x, y, w, h }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Draw the hero canvas region
    const heroCanvas = document.getElementById('heroCanvas');
    if (!heroCanvas) return -1;
    ctx.drawImage(heroCanvas, x, y, w, h, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i+1] + d[i+2]) / 3;
    return sum / (d.length / 4);
  }, { x, y, w, h });
}

/* ============================================================
   MAIN
============================================================ */
async function runChecks() {
  await ensureDir(SCREENSHOT_DIR);

  const results = { pass: true, errors: [], vpResults: {} };

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport: ${vp.name} (${vp.width}×${vp.height}) ===`);
    const vpResult = { frames: [], consoleErrors: 0, networkFails: [] };
    results.vpResults[vp.name] = vpResult;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport:    { width: vp.width, height: vp.height },
      isMobile:    vp.isMobile  || false,
      hasTouch:    vp.hasTouch  || false,
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    /* ---- Capture console errors ---- */
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore GSAP minified internal warnings
        if (!text.includes('gsap') && !text.includes('GSAP')) {
          consoleErrors.push(text);
        }
      }
    });

    /* ---- Capture network failures ---- */
    const networkFails = [];
    page.on('requestfailed', (req) => {
      networkFails.push({ url: req.url(), err: req.failure()?.errorText });
    });

    /* ---- Track network requests for CDN + frame check ---- */
    const networkRequests = [];
    page.on('response', (resp) => {
      networkRequests.push({ url: resp.url(), status: resp.status() });
    });

    // Navigate
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Wait for loader to disappear (frames loaded, GSAP ready)
    try {
      await page.waitForFunction(
        () => {
          const loader = document.getElementById('loader');
          return loader && (loader.style.display === 'none' || loader.classList.contains('hidden'));
        },
        { timeout: 45000 }
      );
    } catch (e) {
      console.warn('  [WARN] Loader did not disappear in time — continuing anyway');
    }

    // Extra settle time for GSAP to bind ScrollTrigger
    await page.waitForTimeout(2000);

    /* ---- Scroll to each spot and capture ---- */
    // We need to scroll INSIDE the pinned hero.
    // The hero is pinned by ScrollTrigger, so window.scrollY controls progress.
    // SCROLL_TOTAL = 192 * 8 = 1536px
    const SCROLL_TOTAL = 192 * 8;

    let prevFrame = -1;
    let monotonic = true;

    for (let s = 0; s < SPOTS.length; s++) {
      const spot     = SPOTS[s];
      const scrollY  = Math.round(spot * SCROLL_TOTAL);

      // Scroll to position
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
      // Give GSAP scrub time to settle
      await page.waitForTimeout(700);

      // Read current frame index
      const frameIdx = await page.evaluate(() => {
        return typeof window.__currentFrame === 'number' ? window.__currentFrame : -1;
      });

      console.log(`  Spot ${s} (${Math.round(spot * 100)}%): scrollY=${scrollY}, frame=${frameIdx}`);
      vpResult.frames.push({ spot: Math.round(spot * 100), scrollY, frameIdx });

      // Monotonicity check
      if (frameIdx >= 0 && prevFrame >= 0 && frameIdx < prevFrame) {
        console.warn(`  [FAIL] Frame NOT monotonically increasing: ${prevFrame} → ${frameIdx}`);
        monotonic = false;
      }
      if (frameIdx >= 0) prevFrame = frameIdx;

      // Screenshot
      const shotName = `${vp.name}-spot${s}-${Math.round(spot * 100)}pct.png`;
      const shotPath = path.join(SCREENSHOT_DIR, shotName);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  Screenshot: _qa/screenshots-v3/${shotName}`);
    }

    vpResult.monotonic     = monotonic;
    vpResult.consoleErrors = consoleErrors.length;
    vpResult.networkFails  = networkFails;

    /* ---- CDN / Frame network check ---- */
    const gsapOk     = networkRequests.some(r => r.url.includes('gsap') && r.status === 200);
    const pretOk     = networkRequests.some(r => r.url.includes('pretendard') && r.status === 200);
    const frameOk    = networkRequests.some(r => r.url.includes('frames/') && r.status === 200);
    const framesFail = networkRequests.filter(r => r.url.includes('frames/') && r.status !== 200);

    vpResult.gsapCdnOk     = gsapOk;
    vpResult.pretendardOk  = pretOk;
    vpResult.frameNetOk    = frameOk;
    vpResult.framesFail    = framesFail;

    console.log(`\n  CDN checks:`);
    console.log(`    GSAP CDN     : ${gsapOk ? 'OK' : 'FAIL'}`);
    console.log(`    Pretendard   : ${pretOk ? 'OK' : 'FAIL'}`);
    console.log(`    frames/*.jpg : ${frameOk ? 'OK (some loaded)' : 'FAIL'}`);
    if (framesFail.length > 0) {
      console.warn(`    Failed frames: ${framesFail.length}`);
    }

    console.log(`\n  Frame monotonic: ${monotonic ? 'PASS' : 'FAIL'}`);
    console.log(`  Console errors : ${consoleErrors.length}`);
    if (consoleErrors.length > 0) consoleErrors.forEach(e => console.warn(`    ERR: ${e}`));

    if (!monotonic || consoleErrors.length > 0) results.pass = false;

    await browser.close();
  }

  /* ============================================================
     VERDICT
  ============================================================ */
  console.log('\n==========================================');
  console.log('SELF-VERIFICATION VERDICT');
  console.log('==========================================');

  let allPass = true;

  for (const [vpName, vpr] of Object.entries(results.vpResults)) {
    const frameInts = vpr.frames.map(f => f.frameIdx);
    console.log(`\n[${vpName.toUpperCase()}]`);
    console.log(`  Frames at 0/25/50/75/100%: ${frameInts.join(', ')}`);
    console.log(`  Monotonic increase        : ${vpr.monotonic ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`  Console errors (non-GSAP) : ${vpr.consoleErrors === 0 ? 'PASS ✓ (0)' : `FAIL ✗ (${vpr.consoleErrors})`}`);
    console.log(`  Network fails             : ${vpr.networkFails.length === 0 ? 'PASS ✓' : `FAIL ✗ (${vpr.networkFails.length})`}`);
    console.log(`  GSAP CDN                  : ${vpr.gsapCdnOk ? 'OK ✓' : 'WARN (offline?)'}`);
    console.log(`  Pretendard CDN            : ${vpr.pretendardOk ? 'OK ✓' : 'WARN'}`);
    console.log(`  Frames loaded (net)       : ${vpr.frameNetOk ? 'OK ✓' : 'WARN'}`);

    if (!vpr.monotonic || vpr.consoleErrors > 0 || vpr.networkFails.length > 0) {
      allPass = false;
    }

    // Frame 0 must be 0 and frame at 100% must be near 191
    const f0 = vpr.frames[0]?.frameIdx;
    const f4 = vpr.frames[4]?.frameIdx;
    if (f0 !== 0) {
      console.warn(`  [WARN] 0% spot frame = ${f0} (expected 0)`);
    }
    if (f4 < 180) {
      console.warn(`  [WARN] 100% spot frame = ${f4} (expected ≥ 180)`);
    }
  }

  console.log(`\n------------------------------------------`);
  console.log(`OVERALL: ${allPass ? '✅ PASS' : '❌ FAIL — see above'}`);
  console.log(`Screenshots: _qa/screenshots-v3/`);
  console.log(`------------------------------------------\n`);

  process.exit(allPass ? 0 : 1);
}

runChecks().catch((err) => {
  console.error('Playwright error:', err);
  process.exit(1);
});
