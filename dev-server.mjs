/**
 * Range-aware static server for local preview.
 * Python http.server는 byte-range를 지원하지 않아 비디오 streaming이 막힘.
 * 영상 hero가 일부 브라우저에서 재생 안 되는 원인이라 Node 기반으로 대체.
 *
 * 사용:  node dev-server.mjs   (포트 8000, 0.0.0.0 바인드)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const BIND = process.env.BIND || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

const NO_CACHE = { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' };

function serve(req, res) {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); }
  catch { url = req.url.split('?')[0]; }
  if (url.endsWith('/')) url += 'index.html';
  // path traversal 방지
  const fp = path.normalize(path.join(ROOT, url));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); res.end('404'); return; }

  const stat = fs.statSync(fp);
  const ext = path.extname(fp).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const range = req.headers.range;

  if (range && /^bytes=/.test(range)) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    let start = parseInt(m[1], 10);
    let end = m[2] === '' ? stat.size - 1 : parseInt(m[2], 10);
    if (isNaN(start) || isNaN(end) || start >= stat.size || end >= stat.size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return;
    }
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Type':  mime,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      ...NO_CACHE,
    });
    fs.createReadStream(fp, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type':   mime,
    'Content-Length': stat.size,
    'Accept-Ranges':  'bytes',
    ...NO_CACHE,
  });
  fs.createReadStream(fp).pipe(res);
}

const server = http.createServer(serve);
server.listen(PORT, BIND, () => {
  console.log(`[EUM] dev server: http://${BIND}:${PORT}/  (range-aware)`);
});
