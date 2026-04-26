import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  authUserId: text('auth_user_id').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  // role: 'user' | 'admin'
  role: text('role').notNull().default('user'),
  // status: 'awaiting_approval' | 'approved' | 'suspended'
  status: text('status').notNull().default('awaiting_approval'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  authUserIdIdx: uniqueIndex('users_auth_user_id_idx').on(table.authUserId),
}));

export const installations = pgTable('installations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  locale: text('locale').notNull().default('en-IE'),
  currencyCode: text('currency_code').notNull().default('EUR'),
  arrayCapacityKw: numeric('array_capacity_kw', { precision: 8, scale: 2 }),
  providerType: text('provider_type').notNull().default('myenergi'),
  // Location fields — all nullable; set during onboarding, never on page load
  locationRawInput: text('location_raw_input'),
  locationDisplayName: text('location_display_name'),
  locationLatitude: numeric('location_latitude', { precision: 9, scale: 6 }),
  locationLongitude: numeric('location_longitude', { precision: 9, scale: 6 }),
  locationPrecisionMode: text('location_precision_mode'),
  locationCountryCode: text('location_country_code'),
  locationLocality: text('location_locality'),
  locationGeocodedAt: timestamp('location_geocoded_at', { withTimezone: true }),
  locationGeocoderProvider: text('location_geocoder_provider'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('installations_user_id_idx').on(table.userId),
}));

export const tariffPlans = pgTable('tariff_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  supplierName: text('supplier_name').notNull(),
  planName: text('plan_name').notNull(),
  productCode: text('product_code'),
  isExportEnabled: boolean('is_export_enabled').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationIdIdx: index('tariff_plans_installation_id_idx').on(table.installationId),
}));

export const tariffPlanVersions = pgTable('tariff_plan_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tariffPlanId: uuid('tariff_plan_id').notNull().references(() => tariffPlans.id, { onDelete: 'cascade' }),
  versionLabel: text('version_label').notNull(),
  validFromLocalDate: date('valid_from_local_date').notNull(),
  validToLocalDate: date('valid_to_local_date'),
  dayRate: numeric('day_rate', { precision: 12, scale: 6 }).notNull(),
  nightRate: numeric('night_rate', { precision: 12, scale: 6 }),
  peakRate: numeric('peak_rate', { precision: 12, scale: 6 }),
  exportRate: numeric('export_rate', { precision: 12, scale: 6 }),
  vatRate: numeric('vat_rate', { precision: 8, scale: 6 }),
  discountRuleType: text('discount_rule_type'),
  discountValue: numeric('discount_value', { precision: 12, scale: 6 }),
  nightStartLocalTime: time('night_start_local_time'),
  nightEndLocalTime: time('night_end_local_time'),
  peakStartLocalTime: time('peak_start_local_time'),
  peakEndLocalTime: time('peak_end_local_time'),
  freeImportRuleJson: jsonb('free_import_rule_json'),
  isActiveDefault: boolean('is_active_default').notNull().default(false),
  // Schedule-based tariff model. When present, weeklyScheduleJson is a
  // 336-element JSON array (7 days × 48 half-hours, Mon=0) where each element
  // is a tariff_price_periods.id. Supersedes the simple night/peak window fields
  // when populated. The window fields are kept for backward compatibility.
  weeklyScheduleJson: jsonb('weekly_schedule_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tariffPlanDateIdx: index('tariff_plan_versions_plan_date_idx').on(table.tariffPlanId, table.validFromLocalDate),
}));

// User-defined price periods for a tariff version. One or more periods can be
// created per version. The weekly schedule assigns each half-hour slot to one
// of these periods by ID.
export const tariffPricePeriods = pgTable('tariff_price_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  tariffPlanVersionId: uuid('tariff_plan_version_id').notNull().references(() => tariffPlanVersions.id, { onDelete: 'cascade' }),
  periodLabel: text('period_label').notNull(),
  ratePerKwh: numeric('rate_per_kwh', { precision: 12, scale: 6 }).notNull(),
  isFreeImport: boolean('is_free_import').notNull().default(false),
  // Display order in the UI (0-based). Does not affect billing resolution.
  sortOrder: smallint('sort_order').notNull().default(0),
  // Hex colour used to render this period in the weekly schedule grid (e.g. '#3b82f6').
  // Null until set by the user in the tariff editor.
  colourHex: text('colour_hex'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  versionSortIdx: index('tariff_price_periods_version_sort_idx').on(table.tariffPlanVersionId, table.sortOrder),
}));

