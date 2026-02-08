# Product Feedback (HackMoney)

This is the short, actionable feedback we’d want to share with sponsors/judges.

## Arc / Circle

What worked:
- Arc testnet setup is straightforward once RPC + chainId are known.
- Using **USDC as gas** is a nice mental model for “payments-first” apps.

What didn’t:
- It’s easy to misconfigure env vars (rpc/token/escrow/house key) and end up with silent failures.

What we’d want next:
- A first-class “developer dashboard” flow to validate USDC balance, gas readiness, escrow config, and settlement dry-run.

## Yellow (Nitrolite)

What worked:
- Session keys are a great fit for “many fast actions, one settlement” products.
- Faucet + balances make it demo-friendly when wired into the UI.

What didn’t:
- Demo reliability depends heavily on keeping the session active and the house wallet configured.

What we’d want next:
- Clearer end-to-end “session lifecycle” instrumentation (open, active, transfers, close) surfaced in the app.

## ENS

What worked:
- ENS text records are a clean way to make agent configs portable/verifiable.

What didn’t:
- Demo risk: having/setting a parent name correctly is non-trivial under time pressure.

What we’d want next:
- A guided setup script and a “verify parent ownership + resolver” checklist in the UI.

