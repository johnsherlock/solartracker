// ---------------------------------------------------------------------------
// Raw inputs — as stored in the DB
// ---------------------------------------------------------------------------

export type SystemAdditionInputs = {
  label: string;
  additionDate: string; // ISO date string e.g. '2024-04-01'
  capacityAddedKw: number | null;
  upfrontPayment: number | null;
  monthlyRepayment: number | null;
  repaymentDurationMonths: number | null;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type SystemAdditionValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// Derived payload — one record as returned by loader
// ---------------------------------------------------------------------------

export type SystemAdditionRecord = {
  id: string;
  label: string;
  additionDate: string;
  capacityAddedKw: number | null;
  upfrontPayment: number | null;
  monthlyRepayment: number | null;
  repaymentDurationMonths: number | null;
  totalInvestment: number;
  remainingMonths: number | null;
  outstandingBalance: number | null;
};

// ---------------------------------------------------------------------------
// List payload — returned by loader for the settings surface
// ---------------------------------------------------------------------------

export type SystemAdditionsSettingsPayload =
  | { configured: false }
  | { configured: true; records: SystemAdditionRecord[] };
