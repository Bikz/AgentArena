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

## Current Sponsor State (as of 2026-02-08)

Enabled in production:
- Demo bots: `DEMO_ALLOW_BOTS=1`
- Yellow paid matches: `YELLOW_PAID_MATCHES=1`
- Arc mirror payouts: `ARC_ONCHAIN_ENABLED=1`

Contracts deployed:
- Arc Testnet `MatchSettlementEscrow`:
  - Address: `0x0d10743428106990aF57C04ce86eEF34A571C920`
  - Deploy tx: `0x366077325fa098f5998c215ca8cc0f371bb58afa7e98799016d84b0fb0a9b454`
  - Explorer: `https://testnet.arcscan.app`
- Sepolia `AgentArenaSubnameRegistrar`:
  - Address: `0x0d10743428106990aF57C04ce86eEF34A571C920`
  - Deploy tx: `0x4ac1001ae17ab319178abad5496792e5293065cf2efaa4f307c52b50f9ec6493`
  - Parent name: `agentarena-hackmoney-2026.eth`
  - Parent namehash: `0xc38c56ba7335daf9d411d9aafb0b2a66926cc8118846259c826b2ada305e0dc8`
  - Parent register tx: `0xa9353a2721baec69306d7ed859ad193dbe6df7657e2f79b02d83dd8d67b42f12`
  - Parent unwrap tx (sets ENS registry owner to registrar): `0xba4523d11304ba4b027ccd482c4d071ab8703da0da46f3c557a291dd7d0efb37`

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
