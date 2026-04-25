// Test B v3 — addInitScript로 페이지 로드 전 훅 삽입 + 느린 스크롤
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// 페이지 로드 전에 미리 훅 삽입
await page.addInitScript(() => {
  window.__frameLog = [];
  window.__origCurrentFrame = 0;
  // currentIdx setter를 추적하기 위해 drawImage를 intercept
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const ctx = origGetContext.call(this, type, ...args);
    if (type === '2d') {
      const origDraw = ctx.drawImage;
      ctx.drawImage = function(...drawArgs) {
        window.__drawCount = (window.__drawCount || 0) + 1;
        return origDraw.apply(this, drawArgs);
      };
    }
    return ctx;
  };
});

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

// 초기 상태
const drawCount0 = await page.evaluate(() => window.__drawCount || 0);
const f0 = await page.evaluate(() => window.__currentFrame ?? 0);

// 휠 60회 (총 6000px, 50ms 간격)
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(50);
}
// scrub 0.6 보정 대기
await page.waitForTimeout(3000);

const drawCount1 = await page.evaluate(() => window.__drawCount || 0);
const f1 = await page.evaluate(() => window.__currentFrame ?? 0);
const drawCallsDuringScroll = drawCount1 - drawCount0;

console.log('=== Test B v3: canvas drawImage 호출 카운트 ===');
console.log(`frame: ${f0} → ${f1}`);
console.log(`drawImage 호출 수 (스크롤 중): ${drawCallsDuringScroll}`);
console.log(`PASS 기준: drawCallsDuringScroll >= 30`);
console.log(`결과: ${drawCallsDuringScroll >= 30 ? 'PASS' : 'FAIL'}`);
console.log(`콘솔 에러: ${errs.length}`);

await browser.close();
process.exit(drawCallsDuringScroll >= 30 ? 0 : 1);
