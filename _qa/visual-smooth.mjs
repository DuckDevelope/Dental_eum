import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:4321';
const OUT = '/home/kimduckhyun/Developments/homepage_maker/dental_laboratory/_qa/screenshots-smooth';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-background-timer-throttling']
});
const log = [];

async function getOps(page) {
  const safe = sel => page.locator(sel).evaluate(el => +getComputedStyle(el).opacity).catch(() => -1);
  return [await safe('#textA'), await safe('#textB'), await safe('#textC')];
}

// ===== Desktop 5 scroll spots =====
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(BASE + '/?_t=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForFunction(() => {
  const l = document.getElementById('loader');
  return l && (l.classList.contains('hidden') || l.style.display === 'none');
}, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2000);

for (const pct of [0, 25, 50, 75, 95]) {
  await page.evaluate(p => {
    const max = document.body.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * p / 100, behavior: 'instant' });
  }, pct);
  await page.waitForTimeout(2500); // scrub 0.6 * 2 + safety
  const idx = await page.evaluate(() => window.__currentFrame ?? -1);
  const [a, b, c] = await getOps(page);
  log.push(`desktop ${pct}%: frame=${idx}  A=${a.toFixed(2)} B=${b.toFixed(2)} C=${c.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/desktop-spot${String(pct).padStart(2,'0')}.png` });
}

// ===== Mobile =====
await ctx.close();
const mctx = await browser.newContext({ ...devices['iPhone 13'] });
const mpage = await mctx.newPage();
const merrs = [];
mpage.on('pageerror', e => merrs.push('pageerror: ' + e.message));

await mpage.goto(BASE + '/?_t=' + Date.now(), { waitUntil: 'networkidle' });
await mpage.waitForFunction(() => {
  const l = document.getElementById('loader');
  return l && (l.classList.contains('hidden') || l.style.display === 'none');
}, { timeout: 45000 }).catch(() => {});
await mpage.waitForTimeout(2000);

await mpage.screenshot({ path: `${OUT}/mobile-spot00.png` });
log.push('mobile 0%: captured');

await mpage.evaluate(() => window.scrollTo({ top: (document.body.scrollHeight - window.innerHeight) * 0.5, behavior: 'instant' }));
await mpage.waitForTimeout(2500);
const mf50 = await mpage.evaluate(() => window.__currentFrame ?? -1);
await mpage.screenshot({ path: `${OUT}/mobile-spot50.png` });
log.push(`mobile 50%: frame=${mf50}`);

await mpage.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
await mpage.waitForTimeout(2500);
const mf100 = await mpage.evaluate(() => window.__currentFrame ?? -1);
await mpage.screenshot({ path: `${OUT}/mobile-spot95.png` });
log.push(`mobile 95%: frame=${mf100}`);

await mctx.close();
await browser.close();

log.push('');
log.push(`콘솔 에러: ${errs.length}`);
log.push(`모바일 에러: ${merrs.length}`);

console.log(log.join('\n'));
console.log('\nCaptures:', OUT);
