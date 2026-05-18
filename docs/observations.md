# Observations

This document is a lightweight holding area for small product, UX, content,
and implementation observations that come up while using the app.

Use it for:

- Small papercuts worth revisiting
- Rough ideas that are not yet scoped as backlog items
- Things noticed during click-throughs, testing, or demos
- Possible future stories that need a little seasoning before promotion

Do not use it for:

- Committed feature scope that already belongs in `docs/backlog.md`
- Fully formed implementation plans
- Long research write-ups that deserve their own dedicated doc

## How to Capture Notes

Add new items to the top of `## Inbox` using this template:

```md
### YYYY-MM-DD - Short title

- Area: Live | History | Settings | Auth | Public site | Data | Other
- Type: Bug | UX | Copy | Polish | Idea | Question
- Status: New
- Notes: What you noticed, where it showed up, and why it felt off
- Next step: Leave as note | Group into small story | Promote to full story
```

When something is finished, change the heading to:

```md
### YYYY-MM-DD - Short title ✅
```

If an item becomes concrete enough to schedule:

- Move it into backlog/story planning
- Add the resulting story or backlog ID back to the note
- Update the note status so this file stays useful as a triage surface

## Inbox

### 2026-05-11 - Live "Trust and interpretation" section feels like fluff

- Area: Live
- Type: UX
- Status: New
- Notes: The current `Trust and interpretation` / `Notes` card in the Live screen's `Next` section does not feel valuable enough to justify the space. It reads as filler rather than helping the user make a decision, so this area likely needs a more useful module or a stronger replacement concept.
- Next step: Leave as note

### 2026-05-11 - Live screen header layout is weak on mobile

- Area: Live
- Type: UX
- Status: New
- Notes: The Live screen header does not lay out especially well on mobile. In the screenshot, the title, freshness chip, rate chip, and date/navigation controls compete for space and create a cramped top section before the main content begins.
- Next step: Leave as note

### 2026-05-11 - Calendar screen has mobile layout issues

- Area: Calendar
- Type: UX
- Status: New
- Notes: The Calendar screen has some layout problems on mobile. From the screenshot, the header/actions, metric pills, and overall vertical spacing feel too cramped, and the screen starts to look crowded before the main chart content gets room to breathe.
- Next step: Leave as note

### 2026-05-11 - Missing setup prompts on Live and Historical Day cost surfaces

- Area: Live | History
- Type: UX
- Status: New
- Notes: Range History already does a nice job of explaining that tariff and installation data unlock financial features, with a direct link into the relevant setup section. Live and Historical Day should do the same on Cost and Savings instead of silently omitting those cards when setup is incomplete. Historical Day also still shows Value Breakdown without tariff data, but it does not guide the user to the tariff setup flow the way Range History does.
- Next step: Leave as note

### 2026-05-11 - Energy trend chart scale does not recompute when series are hidden

- Area: Live | History | Range History
- Type: UX
- Status: New
- Notes: On the energy trend chart, the y-axis scale appears to be set from the largest currently loaded series value, such as import. If that dominant series is toggled off, the chart does not rescale to show the remaining visible series in better detail. The chart already supports this behavior when zooming into a region and even while dragging the zoom window, so the issue seems to be that series visibility changes are not triggering the same kind of scale recalculation. This also applies to charts on the Range History page.
- Next step: Leave as note

### 2026-05-11 - Chart x-axis intervals feel arbitrary at default and zoomed levels

- Area: Live | History
- Type: UX
- Status: New
- Notes: The bottom time axis on the charts currently shows unusual intervals such as 1 hour 20 minutes by default, which makes the scale feel unnatural. A better default would likely be 1-hour intervals with short labels like `07`, `08`, `09` through `23`. When zoomed, the axis should also step through more meaningful intervals where possible, such as 30, 15, 10, 5, or 1 minute increments, instead of values like 12-minute spacing that do not carry much meaning for a user who can already inspect exact timestamps via pointer hover.
- Next step: Leave as note

### 2026-05-11 - Range History needs rollup controls for long time windows

- Area: Range History
- Type: UX
- Status: New
- Notes: When viewing a long range such as a full year, the charts should support rolling data up into coarser groupings such as weeks or months instead of forcing the same granularity regardless of time span. The page needs an explicit scale or group-by control so broad windows can be read meaningfully without overwhelming detail.
- Next step: Leave as note
