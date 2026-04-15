# Settings IA and Shell Spec

This document defines the information architecture, navigation model,
setup-completion messaging, and section inventory for the Settings area.
It is the design input for `P-041` (Settings shell build) and the first
step of `FE-008`.

Source inputs:

- `docs/ui/screen-inventory.md`
- `docs/features/FE-008.md`
- `docs/decisions/0006-beta-auth-approval-and-provider-gating.md`
- `docs/implementation-context.md`

---

## Purpose

Settings is the home for optional user-managed data that was deliberately
deferred from provider setup (`FE-007`). It is not an admin area, a wizard,
or a configuration panel — it is a persistent product area users return to
as their setup and circumstances evolve.

Settings should feel:

- **focused** — only things the user can actually act on
- **legible** — users should immediately see what is done, what is optional,
  and what would unlock more product value
- **safe** — editing tariff or provider data has real downstream effects;
  the UI should make this clear without being alarming

---

## Navigation Model

### Where Settings lives

Settings is a top-level signed-in product destination, alongside Live,
History, and (later) Data Health. It is accessible via the main app
navigation for any approved user with valid provider credentials.

Settings is **not** accessible in:

- demo mode
- the `awaiting_approval` waitlist state
- the provider-setup gate (FE-007)

### URL structure

| Route | Purpose |
|---|---|
| `/settings` | Settings home — setup-completion overview |
| `/settings/tariffs` | Tariffs section (first implemented domain) |
| `/settings/provider` | Provider connection management |
| `/settings/finance` | Finance details (placeholder until built) |
| `/settings/solar` | Solar installation details (placeholder until built) |
| `/settings/notifications` | Notification preferences (placeholder until built) |

### Desktop layout

Settings uses a two-column layout:

- **Left sidebar** (fixed, ~220px): section list with labels and
  completion indicators
- **Main content area**: the selected section rendered to the right

The sidebar is always visible on desktop. The active section is highlighted.

```
┌─────────────────────────────────────────────────────┐
│  ← Overview              [nav bar]                  │
├──────────────┬──────────────────────────────────────┤
│              │                                       │
│  Settings    │  [Section content]                    │
│  ──────────  │                                       │
│  ✓ Tariffs   │                                       │
│  ✓ Provider  │                                       │
│  · Finance   │                                       │
│  · Solar     │                                       │
│  · Notifs    │                                       │
│              │                                       │
└──────────────┴──────────────────────────────────────┘
```

### Mobile layout

On mobile, `/settings` shows a full-screen section list. Selecting a section
navigates to the section's own page (`/settings/tariffs`, etc.). A back
chevron returns to the section list.

No sidebar is shown on mobile — the section list is the navigation.

```
┌───────────────────────────┐
│  Settings           [nav] │
├───────────────────────────┤
│                           │
│  Setup progress       2/5 │
│  ─────────────────────    │
│                           │
│  ✓ Tariffs          →     │
│  ✓ Provider         →     │
│  · Finance          →     │
│  · Solar            →     │
│  · Notifications    →     │
│                           │
└───────────────────────────┘
```

---

## Settings Home — Setup-Completion Messaging

### Purpose

The Settings home (`/settings`) answers: "What have I set up, and what would
improve my experience if I did more?"

It does **not** re-gate the user or block app access — provider connection is
the only hard gate and it lives in FE-007. Everything in Settings is optional
from an access standpoint, but some items unlock significant product value.

### Setup-completion card model

The home renders a completion card per section. Each card conveys:

- **state**: done, actionable (incomplete but optional), or coming soon
- **what it unlocks**: brief explanation of the value behind completing it
- **a CTA** when actionable

#### States

| State | Indicator | Description |
|---|---|---|
| `complete` | Green check / filled icon | User has active data for this domain |
| `actionable` | Amber dot / outline icon | Not configured; completing it unlocks value |
| `coming-soon` | Muted / lock icon | Not yet implemented in this version |

#### Card copy model

Each card has:

- **Section name** (e.g. "Tariffs")
- **One-line status** (e.g. "Active — day rate 24.5¢, night rate 14¢" or "Not set up")
- **Value unlock line** (e.g. "Required for savings and cost calculations")
- **CTA button** when actionable (e.g. "Set up tariff →" or "Edit →")

#### Example home layout (desktop, all sections)

```
Setup progress ━━━━━━━━━━░░░░░░░░ 2 of 5 optional sections complete

┌─────────────────────────┐  ┌─────────────────────────┐
│ ✓  Tariffs              │  │ ✓  Provider              │
│ Day 24.5¢ Night 14¢     │  │ MyEnergi · Connected     │
│                         │  │                         │
│            Edit →       │  │  Manage connection →    │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│ ·  Finance              │  │ ·  Solar details         │
│ Not set up              │  │ Not set up              │
│ Unlocks payback tracker │  │ Unlocks efficiency view │
│          Set up →       │  │          Set up →        │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐
│ 🔒  Notifications        │
│ Coming soon             │
│ Contract and reminder   │
│ alerts will appear here │
└─────────────────────────┘
```

### Progress indicator

A progress bar or fraction ("2 of 5 optional sections complete") appears at
the top of the home. It counts `complete` sections only; `coming-soon`
sections do not count toward either numerator or denominator.

