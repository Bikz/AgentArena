#!/usr/bin/env bash
set -euo pipefail

# Simple heuristic scan for obvious private keys in tracked files (excluding tests/examples).
# Fails if a 64-hex private key appears outside of test fixtures or .env examples.

if rg -n "0x[0-9a-fA-F]{64}" \
  -g '!**/.env.example' \
  -g '!**/test/**' \
  -g '!**/*.test.*' \
  -g '!**/node_modules/**' \
  -g '!**/dist/**' \
  .; then
  echo "Potential secret detected. Remove hard-coded private keys or move to test fixtures." >&2
  exit 1
fi

echo "Secret scan passed."
