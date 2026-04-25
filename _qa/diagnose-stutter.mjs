/**
 * diagnose-stutter.mjs — v3 히어로 끊김 원인 측정
 *
 * 측정 항목:
 *   1. preload phase1 완료까지 걸린 시간
 *   2. 전체 476 frame 로드 완료까지 걸린 시간
 *   3. 스크롤 시 (사용자 행동 시뮬레이션) 매 RAF에서 그려진 frameIdx 시퀀스
 *   4. 그 시점에 해당 frame이 이미 로드되어 있었는지 여부
 *   5. RAF 간격 (jank 측정)
 *   6. 휠 → frame 매핑 단계 누락 여부
 */

import { chromium } from 'playwright';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4399;
const BASE = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.json': 'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const filePath = path.join(ROOT_DIR, urlPath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('404');
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  const networkLog = [];
  page.on('request', (r) => {
    if (r.url().includes('.webp')) {
      networkLog.push({ url: r.url(), startedAt: Date.now() });
    }
  });
  page.on('response', (r) => {
    if (r.url().includes('.webp')) {
      const entry = networkLog.find((e) => e.url === r.url() && !e.finishedAt);
      if (entry) entry.finishedAt = Date.now();
    }
  });

  await page.addInitScript(() => {
    window.__rafLog = [];
    window.__frameDrawLog = [];
    let last = performance.now();
    const tick = (now) => {
      window.__rafLog.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // hook drawFrame after script loads
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    const orig = window.drawFrame;
    // We can't easily wrap module-scoped function, so observe via __currentFrame
    window.__pollLog = [];
    setInterval(() => {
      window.__pollLog.push({
        t: performance.now(),
        idx: window.__currentFrame,
        loaded: typeof images !== 'undefined' ? images.filter(Boolean).length : -1,
      });
    }, 16);
  });

  // Wait for loader to disappear (phase1 done)
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const l = document.getElementById('loader');
    return l && (l.classList.contains('hidden') || l.style.display === 'none');
  }, { timeout: 30_000 });
  const phase1Time = Date.now() - t0;

  // Wait extra for full preload (best-effort: 5s buffer)
  await page.waitForTimeout(2000);
  const networkAt2s = networkLog.filter((e) => e.finishedAt).length;

  // Now scroll: simulate user wheel
  await page.mouse.move(720, 450);
  const scrollStart = Date.now();
  const scrollSteps = 30;
  const stepPx = 30;
  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel(0, stepPx);
    await page.waitForTimeout(33); // ~30fps wheel cadence (typical)
  }
  const scrollEnd = Date.now();

  // Wait for ScrollTrigger to settle
  await page.waitForTimeout(800);

  const result = await page.evaluate(() => ({
    rafIntervals: window.__rafLog.slice(-300),
    poll: window.__pollLog,
    finalFrame: window.__currentFrame,
    scrollY: window.pageYOffset,
    bodyHeight: document.body.scrollHeight,
  }));

  // Analysis
  const intervals = result.rafIntervals;
  const intervalAvg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const intervalP95 = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length * 0.95)];
  const intervalMax = Math.max(...intervals);
  const longFrames = intervals.filter((x) => x > 33).length;

  // frame jumps during scroll
  const polls = result.poll.filter((p) => p.t >= scrollStart - 50 && p.t <= scrollEnd + 800);
  const jumps = [];
  for (let i = 1; i < polls.length; i++) {
    const d = (polls[i].idx ?? 0) - (polls[i - 1].idx ?? 0);
    if (d !== 0) jumps.push(d);
  }
  const jumpsBig = jumps.filter((j) => Math.abs(j) > 10).length;

  console.log('===== DIAGNOSIS =====');
  console.log('phase1Time (ms):', phase1Time);
  console.log('frames loaded by t+2s:', networkAt2s, '/ 476');
  console.log('webp requests total:', networkLog.length);
  console.log('webp requests finished:', networkLog.filter((e) => e.finishedAt).length);
  console.log('---- RAF jank ----');
  console.log('avg interval (ms):', intervalAvg.toFixed(2));
  console.log('p95 interval  (ms):', intervalP95?.toFixed?.(2));
  console.log('max interval  (ms):', intervalMax.toFixed(2));
  console.log('long (>33ms) frames during scroll:', longFrames, '/', intervals.length);
  console.log('---- frame index jumps during scroll ----');
  console.log('total non-zero jumps:', jumps.length);
  console.log('avg jump size:', (jumps.reduce((a, b) => a + Math.abs(b), 0) / Math.max(jumps.length, 1)).toFixed(2));
  console.log('big jumps (>10 frames):', jumpsBig);
  console.log('final frameIdx:', result.finalFrame, '/ 475');
  console.log('final scrollY:', result.scrollY, '/', result.bodyHeight);

  // Save full log
  fs.writeFileSync(
    path.join(ROOT_DIR, '_qa', 'diagnose-stutter.json'),
    JSON.stringify({
      phase1Time,
      networkLog: networkLog.length,
      networkAt2s,
      polls: polls.slice(0, 200),
      jumps,
      intervals,
      finalFrame: result.finalFrame,
      scrollY: result.scrollY,
      bodyHeight: result.bodyHeight,
    }, null, 2)
  );

  await browser.close();
  server.close();
})();
