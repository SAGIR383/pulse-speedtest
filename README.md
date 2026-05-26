# Pulse — Network Intelligence

> A futuristic, AI-powered Speedtest **Progressive Web App**. Real browser-based
> network measurement, cinematic ambient UI, local intelligent diagnostics,
> live maps, and a fully installable offline-capable experience — built to run
> at **zero cost** on free hosting.

Pulse is not a speedometer clone. It's designed to feel like *an ambient
operating system for internet intelligence*: a calm, atmospheric interface that
performs **real** download / upload / latency / jitter / packet-loss
measurements and translates them into human answers — *Can I stream 4K? Can I
game? Will my video calls hold up? Why is my Wi-Fi slow?*

---

## ✨ Features

**Measurement engine (real, not simulated)**
- Parallel streaming **download** test with adaptive stream scaling, warm-up
  exclusion, and trimmed-mean stabilization.
- Parallel **upload** test using pre-generated incompressible random blobs.
- **Latency / ping** via many tiny cache-busted probes timed with
  `performance.now()` + the Resource Timing API.
- **Jitter** as mean absolute consecutive-RTT deviation.
- **Packet-loss estimation** from probe timeout/failure ratio.
- Runs inside a **Web Worker** so the UI never drops a frame, with automatic
  main-thread fallback.

**Intelligent diagnostics (local, rule-based — no paid AI)**
- Internet **health score** (weighted across all metrics).
- **Streaming** capability tiers (480p → 4K) with headroom analysis.
- **Gaming** readiness (latency + jitter + loss).
- **Video-call** stability (Zoom / Meet / Teams / Discord).
- **Wi-Fi diagnostics** + smart, prioritized recommendations.
- Human headlines like *"Your internet is excellent."*

**Experience**
- Cinematic **FluxOrb** centerpiece (canvas ambient flux field — not a gauge).
- Live **waveform** throughput visualization + spring-animated counters.
- Live **Leaflet / OpenStreetMap** map with your location, nearby nodes, and
  routing paths in a custom dark aesthetic.
- **Location detection**: precise GPS with graceful IP-based fallback.
- **History dashboard** with sparklines, stored locally in **IndexedDB**.
- Full **PWA**: installable, offline shell, service worker, manifest,
  shortcuts, maskable icons.

**Cost: $0.** No paid APIs, no database server, no AI inference bills. Free
geolocation fallback (ipapi.co) and free map tiles (OpenStreetMap).

---

## 🏗️ Architecture

```
                       ┌─────────────────────────────────────────┐
                       │              Browser (PWA)               │
                       │                                          │
   ┌───────────────┐   │   ┌──────────────┐    ┌──────────────┐   │
   │  Service       │   │   │   React UI   │    │  Web Worker  │   │
   │  Worker        │◀──┼──▶│  (Next.js    │◀──▶│  speedtest   │   │
   │  (offline      │   │   │   App Router)│    │  .worker.ts  │   │
   │   shell, cache)│   │   └──────┬───────┘    └──────┬───────┘   │
   └───────────────┘   │          │                   │           │
                       │          │ useSpeedTest      │ engine    │
                       │          ▼                   ▼           │
                       │   ┌──────────────┐    ┌──────────────┐   │
                       │   │  IndexedDB   │    │  Measurement │   │
                       │   │  (history)   │    │  engine +    │   │
                       │   └──────────────┘    │  AI scoring  │   │
                       │                       └──────┬───────┘   │
                       └──────────────────────────────┼───────────┘
                                                       │ fetch (no-store)
                                ┌──────────────────────┼──────────────────────┐
                                ▼                       ▼                      ▼
                       ┌────────────────┐     ┌────────────────┐    ┌────────────────┐
                       │ /api/ping      │     │ /api/download  │    │ /api/upload    │
                       │ (1-byte RTT)   │     │ (random stream)│    │ (drain+count)  │
                       └────────────────┘     └────────────────┘    └────────────────┘
                              Next.js Edge API routes (same origin, zero infra)

        Optional (Railway/Render only): standalone Express + WebSocket server in /server
        provides identical HTTP endpoints + a persistent /ws channel for higher-precision RTT.
```

