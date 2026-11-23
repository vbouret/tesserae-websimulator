# Tesserae Device Simulator

A browser-only simulator of the [tesserae-device-firmware](https://github.com/dmellok/tesserae-device-firmware).
Each virtual device onboards on a Tesserae server, polls for frames, paints them on a simulated
e-paper panel, reports status and sleeps for the server-driven interval. See [PLAN.md](PLAN.md).

The board selector includes the devices in the firmware's supported-device list, plus
additional firmware board targets. Each profile uses its firmware kind, panel geometry,
frame format and button mappings. Your Tesserae server must support the selected kind.
The simulator models the common REST wake cycle; hardware-specific features such as touch,
partial refresh, SD caching and BLE are not simulated.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # Vitest: decoders + full wake-cycle scenarios (fake clock, scripted server)
pnpm typecheck && pnpm lint
```

Or open the folder in the devcontainer: it starts the app plus a Tesserae sidecar on
`http://localhost:8765` (from the host browser) / `http://tesserae:8765` (inside the container).

### First run of the Tesserae sidecar

Complete Tesserae's setup wizard once in the browser (password + onboarding). From a non-LAN origin
it asks for the setup token printed in `docker logs`. Then add a device here with the server URL
and either approve it under _Settings > Devices_ (Discover) or use a pairing code.

## Using it

- **Add device**: pick the board, server URL, fake SSID and onboarding mode.
- **Wake now / buttons**: Available board buttons wake the device; the press is sent as
  `?button=…&button_event_id=…` on the frame GET, with a `/status` fallback.
- **Time speed** divides the server's sleep interval (×10, ×60, ×600) for testing.
- **Inspector**: HTTP log, state timeline, NVS dump, raw frame stats/hex.
- State persists in IndexedDB; a reload resumes the in-progress sleep. _Factory reset_ wipes it.

## Browser constraints

- **Mixed content**: an HTTPS-hosted simulator cannot call an `http://` Tesserae. Serve Tesserae
  over HTTPS or open the simulator over HTTP. The UI reports this specifically.
- **CORS**: Tesserae must allow the simulator's origin and expose `ETag`. Without a readable
  `ETag` the simulator still works but re-downloads every frame (a warning appears in the timeline).
- The `.bin` is first fetched without `Authorization` (no preflight, signed URL) and retried with
  the bearer token if that fails.

## Deploy (Dokploy)

`docker-compose.yml` builds a static nginx image listening on `8080`. Point Dokploy's domain at the
`web` service. Optional build arg `VITE_DEFAULT_SERVER_URL` pre-fills the server URL.
