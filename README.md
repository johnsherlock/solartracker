**PV Manager**

The active rewrite lives in `apps/web` and is the codebase validated by GitHub Actions on the `v2` branch. For now, pull requests targeting `v2` and pushes to `v2` install dependencies from `apps/web`, run the rewrite test suite, and build the rewrite app there.

The original Solar-Stats application has been preserved under `V1/` at the project root so the legacy code, assets, and deployment tooling remain available for reference while the rewrite continues.

## Rewrite Docs

- Workflow scope: `docs/features/Q-009.md`
- Product brief: `docs/product-brief.md`
- Use cases: `docs/use-cases.md`
- Calculation spec: `docs/calculation-spec.md`
- Architecture: `docs/architecture.md`
- Delivery backlog: `docs/backlog.md`
