import { and, desc, eq, lte } from 'drizzle-orm';

export type StaleTariffWarning =
  | { stale: false }
  | { stale: true; daysRemaining: number | null };

/**
 * Returns a stale-tariff warning if the latest tariff version for the installation
 * has a non-null validToLocalDate that is within 7 days of today (or already past).
 *
 * daysRemaining is null when the tariff has already lapsed (validToLocalDate < today).
 * daysRemaining >= 0 when the tariff ends today or within 7 days.
 */
export async function loadStaleTariffWarning(
  installationId: string,
  timezone: string,
): Promise<StaleTariffWarning> {
  const [{ db }, { tariffPlans, tariffPlanVersions }] = await Promise.all([
    import('../db/client'),
    import('../db/schema'),
  ]);

  const todayLocal = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Find the latest tariff version active on or before today.
  // Filtering to validFromLocalDate <= today prevents a preloaded future version
  // (with no end date) from masking a stale current tariff.
  const rows = await db
    .select({ validToLocalDate: tariffPlanVersions.validToLocalDate })
    .from(tariffPlanVersions)
    .innerJoin(tariffPlans, eq(tariffPlanVersions.tariffPlanId, tariffPlans.id))
    .where(and(
      eq(tariffPlans.installationId, installationId),
      lte(tariffPlanVersions.validFromLocalDate, todayLocal),
    ))
    .orderBy(desc(tariffPlanVersions.validFromLocalDate))
    .limit(1);

  const latestVersion = rows[0];
  if (!latestVersion || !latestVersion.validToLocalDate) {
    // No tariff at all, or open-ended tariff — not stale
    return { stale: false };
  }

  const validTo = latestVersion.validToLocalDate;
  const todayMs = new Date(`${todayLocal}T12:00:00`).getTime();
  const validToMs = new Date(`${validTo}T12:00:00`).getTime();
  const diffDays = Math.floor((validToMs - todayMs) / 86_400_000);

  if (diffDays > 7) {
    return { stale: false };
  }

  return { stale: true, daysRemaining: diffDays < 0 ? null : diffDays };
}
