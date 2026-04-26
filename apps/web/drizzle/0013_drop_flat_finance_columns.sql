ALTER TABLE "installations"
  DROP COLUMN IF EXISTS "finance_mode",
  DROP COLUMN IF EXISTS "finance_investment_date",
  DROP COLUMN IF EXISTS "install_cost_amount",
  DROP COLUMN IF EXISTS "monthly_finance_payment_amount",
  DROP COLUMN IF EXISTS "finance_term_months";