This indicator communicates progress without manufacturing urgency. It should
not say "incomplete" or "required" for optional sections.

### Hard-gate distinction

The Settings home must never show provider connection as a blocking gate.
Provider status is shown as a normal section card (actionable if disconnected,
complete if connected), not as a warning banner that blocks interaction with
the rest of Settings. The FE-007 gate handles the case where provider
credentials are missing before app entry; once inside the app, provider
status is a manageable concern, not a hard stop.

---

## Section Definitions

### Tariffs

**Status in FE-008:** First fully implemented section (built in P-042 / P-043).

**What it is:** The user's electricity rate history — import rates, export
rates, standing charges, and contract dates. This data powers all financial
calculations in the product.

**Completion signal:** `complete` when at least one active `tariff_plan_version`
exists for the user's installation.

**Setup-completion value line:** "Required for savings, cost, and payback
calculations."

**Section content** (defined in detail by U-027 / P-042):

- Current active tariff summary card
- Historical tariff version timeline
- Add/edit entry point
- Contract reminder and validity state

### Provider

**Status in FE-008:** Managed entry point — actual connection state is from
FE-007; Settings exposes a reconnect / update path.

**What it is:** The user's provider (e.g. MyEnergi) credentials and connection
state. This section lets users update credentials without going through the
full FE-007 gate.

**Completion signal:** `complete` when a valid `provider_connection` exists.

**Setup-completion value line:** "Required to fetch live and historical data."

**Section content:**

- Provider name and connection status
- Last successful sync timestamp
- "Update credentials" action (reuses the credential form from FE-007 but in
  a Settings context, not a gate context)
- Disconnect option (with clear recalculation impact warning)

**Relationship to FE-007:** The FE-007 gate handles first-time setup.
Settings/Provider is the ongoing management entry point. Both use the same
server-side credential validation but Settings should not re-trigger the gate
UI — it should feel like account maintenance, not re-onboarding.

### Finance

**Status in FE-008:** Placeholder. Built in a future feature.

**What it is:** Finance mode (cash purchase vs financed installation),
monthly payment amount, and finance term. Powers the payback tracker.

**Completion signal:** `complete` when finance mode and payment details are
configured.

**Setup-completion value line:** "Unlocks the payback progress tracker."

**Placeholder treatment:** The section card on the home shows as `actionable`
with a "Set up →" CTA. Navigating to `/settings/finance` shows a
"Coming soon" placeholder screen with a brief explanation of what it will do.

### Solar Details

**Status in FE-008:** Placeholder. Built in a future feature.

**What it is:** Theoretical array output (kWp), installation date, and
array configuration. Powers the efficiency and yield comparison views.

**Completion signal:** `complete` when `installation` has array capacity data.

**Setup-completion value line:** "Unlocks solar efficiency and yield
comparison views."

**Placeholder treatment:** Same as Finance — actionable card on home;
coming-soon screen at `/settings/solar`.

### Notifications

**Status in FE-008:** Placeholder. Explicitly deferred in FE-008 feature
scope.

**What it is:** Contract renewal reminders, tariff validity alerts, and
other notification preferences.

**Completion signal:** N/A while in placeholder state.

**Setup-completion value line:** "Get notified before your tariff or
contract expires."

**Placeholder treatment:** `coming-soon` card on home; lock icon; no CTA.
Does not appear in the section count for the progress indicator.

---

## Provider Reconnect Entry Point

Provider reconnect can surface from two places:

1. **Settings / Provider section** — the primary intended path for planned
   credential updates
2. **Inline warning** — if the app detects invalid/expired credentials
   elsewhere (e.g. a failed live fetch), a banner or callout may link to
   `/settings/provider` rather than re-triggering the FE-007 gate

In both cases, the destination is `/settings/provider`, not the FE-007 gate.
The credential form may be shared code, but the flow and framing are
different: Settings is maintenance, FE-007 is first-time setup.

---

## Navigation Bar Integration

The main app nav bar (currently used on Live and Range History screens)
should include a Settings entry for signed-in non-admin users.

- **Desktop nav:** Settings link in the top-right or as a dedicated icon
  (gear/cog) alongside the user avatar
- **Mobile nav:** Settings accessible via the same icon in the header or
  a bottom navigation bar item

Settings should **not** appear for:

- admin users (they have their own admin area)
- demo visitors
- users in `awaiting_approval` state
- users blocked at the FE-007 provider gate

---

## States and Edge Cases

### No sections complete (new user, just passed provider gate)

The Settings home shows:

- Provider card: `complete`
- All other cards: `actionable` or `coming-soon`
- Progress: "1 of 4 optional sections complete" (counting provider)
- A brief welcoming copy block: "Your provider is connected. Add a tariff
  to start seeing savings and cost data."

### Provider disconnected after initial setup

- Provider card shows as `actionable` (amber, not green)
- A short inline warning in the card: "Connection lost — update credentials
  to restore live and historical data"
- The disconnect does not break navigation or access to other Settings
  sections

### All actionable sections complete

Progress shows "4 of 4 optional sections complete" (or however many are
currently implemented). No manufactured next-step prompt is added; the home
simply reflects the complete state.

---

## Out of Scope for This Story

- Admin/operator controls
- Data Health section
- Suspension or account deletion UI
- Full notification-preferences implementation
- Any screen-level mockups beyond the structural layout described here
