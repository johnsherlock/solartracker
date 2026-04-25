// ---------------------------------------------------------------------------
// Raw inputs — as stored in the DB (nullable fields reflect the flexible model)
// ---------------------------------------------------------------------------

export type FinanceInputs = {
  /** Date the solar investment was made (approximate). Always required for a valid profile. */
  investmentDate: string | null; // ISO date string e.g. '2024-04-01'
  /** Upfront cash payment at time of investment. At least one of this or monthlyRepayment is required. */
  upfrontPayment: number | null;
  /** Monthly repayment amount, interest included. Requires repaymentDurationMonths when set. */
  monthlyRepayment: number | null;
  /** Total number of repayment months. Required when monthlyRepayment is set. */
  repaymentDurationMonths: number | null;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type FinanceValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// Derived payload — returned by loader for UI consumption
// ---------------------------------------------------------------------------

export type FinanceSettingsPayload =
  | { configured: false }
  | {
      configured: true;
      investmentDate: string;
      upfrontPayment: number | null;
      monthlyRepayment: number | null;
      repaymentDurationMonths: number | null;
      totalInvestment: number;
      remainingMonths: number | null;
      outstandingBalance: number | null;
    };
