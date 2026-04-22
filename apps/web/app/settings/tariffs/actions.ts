'use server';

import { and, eq } from 'drizzle-orm';
import { getSession } from '@/src/auth-helpers';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { UserStatus } from '@/src/user-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveTariffPeriodInput = {
  clientId: string;
  periodLabel: string;
  ratePerKwh: string;
  colourHex: string;
};

export type SaveTariffInput = {
  mode: 'create' | 'edit';
  versionId?: string;
  supplierName: string;
  planName: string;
  validFromLocalDate: string;
  validToLocalDate: string;
  /** As a percentage string, e.g. "9" for 9% VAT. */
  vatRate: string;
  exportRate: string;
  standingChargePerDay: string;
  periods: SaveTariffPeriodInput[];
  /** 336-element array of client-side period IDs (empty string = unassigned). */
  weeklySchedule: string[];
};

export type SaveTariffResult =
  | { ok: true; versionId: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Lazy DB deps
// ---------------------------------------------------------------------------

type DbModule = typeof import('@/src/db/client');
type SchemaModule = typeof import('@/src/db/schema');

type Deps = {
  db: DbModule['db'];
  tariffPlans: SchemaModule['tariffPlans'];
  tariffPlanVersions: SchemaModule['tariffPlanVersions'];
  tariffPricePeriods: SchemaModule['tariffPricePeriods'];
  tariffFixedChargeVersions: SchemaModule['tariffFixedChargeVersions'];
};

let _deps: Promise<Deps> | null = null;

async function getDeps(): Promise<Deps> {
  if (!_deps) {
    _deps = Promise.all([
      import('@/src/db/client'),
      import('@/src/db/schema'),
    ]).then(([client, schema]) => ({
      db: client.db,
      tariffPlans: schema.tariffPlans,
      tariffPlanVersions: schema.tariffPlanVersions,
      tariffPricePeriods: schema.tariffPricePeriods,
      tariffFixedChargeVersions: schema.tariffFixedChargeVersions,
    }));
  }
  return _deps;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function autoVersionLabel(supplierName: string, validFromLocalDate: string): string {
  const formatted = new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(validFromLocalDate + 'T00:00:00'));
  return `${supplierName} from ${formatted}`;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function saveTariffVersion(input: SaveTariffInput): Promise<SaveTariffResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const {
    db,
    tariffPlans,
    tariffPlanVersions,
    tariffPricePeriods,
    tariffFixedChargeVersions,
  } = await getDeps();

  const vatRateDecimal =
    input.vatRate !== '' ? (parseFloat(input.vatRate) / 100).toFixed(6) : null;
  const exportRateVal = input.exportRate !== '' ? input.exportRate : null;
  const standingChargeVal =
    input.standingChargePerDay !== '' ? parseFloat(input.standingChargePerDay) : null;
  // Schema requires dayRate NOT NULL; use first period rate as placeholder for
  // the legacy billing column (schedule-based billing is a follow-up).
  const dayRatePlaceholder = input.periods[0]?.ratePerKwh ?? '0';

  try {
    if (input.mode === 'create') {
      // ----------------------------------------------------------------
      // Get or create the tariff plan
      // ----------------------------------------------------------------
      let planId: string;

      const existingPlan = await db
        .select({ id: tariffPlans.id })
        .from(tariffPlans)
        .where(
          and(
            eq(tariffPlans.installationId, installationId),
            eq(tariffPlans.supplierName, input.supplierName),
            eq(tariffPlans.planName, input.planName),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (existingPlan) {
        planId = existingPlan.id;
        const hasExport = exportRateVal !== null && parseFloat(exportRateVal) > 0;
        if (hasExport) {
          await db.update(tariffPlans).set({ isExportEnabled: true }).where(eq(tariffPlans.id, planId));
        }
      } else {
        const [newPlan] = await db
          .insert(tariffPlans)
          .values({
            installationId,
            supplierName: input.supplierName,
            planName: input.planName,
            isExportEnabled: exportRateVal !== null && parseFloat(exportRateVal) > 0,
          })
          .returning({ id: tariffPlans.id });
        planId = newPlan.id;
      }

      // ----------------------------------------------------------------
      // Insert version (weeklyScheduleJson populated after periods)
      // ----------------------------------------------------------------
      const [newVersion] = await db
        .insert(tariffPlanVersions)
        .values({
          tariffPlanId: planId,
          versionLabel: autoVersionLabel(input.supplierName, input.validFromLocalDate),
          validFromLocalDate: input.validFromLocalDate,
          validToLocalDate: input.validToLocalDate || null,
          dayRate: dayRatePlaceholder,
          exportRate: exportRateVal,
          vatRate: vatRateDecimal,
          isActiveDefault: false,
          weeklyScheduleJson: null,
        })
        .returning({ id: tariffPlanVersions.id });

      await persistPeriodsAndCharges({
        db, tariffPricePeriods, tariffPlanVersions, tariffFixedChargeVersions,
        versionId: newVersion.id,
        input,
        standingChargeVal,
      });

      return { ok: true, versionId: newVersion.id };
    } else {
      // ----------------------------------------------------------------
      // Edit mode: verify ownership then update
      // ----------------------------------------------------------------
      if (!input.versionId) return { ok: false, error: 'Version ID required for edit.' };

      const existing = await db
        .select({ id: tariffPlanVersions.id })
        .from(tariffPlanVersions)
        .innerJoin(tariffPlans, eq(tariffPlanVersions.tariffPlanId, tariffPlans.id))
        .where(
          and(
            eq(tariffPlanVersions.id, input.versionId),
            eq(tariffPlans.installationId, installationId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!existing) return { ok: false, error: 'Tariff version not found.' };

      await db
        .update(tariffPlanVersions)
        .set({
          validFromLocalDate: input.validFromLocalDate,
          validToLocalDate: input.validToLocalDate || null,
          dayRate: dayRatePlaceholder,
          exportRate: exportRateVal,
          vatRate: vatRateDecimal,
          weeklyScheduleJson: null,
          updatedAt: new Date(),
        })
        .where(eq(tariffPlanVersions.id, input.versionId));

      // Clear existing periods and charges before reinserting
      await db
        .delete(tariffPricePeriods)
        .where(eq(tariffPricePeriods.tariffPlanVersionId, input.versionId));
      await db
        .delete(tariffFixedChargeVersions)
        .where(eq(tariffFixedChargeVersions.tariffPlanVersionId, input.versionId));

      await persistPeriodsAndCharges({
        db, tariffPricePeriods, tariffPlanVersions, tariffFixedChargeVersions,
        versionId: input.versionId,
        input,
        standingChargeVal,
      });

      return { ok: true, versionId: input.versionId };
    }
  } catch (err) {
    console.error('[saveTariffVersion]', err);
    return { ok: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Shared: insert price periods, remap schedule, write standing charge
// ---------------------------------------------------------------------------

async function persistPeriodsAndCharges({
  db,
  tariffPricePeriods,
  tariffPlanVersions,
  tariffFixedChargeVersions,
  versionId,
  input,
  standingChargeVal,
}: {
  db: Deps['db'];
  tariffPricePeriods: Deps['tariffPricePeriods'];
  tariffPlanVersions: Deps['tariffPlanVersions'];
  tariffFixedChargeVersions: Deps['tariffFixedChargeVersions'];
  versionId: string;
  input: SaveTariffInput;
  standingChargeVal: number | null;
}) {
  // Map client-side period IDs → DB-generated UUIDs
  const clientIdToDbId = new Map<string, string>();

  if (input.periods.length > 0) {
    const inserted = await db
      .insert(tariffPricePeriods)
      .values(
        input.periods.map((p, idx) => ({
          tariffPlanVersionId: versionId,
          periodLabel: p.periodLabel,
          ratePerKwh: p.ratePerKwh,
          isFreeImport: false,
          sortOrder: idx,
          colourHex: p.colourHex,
        })),
      )
      .returning({ id: tariffPricePeriods.id });

    inserted.forEach((row, idx) => {
      clientIdToDbId.set(input.periods[idx].clientId, row.id);
    });
  }

  const remappedSchedule = input.weeklySchedule.map((clientId) =>
    clientId ? (clientIdToDbId.get(clientId) ?? '') : '',
  );

  await db
    .update(tariffPlanVersions)
    .set({ weeklyScheduleJson: remappedSchedule })
    .where(eq(tariffPlanVersions.id, versionId));

  if (standingChargeVal !== null && standingChargeVal > 0) {
    await db.insert(tariffFixedChargeVersions).values({
      tariffPlanVersionId: versionId,
      chargeType: 'standing_charge',
      amount: standingChargeVal.toFixed(6),
      unit: 'per_day',
      vatInclusive: false,
      validFromLocalDate: input.validFromLocalDate,
      validToLocalDate: input.validToLocalDate || null,
    });
  }
}
