import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:4321';
const OUT = '/home/kimduckhyun/Developments/homepage_maker/dental_laboratory/_qa/screenshots-opus';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const log = [];

async function getOps(page) {
  const safe = sel => page.locator(sel).evaluate(el => +getComputedStyle(el).opacity).catch(() => -1);
  return [await safe('#textA'), await safe('#textB'), await safe('#textC')];
}

// =========== Desktop main page — 5 scroll spots ===========
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => {
  const l = document.getElementById('loader');
  return l && (l.classList.contains('hidden') || l.style.display === 'none');
}, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

for (const pct of [0, 25, 50, 75, 95]) {
  await page.evaluate(p => {
    const max = document.body.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * p / 100, behavior: 'instant' });
  }, pct);
  await page.waitForTimeout(1800); // scrub 1.2s + safety
  const idx = await page.evaluate(() => window.__currentFrame ?? -1);
  const [a, b, c] = await getOps(page);
  log.push(`desktop spot${pct}%: frame=${idx}  A=${a.toFixed(2)} B=${b.toFixed(2)} C=${c.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/desktop-spot${String(pct).padStart(2,'0')}.png` });
}

// =========== Real mouse wheel test (the one박사님 was failing on) ===========
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(1500);
const wheelStart = await page.evaluate(() => window.__currentFrame ?? -1);
// Simulate slow user wheel: 12 increments of 100px
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(2000);
const wheelMid = await page.evaluate(() => window.__currentFrame ?? -1);
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(2000);
const wheelEnd = await page.evaluate(() => window.__currentFrame ?? -1);
log.push(`WHEEL: start=${wheelStart}  mid=${wheelMid}  end=${wheelEnd}`);
log.push(`WHEEL_PASS: ${wheelEnd > wheelMid && wheelMid > wheelStart}`);

// =========== Sub pages ===========
const sub = [['/about/', 'about'], ['/location/', 'location'], ['/board/', 'board'], ['/qna/', 'qna'], ['/contact/', 'contact']];
for (const [path, slug] of sub) {
  const subErrs = [];
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.on('pageerror', e => subErrs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') subErrs.push('console: ' + m.text()); });

  const r = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => null);
  await page.waitForTimeout(800);
  const status = r?.status() ?? 0;
  await page.screenshot({ path: `${OUT}/desktop-${slug}.png`, fullPage: true });
  log.push(`${path}: status=${status}  errors=${subErrs.length}${subErrs.length ? ' :: ' + subErrs.slice(0,2).join(' | ') : ''}`);
}

await ctx.close();

// =========== Mobile main + nav check ===========
const mctx = await browser.newContext({ ...devices['iPhone 13'] });
const mpage = await mctx.newPage();
await mpage.goto(BASE + '/', { waitUntil: 'networkidle' });
await mpage.waitForFunction(() => {
  const l = document.getElementById('loader');
  return l && (l.classList.contains('hidden') || l.style.display === 'none');
}, { timeout: 30000 }).catch(() => {});
await mpage.waitForTimeout(1500);
await mpage.screenshot({ path: `${OUT}/mobile-spot00.png` });

await mpage.evaluate(() => window.scrollTo({ top: (document.body.scrollHeight - window.innerHeight) * 0.95, behavior: 'instant' }));
await mpage.waitForTimeout(1800);
await mpage.screenshot({ path: `${OUT}/mobile-spot95.png` });

// nav check — go to about, then test hamburger
await mpage.goto(BASE + '/about/', { waitUntil: 'networkidle' });
await mpage.waitForTimeout(500);
await mpage.screenshot({ path: `${OUT}/mobile-about-default.png` });
// Find hamburger by aria-label/class heuristic
const hamSel = ['.hamburger', '[aria-label*="메뉴"]', 'button[aria-controls]', '.nav__toggle', '.menu-toggle'];
let opened = false;
for (const s of hamSel) {
  if (await mpage.locator(s).first().isVisible().catch(() => false)) {
    await mpage.locator(s).first().click().catch(() => {});
    await mpage.waitForTimeout(400);
    opened = true;
    log.push(`hamburger selector hit: ${s}`);
    break;
  }
}
if (opened) await mpage.screenshot({ path: `${OUT}/mobile-menu-open.png` });
else log.push('hamburger NOT found — selectors: ' + hamSel.join(', '));

await browser.close();

log.push('');
log.push('TOTAL pageerror/console-error during desktop main: ' + errs.length);
errs.slice(0, 5).forEach(e => log.push('  ' + e));

console.log(log.join('\n'));
console.log('\nCaptures:', OUT);
