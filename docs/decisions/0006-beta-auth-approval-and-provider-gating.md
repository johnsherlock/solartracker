# Decision Record 0006: Beta Auth, Approval, And Provider Gating

## Status

Accepted

## Date

2026-04-11

## Context

The rewrite is moving beyond a seeded local-user application and needs a
pragmatic beta-access model that:

- avoids storing user passwords in the app database
- stays invite/approval controlled without requiring secret signup URLs
- gives the sole operator a simple user-management flow
- gives prospective users a low-friction way to preview the product
- keeps the initial onboarding burden low
- requires a valid provider connection before the product is usable

The product also needs a clear separation between:

- identity/authentication
- beta approval state
- operator/admin permissions
- provider-connection readiness
- later optional setup such as tariff, finance, and location data

## Decision

For beta, the rewrite will use Google sign-in only, with app-managed approval
state, a read-only public demo mode, and a required provider-credentials gate
before normal product access.

### Decided now

1. Authentication uses third-party OAuth only.
   - Google sign-in is the initial supported authentication method.
   - The app will not store user passwords.
   - A different Google email is treated as a different app user.

2. Any user may sign in, but beta access is approval-gated.
   - A first successful Google sign-in may create an app user record even if the
     user has not yet been approved.
   - New non-admin users default to role `user`.
   - New non-admin users default to status `awaiting_approval`.
   - Users in `awaiting_approval` may sign in but can only see a waitlist /
     invite-only response and sign out.

3. Approval is managed inside the app by an admin user.
   - The first admin user will be seeded by exact Google email to avoid a
     chicken-and-egg setup problem.
   - Admin users are operator accounts, not normal customer accounts.
   - Admin users do not require their own provider connection or installation
     setup in order to use the admin area.
   - Admins can view registered users and approve users whose status is
     `awaiting_approval`.
   - Approving a user changes that user's status to `approved`.
   - Approval should capture `approved_at` and `approved_by`.

4. Approval sends a simple notification email.
   - When a user is approved, the app sends an email telling them their beta
     access is now available.
   - The email should direct them to [www.solartracker.app](https://www.solartracker.app).
   - The email should explicitly tell them to sign in with the same Google
     account they used originally.
   - No invite token or secret invite URL is required for the first beta flow.

5. Gmail plus-address variants are treated as distinct beta identities.
   - Addresses such as `name@gmail.com` and `name+test@gmail.com` are treated as
     different app users if Google presents them as different verified emails.
   - The app should not normalize away `+suffix` values.

6. Provider credentials are the only required onboarding gate in this feature.
   - There will not be a multi-step onboarding wizard for tariff, finance, or
     location setup in `FE-007`.
   - After approval, users are forced to a provider-credentials setup screen
     until a valid provider connection exists.
   - Later setup for tariffs, solar details, finance, location, reminders, and
     similar data will live in Settings and will not block app entry.

7. Provider setup is modeled as a provider selection plus provider-specific
   credential form.
   - The UI should be shaped as a provider picker plus credentials form so the
     product can add more providers later.
   - For now, only MyEnergi is supported.
   - The product should clearly say before or during sign-in that valid
     MyEnergi API credentials are required to use the app in the current beta.
   - The provider setup screen should include a "How do I find my MyEnergi
     credentials?" help affordance with explanatory content.

8. Provider credentials must be validated before the user can proceed into the app.
   - A user who is approved but has not yet supplied valid provider credentials
     must not be allowed into the normal user app.
   - The app should test supplied MyEnergi credentials server-side before
     treating the provider connection as usable.
   - Invalid credentials keep the user on the provider setup screen with a clear
     recoverable error.
   - This decision is intentionally strict because the current runtime already
     treats missing/invalid provider credentials as blocking for live/day reads,
     and the beta product is not yet designed to be broadly useful in an
     invalid-credentials state.

9. Provider connection state must remain distinct from user approval state.
   - User approval answers "is this person allowed into the beta?"
   - Provider connection state answers "is this approved user ready to use the
     product?"
   - The model should support states such as missing credentials, invalid
     credentials, and connected credentials without overloading the user status.

10. Admin support tooling includes "view app as user".
   - Admins may temporarily view the app as a selected approved user for support
     and debugging.
   - The UI should show a persistent banner while impersonation is active.
   - Detailed audit logging of impersonation is explicitly deferred for now
     because the operator model is single-admin and the extra complexity is not
     justified yet.

11. Suspension is allowed in the data model even if not surfaced immediately.
   - The user lifecycle should leave room for a `suspended` status.
   - A suspended user who signs in should be blocked from normal app access in a
     clear, non-destructive way.
   - A dedicated suspension-management UI is not required in the first pass.

12. A public read-only demo mode exists outside the approval flow.
   - Prospective users should be able to preview the app without Google sign-in,
     beta approval, or MyEnergi credentials.
   - Demo mode should use seeded/sample data in the same spirit as the current
     local test user.
   - Demo mode is read-only and must not expose Settings, provider setup, or any
     write/mutation behavior.
   - The UI should show a persistent demo banner so users always know they are
     viewing sample data rather than their own installation.
   - Public demo mode should provide a clear path into the real sign-in flow for
     users who want beta access.
   - Demo mode is a separate access mode, not a normal signed-in beta user.

## Consequences

### Product consequences

- The app no longer needs a hidden signup URL or tokenized invite-link system
  for first beta access.
- The beta access flow remains controlled because sign-in does not imply
  approval.
- Prospective users can still understand the product through demo mode before
  deciding whether to request or use beta access.
- The first-user experience stays focused on the one thing the product truly
  needs to function: provider credentials.
- Optional setup is deferred to Settings instead of bloating onboarding.

### Data-model consequences

- The user model needs separate concepts for role and status.
- The approval flow needs support for approval metadata such as who approved the
  user and when.
- Provider connection state must be persisted separately from user approval.
- The admin seed path must support one or more exact Google-email admin records.
- Demo mode should be implemented as a seeded/sample-app context rather than as
  a normal mutable customer account.

### UX consequences

- There are at least three post-sign-in outcomes:
  - `awaiting_approval` -> waitlist / invite-only screen
  - `approved` but no valid provider connection -> provider setup gate
  - `approved` with valid provider connection -> normal app entry
- There is also one public pre-sign-in outcome:
  - demo visitor -> read-only sample app with a persistent demo indicator
- Public-facing copy should make the MyEnergi requirement visible early so users
  understand the beta constraint before creating an account.

## Explicitly Deferred

1. Additional auth providers such as Apple
2. Email/password auth
3. Secret invite URLs or invite-token claim flows
4. Full multi-step onboarding for tariff, finance, location, and solar details
5. Detailed admin-action audit logging
6. User-visible suspension-management UX
7. Broader admin-console job controls beyond what later stories may add
8. Per-demo-session personalization or saved demo state

## Relationship To Other Decisions

- This decision builds on
  [`0001-runtime-boundaries-and-infra-deferral.md`](/Users/john/Documents/Projects/pv-manager/docs/decisions/0001-runtime-boundaries-and-infra-deferral.md)
  and
  [`0005-v1-hosting-on-vercel.md`](/Users/john/Documents/Projects/pv-manager/docs/decisions/0005-v1-hosting-on-vercel.md)
  by defining how real beta users gain access to the app-owned backend.
- It narrows the intended scope of `FE-007` by replacing the earlier idea of a
  fuller onboarding flow with a stricter provider-credentials gate plus later
  Settings-based setup.
