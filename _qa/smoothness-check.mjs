// Test B — 부드러움 정량 측정
// 휠 60회 동안 frame index 변경 횟수가 30회 이상이어야 PASS
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

// frame 기록 저장 배열
const frames = [];
await page.exposeFunction('logFrame', (i) => frames.push({ t: Date.now(), i }));

// __currentFrame setter를 intercept해서 모든 frame 변경 기록
await page.evaluate(() => {
  let _cf = window.__currentFrame ?? 0;
  Object.defineProperty(window, '__currentFrame', {
    configurable: true,
    get() { return _cf; },
    set(v) {
      _cf = v;
      window.logFrame(v);
    }
  });
});

// 휠 60회 (각 100px, 총 6000px), 50ms 간격
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(50);
}
await page.waitForTimeout(2000);

const totalChanges = frames.length;
const uniqueFrames = new Set(frames.map(f => f.i)).size;

// 연속 frame들 간의 변화 횟수 (실제 index 변경 이벤트)
let distinctChanges = 0;
let prevIdx = -1;
for (const f of frames) {
  if (f.i !== prevIdx) { distinctChanges++; prevIdx = f.i; }
}
distinctChanges--; // 초기값 제외

console.log('=== Test B: 부드러움 정량 측정 ===');
console.log(`총 frame 변경 이벤트: ${totalChanges}`);
console.log(`고유 frame 수 (0-based): ${uniqueFrames}`);
console.log(`distinctChanges (중복 제거): ${distinctChanges}`);
console.log(`PASS 기준: distinctChanges >= 30`);
console.log(`결과: ${distinctChanges >= 30 ? 'PASS' : 'FAIL'}`);

if (frames.length >= 2) {
  const minF = Math.min(...frames.map(f => f.i));
  const maxF = Math.max(...frames.map(f => f.i));
  console.log(`frame range: ${minF} → ${maxF}`);
  // 시간 간격 분석 (마지막 10개)
  const last10 = frames.slice(-10);
  if (last10.length > 1) {
    const diffs = [];
    for (let i = 1; i < last10.length; i++) diffs.push(last10[i].t - last10[i-1].t);
    const avg = diffs.reduce((a,b) => a+b, 0) / diffs.length;
    console.log(`마지막 10 이벤트 평균 간격: ${avg.toFixed(1)}ms`);
  }
}

console.log(`콘솔 에러: ${errs.length}`);

await browser.close();
process.exit(distinctChanges >= 30 ? 0 : 1);
