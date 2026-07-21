# Accessibility Checklist — Epic 12 Redesign (Story 12.10, RDR-9)

Last updated: 2026-07-21
Audience: human QA tester, black-box only (no code access required).

This is the manual verification pass for the automated AA gate in
`tests/a11y/contrast-themes.test.ts`, `tests/lib/glass.test.ts`,
`tests/theme-aa-contrast.test.ts`, and `tests/a11y/touch-targets.test.tsx`.
Automated tests prove the _tokens_ and _primitives_ clear WCAG 2.1 AA math;
this checklist is where a human confirms it _looks and behaves_ right on a
real device, and covers what code alone can't (real blur rendering, VoiceOver
behavior, actual OS dynamic-type scaling).

> **Scope note:** As of this pass, only Stories 12.1–12.4 and 12.7 are merged
> to `main` — the theme registry, the glass/gradient surface primitives, the
> balance hero, and the Dashboard + Add-Transaction screens. Stories 12.5
> (nav chrome), 12.6 (theme picker UI), 12.8 (re-skin of Activity / Categories
> / Insights / Cards), and 12.9 (motion language) are still on unmerged
> branches, so those screens still render the pre-redesign chrome and cannot
> yet be theme-switched. Rows below are marked **Verified** (covered by this
> session's automated tests + reachable today) or **Pending 12.5/12.6/12.8**
> (not yet re-skinned onto the theme registry — re-audit once merged).

## How to test each combination

1. Go to **Settings → Appearance** _(not yet available — pending Story
   12.6; until then, themes can only be exercised via `app/dev/theme-lab.tsx`
   or by seeding `theme.config.js`'s `DEFAULT_THEME_ID`)_, select the theme,
   then toggle light/dark/system.
2. Visit each reachable screen and check every item in the table below.
3. Enable the OS **largest accessibility text size** and re-check for
   clipping/overlap of essential content (balance, amounts, labels, buttons).
4. Turn on **VoiceOver (iOS) / TalkBack (Android)** and swipe through; every
   control should announce a role, a name, and its state.
5. Turn on **Reduce Motion**; animations should be minimized with no layout
   shift.

## Per-theme × variant checklist

| #   | Theme × Variant           | Contrast (body/secondary/icons/category/on-glass/on-gradient) | Touch targets ≥44×44pt | Screen-reader labels | Dynamic type to 200% | Color-independent income/expense | Status                                                                                                                                                       |
| --- | ------------------------- | ------------------------------------------------------------- | ---------------------- | -------------------- | -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Aurora Glass · Dark       | ☐                                                             | ☐                      | ☐                    | ☐                    | ☐                                | **Verified** — `tests/a11y/contrast-themes.test.ts`, `tests/lib/glass.test.ts`, `tests/a11y/touch-targets.test.tsx`, `tests/components/BalanceHero.test.tsx` |
| 2   | Aurora Glass · Light      | ☐                                                             | ☐                      | ☐                    | ☐                    | ☐                                | **Verified** — same suites as above                                                                                                                          |
| 3   | Obsidian & Gold · Dark    | ☐                                                             | ☐                      | ☐                    | ☐                    | ☐                                | **Verified** (registry/primitives level) — Settings has no theme picker yet (Story 12.6), so this can only be exercised via `app/dev/theme-lab.tsx` today    |
| 4   | Obsidian & Gold · Light   | ☐                                                             | ☐                      | ☐                    | ☐                    | ☐                                | **Verified** (registry/primitives level) — same caveat as #3                                                                                                 |
| 5   | Midnight Spectrum · Dark  | ☐                                                             | ☐                      | ☐                    | ☐                    | ☐                                | **Verified** (registry/primitives level) — same caveat as #3                                                                                                 |
| 6   | Midnight Spectrum · Light | ☐                                                             | ☐                      | ☐                    | ☐                    | ☐                                | **Verified** (registry/primitives level) — same caveat as #3                                                                                                 |

"Verified" above means: the theme registry's semantic tokens, category
colors, on-glass fill (`GlassSurface`), and on-gradient text (`GradientHero`,
`BalanceHero`, `StatCard` hero) all clear WCAG 2.1 AA for this combination,
and the shared `components/ui/*` primitives (Button, Pill, CategoryToken,
TransactionRow, Sheet, Toast, Skeleton, EmptyState) keep their ≥44pt touch
targets under this theme. Check the boxes above once a human has confirmed
the same on a real device/build.

## Per-screen coverage

| Screen                  | Theme-aware?                                                   | Status                                                                                  |
| ----------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Home (Dashboard)        | Yes (Story 12.7)                                               | **Verified** — `BalanceHero`, `StatCard` hero/compact, category tokens                  |
| Add-Transaction         | Yes (Story 12.7)                                               | **Verified** — amount field font-scale cap, category color now threads the active theme |
| Activity (Transactions) | No — still on legacy `useColors()`                             | **Pending Story 12.8** re-skin                                                          |
| Categories              | No — still on legacy `useColors()`                             | **Pending Story 12.8** re-skin                                                          |
| Insights (Summary)      | No — still on legacy `useColors()`                             | **Pending Story 12.8** re-skin                                                          |
| Cards                   | No — still on legacy `useColors()`                             | **Pending Story 12.8** re-skin                                                          |
| Settings                | No — no theme picker yet                                       | **Pending Story 12.6**                                                                  |
| Tab bar / nav chrome    | Partially — labels fixed this session, glass treatment pending | Screen-reader labels **Verified**; glass chrome **Pending Story 12.5**                  |

## Cross-cutting checks (once 12.5/12.6/12.8 land)

- [ ] iOS + Android + Web
- [ ] Phone + tablet sizes
- [ ] Light / Dark / System
- [ ] VoiceOver + TalkBack
- [ ] Rapid theme switching
- [ ] Rotate device mid-flow
- [ ] Very long category names at max font size
- [ ] Empty states
- [ ] Back-button mid-flow

## Known follow-ups

- Full per-screen manual QA for Activity/Categories/Insights/Cards/Settings
  is blocked on Stories 12.5 (nav chrome), 12.6 (theme picker), and 12.8
  (screen re-skin) merging to `main`. Re-run this checklist's per-theme ×
  variant rows against those screens once they land.
- `docs/ux-redesign-samples.html` remains the design source of truth for
  visual QA comparison.
