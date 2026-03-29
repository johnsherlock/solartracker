---
name: plan-feature
description: Create a scoped implementation plan for a feature story such as P-021 using docs/features/<story-id>.md
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

You are planning a feature only. Do not write code.

Feature story: $ARGUMENTS

Workflow:
1. Create a branch for the feature (e.g. `stories/P-021`) and switch to it
2. Read `CLAUDE.md`
3. Read `docs/backlog.md`
4. Read `docs/architecture.md`
5. Read `docs/calculation-spec.md`
6. Read any docs in `docs/decision/`
7. Read `$ARGUMENTS` (e.g. `docs/stories/P-021.md`)

Then produce:

1. The files likely to be created or modified
2. Any ambiguities or assumptions
3. A scoped implementation plan for this feature only
4. Follow the steps in the plan precisely, without expanding scope or modifying unrelated code

Rules:
- Stay in plan-only mode
- Do not edit files
- Do not write code
- Do not expand scope beyond the requested feature
- Prefer the rewrite app under `apps/web`
- Do not modify the legacy root app