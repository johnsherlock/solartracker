import { and, count, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionStatus = 'complete' | 'actionable' | 'coming-soon';

export type SettingsCompletionState = {
  tariffs: SectionStatus;
  provider: SectionStatus;
  finance: SectionStatus;
  location: SectionStatus;
  notifications: 'complete' | 'actionable';
  system: 'complete' | 'actionable';
  providerName: string | null;
  providerStatus: string | null;
  providerLastSyncAt: Date | null;
  /** Sections that count toward the progress denominator (excludes notifications and system). */
  totalActionable: number;
  /** Number of sections currently complete. */
  totalComplete: number;
};

// ---------------------------------------------------------------------------
// Lazy DB deps
// ---------------------------------------------------------------------------

type SettingsLoaderDbModule = typeof import('../db/client');
type SettingsLoaderSchemaModule = typeof import('../db/schema');

let _dbDeps:
  | Promise<{
      db: SettingsLoaderDbModule['db'];
      installations: SettingsLoaderSchemaModule['installations'];
      providerConnections: SettingsLoaderSchemaModule['providerConnections'];
      tariffPlans: SettingsLoaderSchemaModule['tariffPlans'];
      tariffPlanVersions: SettingsLoaderSchemaModule['tariffPlanVersions'];
      systemAdditions: SettingsLoaderSchemaModule['systemAdditions'];
    }>
  | null = null;

async function getDbDeps() {
  if (!_dbDeps) {
    _dbDeps = Promise.all([import('../db/client'), import('../db/schema')]).then(
      ([client, schema]) => ({
        db: client.db,
        installations: schema.installations,
        providerConnections: schema.providerConnections,
        tariffPlans: schema.tariffPlans,
        tariffPlanVersions: schema.tariffPlanVersions,
        systemAdditions: schema.systemAdditions,
      }),
    );
  }
  return _dbDeps;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadSettingsCompletionState(
  installationId: string,
): Promise<SettingsCompletionState> {
  const { db, installations, providerConnections, tariffPlans, tariffPlanVersions, systemAdditions } =
    await getDbDeps();

  const [installation, providerConnection, tariffVersion, systemAdditionCount] = await Promise.all([
    db
      .select({
        locationLatitude: installations.locationLatitude,
        notificationPreferencesJson: installations.notificationPreferencesJson,
        arrayCapacityKw: installations.arrayCapacityKw,
      })
      .from(installations)
      .where(eq(installations.id, installationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    db
      .select({
        status: providerConnections.status,
        providerType: providerConnections.providerType,
        lastSuccessfulSyncAt: providerConnections.lastSuccessfulSyncAt,
      })
      .from(providerConnections)
      .where(eq(providerConnections.installationId, installationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // Check if at least one tariff_plan_version exists for this installation.
    db
      .select({ id: tariffPlanVersions.id })
      .from(tariffPlanVersions)
      .innerJoin(tariffPlans, eq(tariffPlanVersions.tariffPlanId, tariffPlans.id))
      .where(eq(tariffPlans.installationId, installationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    // Finance is complete when at least one record with a positive payment amount exists.
    // Mirrors validateSystemAdditionInputs: at least one of upfront > 0 or monthly > 0,
    // and monthly repayment requires a duration.
    // monthly_repayment = 0 is treated the same as NULL (no repayment) so upfront-only
    // records with a stored 0 are not incorrectly excluded.
    db
      .select({ n: count() })
      .from(systemAdditions)
      .where(
        and(
          eq(systemAdditions.installationId, installationId),
          or(
            gt(systemAdditions.upfrontPayment, sql`0`),
            gt(systemAdditions.monthlyRepayment, sql`0`),
          ),
          or(
            isNull(systemAdditions.monthlyRepayment),
            lte(systemAdditions.monthlyRepayment, sql`0`),
            and(
              gt(systemAdditions.monthlyRepayment, sql`0`),
              isNotNull(systemAdditions.repaymentDurationMonths),
            ),
          ),
        ),
      )
      .then((rows) => rows[0]?.n ?? 0),
  ]);

  const tariffsStatus: SectionStatus = tariffVersion ? 'complete' : 'actionable';
  const providerStatus: SectionStatus =
    providerConnection?.status === 'active' ? 'complete' : 'actionable';
  const financeStatus: SectionStatus = systemAdditionCount > 0 ? 'complete' : 'actionable';
  const locationStatus: SectionStatus = installation?.locationLatitude ? 'complete' : 'actionable';
  // Notifications are "never incomplete" per U-052 — null means the user hasn't
  // explicitly saved preferences, but the page already has working defaults.
  const notificationsStatus: 'complete' | 'actionable' = 'complete';
  // System capacity is optional — unlocks solar yield context but not core app function.
  const systemStatus: 'complete' | 'actionable' =
    installation?.arrayCapacityKw != null ? 'complete' : 'actionable';

  // Notifications and system capacity do not count toward the setup progress denominator.
  const actionable: SectionStatus[] = [
    tariffsStatus,
    providerStatus,
    financeStatus,
    locationStatus,
  ];
  const totalComplete = actionable.filter((s) => s === 'complete').length;

  return {
    tariffs: tariffsStatus,
    provider: providerStatus,
    finance: financeStatus,
    location: locationStatus,
    notifications: notificationsStatus,
    system: systemStatus,
    providerName: providerConnection?.providerType ?? null,
    providerStatus: providerConnection?.status ?? null,
    providerLastSyncAt: providerConnection?.lastSuccessfulSyncAt ?? null,
    totalActionable: actionable.length,
    totalComplete,
  };
}
