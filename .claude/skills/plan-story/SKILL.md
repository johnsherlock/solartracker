---
name: plan-story
description: Create a scoped implementation plan for a story such as P-021 using docs/stories/<story-id>.md
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

You are planning a story only. Do not write code.

Story: $ARGUMENTS

Workflow:
1. Create a branch for the story (e.g. `stories/P-021`) and switch to it
2. Read `CLAUDE.md`
3. Read `docs/backlog.md`
4. Read `docs/architecture.md`
5. Read `docs/calculation-spec.md`
6. Read any docs in `docs/decision/`
7. Read `$ARGUMENTS` (e.g. `docs/stories/P-021.md`)

Then produce:

1. The files likely to be created or modified
2. Any ambiguities or assumptions
3. A scoped implementation plan for this story only
4. Follow the steps in the plan precisely, without expanding scope or modifying unrelated code

Rules:
- Stay in plan-only mode
- Do not edit files
- Do not write code
- Do not expand scope beyond the requested story
- Prefer the rewrite app under `apps/web`
- Do not modify the legacy root app