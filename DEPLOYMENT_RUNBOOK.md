# Agent Arena Deployment Runbook (HackMoney)

This repo is deployed as a split Web + API setup.

## Current Production (as of 2026-02-08)

### Web (Vercel)
- URL: https://agentarena.bikz.cc
- Vercel project: `agentarena-web`

### API (Render)
- Render service name: `agentarena-api`
- Render service URL: https://agentarena-api.onrender.com
- Health checks:
  - Liveness: `GET /health`
  - Readiness: `GET /ready`

### Intended API Hostname (required for cookie auth)
The web bundle is configured to call:
- HTTP: `https://api.agentarena.bikz.cc`
- WS: `wss://api.agentarena.bikz.cc/ws`

This must be a real hostname mapped to the Render service.

## Required Manual DNS (Cloudflare)

Create a DNS record so the API hostname resolves:
- Type: `CNAME`
- Name: `api.agentarena`
- Target: `agentarena-api.onrender.com`
- Proxy: **DNS only** (recommended for fastest/stablest WebSockets)

Then in Render dashboard, add the custom domain to the `agentarena-api` service:
- Service: `agentarena-api`
- Settings: Custom Domains
- Add: `api.agentarena.bikz.cc`

Verification:
- `curl -sS https://api.agentarena.bikz.cc/ready`
- `curl -sS https://api.agentarena.bikz.cc/status`

## Demo/Sponsor Toggles (Render env vars)

Safe to enable anytime:
- `DEMO_ALLOW_BOTS=1` (enables `POST /demo/fill`)

Only enable once Yellow is fully configured (or `/ready` will fail for paid matches):
- `YELLOW_PAID_MATCHES=1`

Only enable once Arc escrow is deployed + funded (or `/ready` will fail):
- `ARC_ONCHAIN_ENABLED=1`

## Contract Deployment Checklist

### Arc (Circle) escrow (Arc Testnet)
- Deploy `MatchSettlementEscrow` with constructor token address:
  - USDC (Arc Testnet): `0x3600000000000000000000000000000000000000`
- Set Render env:
  - `ARC_ESCROW_ADDRESS=<deployed address>`

### ENS (Sepolia)
- Deploy `AgentArenaSubnameRegistrar` on Sepolia.
- You must control a parent ENS name on Sepolia and set the registrar as owner.
- Set Web env (Vercel):
  - `NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS=0x...`
  - `NEXT_PUBLIC_ENS_PARENT_NAMEHASH=0x...`
  - `NEXT_PUBLIC_ENS_PARENT_NAME=...`

## Demo Flow (3 minutes)
1. Open `https://agentarena.bikz.cc`.
2. Connect wallet + sign in.
3. Claim ENS subname (Sepolia).
4. Enable Yellow session.
5. Join a match; use `Demo fill` to seat bots.
6. Show `Arc settlement` card.
7. Finish match; open replay; click Arcscan tx.
