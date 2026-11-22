# Tesserae Device Simulator — Plan

A browser-based simulator of the [tesserae-device-firmware](https://github.com/dmellok/tesserae-device-firmware)
that behaves like a real e-paper device on a Tesserae server: it onboards, polls
for frames, paints them, reports status and sleeps. It can point at any Tesserae server.

First target: **Seeed reTerminal E1001**, both the mono (1bpp) and 4-gray (2bpp) builds.
The design keeps adding more boards a matter of data and decoders.

> Reference revisions studied: firmware `eb266cc`, server `ddff55b` (both 2026-11-22).

---

## 1. Decisions

| Topic                         | Decision                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where the firmware logic runs | **Browser only, no backend.** The wake-cycle state machine is TypeScript running in the page. The Tesserae device API already sends `Access-Control-Allow-Origin: *` on `/api/v1/device/*` and `/renders/*`. |
| Frontend                      | React 19 + Vite + TypeScript, Tailwind v4, shadcn/ui, Zustand (state), Dexie (IndexedDB)                                                                                                                     |
| Package manager               | pnpm (via corepack)                                                                                                                                                                                          |
| Python / uv                   | **Not used** unless a tool or script actually needs it. If one does, it goes in a uv project under `tools/` and the devcontainer gets the uv feature.                                                        |
| Timing                        | Real time: sleep for the server's `next_poll_s`. There is a **Wake now** control, physical-button wakes, and a per-device speed multiplier for testing.                                                      |
| Auth on the simulator         | None. Protect it at the Dokploy/Traefik/network layer if needed.                                                                                                                                             |
| Dev Tesserae server           | A **sidecar container** (`ghcr.io/dmellok/tesserae`) in the devcontainer's compose file. Only the image reference is committed. No Tesserae code is committed, and its data volume is gitignored.            |
| Deployment                    | Dokploy, Docker Compose: a static build served by a small web server container.                                                                                                                              |
| Tests                         | Vitest (engine and decoders, fully unit-testable with an injected clock and HTTP layer) and Playwright (end-to-end against the dev sidecar)                                                                  |

---

## 2. What the simulator must reproduce

### 2.1 Wake cycle (from `src/main.c` / README)

```
boot
  -> no WiFi creds / server URL?   -> setup screen (stands in for captive portal)
  -> "connect WiFi"                 (simulated: instant, or a configurable failure)
  -> no device token?               -> discover / register -> sleep
  -> GET frame (If-None-Match)       304 -> skip paint
                                     204 -> nothing rendered yet
                                     200 -> download panel-native .bin
  -> POST status (battery, rssi, temp/humidity, next_sleep_s, fw_version…)
  -> paint (simulated slow e-ink refresh)
  -> deep sleep for server-driven interval
```

### 2.2 REST protocol (base `<server_url>/api/v1/device/`)

| Call                     | Auth                                | Request                                       | Response fields the simulator uses                                                                                                                        |
| ------------------------ | ----------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /discover`         | none                                | identity body                                 | `registered`, `device_token`, `device_id`, `server_time`, `retry_after_s`, `config.sleep_interval_s`                                                      |
| `POST /register`         | `X-Pairing-Code`                    | identity body                                 | `device_token`, `device_id`, `server_time`, `config.{sleep_interval_s,button_wake_s}`                                                                     |
| `GET /<id>/frame`        | `Bearer`, `If-None-Match: "<etag>"` | optional `?button=<name>&button_event_id=<n>` | 200: `url`, `format`, `panel_w`, `panel_h`, `render_id`, `button_wake_s`. 304 / 204. `ETag` header                                                        |
| `GET <url>` (the `.bin`) | `Bearer`                            | —                                             | raw panel bytes, length checked exactly                                                                                                                   |
| `POST /<id>/status`      | `Bearer`                            | telemetry body (below)                        | `next_poll_s`, `wake_at`, `server_time`, `config.{sleep_interval_s, button_wake_s, beep_enabled, beep_volume, beep_pattern, tz, always_on, awake_poll_s}` |

**Identity body** (discover/register): `device_id`, `kind`, `panel_w`, `panel_h`, `rotation`,
`fw_version`, `mac`, and capability blocks. The default `device_id` is `reTerminal_E1001_<mac-suffix>`.
The simulator generates a stable fake MAC for each virtual device.

**Status body**: `battery_mv`, `battery_pct`, `vbus`, `charging`, `rssi`, `ip`, `next_sleep_s`,
`sleep_until`, `fw_version`, `panel_w`, `panel_h`, `temperature_c`, `humidity_pct`,
`env_sensor:"sht4x"`, `tz`, plus `button` and `button_event_id` when the frame GET failed to deliver a press.
Every one of these values can be edited from the simulator UI (sliders, toggles).

The simulator **does not advertise** capabilities it doesn't implement: OTA, deck_cache, overlay,
touch, logs, or frame-cache. That keeps the server on its plain code path.

### 2.3 E1001 profiles (MVP)

| Profile                   | `kind`                        | Wire format                                                | Size     |
| ------------------------- | ----------------------------- | ---------------------------------------------------------- | -------- |
| reTerminal E1001          | `seeed_reterminal_e1001`      | 1bpp packed, MSB = leftmost, bit 1 = white                 | 48 000 B |
| reTerminal E1001 (4-gray) | `seeed_reterminal_e1001_gray` | 2bpp packed, 4 px/byte, MSB-first, `00` black … `11` white | 96 000 B |

Both are 800×480 landscape and have three front buttons: **Left, Right, Refresh**, in that
physical order. Refresh is the green one at the end. The buzzer, the green status LED and the
SHT4x sensor are simulated.

### 2.4 On-device status screens

These are drawn into the same framebuffer, so they look like the panel itself, using strings
taken from `splash.c` / `main.c`:

- Setup needed ("Open http://192.168.4.1" in the real portal; here it is a setup form)
- "Can't reach the server" / "Wi-Fi didn't connect" / "Pairing code rejected"
- "Almost done — Approve this device in Tesserae, Settings > Devices." (discover pending)
- "Tesserae is busy; it will keep retrying." (429 / `retry_after_s`)
- "Connected! Waiting for your first frame" (204)
- "Wi-Fi unavailable" (simulated outage)

---

## 3. Architecture

```
┌──────────────────────────── Browser (one tab) ────────────────────────────┐
│  React UI                                                                  │
│   ├─ Device list / add device (choose profile, server URL, pairing code)   │
│   ├─ DeviceView: bezel + <canvas> panel + buttons + LED + "sleeping" badge │
│   ├─ Controls: wake now, speed ×, battery/rssi/temp sliders, Wi-Fi fail    │
│   └─ Inspector: HTTP log (req/resp), state timeline, NVS dump, raw frame   │
│                                                                            │
│  Zustand store  ◄── events ──  Firmware engine (pure TS, no React)         │
│                                 ├─ state machine (one per virtual device)  │
│                                 ├─ Clock  (injectable: real / scaled / fake)│
│                                 ├─ Http   (injectable: fetch / mock)       │
│                                 ├─ Nvs    (Dexie-backed persistence)       │
│                                 └─ Panel  (profile → decoder → RGBA)       │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ fetch (CORS)
                                     ▼
                          Tesserae server (any URL)
```

Engine design rules:

- **Pure and deterministic.** The engine never touches `Date.now()`, `setTimeout` or `fetch`
  directly. It goes through `Clock`/`Http`, so Vitest can run a full onboarding-to-sleep cycle with a
  fake clock and a scripted server.
- **Data-driven profiles.** A `DeviceProfile` holds the kind, geometry, format, buttons, sensors,
  battery model, capabilities and palette. New boards add a profile and, if needed, a decoder
  (`mono1`, `gray2`, then later `spectra6_4bpp`, `gray4`, `bwr2`, `bwyr2`).
- **NVS mirror.** Each virtual device stores what the firmware keeps in NVS: Wi-Fi creds (fake),
  `server_url`, `pairing_code`, `device_id`, `device_token`, `last_frame_etag`, `tz`, and the last
  framebuffer. Everything persists in IndexedDB, so a reload looks like a device that kept its
  e-ink image. "Factory reset" wipes it.
- **Sleep scheduling.** Store an absolute `wake_at` time instead of a relative timeout. Browsers
  throttle background-tab timers, so on `visibilitychange` or on load the engine catches up
  (one wake, not N). Timers run in a Web Worker to reduce throttling.
- **Paint simulation.** E-ink style refresh animation (flash black/white, about 3–4 s for a full
  mono refresh), with a "fast" toggle.

### 3.1 Known constraints of the browser-only choice

| Constraint                                                                             | Impact / mitigation                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mixed content:** an HTTPS simulator (Dokploy) cannot `fetch` an `http://` LAN server | Document it clearly, and detect it in the UI with a specific error. Options: put Tesserae behind HTTPS (Dokploy/Traefik/Caddy), or serve the simulator over plain HTTP on the LAN. A small reverse-proxy service would be the escape hatch, but it is out of scope unless asked. |
| **Response headers through CORS:** `ETag` and `Date` are not CORS-safelisted           | **Verify** that Tesserae's `Access-Control-Expose-Headers` includes `ETag` (its changelog says Expose-Headers is set). If `Date` isn't exposed, use `server_time` from JSON bodies as the clock source. That is better anyway.                                                   |
| Devices only run while the tab is open                                                 | That is acceptable for a simulator. Catch up on reopen as described above.                                                                                                                                                                                                       |
| `/renders/*` on a non-LAN client needs a signed URL                                    | The server already appends the signature to `url` in the frame response. Use the URL exactly as given.                                                                                                                                                                           |
| `rotation` / panel orientation                                                         | E1001 is landscape with no rotation. The profile carries `BOARD_FRAMEBUFFER_ROTATION` for later boards.                                                                                                                                                                          |

---

## 4. Repository layout

```
tesserae-websimulator/
├─ .devcontainer/
│  ├─ devcontainer.json          # dockerComposeFile + service "app"
│  ├─ docker-compose.yml         # app (node) + tesserae sidecar
│  └─ post-create.sh             # corepack enable, pnpm install
├─ src/
│  ├─ engine/                    # firmware simulation (no React imports)
│  │  ├─ machine.ts              # wake-cycle state machine
│  │  ├─ rest.ts                 # typed Tesserae device API client
│  │  ├─ clock.ts  http.ts  nvs.ts
│  │  └─ splash.ts               # status screens rendered into the framebuffer
│  ├─ profiles/
│  │  ├─ types.ts
│  │  ├─ seeed-reterminal-e1001.ts
│  │  └─ seeed-reterminal-e1001-gray.ts
│  ├─ panel/decoders/            # mono1.ts, gray2.ts (+ tests)
│  ├─ components/                # DeviceView, Bezel, Inspector, … (shadcn/ui)
│  ├─ store/                     # Zustand slices
│  └─ main.tsx  App.tsx
├─ tests/e2e/                    # Playwright, runs against the sidecar
├─ Dockerfile                    # multi-stage: node build → static server
├─ docker-compose.yml            # Dokploy deployment
├─ .gitignore                    # node_modules, dist, .devcontainer/.tesserae-data, …
└─ PLAN.md
```

---

## 5. Development environment (devcontainer)

`.devcontainer/docker-compose.yml` has two services:

- **app**: `mcr.microsoft.com/devcontainers/typescript-node:22`, with the workspace mounted and pnpm
  through corepack. Vite on `5173`.
- **tesserae**: `ghcr.io/dmellok/tesserae:<pinned tag>` (about 2.5 GB, pulled once), bridge network,
  port `8765`, with data in `.devcontainer/.tesserae-data/` (**gitignored**) or a named volume.
  `TESSERAE_IN_DOCKER=1`.

`forwardPorts: [5173, 8765]`. From the host browser, the simulator at `http://localhost:5173` calls
Tesserae at `http://localhost:8765`, which is cross-origin and allowed by CORS. Tesserae builds frame
URLs from the request `Host` (`request.url_root`), so `localhost:8765` URLs resolve correctly.
Playwright e2e running inside the container uses `http://tesserae:8765`.

First-run note: Tesserae's setup wizard (password plus onboarding) must be completed once in the
browser. From a non-LAN origin it asks for the setup token printed in `docker logs`. Document this
in the README, and optionally script it in a later milestone.

VS Code extensions: ESLint, Prettier, Tailwind CSS IntelliSense, Playwright, Vitest.

---

## 6. Deployment (Dokploy)

- `Dockerfile`: `node:22-alpine` + pnpm → `pnpm build` → copy `dist/` into a small static server
  image (Caddy or nginx-unprivileged) with an SPA fallback and long cache headers for hashed assets.
- `docker-compose.yml`: one `web` service, exposed internally on `8080`. Dokploy's Traefik handles
  the domain and TLS. No volumes: all state is per-browser in IndexedDB.
- Optional build-time env: `VITE_DEFAULT_SERVER_URL` pre-fills the server URL field.
- Healthcheck: `GET /` returns 200.

---

## 7. Milestones

### M0 — Scaffolding

- [ ] `git init`, `.gitignore`, devcontainer (app + tesserae sidecar), and check that both ports forward
- [ ] Vite + React + TS + Tailwind v4 + shadcn/ui; ESLint/Prettier; Vitest; Playwright
- [ ] Dockerfile + compose; check that `docker compose up` serves the built app

### M1 — Engine core (headless, unit tested)

- [ ] `Clock`, `Http`, `Nvs` interfaces with real and fake implementations
- [ ] Typed REST client for discover / register / frame / status (and `.bin` fetch with an exact length check)
- [ ] State machine: setup → connect → onboard (discover _or_ pairing-code register) → frame → status → paint → sleep
- [ ] Error paths: network error, 401 (token revoked → re-onboard), 429 with `retry_after_s`, 204, 304, wrong `.bin` length
- [ ] Decoders `mono1` and `gray2`, with golden tests (checkerboards, edge bits)
- [ ] Vitest scenario tests against a scripted fake server

### M2 — E1001 device UI

- [ ] Profiles for E1001 mono and gray
- [ ] DeviceView: bezel, 800×480 canvas (crisp scaling with a zoom toggle), LED, sleeping/awake indicator, countdown to next wake
- [ ] Setup form (server URL, onboarding mode: discover or pairing code, fake SSID)
- [ ] Status/splash screens rendered into the panel
- [ ] E-ink refresh animation (full refresh, with a "fast" toggle)

### M3 — Buttons, sensors, controls

- [ ] Left / Right / Refresh: wake → `?button=…&button_event_id=…` on the frame GET → `/status` fallback when delivery fails
- [ ] Buzzer through WebAudio, driven by the server `beep_*` config (`freq:ms` pattern)
- [ ] Editable telemetry: battery mV/% (plus an optional drain model), USB/charging, RSSI, temperature, humidity
- [ ] Wake now, speed multiplier, simulated Wi-Fi outage, factory reset

### M4 — Inspector & multi-device

- [ ] HTTP log with request/response bodies and headers, state timeline, NVS view, raw-frame hex/stats
- [ ] Several virtual devices at once, each with its own server URL
- [ ] Export/import device definitions as JSON

### M5 — Hardening & deploy

- [ ] Playwright e2e against the sidecar: discover → approve via the Tesserae admin API → frame painted
- [ ] Clear mixed-content and CORS diagnostics in the UI
- [ ] Deploy to Dokploy, with a README for setup, the HTTPS note and the first-run token

### Later

- More profiles: E1002 (Spectra-6 4bpp, 192000 B), E1003 (4bpp gray 1872×1404), TRMNL 7.5", …
- Deck cache (`/deck`, simulated SD), touch v2/v3 (`/frame/spec`, `/interact`, SSE `/stream`), overlay,
  proto2 manifest, OTA advertisement (simulated, no flash), `/log` upload
- Simulated BLE/serial setup flows

---

## 8. Open items to verify early (M0/M1)

1. Does `Access-Control-Expose-Headers` on `/api/v1/device/*` include `ETag`, `Retry-After` and `Date`?
   If not, open an upstream issue or PR, or fall back as described in §3.1.
2. The `.bin` URL (`/renders/...`) carries `Access-Control-Allow-Origin: *` (confirmed in
   `app_factory.py`), but that route may not answer an `OPTIONS` preflight. The firmware's
   `image_fetcher` sends `Authorization`, and in a browser that header triggers a preflight.
   Check whether fetching it _without_ `Authorization` works (simple CORS GET, signed URL / LAN
   bypass), and use that.
3. The exact discover/register identity capability blocks the server _requires_ for these kinds,
   compared with ones it only treats as optional.
4. Upstream mentions a planned browser emulator at `emulator.tesserae.ink`. Keep an eye on it so this
   project doesn't diverge, and consider contributing.
