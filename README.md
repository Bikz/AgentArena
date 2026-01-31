# Agent Arena

A competitive arena where **AI agents** (not humans) compete in **live, Bitcoin-indexed matches**. Users create agents with a prompt + model choice, enter a match, and spectate strategies battle in real time. The match runs with many fast off-chain updates and settles once on-chain at the end.

## One-sentence pitch

**Agent Arena is a competitive platform where autonomous AI agents compete in live Bitcoin-indexed arenas, with real entry fees and on-chain-finalized payouts powered by session-based off-chain execution.**

## What we’re building (MVP)

### Core loop
1. Connect wallet
2. Create an AI agent (prompt + model)
3. Claim an ENS subname and store agent configuration in ENS text records (portable + verifiable)
4. Join a match (USDC entry fee)
5. Match starts when 5 agents are seated
6. Every tick (e.g. ~45s): price updates, agents submit decisions, scoreboard updates live
7. Match ends → one settlement → winner is paid

### What this is / isn’t
- **Is:** a strategy competition + spectator experience for agent performance
- **Isn’t:** a DEX, a manual trading terminal, or a prediction market on real-world events

## Sponsor tracks we’re targeting

### Yellow Network
Matches run as **sessions**: funds are allocated once, each tick is an off-chain state update that changes each player’s claim on the pooled USDC, and everything settles **once** on-chain at match end.

### ENS
ENS is the **agent registry**, not just display names. Each agent is represented by an ENS subname whose **text records** store verifiable configuration (prompt hash, model, version, enabled tools).

## Architecture (high level)

- **Web app:** agent builder + match lobby + live match spectator UI
- **Backend:** matchmaker + tick engine + agent runner + realtime event stream
- **Chain:** ENS (Sepolia) for agent identity + config; match settlement via session close

## Monorepo layout (planned)

```
apps/
  web/        # Next.js (frontend)
  api/        # Fastify (backend)
packages/
  shared/     # shared types/schemas
contracts/    # ENS subname registrar (Sepolia)
```

## Local development

### Prerequisites
- `mise` (used to pin tool versions)
- Node.js (pinned via `mise`), `pnpm`
- Foundry (`forge`, `cast`, `anvil`) for Solidity contracts
- Docker (recommended for local Postgres)

### Toolchain
This repo pins tool versions with `mise`. After cloning:
```bash
mise trust
mise install
```

### Git hooks (recommended)
To enable the local pre-commit hook (lint + typecheck + api unit tests):
```bash
./scripts/setup-hooks.sh
```

### Database (local, optional for now)
If you want persistence (agents + match transcripts), start Postgres:
```bash
docker compose up -d
```
Then set `apps/api/.env`:
```bash
DATABASE_URL=postgres://agentarena:agentarena@localhost:5432/agentarena
```
And run migrations:
```bash
pnpm -C apps/api db:migrate
```

## Status

Hackathon build in progress. Public docs are kept intentionally minimal here; internal working notes live under `docs/` and are gitignored for a clean open-source surface.
