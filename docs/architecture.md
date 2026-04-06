# Solar Stats Rewrite Architecture

## Goals

- Multi-user from day one
- Low operational cost
- Straightforward local development
- Clean separation between provider ingestion, domain calculations, persistence, and UI
- Strong testability around financial logic
- Centralized logs and operational visibility for app requests and background jobs
- Strong privacy and deletion guarantees for beta-user data

## Recommended Stack

### Application

- Next.js with TypeScript
- App Router for authenticated product pages and server-side data access
- Tailwind CSS and a headless component library for a modern UI foundation
- TanStack Query for client data fetching where interactive caching is useful

### Backend and data

- Supabase Auth for invite-only beta authentication
- Postgres for core relational data
- Supabase Storage only if raw provider payload archival is still useful
- Drizzle ORM for schema management and typed queries
- Secrets kept in the hosting platform or database provider secret store, never in client-visible config

### Jobs and ingestion

- Platform-native scheduled jobs or cron within the same operational environment as the app
- Secure internal job entrypoints for ingestion, backfill, repair, and summary rebuild work
- Provider adapters so MyEnergi-specific logic does not leak into product code
- Provider payloads normalized into a canonical internal energy-reading model before domain logic runs
- Centralized structured logging for web requests, job runs, and provider sync failures

### Testing

- Vitest for unit and domain tests
- Playwright for end-to-end UI coverage in the new app

## High-Level Shape

```text
Web App
  -> Product UI
  -> Server routes / actions
  -> Domain services
  -> Postgres
  -> Storage (optional for raw payloads)
  -> Centralized logs / metrics

Scheduled Jobs
  -> Internal authenticated job trigger
  -> Provider adapter
  -> Normalize interval readings
  -> Persist readings
  -> Generate daily summaries
  -> Update data-health status
  -> Centralized logs / metrics
```

## Core Domains

### Identity and ownership

- `User`
- `Installation`
- `ProviderConnection`
- `DeletionRequest`

### Tariffs and billing

- `TariffPlan`
- `TariffPlanVersion`
- `BillingComparison`

### Energy data

- `EnergyReading`
- `DailySummary`
- `ImportRun`
- `DataHealthEvent`
- `JobRun`
- `ProviderRawImport`

## Data Model Direction

### User

- identity and auth ownership
- deletion status and retention lifecycle where needed

### Installation

- timezone
- locale
- finance cost and finance-duration settings
- provider metadata
- privacy-scoped ownership boundary for all related readings and summaries

### TariffPlan and TariffPlanVersion

- supplier and plan identity
- effective date range
- usage rates and export rules
- fixed-charge rules
- contract reminder metadata kept separate from tariff validity

### EnergyReading

- installation-scoped normalized interval data
- timestamped generation, import, export, and derived consumption
- canonical internal representation used by savings logic regardless of upstream provider

### ProviderRawImport

- optional archival of provider-native payloads for debugging, repair, and adapter evolution
- explicitly separate from the canonical reading model used by product logic

### DailySummary

- precomputed daily totals for reporting and faster aggregation

### BillingComparison

- cached or on-demand comparison outputs for specific periods

## Schema Proposal

This section is the first implementation-oriented schema direction for Postgres. It is intended to be concrete enough to guide Drizzle models and migrations, while still leaving room for naming cleanup during implementation.

### Design principles

- Keep calculation-effective tariff data separate from reminder-only contract metadata.
- Keep canonical energy readings provider-agnostic, even if MyEnergi is the only beta source.
- Prefer append-only or versioned records for historical correctness over destructive updates.
- Treat derived summaries and billing comparisons as rebuildable projections rather than irreplaceable source data.
- Keep development-only validation evidence outside the runtime product schema.

### Proposed tables

#### `users`

Purpose:

- application-level profile linked to Supabase Auth identity

Key fields:

- `id` UUID primary key
- `auth_user_id` UUID unique, external auth reference
- `email` text
- `display_name` text nullable
- `status` enum-like text such as `active`, `pending_deletion`, `deleted`
- `created_at`, `updated_at`

Notes:

- auth remains owned by Supabase Auth, while this table stores app-specific lifecycle fields

#### `installations`

Purpose:

- household or solar-installation boundary for readings, tariffs, summaries, and billing comparisons

Key fields:

