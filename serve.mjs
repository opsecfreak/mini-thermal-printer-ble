// mini-thermal-printer-ble local server. Zero dependencies (Node 18+).
// Serves this folder on http://127.0.0.1:PORT (localhost = secure context for Web Bluetooth)
// and accepts POST /api/log to save session logs into ./logs/.
// Binds to 127.0.0.1 only: nothing is reachable from the network.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(ROOT, 'logs');
const PORT = Number(process.env.PORT) || 8384;
const HOST = '127.0.0.1';
const MAX_LOG_BYTES = 25 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function saveLog(req, res, url) {
  const name = url.searchParams.get('session') || '';
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(name)) return send(res, 400, 'bad session name');
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > MAX_LOG_BYTES) {
      send(res, 413, 'too large');
      req.destroy();
    } else chunks.push(c);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    const body = Buffer.concat(chunks).toString('utf8');
    try {
      JSON.parse(body);
    } catch {
      return send(res, 400, 'invalid json');
    }
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const file = path.join(LOG_DIR, name + '.json');
      fs.writeFileSync(file + '.tmp', body);
      fs.renameSync(file + '.tmp', file);
      send(res, 200, JSON.stringify({ ok: true, file: 'logs/' + name + '.json' }), MIME['.json']);
    } catch (e) {
      send(res, 500, 'write failed: ' + e.message);
    }
  });
}

function serveStatic(req, res, url) {
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, 'bad path');
  }
  const file = path.normalize(path.join(ROOT, rel));
  const inside = file === ROOT || file.startsWith(ROOT + path.sep);
  const parts = path.relative(ROOT, file).split(path.sep);
  if (!inside || parts.some(p => p === '.git' || p === 'node_modules' || p === 'logs' || p === 'probe-logs')) {
    return send(res, 403, 'forbidden');
  }
  let target = file;
  try {
    if (fs.statSync(target).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: url.pathname + '/' });
        return res.end();
      }
      target = path.join(target, 'index.html');
    }
    const data = fs.readFileSync(target);
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    send(res, 404, 'not found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/api/ping') return send(res, 200, 'mini-thermal-printer-ble');
  if (url.pathname === '/api/log' && req.method === 'POST') return saveLog(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  serveStatic(req, res, url);
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Is the server already running?`);
  } else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`mini-thermal-printer-ble serving ${ROOT}`);
  console.log(`Open http://${HOST}:${PORT}/   (diagnostics: /probe/)`);
  console.log('Logs are saved to ' + LOG_DIR);
  console.log('Close this window to stop the server.');
});
