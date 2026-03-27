---
name: Always create a feature branch before implementing
description: Must create a feature branch before writing any code or making commits — never commit directly to v2
type: feedback
---

Always create a feature branch (e.g. `feat/p-021-seed-fixture-data`) before starting implementation. Never commit directly to `v2`.

**Why:** Committed P-021 work directly to `v2` instead of a feature branch; had to create the branch retroactively and reset `v2`.

**How to apply:** As the very first step of any implementation task, run `git checkout -b feat/<story-id>-<short-description>` from `v2` before touching any files.
