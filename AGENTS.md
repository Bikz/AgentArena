# AgentArena — Working Agreement

## Source of truth (priority)
1. `AGENTS.md`
2. `README.md`
3. `docs/` (plans, ADRs, requirements)
4. Code as-built (code reality wins)

## Repo docs policy
- All project notes live in `docs/` (gitignored).
- For this repo, gitignored files are still treated as normal developer context.

## Delivery process
- Tie all work to a user journey; fix core journeys before adding scope.
- Work one epic at a time; implement in small, safe increments.
- Keep builds/tests green; prefer simple, clear code.
- Every user-facing feature ships with empty/loading/error states + basic accessibility.
- Architectural changes require an ADR in `docs/_private/adr/`.
