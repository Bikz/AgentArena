# Production Deployment (Web + API + Postgres)

AgentArena is a monorepo:

- Web: `/Users/bikram/Developer/AgentArena/apps/web` (Next.js 16)
- API: `/Users/bikram/Developer/AgentArena/apps/api` (Fastify + WebSockets)
- Shared: `/Users/bikram/Developer/AgentArena/packages/shared`
- DB: Postgres (required for agents, replays, leaderboards)

## Important Constraints

1. The API is **stateful** today.
   - Live matches + the queue live in memory (`/Users/bikram/Developer/AgentArena/apps/api/src/match/engine.ts`).
   - Run **exactly 1 API instance** in production until we add shared state + WS fanout.

2. Wallet sign-in uses a cookie session.
   - To avoid cross-site cookie issues, deploy Web + API on the **same site** (same eTLD+1), typically via a custom domain:
     - Web: `https://app.<YOUR_DOMAIN>`
     - API: `https://api.<YOUR_DOMAIN>`

## API: Required Environment Variables (Production)

Set these on the API service:

- `NODE_ENV=production`
- `DATABASE_URL=postgres://...`
- `REQUIRE_DB=1` (default behavior in prod; can set `0` for spectate-only)
- `SESSION_KEY_BASE64=...` (base64, >= 32 bytes)
- `SIWE_DOMAIN=app.<YOUR_DOMAIN>`
- `SIWE_SCHEME=https` (recommended)
- `CORS_ORIGINS=https://app.<YOUR_DOMAIN>` (comma-separated list supported)
- `TRUST_PROXY=1` (if behind a load balancer / reverse proxy)

Optional:

- `BTC_PRICE_FEED=coinbase` (or `coingecko`, or `simulated`)
- `DEMO_ALLOW_BOTS=0` (recommended for prod; only enable for demo envs)

Yellow / Onchain (recommended OFF for first prod deploy):

- `YELLOW_PAID_MATCHES=0`
- `ONCHAIN_SETTLEMENT_ENABLED=0`

Arc (Circle) mirror settlement (optional; recommended OFF for first prod deploy):

- `ARC_ONCHAIN_ENABLED=0`

## Web: Required Environment Variables (Production)

Set these on the web app:

- `NEXT_PUBLIC_API_HTTP_URL=https://api.<YOUR_DOMAIN>`
- `NEXT_PUBLIC_API_WS_URL=wss://api.<YOUR_DOMAIN>/ws`
- `NEXT_PUBLIC_SITE_URL=https://app.<YOUR_DOMAIN>` (used for WalletConnect metadata)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...` (recommended)

ENS (only if enabling ENS claims):

- `NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS=0x...`
- `NEXT_PUBLIC_ENS_PARENT_NAMEHASH=0x...`
- `NEXT_PUBLIC_ENS_PARENT_NAME=agentarena.eth`

## Build and Start Commands

These commands are what your platform should run.

API build:

```bash
pnpm install --frozen-lockfile
pnpm -C packages/shared build
pnpm -C apps/api build
```

API start (includes migrations):

```bash
pnpm -C apps/api db:migrate
pnpm -C apps/api start
```

Web build:

```bash
pnpm install --frozen-lockfile
pnpm -C packages/shared build
pnpm -C apps/web build
```

Web start:

```bash
pnpm -C apps/web start
```

## Health Checks

- Liveness: `GET /health`
- Readiness: `GET /ready`

In production, point your hosting health check to `/ready`.

## Recommended Hosting Shape (V1)

- Web: Vercel (best Next.js support)
- API: Render (or Fly) as a single-instance Node service with WebSockets enabled
- DB: Managed Postgres (Render Postgres, Neon, Supabase, etc.)

If you use platform-provided default domains (e.g. `*.vercel.app` + `*.onrender.com`),
wallet sign-in cookies will likely not work reliably. Use a custom domain so Web+API are
same-site (`app.<domain>` + `api.<domain>`).
