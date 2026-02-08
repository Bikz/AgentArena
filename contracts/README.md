# Agent Arena Contracts

This folder contains onchain contracts used by Agent Arena.

## Subname registrar (ENS)

`AgentArenaSubnameRegistrar` is intended to be set as the owner of a parent ENS name (e.g. `agentarena.eth`) so users can claim subnames for their agents and store configuration in ENS records.

## Match settlement escrow

`MatchSettlementEscrow` holds ERC-20 entry fees and pays out the winner + rake on-chain.
It is designed for a simple owner-controlled flow to demonstrate end-to-end settlement in the hackathon:

1. Owner funds a match pot via `depositMatchPot(matchId, amount)`.
2. Owner settles via `settleMatch(matchId, winner, rakeRecipient, rakeBps)`.

This works alongside Yellow session-based execution (off-chain), and provides a verifiable on-chain close.

## Develop

Requires Foundry:

```bash
forge --version
forge build
```

## Deploy (Hackathon)

### Arc Testnet (USDC escrow)

Deploy `MatchSettlementEscrow` to Arc Testnet using Arc USDC:

- Arc RPC: `https://rpc.testnet.arc.network`
- Arc USDC: `0x3600000000000000000000000000000000000000`

Example:

```bash
export ARC_RPC_URL="https://rpc.testnet.arc.network"
export ARC_USDC="0x3600000000000000000000000000000000000000"
export DEPLOYER_PRIVATE_KEY="0x..."

forge create \
  --rpc-url "$ARC_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  src/MatchSettlementEscrow.sol:MatchSettlementEscrow \
  --constructor-args "$ARC_USDC"
```

Take the deployed address and set API env vars:

- `ARC_ONCHAIN_ENABLED=1`
- `ARC_ESCROW_ADDRESS=0x...`
- `ARC_HOUSE_PRIVATE_KEY=0x...`
- `ARC_ENTRY_AMOUNT_BASE_UNITS=...` (Arc USDC uses 6 decimals)
