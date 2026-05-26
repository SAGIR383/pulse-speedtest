/**
 * Pulse standalone telemetry server (optional).
 * =============================================
 *
 * The Next.js app is fully self-contained: its built-in API routes
 * (/api/ping, /api/download, /api/upload) handle every measurement, so the
 * app deploys to Vercel or Cloudflare Pages with ZERO extra infrastructure.
 *
 * This server is an OPTIONAL enhancement for platforms that support a
 * long-running Node process (Railway / Render free tiers). It provides:
 *
 *   • Identical HTTP measurement endpoints (so the front-end can point at it
 *     directly via NEXT_PUBLIC_TELEMETRY_ORIGIN if desired).
 *   • A WebSocket telemetry channel (/ws) for high-precision, low-overhead
 *     round-trip latency sampling — a persistent socket avoids per-probe TCP
 *     + TLS setup cost, yielding cleaner ping/jitter numbers than HTTP probes.
 *
 * It is intentionally dependency-light (express + ws), both of which are
 * free and open-source. If you only deploy the Next app, you never run this.
 *
 * Run:  npm run server      (PORT defaults to 8080)
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

// express and ws are optional — only needed when running this server.
let express;
let WebSocketServer;
try {
  express = require('express');
  ({ WebSocketServer } = require('ws'));
} catch (err) {
  console.error(
    '\n[pulse-server] Missing optional deps. Install them with:\n' +
      '    npm install express ws\n' +
      'You only need these if you run the standalone telemetry server.\n'
  );
  process.exit(1);
}

const PORT = process.env.PORT || 8080;
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB hard cap
const CHUNK = 64 * 1024;

const app = express();

// ---- security + CORS (lightweight) ----
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Timing-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ---- very lightweight rate limiting (per-IP token bucket) ----
const buckets = new Map();
const RATE = { capacity: 240, refillPerSec: 8 };
function rateLimited(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: RATE.capacity, last: now };
    buckets.set(ip, b);
  }
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(RATE.capacity, b.tokens + elapsed * RATE.refillPerSec);
  b.last = now;
  if (b.tokens < 1) return true;
  b.tokens -= 1;
  return false;
}
// periodic cleanup so the map can't grow unbounded
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [ip, b] of buckets) if (b.last < cutoff) buckets.delete(ip);
}, 60 * 1000).unref();

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (rateLimited(String(ip).split(',')[0].trim())) {
    return res.status(429).json({ error: 'rate_limited' });
  }
  next();
});

const noCache = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
};

// ---- health check ----
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pulse-telemetry', uptime: process.uptime() });
});

// ---- ping ----
app.get('/api/ping', (_req, res) => {
  noCache(res);
  res.type('text/plain').send('1');
});
app.head('/api/ping', (_req, res) => {
  noCache(res);
  res.status(204).end();
});

// ---- download (streaming, incompressible random bytes) ----
app.get('/api/download', (req, res) => {
  const requested = parseInt(req.query.bytes, 10);
  const total = Number.isFinite(requested)
    ? Math.min(Math.max(requested, CHUNK), MAX_BYTES)
    : 12 * 1024 * 1024;

  noCache(res);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(total));

  const chunk = crypto.randomBytes(CHUNK);
  let sent = 0;

  const write = () => {
    let ok = true;
    while (sent < total && ok) {
      const size = Math.min(CHUNK, total - sent);
      // mutate a few bytes so intermediaries can't dedupe/compress
      chunk[0] = (chunk[0] + 1) & 0xff;
      chunk[size - 1] = (chunk[size - 1] + 7) & 0xff;
      ok = res.write(size === CHUNK ? chunk : chunk.subarray(0, size));
      sent += size;
    }
    if (sent >= total) res.end();
    else res.once('drain', write);
  };
  write();
});

// ---- upload (drain + count, discard) ----
app.post('/api/upload', (req, res) => {
  let received = 0;
  req.on('data', (d) => {
    received += d.length;
  });
  req.on('end', () => {
    noCache(res);
    res.json({ received });
  });
  req.on('error', () => {
    res.status(400).json({ error: 'upload_failed' });
  });
});

// ---- create HTTP server + attach WebSocket ----
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  // Each connection is a persistent low-latency RTT channel.
  // Client sends a small JSON {t: <clientSendTime>} or a 'ping' token;
  // server echoes immediately so the client can compute RTT with one socket.
  socket.on('message', (data) => {
    try {
      // Echo back as fast as possible. Keep payload tiny.
      // Supports both raw 'ping' and JSON {seq,t} messages.
      const text = data.toString();
      if (text === 'ping') {
        socket.send('pong');
        return;
      }
      const msg = JSON.parse(text);
      socket.send(JSON.stringify({ seq: msg.seq, t: msg.t, srv: Date.now() }));
    } catch {
      // Non-JSON: just echo for RTT measurement.
      socket.send(data);
    }
  });

  socket.on('error', () => {
    /* swallow: a dropped probe socket is expected on flaky networks */
  });
});

server.listen(PORT, () => {
  console.log(`[pulse-server] HTTP + WS telemetry listening on :${PORT}`);
  console.log(`[pulse-server] endpoints: /api/ping /api/download /api/upload  ws:/ws`);
});
