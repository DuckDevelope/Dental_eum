import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE = 'http://localhost:4321';
const PAGES = [
  { path: '/',          slug: 'index'    },
  { path: '/about/',    slug: 'about'    },
  { path: '/location/', slug: 'location' },
  { path: '/board/',    slug: 'board'    },
  { path: '/qna/',      slug: 'qna'      },
  { path: '/contact/',  slug: 'contact'  },
];

const report = { timestamp: new Date().toISOString(), pages: [], summary: {} };

const browser = await chromium.launch();

async function audit(viewportName, contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  for (const { path, slug } of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    const consoleErr = [];
    const failedReq = [];

    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text()); });
    page.on('requestfailed', r => failedReq.push(`${r.url()} :: ${r.failure()?.errorText}`));

    let status = 0, title = '', timing = {};
    try {
      const t0 = Date.now();
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
      timing.load = Date.now() - t0;
      status = res?.status() ?? 0;
      title = await page.title();
    } catch (e) {
      errors.push(`goto: ${e.message}`);
    }

    // basic a11y/SEO probes
    const lang        = await page.locator('html').getAttribute('lang').catch(() => null);
    const h1Count     = await page.locator('h1').count().catch(() => 0);
    const imgs        = await page.locator('img').all();
    let imgsNoAlt = 0;
    for (const i of imgs) {
      const a = await i.getAttribute('alt');
      if (a === null || a === undefined) imgsNoAlt++;
    }
    const navLinks    = await page.locator('header a').count().catch(() => 0);
    const skipLink    = await page.locator('a[href^="#"]').count().catch(() => 0);

    // viewport-aware screenshot
    await page.screenshot({ path: `${SHOTS}/${viewportName}-${slug}.png`, fullPage: true }).catch(() => {});

    report.pages.push({
      viewport: viewportName, path, status, title, timing,
      h1Count, lang, imgs: imgs.length, imgsNoAlt, navLinks,
      pageErrors: errors, consoleErrors: consoleErr, failedRequests: failedReq,
    });

    await page.close();
  }
  await ctx.close();
}

await audit('desktop', { viewport: { width: 1440, height: 900 } });
await audit('mobile',  { ...devices['iPhone 13'] });

// quick interaction probe — click nav links from index
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const navHrefs = await page.locator('header nav a').evaluateAll(els => els.map(e => e.getAttribute('href')));
  const navTest = { discovered: navHrefs, brokenLinks: [] };
  for (const href of navHrefs) {
    if (!href || href.startsWith('#') || href.startsWith('http')) continue;
    try {
      const res = await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      if (!res || res.status() >= 400) navTest.brokenLinks.push({ href, status: res?.status() });
    } catch (e) {
      navTest.brokenLinks.push({ href, error: e.message });
    }
  }
  report.navigation = navTest;
  report.navPageErrors = errs;
  await ctx.close();
}

await browser.close();

// summary
const totErr = report.pages.reduce((a,p) => a + p.pageErrors.length + p.consoleErrors.length, 0);
const totFail = report.pages.reduce((a,p) => a + p.failedRequests.length, 0);
const totNoAlt = report.pages.reduce((a,p) => a + p.imgsNoAlt, 0);
report.summary = {
  pagesChecked: report.pages.length,
  totalErrors: totErr,
  totalFailedRequests: totFail,
  totalImgsMissingAlt: totNoAlt,
  brokenNavLinks: report.navigation.brokenLinks.length,
};

writeFileSync(resolve(__dirname, 'report.json'), JSON.stringify(report, null, 2));

// markdown summary
let md = `# Playwright QA Report — 이음 기공소 v2\n\n`;
md += `Generated: ${report.timestamp}\n\n`;
md += `## Summary\n\n`;
md += `| Metric | Value |\n|---|---|\n`;
for (const [k,v] of Object.entries(report.summary)) md += `| ${k} | ${v} |\n`;
md += `\n## Per-page (desktop + mobile)\n\n`;
md += `| viewport | path | status | title | h1 | imgs | imgs no-alt | console-err | page-err | failed-req | load-ms |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const p of report.pages) {
  md += `| ${p.viewport} | ${p.path} | ${p.status} | ${p.title.slice(0,40)} | ${p.h1Count} | ${p.imgs} | ${p.imgsNoAlt} | ${p.consoleErrors.length} | ${p.pageErrors.length} | ${p.failedRequests.length} | ${p.timing.load ?? '-'} |\n`;
}
md += `\n## Errors detail\n\n`;
for (const p of report.pages) {
  if (p.consoleErrors.length || p.pageErrors.length || p.failedRequests.length) {
    md += `### ${p.viewport} ${p.path}\n`;
    p.consoleErrors.forEach(e => md += `- console: ${e}\n`);
    p.pageErrors.forEach(e => md += `- page: ${e}\n`);
    p.failedRequests.forEach(e => md += `- net: ${e}\n`);
  }
}
md += `\n## Nav probe\n\n`;
md += `Discovered: ${report.navigation.discovered.join(', ')}\n\n`;
md += `Broken: ${JSON.stringify(report.navigation.brokenLinks)}\n`;

writeFileSync(resolve(__dirname, 'report.md'), md);

console.log('=== SUMMARY ===');
console.log(JSON.stringify(report.summary, null, 2));
console.log('Report written:', resolve(__dirname, 'report.md'));