export const tariffFixedChargeVersions = pgTable('tariff_fixed_charge_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tariffPlanVersionId: uuid('tariff_plan_version_id').notNull().references(() => tariffPlanVersions.id, { onDelete: 'cascade' }),
  chargeType: text('charge_type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 6 }).notNull(),
  unit: text('unit').notNull(),
  vatInclusive: boolean('vat_inclusive').notNull().default(false),
  validFromLocalDate: date('valid_from_local_date').notNull(),
  validToLocalDate: date('valid_to_local_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  fixedChargeIdx: index('tariff_fixed_charge_versions_lookup_idx').on(
    table.tariffPlanVersionId,
    table.chargeType,
    table.validFromLocalDate,
  ),
}));

export const installationContracts = pgTable('installation_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  tariffPlanId: uuid('tariff_plan_id').references(() => tariffPlans.id, { onDelete: 'set null' }),
  contractStartDate: date('contract_start_date'),
  contractEndDate: date('contract_end_date'),
  expectedReviewDate: date('expected_review_date'),
  postContractDefaultBehavior: text('post_contract_default_behavior'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerConnections = pgTable('provider_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  providerType: text('provider_type').notNull(),
  status: text('status').notNull().default('active'),
  credentialRef: text('credential_ref'),
  lastSuccessfulSyncAt: timestamp('last_successful_sync_at', { withTimezone: true }),
  lastFailedSyncAt: timestamp('last_failed_sync_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  lastErrorSummary: text('last_error_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationIdIdx: index('provider_connections_installation_id_idx').on(table.installationId),
}));

export const dailySummaries = pgTable('daily_summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  localDate: date('local_date').notNull(),
  importKwh: numeric('import_kwh', { precision: 14, scale: 6 }).notNull().default('0'),
  exportKwh: numeric('export_kwh', { precision: 14, scale: 6 }).notNull().default('0'),
  generatedKwh: numeric('generated_kwh', { precision: 14, scale: 6 }).notNull().default('0'),
  consumedKwh: numeric('consumed_kwh', { precision: 14, scale: 6 }),
  immersionDivertedKwh: numeric('immersion_diverted_kwh', { precision: 14, scale: 6 }),
  immersionBoostedKwh: numeric('immersion_boosted_kwh', { precision: 14, scale: 6 }),
  selfConsumptionRatio: numeric('self_consumption_ratio', { precision: 8, scale: 4 }),
  gridDependenceRatio: numeric('grid_dependence_ratio', { precision: 8, scale: 4 }),
  dayImportKwh: numeric('day_import_kwh', { precision: 14, scale: 6 }),
  nightImportKwh: numeric('night_import_kwh', { precision: 14, scale: 6 }),
  peakImportKwh: numeric('peak_import_kwh', { precision: 14, scale: 6 }),
  freeImportKwh: numeric('free_import_kwh', { precision: 14, scale: 6 }),
  // Schedule-based per-period import breakdown: { [pricePeriodId]: kWh }.
  // Populated when a schedule-based tariff version is active during summary
  // derivation. Null for rows derived under the simple window model.
  bandBreakdownJson: jsonb('band_breakdown_json'),
  isPartial: boolean('is_partial').notNull().default(false),
  rebuiltAt: timestamp('rebuilt_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueDailySummaryIdx: uniqueIndex('daily_summaries_installation_date_idx').on(table.installationId, table.localDate),
}));

export const jobRuns = pgTable('job_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobType: text('job_type').notNull(),
  installationId: uuid('installation_id').references(() => installations.id, { onDelete: 'set null' }),
  status: text('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  recordsWritten: integer('records_written'),
  recordsUpdated: integer('records_updated'),
  errorSummary: text('error_summary'),
  metadataJson: jsonb('metadata_json'),
});

export const dataHealthEvents = pgTable('data_health_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  providerConnectionId: uuid('provider_connection_id').references(() => providerConnections.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  summary: text('summary').notNull(),
  detailsJson: jsonb('details_json'),
});

export const systemAdditions = pgTable('system_additions', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  additionDate: date('addition_date').notNull(),
  capacityAddedKw: numeric('capacity_added_kw', { precision: 8, scale: 2 }),
  upfrontPayment: numeric('upfront_payment', { precision: 12, scale: 2 }),
  monthlyRepayment: numeric('monthly_repayment', { precision: 12, scale: 2 }),
  repaymentDurationMonths: integer('repayment_duration_months'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  installationIdIdx: index('system_additions_installation_id_idx').on(table.installationId),
  // At least one payment field is required; monthly repayment requires a duration.
  financeDetailsCheck: check(
    'system_additions_finance_details_check',
    sql`(${table.upfrontPayment} IS NOT NULL OR ${table.monthlyRepayment} IS NOT NULL) AND (${table.monthlyRepayment} IS NULL OR ${table.repaymentDurationMonths} IS NOT NULL)`,
  ),
}));

export const deletionRequests = pgTable('deletion_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
});
