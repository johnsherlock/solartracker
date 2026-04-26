import { and, count, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionStatus = 'complete' | 'actionable' | 'coming-soon';

export type SettingsCompletionState = {
  tariffs: SectionStatus;
  provider: SectionStatus;
  finance: SectionStatus;
  location: SectionStatus;
  notifications: 'coming-soon';
  providerName: string | null;
  providerStatus: string | null;
  providerLastSyncAt: Date | null;
  /** Sections that count toward the progress denominator (excludes coming-soon). */
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
    notifications: 'coming-soon',
    providerName: providerConnection?.providerType ?? null,
    providerStatus: providerConnection?.status ?? null,
    providerLastSyncAt: providerConnection?.lastSuccessfulSyncAt ?? null,
    totalActionable: actionable.length,
    totalComplete,
  };
}