- `id` UUID primary key
- `user_id` UUID foreign key to `users`
- `name` text
- `timezone` text
- `locale` text
- `currency_code` text default `EUR`
- `finance_mode` text nullable such as `cash` or `finance`
- `install_cost_amount` numeric nullable
- `monthly_finance_payment_amount` numeric nullable
- `finance_term_months` integer nullable
- `provider_type` text
- `created_at`, `updated_at`

Constraints:

- index on `user_id`

#### `provider_connections`

Purpose:

- server-side provider credential and connection state per installation

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `provider_type` text
- `status` text such as `active`, `error`, `revoked`
- `credential_ref` text or provider-secret reference
- `last_successful_sync_at` timestamptz nullable
- `last_failed_sync_at` timestamptz nullable
- `last_error_code` text nullable
- `last_error_summary` text nullable
- `created_at`, `updated_at`

Notes:

- raw credentials should stay in managed secret storage where possible, with this table storing only references and operational state

#### `tariff_plans`

Purpose:

- user-managed logical tariff plan container for an installation

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `supplier_name` text
- `plan_name` text
- `product_code` text nullable
- `is_export_enabled` boolean default true
- `notes` text nullable
- `created_at`, `updated_at`

Constraints:

- index on `installation_id`

#### `tariff_plan_versions`

Purpose:

- date-ranged calculation rules for import, export, VAT, discounts, and tariff validity

Key fields:

- `id` UUID primary key
- `tariff_plan_id` UUID foreign key to `tariff_plans`
- `version_label` text
- `valid_from_local_date` date
- `valid_to_local_date` date nullable
- `day_rate` numeric
- `night_rate` numeric nullable
- `peak_rate` numeric nullable
- `export_rate` numeric nullable
- `vat_rate` numeric nullable
- `discount_rule_type` text nullable
- `discount_value` numeric nullable
- `night_start_local_time` time nullable
- `night_end_local_time` time nullable
- `peak_start_local_time` time nullable
- `peak_end_local_time` time nullable
- `free_import_rule_json` jsonb nullable
- `is_active_default` boolean default false
- `created_at`, `updated_at`

Constraints:

- index on `tariff_plan_id`, `valid_from_local_date`
- exclusion or application-level validation preventing overlapping validity ranges for the same tariff plan

Notes:

- tariff validity lives here because it directly affects calculation output
- contract renewal may create a new version, but contract dates themselves do not belong in this table unless they affect the actual rates

#### `tariff_fixed_charge_versions`

Purpose:

- date-ranged non-interval charges that need independent versioning

Key fields:

- `id` UUID primary key
- `tariff_plan_version_id` UUID foreign key to `tariff_plan_versions`
- `charge_type` text such as `standing_charge`, `pso_levy`
- `amount` numeric
- `unit` text such as `per_day`, `per_month`, `per_bill`
- `vat_inclusive` boolean default false
- `valid_from_local_date` date
- `valid_to_local_date` date nullable
- `created_at`, `updated_at`

Constraints:

- index on `tariff_plan_version_id`, `charge_type`, `valid_from_local_date`

Notes:

- this keeps fixed-charge splits explicit instead of overloading the tariff version row with too many nullable columns

#### `installation_contracts`

Purpose:

- reminder-oriented supplier contract metadata kept separate from calculation-effective tariff validity

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `tariff_plan_id` UUID foreign key to `tariff_plans` nullable
- `contract_start_date` date nullable
- `contract_end_date` date nullable
- `expected_review_date` date nullable
- `post_contract_default_behavior` text nullable such as `supplier_default_rates`, `unknown`
- `notes` text nullable
- `created_at`, `updated_at`

Notes:

- this supports reminder UX without polluting the savings engine inputs
- contract records should help the app warn when a user may have rolled onto worse default supplier rates because no replacement tariff version has been entered
- users may also enter future-dated tariff versions in advance of a renewal, so reminder logic should check whether an expected review date has passed without an appropriate newer tariff version being in place

#### `energy_readings`

Purpose:

- canonical interval readings used by summaries, bill comparison, and product UI

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `provider_connection_id` UUID foreign key to `provider_connections`
- `interval_start_utc` timestamptz
- `interval_end_utc` timestamptz
- `local_date` date
- `local_time` time
- `timezone` text
- `interval_minutes` integer
- `import_kwh` numeric default 0
- `export_kwh` numeric default 0
- `generated_kwh` numeric default 0
- `consumed_kwh` numeric nullable
- `immersion_diverted_kwh` numeric nullable
- `immersion_boosted_kwh` numeric nullable
- `source_quality` text nullable such as `raw`, `derived`, `repaired`
- `source_run_id` UUID nullable
- `provider_trace_json` jsonb nullable
- `created_at`

Constraints:

- unique on `installation_id`, `interval_start_utc`, `interval_end_utc`
- indexes on `installation_id`, `local_date` and `installation_id`, `interval_start_utc`

Notes:

- `consumed_kwh` may be sourced directly or derived, but storing it avoids repeated recalculation and preserves the canonical result used at import time
- local date and local time are denormalized on purpose because tariff application is driven by local windows

#### `daily_summaries`

Purpose:

- rebuildable daily aggregates for fast reporting

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `local_date` date
- `import_kwh` numeric default 0
- `export_kwh` numeric default 0
- `generated_kwh` numeric default 0
- `consumed_kwh` numeric nullable
- `immersion_diverted_kwh` numeric nullable
- `immersion_boosted_kwh` numeric nullable
- `self_consumption_ratio` numeric nullable
- `grid_dependence_ratio` numeric nullable
- `is_partial` boolean default false
- `source_reading_count` integer
- `rebuilt_at` timestamptz

Constraints:

- unique on `installation_id`, `local_date`

#### `billing_comparisons`

Purpose:

- cached results for a period-specific actual-versus-without-solar comparison

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `period_start_local_date` date
- `period_end_local_date` date
- `comparison_granularity` text such as `day`, `month`, `custom`
- `tariff_snapshot_hash` text
- `reading_snapshot_hash` text
- `actual_import_cost` numeric
- `actual_fixed_charges` numeric
- `actual_export_credit` numeric
- `actual_gross_cost` numeric
- `actual_net_cost` numeric
- `without_solar_import_cost` numeric
- `without_solar_fixed_charges` numeric
- `without_solar_gross_cost` numeric
- `without_solar_net_cost` numeric
- `solar_savings` numeric
- `solar_export_value` numeric
- `self_consumption_ratio` numeric nullable
- `grid_dependence_ratio` numeric nullable
- `assumptions_json` jsonb
- `is_partial` boolean default false
- `computed_at` timestamptz

Constraints:

- index on `installation_id`, `period_start_local_date`, `period_end_local_date`

Notes:

- this table is a cache and audit aid, not the only source of truth
- snapshot hashes make it easier to invalidate stale comparisons when tariff or reading history changes

#### `provider_raw_imports`

Purpose:

- optional archival of raw provider payloads for debugging and repair

Key fields:

- `id` UUID primary key
- `provider_connection_id` UUID foreign key to `provider_connections`
- `import_run_id` UUID nullable
- `payload_storage_key` text
- `payload_date` date nullable
- `payload_kind` text
- `created_at`

#### `job_runs`

Purpose:

- persisted record of scheduled and manual background work

Key fields:

- `id` UUID primary key
- `job_type` text
- `installation_id` UUID nullable
- `status` text
- `started_at` timestamptz
- `finished_at` timestamptz nullable
- `records_written` integer nullable
- `records_updated` integer nullable
- `error_summary` text nullable
- `metadata_json` jsonb nullable

#### `data_health_events`

Purpose:

- user-visible or operator-visible health warnings about provider freshness and completeness

Key fields:

- `id` UUID primary key
- `installation_id` UUID foreign key to `installations`
- `provider_connection_id` UUID foreign key to `provider_connections` nullable
- `event_type` text
- `severity` text
- `status` text such as `open`, `resolved`
- `detected_at` timestamptz
- `resolved_at` timestamptz nullable
- `summary` text
- `details_json` jsonb nullable

#### `deletion_requests`

Purpose:

- auditable account and data deletion workflow

Key fields:

- `id` UUID primary key
- `user_id` UUID foreign key to `users`
- `status` text such as `requested`, `processing`, `completed`, `failed`
- `requested_at` timestamptz
- `completed_at` timestamptz nullable
- `notes` text nullable

### Relationships

