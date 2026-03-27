# Solar Stats Use Cases

## Core User Stories

### UC-001 Live monitoring

As a user, I want to see my current generation, consumption, import, export, and solar coverage so I can understand what my system is doing right now.

Acceptance notes:

- Show live or most recent interval data.
- Make solar coverage and grid reliance easy to interpret.
- Surface stale or missing data clearly.

### UC-002 Daily review

As a user, I want to inspect a single day's energy activity so I can understand when I relied on the grid, when I exported, and what that day cost or saved me.

Acceptance notes:

- Support a specific calendar date.
- Show interval-level trends for import, generation, consumption, and export.
- Show daily totals and bill-impact summary.

### UC-003 Historical range analysis

As a user, I want to review week, month, year, and custom date ranges so I can understand longer-term patterns in usage, savings, and grid dependence.

Acceptance notes:

- Support day, week, month, year, and custom ranges.
- Summaries and charts should use persisted historical data.
- The range view should answer a financial question, not just restate raw totals.

### UC-004 Savings vs no-solar baseline

As a user, I want to compare my actual bill impact with an estimated no-solar scenario so I can tell whether solar ownership is worth it.

Acceptance notes:

- Present actual import cost, export credit, and net effect.
- Present a modeled "without solar" cost for the same period.
- Present the difference as savings with a clear explanation of assumptions.

### UC-005 Installation payback tracking

As a user, I want to compare energy-bill reduction against my solar finance or ownership cost so I can tell whether the installation is paying for itself.

Acceptance notes:

- Support monthly finance cost plus finance duration for financed systems.
- Show when the installation is expected to have paid for itself based on the configured ownership or finance inputs.
- Show savings relative to installation cost over a chosen period.
- Keep the calculation understandable and traceable.

### UC-006 Tariff-aware history

As a user, I want the app to apply the correct energy plan for the relevant date range so that my savings calculations remain accurate after I switch plan.

Acceptance notes:

- Users can create tariff plan versions with effective dates.
- Historical queries use the tariff active at the time.
- Periods spanning plan changes are handled correctly.

### UC-007 Export understanding

As a user, I want to understand how export credits affect my bill and my overall solar value so I can reason about self-consumption versus export behavior.

Acceptance notes:

- Show export volume and export value.
- Make it clear whether export is offsetting import or reported separately.
- Keep the calculation terminology consistent.

### UC-008 Installation setup

As a user, I want to configure my installation, provider credentials, locale, and defaults so the app can calculate my data correctly.

Acceptance notes:

- Users can define installation profile and timezone.
- Users can record the economic inputs needed for day 1 payback reporting, including upfront install cost or monthly finance payment plus term.
- Credentials are stored securely.
- Data ingestion validates the setup and reports health.

### UC-009 Data quality and trust

As a user, I want to know whether my data is complete and up to date so I can trust the conclusions shown in the app.

Acceptance notes:

- Show last successful import.
- Flag missing or partial days.
- Surface backfill status and ingestion failures.

### UC-009a API health monitoring and alerts

As a user, I want the app to detect when my provider integration appears unhealthy so I am not left blind when data stops flowing.

Acceptance notes:

- If current-day data looks incomplete or suspicious in the app, show an in-product warning.
- Run a background health check on a regular cadence, initially hourly.
- Notify the user when the provider integration appears unhealthy or stale.
- Support email notifications first, with push-based/mobile notification options left open for later.
- Keep health logic aware that provider outages or device issues may require a local reboot or user action.

### UC-010 Beta multi-user support

As an operator, I want multiple users to access isolated data and tariff setups so the product can be tested beyond a single household.

Acceptance notes:

- Authenticated access per user.
- Data isolation by user and installation.
- No hardcoded serial numbers or tariff assumptions in the UI or API.

### UC-010a Provider-backed installation setup

As a user, I want my installation data ingested from my provider without exposing provider-specific quirks in the product experience so the app remains understandable and extensible.

Acceptance notes:

- Provider-specific credentials and schemas stay behind server-side adapters.
- Product calculations and views use a canonical internal reading model.
- The initial release may support only MyEnergi, but should not hardwire MyEnergi payload structure into domain logic.

### UC-010b Tariff validity and contract reminders

As a user, I want to record when my tariff rates are valid and when my contract ends so the app can warn me when my rate data may be out of date.

Acceptance notes:

- Users can set rate validity start and end dates independently of a contract end date.
- If no tariff end date is supplied, treat the rates as current until replaced.
- Users can record contract end dates separately so the app can remind them to review their plan.
- The system can notify users when a tariff validity window or contract end date has passed.
- Users can correct tariff data retrospectively and trigger recalculation of affected reporting periods.

### UC-010c Beta access request and approval

As a prospective user, I want to request beta access and tell the team what solar/provider setup I have so I can be approved for the right type of onboarding.

Acceptance notes:

