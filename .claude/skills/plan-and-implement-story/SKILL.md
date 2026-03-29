---
name: plan-and-implement-story
description: Create a scoped implementation plan for a story such as P-021 using docs/stories/<story-id>.md and then implement it
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Write, Edit, Create, git commands, bash commands
---

Plan a story first then await confirmation before implementing. Do not write code before the plan is confirmed.

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
5. Promt for confirmation before writing any code, and only proceed once the plan is confirmed
6. Implement the story according to the confirmed plan
7. Once implementation is complete, create a pull request and request review from the team
8. Address any review feedback and iterate until the PR is approved
9. Merge the PR into v2, return to the v2 branch and delete the story branch
10. Update the story status to "DONE" in the feature md in `docs/features/`
11. Update the story status to "DONE" in the `docs/backlog.md`
12. Push the changes to the docs files to the v2 branch

Rules:
- Stay in plan-only mode until the plan is confirmed
- Do not expand scope beyond the requested story
- Prefer the rewrite app under `apps/web`
- Do not modify the legacy root app