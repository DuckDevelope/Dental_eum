// Test B v4 — 휠 속도 낮추고 GSAP 트윈 완료 후 카운트
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__drawCount = 0;
  window.__frameChanges = 0;
  window.__prevFrame = -1;

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
await page.waitForTimeout(3000);

const drawCount0 = await page.evaluate(() => window.__drawCount);
const f0 = await page.evaluate(() => window.__currentFrame ?? 0);

// 더 빠른 스크롤: 120회, 150px씩, 20ms 간격 — 총 18000px 입력 (전체 스크롤 1904px 완주 보장)
for (let i = 0; i < 120; i++) {
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(20);
}
// GSAP scrub 0.6 애니메이션 완전 완료 대기
await page.waitForTimeout(4000);

const drawCount1 = await page.evaluate(() => window.__drawCount);
const f1 = await page.evaluate(() => window.__currentFrame ?? 0);
const total = drawCount1 - drawCount0;

console.log('=== Test B v4 ===');
console.log(`frame: ${f0} → ${f1}`);
console.log(`drawImage 호출: ${total}`);
console.log(`PASS 기준: >= 30`);
console.log(`결과: ${total >= 30 ? 'PASS' : 'FAIL'}`);
console.log(`에러: ${errs.length}`);

await browser.close();
process.exit(total >= 30 ? 0 : 1);
