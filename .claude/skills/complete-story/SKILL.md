---
name: complete-story
description: Complete a story such as P-021 by updating the backlog and current feature doc to mark the story as done, merge the PR and switch back to the v2 branch. 
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Write, Edit, Create, git commands, bash commands
---

Tidies up the backlog and merges the PR fon the feature branch.

Story: $ARGUMENTS

Workflow:
1. Read `docs/backlog.md`
2. Read the feature that `$ARGUMENTS` is part of `docs/features/FE-<feature-id>.md`
3. Update the story status to "✅" in the feature md in `docs/features/FE-<feature-id>.md`
4. Update the story status to "✅" in the `docs/backlog.md`
5. Push the changes to the docs files to the story branch
6. Merge the PR for `$ARGUMENTS` into v2, return to the v2 branch and delete the story branch

Rules:
- Only update the status of the story in the feature doc and backlog doc, do not modify any other content in those docs