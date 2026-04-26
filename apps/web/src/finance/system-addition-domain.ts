import type {
  SystemAdditionInputs,
  SystemAdditionRecord,
  SystemAdditionsSettingsPayload,
  SystemAdditionValidationResult,
} from './system-addition-types';
import { elapsedMonths } from './finance-domain';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateSystemAdditionInputs(
  inputs: SystemAdditionInputs,
): SystemAdditionValidationResult {
  if (!inputs.label.trim()) {
    return { valid: false, reason: 'Label is required.' };
  }
  if (!inputs.additionDate) {
    return { valid: false, reason: 'Date is required.' };
  }
  if (inputs.upfrontPayment == null && inputs.monthlyRepayment == null) {
    return {
      valid: false,
      reason: 'At least one of upfront payment or monthly repayment is required.',
    };
  }
  if (inputs.monthlyRepayment != null && inputs.repaymentDurationMonths == null) {
    return {
      valid: false,
      reason: 'Repayment duration is required when monthly repayment is set.',
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export function deriveSystemAdditionTotalInvestment(inputs: SystemAdditionInputs): number {
  const upfront = inputs.upfrontPayment ?? 0;
  const repaymentTotal =
    inputs.monthlyRepayment != null && inputs.repaymentDurationMonths != null
      ? inputs.monthlyRepayment * inputs.repaymentDurationMonths
      : 0;
  return upfront + repaymentTotal;
}

export function deriveSystemAdditionRemainingMonths(
  inputs: SystemAdditionInputs,
  today: Date,
): number | null {
  if (!inputs.additionDate || inputs.repaymentDurationMonths == null) {
    return null;
  }
  const elapsed = elapsedMonths(inputs.additionDate, today);
  return Math.max(0, inputs.repaymentDurationMonths - elapsed);
}

export function deriveSystemAdditionOutstandingBalance(
  inputs: SystemAdditionInputs,
  today: Date,
): number | null {
  if (inputs.monthlyRepayment == null) return null;
  const remaining = deriveSystemAdditionRemainingMonths(inputs, today);
  if (remaining == null) return null;
  return remaining * inputs.monthlyRepayment;
}

// ---------------------------------------------------------------------------
// Single-record payload builder
// ---------------------------------------------------------------------------

export function buildSystemAdditionRecord(
  id: string,
  inputs: SystemAdditionInputs,
  today: Date = new Date(),
): SystemAdditionRecord {
  return {
    id,
    label: inputs.label,
    additionDate: inputs.additionDate,
    capacityAddedKw: inputs.capacityAddedKw,
    upfrontPayment: inputs.upfrontPayment,
    monthlyRepayment: inputs.monthlyRepayment,
    repaymentDurationMonths: inputs.repaymentDurationMonths,
    totalInvestment: deriveSystemAdditionTotalInvestment(inputs),
    remainingMonths: deriveSystemAdditionRemainingMonths(inputs, today),
    outstandingBalance: deriveSystemAdditionOutstandingBalance(inputs, today),
  };
}

// ---------------------------------------------------------------------------
// List payload builder
// ---------------------------------------------------------------------------

export function buildSystemAdditionsPayload(
  rows: Array<{ id: string } & SystemAdditionInputs>,
  today: Date = new Date(),
): SystemAdditionsSettingsPayload {
  const validRows = rows.filter((row) => validateSystemAdditionInputs(row).valid);
  if (validRows.length === 0) {
    return { configured: false };
  }
  return {
    configured: true,
    records: validRows.map((row) => buildSystemAdditionRecord(row.id, row, today)),
  };
}
