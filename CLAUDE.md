# Claude Code Instructions for pv-manager Rewrite

## Project Overview

This repository contains a rewrite of a solar energy analysis application.

- The rewrite app lives in `apps/web`
- The legacy app exists at the repo root and must not be modified for rewrite
  work
- The rewrite uses Next.js, Postgres, Drizzle, and app-owned server-side logic

## Default Reading Order

Before planning or implementing a story, read:

1. `CLAUDE.md`
2. `docs/implementation-context.md`
3. the requested story file
4. the relevant feature file
5. only the decision records and deeper docs that are clearly relevant

Do not load the full architecture history or every decision record by default.
Use deeper docs only when the story actually needs them.

## Scope Control

- Work only on the requested story unless the user expands scope
- Do not refactor unrelated code
- Prefer the rewrite app under `apps/web`
- Do not modify the legacy root app unless explicitly instructed

## Architecture Guardrails

- The browser must never call provider APIs directly
- Live and single-day detail are fetched from the provider through our backend
- Multi-day/range history reads from persisted `daily_summaries`
- Scheduled summary work runs through app-owned server-side job entrypoints
- Provider-specific logic must stay out of shared domain/product-facing logic
- Provider credentials must remain server-side and must not be exposed to the
  browser

## Auth And Access Guardrails

- Real-user auth is third-party OAuth only; do not introduce app-stored
  passwords
- The current beta model uses Google sign-in, approval state, and a required
  provider-setup gate before normal app entry
- Admin/operator behavior, demo mode, and normal end-user flows should stay
  clearly separated

## Planning Workflow

When asked to plan a story:

- remain in plan-only mode until the user confirms
- produce a scoped implementation plan for that story only
- call out assumptions and ambiguities explicitly
- do not start coding before the plan is confirmed

## Code Boundaries

- Prefer existing app structure and patterns in `apps/web`
- Keep business logic in app/domain/server modules rather than pushing logic
  into client components
- Keep changes minimal, scoped, and consistent with accepted decisions

## UI Guidance

- Follow the established UI patterns already used in `apps/web` unless the story
  is explicitly about design exploration
- Prefer the project’s existing component and styling approach over introducing
  a new UI library
- Do not assume old stack choices documented in earlier planning are still
  correct without checking the current codebase

## Testing

- Add or update focused tests when changing domain or server-side behavior
- Prefer small, targeted tests over broad, brittle test coverage
- Do not remove existing tests unless they are incorrect and you are replacing
  them intentionally

## Seed / Fixture Data

- Keep seed data small, deterministic, and easy to inspect manually
- Do not commit real credentials, private user data, or opaque fixture blobs
  without a clear need

## Git Workflow

- The active rewrite branch line is `v2`, not `main`
- Work on a feature/story branch when implementing
- Keep commits small and logical
- PRs should target `v2`, not `main`
- Follow the repo’s current PR/title conventions rather than assuming older
  workflow notes are still correct

## When Unsure

- Ask a question if the ambiguity materially affects implementation
- Otherwise state the assumption clearly in the plan or final summary
- Do not guess silently when the choice could create churn

## Definition Of Done

A story is complete when:

- the acceptance criteria are satisfied
- the implementation is scoped and coherent
- code compiles or runs where relevant
- tests pass, or any unrun/blocked verification is called out clearly
- no unintended side effects were introduced
- the relevant docs are updated if the story changes the documented behavior