**Why same-origin API routes?** Measuring against your own origin keeps the
test honest (no third-party CDN inflating numbers), requires zero extra
infrastructure, and deploys free on Vercel/Cloudflare. The optional WebSocket
server is a pure enhancement for platforms that allow long-running processes.

---

## 📁 Folder structure

```
pulse/
├── public/
│   ├── icons/                     # PWA icons (192, 512, maskable, apple, favicons)
│   ├── manifest.webmanifest       # PWA manifest
│   └── sw.js                      # Service worker (offline shell, caching)
├── scripts/
│   └── generate_icons.py          # Regenerate brand icons (PIL)
├── server/
│   └── index.js                   # OPTIONAL Express + WebSocket telemetry server
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ping/route.ts       # RTT endpoint (edge)
│   │   │   ├── download/route.ts   # Streaming random bytes (edge)
│   │   │   └── upload/route.ts     # Upload sink (edge)
│   │   ├── offline/page.tsx        # Offline fallback shell
│   │   ├── layout.tsx              # Root layout, fonts, PWA metadata
│   │   └── page.tsx                # Main experience (idle / testing / results)
│   ├── components/
│   │   ├── analytics/              # ScoreRing, InsightCard, StreamingTiers,
│   │   │                           #   Recommendations, HistoryDashboard
│   │   ├── layout/                 # Header, InstallPrompt, ServiceWorkerRegister
│   │   ├── map/                    # NetworkMap (Leaflet, client-only)
│   │   ├── test/                   # FluxOrb, Waveform, TestStage, ResultsView,
│   │   │                           #   AnimatedNumber
│   │   └── ui/                     # Icon set
│   ├── lib/
│   │   ├── ai/                     # score.ts, diagnostics.ts (rule-based AI)
│   │   ├── db/                     # history.ts (IndexedDB wrapper)
│   │   ├── engine/                 # latency, download, upload, orchestrator,
│   │   │                           #   location, runner (worker client), types
│   │   ├── hooks/                  # useSpeedTest
│   │   └── utils/                  # format helpers
│   ├── styles/
│   │   └── globals.css             # Design system, ambient mesh, glass surfaces
│   └── workers/
│       └── speedtest.worker.ts     # Engine runner (off main thread)
├── next.config.js                  # standalone output, no-store API headers
├── tailwind.config.ts              # Design tokens (aurora/titanium/void palette)
├── tsconfig.json
└── package.json
```

---

## 🚀 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev
# → http://localhost:3000

