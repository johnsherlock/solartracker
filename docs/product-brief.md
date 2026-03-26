# Solar Stats Product Brief

## Purpose

Solar Stats exists to answer a simple but financially important question:

> Does owning solar materially reduce a household's total electricity cost, and by enough to justify the install or financing cost over time?

The current app already demonstrates that this can be explored with live and historical energy data. The rewrite should turn that proof of concept into a professional, multi-user product with a reliable financial model, a cleaner user experience, and a maintainable codebase.

## Product Vision

Build a web application that helps users understand:

- what their home is generating, consuming, importing, and exporting right now
- how much solar is reducing their bill over different time ranges
- how their current tariff affects those savings
- whether their solar system is paying for itself over time
- how changes in tariff plan, usage, or export value affect the economics

The product should feel trustworthy, financially legible, and easy to operate for a small beta audience while remaining inexpensive to host.

## Target Users

### Primary user

- A homeowner with solar generation and smart metering who wants to understand bill impact rather than just raw power flows.

### Secondary user

- A beta user with a similar setup, initially expected to be another MyEnergi or Eddi user.

### Admin/operator

- The project owner, who needs low-maintenance operations, cheap hosting, and tooling that makes new features safe to build.

## Core Product Questions

The rewrite should make it easy for a user to answer:

- How much electricity did I generate, consume, import, and export today?
- How much did solar save me this week, month, year, or over a custom period?
- What would my bill have been without solar for the same period?
- How much of my total home consumption came from my own generation versus the grid?
- How much value did export contribute?
- Is my current tariff still the best fit?
- Is the reduction in my energy bill covering the monthly or annual cost of my installation?

## Success Criteria

### Product success

- Users can trust the savings and bill-impact calculations.
- Users can compare "with solar" vs "without solar" over any supported date range.
- Users can maintain tariff history over time without corrupting historical analysis.
- The app feels polished and professional on desktop and mobile.
- Users feel confident that their energy data is private, access-controlled, and removable on request.

### Engineering success

- Business logic is expressed as explicit, well-tested domain rules.
- Historical reporting is backed by persisted normalized data and daily summaries.
- Local development is straightforward without depending on deployed Lambda infrastructure.
- The system supports multiple users and installations from the start.
- Jobs, application logs, and operational telemetry are visible in a central location.

### Operational success

- Running costs stay low enough for a hobby product.
- Scheduled data ingestion and backfills can run unattended.
- The application can onboard a small number of beta users without manual code changes.
- Operational tooling remains simple enough to manage roughly 100 beta users without stitching together multiple logging surfaces.

## Non-Goals For Early Stages

- Native mobile apps
- Public open signup
- Broad support for many inverter vendors on day one
- Perfect recreation of every chart from the current app

## Product Principles

- Preserve validated outcomes, not legacy implementation details.
- Optimize for user decisions, not dashboard density.
- Prefer explicit financial assumptions over hidden formulas.
- Keep operational cost and maintenance burden low.
- Default to strong privacy boundaries and least-privilege access.
- Build for confidence first, visual polish second, and feature breadth third.
