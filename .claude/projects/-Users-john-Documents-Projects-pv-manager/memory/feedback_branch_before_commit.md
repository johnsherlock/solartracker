---
name: Always create a feature branch before implementing
description: Must create a feature branch before writing any code or making commits — never commit directly to main
type: feedback
---

Always create a feature branch (e.g. `feat/p-021-seed-fixture-data`) before starting implementation. Never commit directly to `main`.

**Why:** Committed P-021 work directly to the shipping branch instead of a feature branch; had to create the branch retroactively and reset the branch state.

**How to apply:** As the very first step of any implementation task, run `git checkout -b feat/<story-id>-<short-description>` from `main` before touching any files.
