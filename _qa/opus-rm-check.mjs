// Opus' verification: reduced-motion + cache-bust working under real wheel
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const browser = await chromium.launch();
const consoleLogs = [];

async function runScenario(label, contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errs = [];
  const eumLogs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => {
    const txt = m.text();
    if (m.type() === 'error') errs.push('console: ' + txt);
    if (txt.includes('[EUM]')) eumLogs.push(txt);
  });
  await page.goto(BASE + '/?_t=' + Date.now(), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const l = document.getElementById('loader');
    return l && (l.classList.contains('hidden') || l.style.display === 'none');
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const f0 = await page.evaluate(() => window.__currentFrame ?? -1);
  for (let i = 0; i < 18; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1500);
  const f1 = await page.evaluate(() => window.__currentFrame ?? -1);

  // text opacity check at current scroll
  const safe = sel => page.locator(sel).evaluate(el => +getComputedStyle(el).opacity).catch(() => -1);
  const a = await safe('#textA'), b = await safe('#textB'), c = await safe('#textC');

  console.log(`[${label}]`);
  console.log(`  wheel: frame ${f0} → ${f1}  (${f1 > f0 ? 'PASS' : 'FAIL'})`);
  console.log(`  text @ scrolled: A=${a.toFixed(2)} B=${b.toFixed(2)} C=${c.toFixed(2)}`);
  console.log(`  pageerror/console-error: ${errs.length}`);
  errs.slice(0,3).forEach(e => console.log('    ' + e));
  console.log(`  EUM logs: ${eumLogs.length}`);
  eumLogs.slice(0,4).forEach(l => console.log('    ' + l));

  await ctx.close();
  return { ok: f1 > f0, f0, f1, errs: errs.length, eumLogs: eumLogs.length };
}

const r1 = await runScenario('NORMAL desktop', { viewport: { width: 1440, height: 900 } });
const r2 = await runScenario('REDUCED-MOTION desktop', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

await browser.close();

console.log('\n=== SUMMARY ===');
console.log('normal:', r1.ok ? 'PASS' : 'FAIL', r1);
console.log('reduced-motion:', r2.ok ? 'PASS' : 'FAIL', r2);
process.exit(r1.ok && r2.ok ? 0 : 1);
