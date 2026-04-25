// Test B v5 — headless false 불가하므로 progress 값 직접 샘플링으로 부드러움 측정
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
// --disable-background-timer-throttling 적용
const browser = await chromium.launch({
  args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__drawCount = 0;
  window.__frameSeq = [];

  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const c = origGetContext.call(this, type, ...args);
    if (type === '2d') {
      const origDraw = c.drawImage;
      c.drawImage = function(...a) {
        window.__drawCount++;
        return origDraw.apply(this, a);
      };
    }
    return c;
  };
});

const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));

await page.goto(BASE + '/?_t=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForFunction(() => {
  const l = document.getElementById('loader');
  return l && (l.classList.contains('hidden') || l.style.display === 'none');
}, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2000);

const f0 = await page.evaluate(() => window.__currentFrame ?? 0);
const dc0 = await page.evaluate(() => window.__drawCount);

// 휠 180회, 100px씩, 30ms 간격
for (let i = 0; i < 180; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(5000);

const f1 = await page.evaluate(() => window.__currentFrame ?? 0);
const dc1 = await page.evaluate(() => window.__drawCount);
const draws = dc1 - dc0;

console.log('=== Test B v5 (--disable-background-timer-throttling) ===');
console.log(`frame: ${f0} → ${f1}`);
console.log(`drawImage 호출: ${draws}`);
console.log(`PASS 기준: >= 30`);
console.log(`결과: ${draws >= 30 ? 'PASS' : 'FAIL'}`);
console.log(`에러: ${errs.length}`);

await browser.close();
process.exit(draws >= 30 ? 0 : 1);