```text
users
  -> installations
    -> provider_connections
    -> tariff_plans
      -> tariff_plan_versions
        -> tariff_fixed_charge_versions
    -> installation_contracts
    -> energy_readings
    -> daily_summaries
    -> billing_comparisons
    -> data_health_events

provider_connections
  -> provider_raw_imports

users
  -> deletion_requests
```

### Calculation-specific notes

- Billing calculations should resolve tariff versions and fixed-charge versions by local interval date, not by contract dates.
- `billing_comparisons` should be invalidated and rebuilt whenever relevant readings, tariff versions, or fixed-charge versions change for the covered period.
- Fixed charges should be applied to both actual and no-solar scenarios unless a future tariff explicitly makes them usage-dependent.
- Supplier CSV and bill evidence should remain outside this runtime schema and live only in development fixtures, scripts, or test assets.

### First migration sequence

1. Create `users`, `installations`, and `provider_connections`.
2. Create `tariff_plans`, `tariff_plan_versions`, `tariff_fixed_charge_versions`, and `installation_contracts`.
3. Create `energy_readings` and `daily_summaries`.
4. Create `billing_comparisons`.
5. Create operational tables: `provider_raw_imports`, `job_runs`, `data_health_events`, and `deletion_requests`.

## Privacy And Deletion Model

This section turns the privacy requirements into concrete implementation defaults for beta.

### Ownership model

- Every user-owned record should be scoped through `installation_id` or `user_id`.
- Application queries should resolve access through the authenticated user first, never through provider identifiers or guessed installation ids.
- Operators should not receive broad read access by default; any exceptional support access should be deliberate, narrow, and auditable.

### Data classes

#### 1. Account and identity data

Examples:

- auth identity
- email address
- display name
- beta approval state
- terms acceptance records

Handling:

- stored in auth provider and app-owned user tables
- retained only as long as needed for account lifecycle, approvals, and audit requirements

#### 2. Operational secret and connection data

Examples:

- provider credentials
- API refresh secrets
- secret references

Handling:

- secrets should live in managed secret storage where possible
- application tables should store references and status, not raw secret values
- secrets should be deleted or revoked immediately when a connection is removed or an account deletion is processed

#### 3. Energy and tariff data

Examples:

- interval readings
- daily summaries
- tariff plans and versions
- billing comparisons
- provider health events

Handling:

- treated as user-owned primary product data
- deleted when the user deletes their account unless a short-lived deletion pipeline requires temporary staging

#### 4. Operational logs and raw payload archives

Examples:

- job runs
- import diagnostics
- provider raw payload archives
- error metadata

Handling:

- should contain the minimum user detail needed for debugging
- should avoid raw credentials and unnecessary personal data
- should use retention windows rather than indefinite storage

### Default retention and deletion rules

- `users`, `installations`, `provider_connections`, `tariff_plans`, `tariff_plan_versions`, `tariff_fixed_charge_versions`, `installation_contracts`, `energy_readings`, `daily_summaries`, `billing_comparisons`, and `data_health_events` should be treated as primary user-owned data and removed as part of account deletion.
- `provider_raw_imports` should be optional and lifecycle-managed. If retained for debugging, they should use a short retention window and should also be purged during account deletion.
- `job_runs` may remain for short-lived operational audit purposes, but any retained rows should be scrubbed of user-identifying detail once the related account deletion completes.
- `deletion_requests` should remain as the durable audit trail of deletion workflow completion, but should avoid storing unnecessary personal content.

### Deletion workflow

1. User requests account deletion.
2. Account is marked `pending_deletion` and active imports or refresh jobs for that user are halted.
3. Provider credentials are revoked or secret references removed.
4. User-owned product data is deleted from primary tables.
5. Optional raw payload archives and derived caches are purged.
6. Operational audit rows are scrubbed or reduced to minimal non-personal traces where retention is still needed.
7. Auth account is deleted or disabled according to the chosen auth-provider flow.
8. `deletion_requests` is marked completed with timestamps and any failure notes.

### Access-control defaults

- Row ownership should be enforced in the database for user-owned tables.
- Server-side jobs should use privileged roles, but product requests should use least-privilege application roles.
- Admin and support tooling should prefer summary views and health metadata over unrestricted raw data access.
- Normal operator workflows should not expose provider credentials or raw payloads.

### Logging and support rules

