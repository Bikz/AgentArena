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
