// Test B v2 — onUpdate 직접 개수 카운팅
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') errs.push('console-error: ' + m.text());
});

await page.goto(BASE + '/?_t=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForFunction(() => {
  const l = document.getElementById('loader');
  return l && (l.classList.contains('hidden') || l.style.display === 'none');
}, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);

// drawFrame 호출 횟수 추적
const updateCounts = [];
await page.exposeFunction('logUpdate', (idx) => updateCounts.push({ t: Date.now(), idx }));

// drawFrame 패치
await page.evaluate(() => {
  const origDraw = window.drawFrame;
  if (typeof origDraw === 'function') {
    window.drawFrame = function(idx) {
      origDraw.call(this, idx);
      window.logUpdate(idx);
    };
  }
});

const f0 = await page.evaluate(() => window.__currentFrame ?? 0);

// 휠 60회 (총 6000px)
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(50);
}
// scrub 0.6이라 GSAP 애니메이션이 끝날 때까지 기다림
await page.waitForTimeout(3000);

const f1 = await page.evaluate(() => window.__currentFrame ?? 0);

const totalDrawCalls = updateCounts.length;
const uniqueFrameIdxs = new Set(updateCounts.map(u => u.idx)).size;

console.log('=== Test B v2: drawFrame 호출 기반 부드러움 측정 ===');
console.log(`frame start: ${f0} → end: ${f1}`);
console.log(`총 drawFrame 호출: ${totalDrawCalls}`);
console.log(`고유 frame 인덱스: ${uniqueFrameIdxs}`);
console.log(`PASS 기준: uniqueFrameIdxs >= 30`);
console.log(`결과: ${uniqueFrameIdxs >= 30 ? 'PASS' : 'FAIL'}`);
console.log(`콘솔 에러: ${errs.length}`);
if (errs.length) errs.forEach(e => console.log('  ' + e));

await browser.close();
process.exit(uniqueFrameIdxs >= 30 ? 0 : 1);
