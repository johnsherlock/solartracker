# Solar Stats Delivery Backlog

This backlog is now the high-level feature tracker for the rewrite.

Detailed execution stories live outside this file. Feature records should point to
their supporting story documents rather than duplicating story-level detail here.

Status values:

- `Todo`
- `In Progress`
- `Blocked`
- `Done`
- `Deferred`

## Phase Summary

| Phase | Focus | Status | Notes |
| --- | --- | --- | --- |
| Phase 1 | Discovery and product definition | Done | Product brief, use cases, architecture direction, and core UX foundations are in place. |
| Phase 2 | Financial model and validation | In Progress | Core billing rules are defined; fixture and regression work still needs to be completed. |
| Phase 3 | Data model and platform | In Progress | Rewrite app, schema, seed data, and first billing slice exist; live provider-backed path is next. |
| Phase 4 | Feature delivery | In Progress | The current focus is the first end-to-end working Live slice for a single seeded user. |
| Phase 5 | Quality and delivery | In Progress | CI is in place for the rewrite line; deeper regression and release workflow work remains. |

## Feature Tracker

| ID | Feature | Goal | Status | Supporting Doc | Notes |
| --- | --- | --- | --- | --- | --- |
| FE-001 | Live Single-User Slice | Deliver one end-to-end working Live experience in `apps/web` for a single seeded local user using seeded rewrite DB data plus the temporary V1 minute-data backend. | In Progress | [`docs/features/FE-001.md`](/Users/john/Documents/Projects/pv-manager/docs/features/FE-001.md) | First vertical product slice; onboarding, auth, and broader history work are intentionally deferred. |

## Current Feature Order

1. `FE-001` Live Single-User Slice

## Active Risks

- Financial logic may drift if billing evidence arrives too late.
- "No solar" baseline modeling can become hand-wavy without explicit examples.
- Tariff versioning affects schema, APIs, and reporting, so delays there create downstream churn.
- If the executable schema keeps drifting away from the intended v1 data flow, implementation work will build on the wrong persistence model.
- Letting backend slices harden before the UI and data contracts are defined could lock us into the wrong product shape.
- Splitting jobs and observability across providers too early may create operational blind spots for beta support.
- Privacy and deletion requirements touch schema, logs, storage, and support workflows, so delaying them increases rework.
- Even with one provider at launch, letting MyEnergi schema leak into core logic would make future ingestion sources much harder to add.