- Do not log raw provider credentials, full payload bodies, or unnecessary personal content.
- Log installation ids and job ids rather than emails where possible.
- Support actions that inspect user data should be rare and recorded.
- Error summaries shown in admin tooling should be redacted enough to avoid leaking secrets.

### Beta policy defaults

- Beta users should be told what provider data is stored, what is derived, and how deletion works.
- Terms and privacy acceptance should be recorded at signup.
- Manual operator intervention should be assumed possible during beta, but it should still be exceptional and auditable.

### Testing implications

- Privacy verification should cover row isolation between users.
- Deletion verification should cover provider secret revocation, primary data deletion, cache/raw-payload purge, and the absence of continued scheduled imports after deletion is requested.
- Logging checks should verify that secrets and sensitive payloads do not appear in normal application or job logs.

### JobRun

- central record of scheduled job execution, status, scope, timing, and error summary

## Ingestion Flow

1. A platform-native scheduled job triggers a secure internal job entrypoint.
2. The job identifies installations due for refresh.
3. The provider adapter fetches provider-native raw interval data.
4. Raw payload is optionally archived with retention rules.
5. The adapter canonicalizes provider-native fields into the internal `EnergyReading` format.
6. Daily summaries are recalculated for affected dates.
7. Data-health metadata is updated.
8. A `JobRun` record and centralized logs capture outcome, counts, and failures.

Supplier bills and manually exported supplier interval files may still be used during development as offline validation evidence, but they are not part of the intended product ingestion workflow.

## Canonical Energy Model

The core financial and reporting logic should never depend directly on a provider-specific schema.

Instead:

- each provider adapter maps raw payloads into a canonical internal format
- the savings engine, summaries, and UI queries operate only on canonical readings
- provider-specific quirks remain isolated to adapter and import layers

For beta v1:

- MyEnergi is expected to be the primary solar telemetry source
- supplier bills and manually exported supplier interval data are validation evidence for development, not runtime product inputs
- comparison between supplier-side import evidence and MyEnergi-derived behavior should be supported as internal validation tooling, not as a beta user-facing workflow
- provider-specific timezone behavior should be normalized inside the adapter boundary rather than assumed by the core model

The initial product can be MyEnergi-only while still enforcing this boundary.

Minimum canonical fields expected in the internal model:

- installation identifier
- timestamp and timezone context
- generated energy
- imported energy
- exported energy
- consumed energy, whether provided directly or derived
- optional provider metadata for traceability

Timezone note:

- many providers may expose timestamps in UTC or another provider-defined convention
- the adapter must normalize raw timestamps into a canonical representation with explicit timezone context
- DST and date-boundary handling are adapter concerns first, not savings-engine concerns

## Provider Adapter Contract

Provider adapters are responsible for converting provider-native API behavior into the canonical ingestion model without leaking provider quirks into domain logic.

### Adapter responsibilities

- authenticate against the provider and manage token or credential usage through server-side secret handling
- fetch provider-native readings for a requested local-date or UTC-range window
- normalize timestamps into canonical interval boundaries with explicit timezone context
- map provider-native fields into canonical energy-reading fields
- mark whether a value is direct, derived, missing, or repaired
- surface health and failure signals in a consistent format for jobs and operator tooling
- preserve enough provider trace metadata for debugging without making product code depend on raw payload shape

### Adapter input contract

Each adapter should accept a request shaped roughly like:

```ts
type ProviderImportRequest = {
  installationId: string;
  providerConnectionId: string;
  timezone: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  reason: 'daily-import' | 'recent-refresh' | 'backfill-import' | 'repair';
};
```

### Adapter output contract

Each adapter should return canonical rows plus enough metadata for import bookkeeping:

```ts
type CanonicalIntervalReading = {
  intervalStartUtc: string;
  intervalEndUtc: string;
  localDate: string;
  localTime: string;
  timezone: string;
  intervalMinutes: number;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh?: number;
  immersionDivertedKwh?: number;
  immersionBoostedKwh?: number;
  sourceQuality?: 'raw' | 'derived' | 'repaired';
  providerTrace?: Record<string, unknown>;
};

type ProviderImportResult = {
  readings: CanonicalIntervalReading[];
  sourceWindowStartUtc: string;
  sourceWindowEndUtc: string;
  providerCursor?: string;
  healthSignals?: Array<{
    code: string;
    severity: 'info' | 'warning' | 'error';
    summary: string;
  }>;
  rawPayloadRefs?: string[];
};
```