- Prospective users can submit email, provider details, and relevant setup notes.
- Initial beta access is limited to users with a supported provider, starting with MyEnergi.
- Users are told that provider credentials or API access will be required for supported integrations.
- Requests flow into an admin review and approval process.
- Approved users receive a secure invitation or signup link.

### UC-010d Auth, signup, and terms acceptance

As a user, I want to sign up using common login methods and accept the platform terms so I can access the product with a low-friction, trustworthy onboarding flow.

Acceptance notes:

- Support Google and other common authentication methods.
- Require acceptance of terms and privacy conditions at signup.
- Make data usage, deletion rights, and GDPR-related expectations clear.
- Keep signup gated behind approval during beta.

### UC-010e Gifted pro access

As an operator, I want to grant pro access to selected users so I can test premium features without requiring payment flows first.

Acceptance notes:

- Admins can assign or revoke gifted pro entitlements.
- Gifted access is auditable.
- Premium feature gating respects gifted access.

### UC-011 Privacy and account deletion

As a user, I want confidence that my energy and billing data is private and deletable so I can trust the product with household data.

Acceptance notes:

- User data is isolated by account and installation.
- Sensitive provider credentials are encrypted and not exposed to operators through normal product workflows.
- The system supports account closure and deletion of user-owned data from primary stores.
- Audit and operational logging avoids storing unnecessary personal or raw energy detail.

### UC-012 Today vs prior-year comparison

As a user, I want to compare today with the same day last year so I can spot seasonal performance changes.

Acceptance notes:

- Compare generation, consumption, import, export, and savings where data exists.
- Surface when prior-year data is unavailable.
- Keep this feature secondary to the core savings views.

### UC-013 Best generation day insights

As a user, I want to know my best generation day in a chosen period so I can better understand performance patterns.

Acceptance notes:

- Support week, month, and year contexts.
- Explain what "best" means, such as highest generated kWh.
- Link the stat back to the relevant date.

### UC-014 Annual wrap-up

As a user, I want an end-of-year summary with interesting stats and charts so I can reflect on my solar performance and savings.

Acceptance notes:

- Summarize annual savings, generation, export, and coverage.
- Include a curated set of highlights and comparisons.
- Treat this as a later engagement feature, not a launch requirement.

### UC-015 Forecast-informed outlook

As a user, I want a simple short-term weather-informed projection so I can anticipate upcoming generation and usage patterns.

Acceptance notes:

- Use forecast data only when it improves user understanding.
- Make the projected nature of the data explicit.
- Keep this feature out of the initial core delivery.

### UC-016 Periodic summaries and digests

As a user, I want optional end-of-day, week, or month summaries so I can keep up with my solar performance without opening the app constantly.

Acceptance notes:

- Support email first, with push notifications and in-app delivery considered over time.
- Allow on-demand summaries for chosen dates or ranges.
- Treat this as a likely premium feature rather than a beta requirement.

### UC-017 AI-driven insights and recommendations

As a user, I want AI-driven analysis of my energy data so I can spot patterns, improve usage, and make better decisions.

Acceptance notes:

- Insights should identify meaningful patterns rather than generic summaries.
- Recommendations should clearly distinguish observation from prediction.
- Weather-informed appliance-running suggestions should use localized forecasts where available.
- Treat this as a premium, later-stage feature.

### UC-018 Provider-led and white-label growth

As an operator, I want the product to remain compatible with provider partnerships so that a solar provider could eventually offer it to many customers at once.

Acceptance notes:

- Keep the architecture compatible with a provider or organization tenant model.
- Support the idea of provider-level customer onboarding or whitelabel access later.
- Treat this as a commercialization path, not an initial beta requirement.

## Questions The Product Must Answer

- What did my home cost me in electricity over a chosen period?
- What would that same period likely have cost without solar?
- How much value did generation and export create?
- How much of my usage was covered by self-generated energy?
- Is my current tariff helping or hurting the economics?
- Is my installation cost being offset by bill reduction?

## Reference Features From The Current App

The current proof-of-concept already demonstrates these behaviors and should be treated as reference material only:

- live-ish daily monitoring
- single-day graphing
- range summaries
- tariff-aware savings calculations
- import/export and green-energy coverage views
- automatic daily summarization for fast historical reporting

## Explicitly Deprioritized

- Reproducing every existing chart
- Dense dashboard layouts that trade clarity for volume
- Broad provider expansion before the MyEnergi flow is stable

## Long-Finger Ideas

These are useful product directions that should remain visible in planning, but are not required for the first beta:

- today versus same day last year comparisons
- best generation day callouts for week, month, and year
- annual wrap-up reports with highlights and charts
- weather-informed projections for upcoming days
- push-based mobile notifications for provider-health issues
- periodic summary emails or push digests
- AI-driven optimization insights and appliance-timing recommendations
- provider partnerships and white-label distribution
