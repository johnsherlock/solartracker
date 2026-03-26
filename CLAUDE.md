# Claude Code Instructions for pv-manager Rewrite

## Project Overview

This repository contains a rewrite of a solar energy analysis application.

- The rewrite app lives in: `apps/web`
- The legacy app exists at the repo root and MUST NOT be modified
- The rewrite uses:
  - Next.js
  - Postgres (via Drizzle)
  - Domain-driven structure under `apps/web/src`

## Source of Truth

Before making changes, you MUST read:

- `docs/backlog.md` (task selection and priorities)
- `docs/architecture.md` (system design and data model)
- `docs/calculation-spec.md` (financial logic)

If implementing a specific story, also read:

- `docs/features/<story-id>.md` (if present)

## Execution Rules

### Planning

- ALWAYS start in Plan Mode
- Do NOT write code until the plan is approved
- Your plan must include:
  - Files to create/modify
  - Data flow
  - Tests to add
  - Assumptions and ambiguities

### Scope Control

- Only work on the requested story (e.g. P-020)
- Do NOT expand scope unless explicitly asked
- Do NOT refactor unrelated code

### Code Boundaries

- NEVER modify legacy root app code
- ONLY work inside `apps/web` unless instructed otherwise

### Architecture Expectations

- Follow existing domain structure:
  - `src/domain` for business logic
  - `src/db` for schema
  - `src/app` for routes/pages
- Keep provider-specific logic OUT of core domain logic
- Use canonical data models as defined in architecture docs

### Testing

- All new domain logic must have unit tests (Vitest)
- Prefer small, focused tests over large integration tests
- Do not remove existing tests unless incorrect

### Data Safety

- Seed data must be:
  - Small
  - Deterministic
  - Easy to inspect manually

### Git Workflow

- Work on a feature branch
- Make small, logical commits
- Do NOT push unless explicitly instructed

### When Unsure

If something is unclear:
- Ask a question OR
- State assumption clearly in the plan

Do NOT guess silently.

## Definition of Done

A task is complete when:

- Acceptance criteria are satisfied
- Code compiles and runs
- Tests pass
- Changes are minimal and scoped
- No unintended side effects introduced
