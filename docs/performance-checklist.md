# Performance Checklist — Story 12.11 (Render & Blur Performance)

Manual profiling sign-off for the Epic 12 redesign's performance gate (RDR-9,
NFR-2/5). Frame-rate, cold-start, and jank are device-measured — jsdom/node
test environments can't produce meaningful frame timing, so this checklist is
the human-QA artifact `tests/perf/perf-budget.test.ts` can't replace.

## Budgets under test

| Budget                                      | Target | Source                                           |
| ------------------------------------------- | ------ | ------------------------------------------------ |
| Sustained frame rate (scroll, theme switch) | ~60fps | `lib/_core/perf.ts#TARGET_FPS`                   |
| Cold start → dashboard interactive          | ≤ 3s   | `lib/_core/perf.ts#COLD_START_BUDGET_MS`         |
| Screen interactive after data load          | ≤ 1s   | `lib/_core/perf.ts#SCREEN_INTERACTIVE_BUDGET_MS` |

## Prerequisites

- Deploy the build under test to a staging/dev environment; comment the
  build/branch/commit ID on the story ticket once live.
- **A physical mid-range device is required** (e.g. a ~2–3-year-old mid-tier
  Android). Simulators do not reflect GPU cost and must not be used as the
  sign-off device.
- If available, a low-end device (or a mid/high device with OS **Reduce
  Motion** / low-power mode enabled) to validate the fallback path.
- Seed the test account with enough transactions (50+) that Activity/Insights
  lists actually scroll, and enable all three themes (Settings → Appearance).

## Dev instrumentation

`app/dev/theme-lab.tsx` ships a dev-only "Story 12.11" panel:

- An FPS overlay (`hooks/use-fps-monitor.ts`) sampling roughly once per
  second — use it as a rough in-app signal, not a substitute for the
  platform profiler below.
- A device-tier override (auto/high/mid/low, `lib/_core/perf.ts#setDeviceTierOverride`)
  that forces the low-cost fallback path on any machine, so the opaque/solid
  fallback can be visually confirmed without a physical constrained device.

## Checklist

### 1. Cold start

- [ ] Fully close the app (not backgrounded) and reopen.
- [ ] Time from launch to the dashboard being interactive.
- [ ] Record the time; **pass** if ≤ ~3s on the mid-range device.

### 2. Screen time-to-interactive

- [ ] Navigate to Activity, Insights, and Cards from a cold dashboard load.
- [ ] Each screen should be usable within **~1s** of its data loading.
- [ ] Record any screen exceeding budget, with device + theme combination.

### 3. Scroll smoothness

- [ ] Scroll the Activity list (50+ seeded transactions) briskly, top to
      bottom and back.
- [ ] Repeat on Insights' long lists.
- [ ] Confirm no stutter/dropped frames over the glass rows; capture the
      platform profiler's fps trace (Xcode Instruments / Android GPU
      rendering profiler) or the in-app FPS overlay reading during the scroll.

### 4. Theme switching

- [ ] In Settings → Appearance, switch between Aurora / Obsidian / Spectrum
      repeatedly.
- [ ] Toggle light/dark within each theme.
- [ ] Confirm switching is instant and smooth — no flash, jank, or relayout
      flicker (this validates the memoized theme context; see
      `tests/lib/theme-provider.test.tsx` for the automated no-remount guard).

### 5. Sheet open

- [ ] Tap the floating **+** to open Add-Transaction repeatedly.
- [ ] Confirm the sheet animates smoothly every time with no hitch (Sheet's
      open/close/drag motion runs on the Reanimated UI thread — see
      `components/ui/Sheet.tsx`).

### 6. Constrained-device fallback

- [ ] On a low-end device, or with OS **Reduce Motion** / low-power mode on,
      confirm the app stays smooth.
- [ ] Confirm heavy blur visibly reduces to a solid tinted surface where
      relevant, and gradients drop to their solid-color fallback — text
      stays readable (the AA contract from Story 12.10 must hold in the
      fallback path too).
- [ ] Alternatively, use the theme-lab device-tier override (see above) set
      to "low" to preview the fallback surfaces directly.

### 7. Edge cases

- [ ] Rapid repeated theme switching.
- [ ] Rotate device mid-scroll.
- [ ] Open/close the Add-Transaction sheet quickly several times.
- [ ] Background and resume the app.
- [ ] Low-power mode on/off mid-session.

### 8. Cross-cutting matrix

Run at minimum the scroll (§3) and theme-switch (§4) checks across:

- [ ] iOS
- [ ] Android
- [ ] Web
- [ ] Light / Dark / System color scheme

## Regression check (behavior unchanged)

This story changes rendering/perf only — confirm no functional regression:

- [ ] Add / edit / delete a transaction
- [ ] Category CRUD
- [ ] Card create / delete
- [ ] Filters / search
- [ ] Monthly summary

## Sign-off

| Field                   | Value                                                  |
| ----------------------- | ------------------------------------------------------ |
| Build / branch / commit |                                                        |
| Device(s) tested        |                                                        |
| Tester                  |                                                        |
| Date                    |                                                        |
| Result                  | Pass / Fail (attach notes for any failing check above) |
