# AgentArena — Working Agreement

## Source of truth (priority)
1. `AGENTS.md`
2. `README.md`
3. `docs/` (plans, ADRs, requirements)
4. Code as-built (code reality wins)

## Repo docs policy
- `docs/` is **private working notes** and is **gitignored** (never committed).
- Public-facing docs live at the repo root (e.g. `README.md`, `PRIZES.md`).
- For this repo, gitignored files are still treated as normal developer context.

## Delivery process
- Tie all work to a user journey; fix core journeys before adding scope.
- Work one epic at a time; implement in small, safe increments.
- Keep builds/tests green; prefer simple, clear code.
- Every user-facing feature ships with empty/loading/error states + basic accessibility.
- Architectural changes require an ADR in `docs/adr/`.
