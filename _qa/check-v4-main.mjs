/**
 * v4 메인(영상 hero + 다크/라이트 교차 섹션) 회귀 테스트.
 * v3 frame sequence 회귀(check-v3-final.mjs)는 frames-hero 부활 시점 검증용으로 보존.
 *
 * 검증 항목:
 *   1. 모든 페이지 HTTP 200, 콘솔 에러 0
 *   2. 메인 hero video 존재 + autoplay 속성 + poster
 *   3. 4개 섹션 visible 토글 (data-reveal → is-visible)
 *   4. 금지어 "틀니" 0건
 *   5. 모바일 햄버거 default 닫힘 + 클릭 시 열림
 *   6. 글로벌 nav/footer 주입
 */

import { chromium, devices } from 'playwright';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4655;
const BASE_URL = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.mp4':  'video/mp4',
  '.json': 'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = req.url.split('?')[0];
      if (p.endsWith('/')) p += 'index.html';
      const fp = path.join(ROOT_DIR, p);
      const ext = path.extname(fp).toLowerCase();
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.writeHead(404);
        res.end('404');
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

let pass = 0, fail = 0;
const fails = [];
const ok = (name, info) => { pass++; console.log(`  ✅ PASS  ${name}${info ? ' — ' + info : ''}`); };
const ng = (name, info) => { fail++; fails.push(`${name}: ${info}`); console.log(`  ❌ FAIL  ${name} — ${info}`); };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();

  /* ---------- 1. 모든 페이지 200 + 콘솔 에러 0 ---------- */
  console.log('\n[1] 페이지 200 + 콘솔 에러');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const pages = ['/', '/about/', '/location/', '/board/', '/qna/', '/contact/'];
    for (const slug of pages) {
      const errs = [];
      const onErr = m => { if (m.type() === 'error') errs.push(m.text()); };
      const onPageErr = e => errs.push('PAGE: ' + e.message);
      page.on('console', onErr);
      page.on('pageerror', onPageErr);
      const resp = await page.goto(`${BASE_URL}${slug}`, { waitUntil: 'networkidle', timeout: 20000 });
      const status = resp ? resp.status() : 0;
      await page.waitForTimeout(500);
      page.off('console', onErr);
      page.off('pageerror', onPageErr);
      if (status === 200) ok(`page ${slug} HTTP 200`);
      else ng(`page ${slug}`, `status=${status}`);
      if (errs.length === 0) ok(`page ${slug} no console errors`);
      else ng(`page ${slug} console`, errs.slice(0, 3).join(' | '));
    }
    await ctx.close();
  }

  /* ---------- 2. 메인 hero video element ---------- */
  console.log('\n[2] 메인 hero video');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const meta = await page.evaluate(() => {
      const v = document.getElementById('heroVideo');
      if (!v) return { ok: false };
      return {
        ok: true,
        autoplay: v.autoplay,
        muted: v.muted,
        loop: v.loop,
        playsinline: v.playsInline,
        poster: !!v.poster,
        src: v.currentSrc || (v.querySelector('source')?.src ?? ''),
      };
    });
    if (meta.ok) ok('hero video exists');
    else ng('hero video', 'element missing');
    if (meta.autoplay) ok('autoplay attr'); else ng('autoplay attr', 'missing');
    if (meta.muted)    ok('muted attr');    else ng('muted attr', 'missing');
    if (meta.loop)     ok('loop attr');     else ng('loop attr', 'missing');
    if (meta.playsinline) ok('playsinline'); else ng('playsinline', 'missing');
    if (meta.poster)   ok('poster attr');   else ng('poster attr', 'missing');
    if (meta.src && meta.src.endsWith('.mp4')) ok('mp4 source', meta.src.split('/').slice(-2).join('/'));
    else ng('mp4 source', `src=${meta.src}`);
    await ctx.close();
  }

  /* ---------- 3. 섹션 reveal ---------- */
  console.log('\n[3] 섹션 reveal (IntersectionObserver)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    // 천천히 페이지 끝까지 스크롤
    await page.evaluate(async () => {
      const total = document.body.scrollHeight;
      for (let y = 0; y <= total; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 80));
      }
    });
    await page.waitForTimeout(900);
    const counts = await page.evaluate(() => ({
      total:   document.querySelectorAll('[data-reveal]').length,
      visible: document.querySelectorAll('[data-reveal].is-visible').length,
    }));
    if (counts.total >= 8) ok('data-reveal targets', `total=${counts.total}`);
    else ng('data-reveal targets', `expected ≥8, got ${counts.total}`);
    if (counts.visible === counts.total) ok('all targets visible after scroll', `${counts.visible}/${counts.total}`);
    else ng('reveal coverage', `${counts.visible}/${counts.total}`);
    await ctx.close();
  }

  /* ---------- 4. 금지어 "틀니" ---------- */
  console.log('\n[4] 금지어 "틀니" 검사');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const pages = ['/', '/about/', '/location/', '/board/', '/qna/', '/contact/'];
    let hits = [];
    for (const slug of pages) {
      await page.goto(`${BASE_URL}${slug}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('틀니')) hits.push(slug);
    }
    if (hits.length === 0) ok('"틀니" 단어 0건');
    else ng('"틀니" 단어', `발견 페이지: ${hits.join(', ')}`);
    await ctx.close();
  }

  /* ---------- 5. 모바일 햄버거 ---------- */
  console.log('\n[5] 모바일 햄버거');
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const hb = await page.locator('.hamburger').isVisible().catch(() => false);
    if (hb) ok('hamburger visible on mobile');
    else ng('hamburger visible on mobile', 'not visible');
    const initOpen = await page.getAttribute('#globalNavMenu', 'data-open');
    if (initOpen === 'false') ok('nav default closed', `data-open=${initOpen}`);
    else ng('nav default closed', `data-open=${initOpen}`);
    await page.locator('.hamburger').click();
    await page.waitForTimeout(300);
    const afterOpen = await page.getAttribute('#globalNavMenu', 'data-open');
    if (afterOpen === 'true') ok('hamburger click opens menu');
    else ng('hamburger click', `data-open=${afterOpen}`);
    await ctx.close();
  }

  /* ---------- 6. 글로벌 nav/footer 주입 ---------- */
  console.log('\n[6] 글로벌 nav/footer 주입');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const navVisible = await page.locator('#globalNav').isVisible().catch(() => false);
    const footVisible = await page.locator('#globalFooter').isVisible().catch(() => false);
    if (navVisible) ok('global nav injected'); else ng('global nav', 'not visible');
    if (footVisible) ok('global footer injected'); else ng('global footer', 'not visible');
    await ctx.close();
  }

  console.log('\n============================================================');
  console.log(`결과: ${pass} PASS / ${fail} FAIL`);
  console.log('============================================================');
  if (fail > 0) {
    console.log('\n실패 항목:');
    for (const f of fails) console.log(`  ❌ ${f}`);
  } else {
    console.log('\n모든 v4 회귀 통과.');
  }

  await browser.close();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
})();
