#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.foundry/bin:$PATH"

echo "[fast-check] shared build"
pnpm -s -C packages/shared build

echo "[fast-check] api smoke tests"
pnpm -s -C apps/api test test/health.test.ts test/status.test.ts test/metrics.test.ts test/ws.e2e.test.ts