### Boundary rules

- Adapters own provider-specific timezone normalization.
- Adapters must emit explicit `intervalStartUtc` and `intervalEndUtc` values rather than a single ambiguous timestamp.
- If a provider exposes point-in-time readings that imply an interval, the adapter must convert them into interval semantics before persistence.
- DST gaps or repeated local times must be resolved at the adapter layer, not left for the savings engine to interpret later.

### MyEnergi-specific first-pass assumptions

- The legacy V1 MyEnergi proxy has a known DST-boundary quirk: it adjusts `hr`/`min` for timezone but can leave `dom`/`mon`/`yr` on the previous local day for the leading 00:00-00:59 block. Any future direct v2 MyEnergi adapter must normalize full timestamps at the adapter layer and must not trust partially shifted local date fields from this legacy proxy behavior.
- Canonical consumption may be derived as `import + generation - export - immersionDiverted` when not provided directly.
- Import, export, generation, and immersion values should stay distinct even when some are later combined in summaries or billing comparisons.

### Error-handling contract

- Authentication failures should be distinguishable from empty-data responses.
- Partial-day responses should be marked so downstream summaries and billing comparisons can surface warnings.
- Retryable provider failures should be classed separately from permanent configuration failures.
- Adapters should return structured health signals rather than only throwing opaque errors.

## Job Types

The initial scheduled jobs should stay low-frequency and cheap:

- `daily-import`
  - imports the previous finalized day for active installations
- `recent-refresh`
  - refreshes the latest available intervals for live-ish views on a modest cadence
- `backfill-import`
  - imports a requested historical range after onboarding or repair
- `rebuild-summaries`
  - recomputes daily summaries when calculation logic or tariff history changes
- `data-health-check`
  - detects stale connections, missing days, and repeated provider failures

## Job Entrypoints

Use secure server-side entrypoints inside the app or worker environment rather than public-facing APIs.

Typical examples:

- internal HTTP route such as `POST /api/internal/jobs/daily-import`
- internal task handler such as `runDailyImport()`

Requirements:

- only invokable by platform cron or privileged server-side callers
- protected with shared secret, signed request, or platform-native internal auth
- produce structured logs and persisted `JobRun` metadata
- avoid exposing user identifiers or credentials in logs

## Query Model

- Live views read the latest available interval readings.
- Historical range views read daily summaries and, where needed, interval readings for detail screens.
- Billing comparison logic resolves tariff versions by date and computes period-specific outputs.

## Local Development

- One app process for frontend and backend behavior
- Local database through Docker or hosted dev database
- No dependency on deployed Lambda functions for normal development
- Seed scripts for sample tariff versions and fixture readings
- Job handlers should be runnable locally without the production scheduler

## Cost Strategy

- Prefer serverless or low-idle managed services
- Persist summaries so range reporting is cheap
- Run ingestion on a schedule rather than using always-on workers
- Keep raw payload storage optional and lifecycle-managed
- Prefer keeping cron, logs, and runtime in one provider surface where possible

## Privacy and Security

- Use invite-only auth for the initial beta.
- Encrypt or provider-manage encryption for secrets and sensitive connection details.
- Apply row ownership and least-privilege access to all user data.
- Keep logs free of raw credentials and unnecessary personally identifying data.
- Provide account closure and deletion workflows that remove user-owned operational data from primary stores.
- Treat operator access to user data as exceptional, auditable, and minimized by design.

## Early Deliverables

- monorepo or app workspace with new web app
- schema and migrations
- provider adapter interface
- first-pass MyEnergi adapter
- canonical energy-reading model
- savings engine package
- internal validation tooling for bill and supplier-data comparison
- authenticated app shell
- overview, live, history, and tariff setup pages
- supplier-data reconciliation strategy

## Risks To Manage

- Financial logic drift if bills are not used early enough
- Overbuilding for scale before the beta product is proven
- Ambiguity in no-solar baseline modeling
- Provider quirks and slow historical import behavior
- Privacy or deletion requirements being discovered too late and forcing schema or logging rework
- Allowing provider-specific assumptions to leak into the canonical model and reporting layer
