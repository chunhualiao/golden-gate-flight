# Golden Gate Flight

An interactive, cinematic 3D recreation of San Francisco's Golden Gate Bridge. Fly freely around the bridge, shift from daylight to night, and tune the fog in real time.

![Golden Gate Flight preview](public/og.png)

[Open the public Cloudflare demo](https://golden-gate-flight.chunhualiao.workers.dev) — no account or sign-in required.

## Highlights

- Immediate free-flight camera with keyboard, mouse, and touch controls
- Adjustable sunlight, night lighting, and fog density
- Procedural bridge towers, suspension cables, roadway, terrain, bay water, traffic, and stars
- Responsive control panel for desktop and mobile
- Deployment footer with the exact Git revision and live `main` freshness status
- No API keys, database, or runtime secrets required
- Server-rendered application shell with a client-side WebGL scene

## Controls

| Action | Desktop control |
| --- | --- |
| Look around | Drag directly on the scene |
| Move | `W` `A` `S` `D` |
| Rise / descend | `Space` / `Shift` |
| Boost | Hold `E` |
| Recenter the landmark | Click **Return to bridge** or press `R` |
| Time and atmosphere | Use the Sunlight and Fog controls |

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
git clone https://github.com/chunhualiao/golden-gate-flight.git
cd golden-gate-flight
npm ci
npm run dev
```

Open the local address printed in the terminal. No environment file is needed.

To exercise the production build locally:

```bash
npm run build
npm start -- --hostname 0.0.0.0 --port 3000
```

## Deploy

### Verify the deployed source

The footer displays the short Git commit used to build the running site. Select
**Source revision** to open that exact commit on GitHub. Production builds also
compare the deployed commit with the current `main` head and report **Up to
date**, **Update pending**, or **Status unknown** when GitHub cannot be reached.

Cloudflare Workers Builds supplies the commit and branch through
`WORKERS_CI_COMMIT_SHA` and `WORKERS_CI_BRANCH`; no token or manual version
number is required.

### Cloudflare Workers

Vinext has native Cloudflare Workers support. Authenticate once, then deploy:

```bash
npx wrangler login
npm run deploy
```

For CI, provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through your provider's secret manager. Do not commit either value.

### Docker and container clouds

The included image runs on any OCI-compatible container service:

```bash
docker build -t golden-gate-flight .
docker run --rm -p 3000:3000 golden-gate-flight
```

Push that image to your registry and deploy it with port `3000` on services such as AWS App Runner or ECS, Google Cloud Run, Azure Container Apps, Fly.io, Railway, or Render. The container does not require persistent storage or application secrets.

The app can also use Vinext's Nitro presets for provider-specific builds. See the [Vinext deployment guide](https://github.com/cloudflare/vinext#deployment) before choosing a provider adapter.

## Quality checks

```bash
npm run lint
npm test
```

`npm test` creates a production build and checks the server-rendered experience shell and interactive control surface. GitHub Actions runs both commands for every push and pull request.

## Project structure

```text
app/components/BridgeExperience.tsx  interface and environment controls
app/components/GoldenGateScene.tsx   Three.js scene, bridge, water, and flight
app/globals.css                       responsive visual design
tests/                                production rendering checks
worker/                               Cloudflare Workers entry point
```

## Technology

[Three.js](https://threejs.org/), [React Three Fiber](https://r3f.docs.pmnd.rs/), [React](https://react.dev/), [Vinext](https://github.com/cloudflare/vinext), and [Cloudflare's Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/).

WebGL 2 and hardware acceleration are recommended. Performance depends on the device and browser.

## License

[MIT](LICENSE)
