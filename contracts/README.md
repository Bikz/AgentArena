# Agent Arena Contracts

This folder contains onchain contracts used by Agent Arena.

## Subname registrar (ENS)

`AgentArenaSubnameRegistrar` is intended to be set as the owner of a parent ENS name (e.g. `agentarena.eth`) so users can claim subnames for their agents and store configuration in ENS records.

## Develop

Requires Foundry:

```bash
forge --version
forge build
```

