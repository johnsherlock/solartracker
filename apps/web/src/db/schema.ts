import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  authUserId: uuid('auth_user_id').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  status: text('status').notNull().default('active'),
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
  financeMode: text('finance_mode'),
  installCostAmount: numeric('install_cost_amount', { precision: 12, scale: 2 }),
  monthlyFinancePaymentAmount: numeric('monthly_finance_payment_amount', { precision: 12, scale: 2 }),
  providerType: text('provider_type').notNull().default('myenergi'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tariffPlanDateIdx: index('tariff_plan_versions_plan_date_idx').on(table.tariffPlanId, table.validFromLocalDate),
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

export const energyReadings = pgTable('energy_readings', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  providerConnectionId: uuid('provider_connection_id').notNull().references(() => providerConnections.id, { onDelete: 'cascade' }),
  intervalStartUtc: timestamp('interval_start_utc', { withTimezone: true }).notNull(),
  intervalEndUtc: timestamp('interval_end_utc', { withTimezone: true }).notNull(),
  localDate: date('local_date').notNull(),
  localTime: time('local_time').notNull(),
  timezone: text('timezone').notNull(),
  intervalMinutes: integer('interval_minutes').notNull(),
  importKwh: numeric('import_kwh', { precision: 14, scale: 6 }).notNull().default('0'),
  exportKwh: numeric('export_kwh', { precision: 14, scale: 6 }).notNull().default('0'),
  generatedKwh: numeric('generated_kwh', { precision: 14, scale: 6 }).notNull().default('0'),
  consumedKwh: numeric('consumed_kwh', { precision: 14, scale: 6 }),
  immersionDivertedKwh: numeric('immersion_diverted_kwh', { precision: 14, scale: 6 }),
  immersionBoostedKwh: numeric('immersion_boosted_kwh', { precision: 14, scale: 6 }),
  sourceQuality: text('source_quality'),
  sourceRunId: uuid('source_run_id'),
  providerTraceJson: jsonb('provider_trace_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueIntervalIdx: uniqueIndex('energy_readings_unique_interval_idx').on(
    table.installationId,
    table.intervalStartUtc,
    table.intervalEndUtc,
  ),
  localDateIdx: index('energy_readings_installation_local_date_idx').on(table.installationId, table.localDate),
  startIdx: index('energy_readings_installation_interval_start_idx').on(table.installationId, table.intervalStartUtc),
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
  isPartial: boolean('is_partial').notNull().default(false),
  sourceReadingCount: integer('source_reading_count').notNull().default(0),
  rebuiltAt: timestamp('rebuilt_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueDailySummaryIdx: uniqueIndex('daily_summaries_installation_date_idx').on(table.installationId, table.localDate),
}));

export const billingComparisons = pgTable('billing_comparisons', {
  id: uuid('id').defaultRandom().primaryKey(),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  periodStartLocalDate: date('period_start_local_date').notNull(),
  periodEndLocalDate: date('period_end_local_date').notNull(),
  comparisonGranularity: text('comparison_granularity').notNull(),
  tariffSnapshotHash: text('tariff_snapshot_hash').notNull(),
  readingSnapshotHash: text('reading_snapshot_hash').notNull(),
  actualImportCost: numeric('actual_import_cost', { precision: 14, scale: 6 }).notNull(),
  actualFixedCharges: numeric('actual_fixed_charges', { precision: 14, scale: 6 }).notNull(),
  actualExportCredit: numeric('actual_export_credit', { precision: 14, scale: 6 }).notNull(),
  actualGrossCost: numeric('actual_gross_cost', { precision: 14, scale: 6 }).notNull(),
  actualNetCost: numeric('actual_net_cost', { precision: 14, scale: 6 }).notNull(),
  withoutSolarImportCost: numeric('without_solar_import_cost', { precision: 14, scale: 6 }).notNull(),
  withoutSolarFixedCharges: numeric('without_solar_fixed_charges', { precision: 14, scale: 6 }).notNull(),
  withoutSolarGrossCost: numeric('without_solar_gross_cost', { precision: 14, scale: 6 }).notNull(),
  withoutSolarNetCost: numeric('without_solar_net_cost', { precision: 14, scale: 6 }).notNull(),
  solarSavings: numeric('solar_savings', { precision: 14, scale: 6 }).notNull(),
  solarExportValue: numeric('solar_export_value', { precision: 14, scale: 6 }).notNull(),
  selfConsumptionRatio: numeric('self_consumption_ratio', { precision: 8, scale: 4 }),
  gridDependenceRatio: numeric('grid_dependence_ratio', { precision: 8, scale: 4 }),
  assumptionsJson: jsonb('assumptions_json').notNull(),
  isPartial: boolean('is_partial').notNull().default(false),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  periodIdx: index('billing_comparisons_installation_period_idx').on(
    table.installationId,
    table.periodStartLocalDate,
    table.periodEndLocalDate,
  ),
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

export const providerRawImports = pgTable('provider_raw_imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerConnectionId: uuid('provider_connection_id').notNull().references(() => providerConnections.id, { onDelete: 'cascade' }),
  importRunId: uuid('import_run_id').references(() => jobRuns.id, { onDelete: 'set null' }),
  payloadStorageKey: text('payload_storage_key').notNull(),
  payloadDate: date('payload_date'),
  payloadKind: text('payload_kind').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

export const deletionRequests = pgTable('deletion_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
});