# 3. Production build
npm run build
npm start
```

> **HTTPS note:** The Geolocation API and Service Workers require a secure
> context. `localhost` is treated as secure, so dev works. In production your
> host provides free SSL automatically (see below).

**Optional standalone telemetry server** (only for Railway/Render):

```bash
npm install express ws        # optional deps
npm run server                # starts HTTP + WS on :8080
# then set NEXT_PUBLIC_TELEMETRY_ORIGIN to its URL when building the frontend
```

---

## 🌐 Deployment (all FREE tiers)

### Option A — Vercel (recommended, simplest)

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Framework preset auto-detects **Next.js**. No env vars needed.
4. **Deploy.** Done — free SSL, global edge network, the API routes run as edge
   functions automatically.

Vercel free tier covers this app comfortably; the API routes are tiny and
stream data without buffering. No standalone server needed.

### Option B — Cloudflare Pages

1. Push to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect repo**.
3. Build command: `npx @cloudflare/next-on-pages` (or use the Next.js preset).
   Build output directory: `.vercel/output/static`.
4. Set compatibility flag `nodejs_compat`.
5. **Deploy.** Free SSL + global CDN included.

> The API routes use the `edge` runtime, which maps cleanly onto Cloudflare's
> Workers runtime.

### Option C — Railway (includes optional WebSocket server)

1. New project → **Deploy from GitHub repo**.
2. Add **two services** if you want the WS server:
   - **Web** — build `npm run build`, start `npm start` (the Next app).
   - **Telemetry** — start `npm run server` (Express + WS). Add `express` + `ws`.
3. Set `NEXT_PUBLIC_TELEMETRY_ORIGIN` on the web service to the telemetry
   service's public URL (only if you want WS-based RTT).
4. Railway provisions free SSL + a public domain.

### Option D — Render

1. **New → Web Service** → connect repo.
2. Build: `npm install && npm run build`. Start: `npm start`.
3. Instance type: **Free**.
4. (Optional) add a second **Web Service** with start `npm run server` for the
   telemetry/WS server, then set `NEXT_PUBLIC_TELEMETRY_ORIGIN`.
5. Free SSL is automatic.

> **Free-tier sleep:** Render/Railway free services may sleep when idle and cold-
> start on first request. The PWA shell still loads instantly from the service-
> worker cache; only the first live test waits for wake-up. Vercel/Cloudflare
> have no cold-start concern for this app.

---

## ⚡ Performance optimization guide

Pulse is built to score high on Lighthouse and run smoothly on low-end devices.

- **Off-main-thread measurement.** The engine runs in a Web Worker, so
  saturating the network never blocks paint or animation. The UI thread only
  handles `requestAnimationFrame` canvas draws and spring counters.
- **Canvas over DOM for live visuals.** FluxOrb and Waveform render to
  `<canvas>` with a single rAF loop each, instead of animating hundreds of DOM
  nodes — far cheaper on CPU/GPU.
- **Code-splitting & lazy maps.** `NetworkMap` is dynamically imported with
  `ssr: false`, so Leaflet (and its CSS) never ship in the initial bundle or
  block first paint. The map hydrates only when shown.
- **`next/font`** self-hosts Sora / Manrope / JetBrains Mono with zero layout
  shift and no render-blocking font requests.
- **Reduced-motion aware.** `globals.css` honors `prefers-reduced-motion`,
  cutting ambient animation for users who ask for it (accessibility + battery).
- **Incompressible payloads.** Download/upload use random bytes so proxies/CDNs
  can't compress them and falsely inflate throughput — accuracy *and* it avoids
  wasted CPU on compression.
- **Streaming, flat memory.** The download route streams 64 KB chunks via
  `ReadableStream`; memory stays flat regardless of payload size.
- **`output: 'standalone'`** produces a minimal self-contained server bundle for
  small, fast container deploys.
- **Aggressive no-store on `/api/*`**, stale-while-revalidate on static assets,
  network-only for measurement endpoints in the service worker — caching never
  corrupts a measurement.

**Measurement accuracy techniques**
- Warm-up windows are excluded so TCP slow-start / connection ramp doesn't drag
  the average down.
- Trimmed means discard outlier samples for stable final numbers.
- Adaptive parallel streams scale up on fast links to saturate available
  bandwidth (single streams under-report on high-bandwidth connections).
- Median ping with outlier trimming; jitter as mean consecutive deviation.

---

## 🔒 Security

- HTTPS-only in production (free SSL from every recommended host); Geolocation
  and Service Workers require a secure context.
- Aggressive anti-cache headers on all measurement endpoints.
- Payload size hard-capped (100 MB) on download to prevent abuse.
- Optional standalone server includes a lightweight per-IP token-bucket rate
  limiter and disables `x-powered-by`.
- No secrets, no user accounts, no PII leaves the device — history lives only in
  your browser's IndexedDB.

---

## 🧩 Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Framer Motion ·
Canvas API · Web Workers · Service Workers · IndexedDB · Leaflet +
OpenStreetMap · (optional) Express + ws. All free / open-source.

---

## 🔁 Regenerating icons

```bash
python3 scripts/generate_icons.py   # requires Pillow: pip install Pillow
```

---

## 📄 License

MIT — do anything, no warranty.
