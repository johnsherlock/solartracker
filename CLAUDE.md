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

## Feature Planning Workflow

When asked to plan or pull in a feature story (for example P-021), prefer the `/plan-feature <story-id>` skill.

If a user asks in natural language to "pull in", "plan", or "create a plan for" a feature, interpret that as:
- read `docs/features/<story-id>.md`
- remain in plan-only mode
- do not write code
- produce:
  1. likely files to create or modify
  2. ambiguities and assumptions
  3. a scoped implementation plan for that feature only


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

## Preferred UI Stack

For all new UI work in `apps/web`, prefer:

- Next.js App Router
- Tailwind CSS for styling
- shadcn/ui for UI components
- lucide-react for icons
- Recharts for charts
- React Hook Form + Zod for forms and validation

Rules:
- Prefer existing shadcn/ui components before building custom primitives
- Do not introduce a second UI component library unless explicitly requested
- Keep styling in Tailwind utilities unless there is a strong reason not to
- Prefer server-side data loading where appropriate for the current app structure
- Optimise for clean information hierarchy, readability, and simple layouts over decorative design

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
- Commit changes to the feature branch as you go
- Once a feature is complete, open a PR with a summary of the work done and the backlog item(s) it addresses
- When opening PRs use the pr naming convetions from https://www.conventionalcommits.org/en/v1.0.0/

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
- Changes are committed and a PR opened, reviewed and merged
- docs/backlog.md has been updated to reflect the state of the completed item(s)
- Accompanying feature md files have been moved from docs/features/todo to docs/features/complete
