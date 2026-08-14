# SmartPocket — Design QA Audit (Design-to-Development Conformance)

| Field | Value |
| --- | --- |
| **Product** | SmartPocket (ships as "Expense Tracker", v1.0.0) |
| **Branch under test** | `docs/realign-to-react-native` @ `7bbd7d1` |
| **Audit date** | 2026-08-14 |
| **Audit type** | **Mode C — Design QA**: implementation measured against the written design specification |
| **Specifications audited against** | `docs/ux-design-specification.md` (authoritative), `design.md` (screen-level companion), `theme.config.js` (implemented tokens) |
| **Method** | Computed-style measurement of the live DOM + static token diff. No mockups or Figma files were provided; the repo's own written spec is the reference. |
| **Companion report** | [`QA-REPORT-2026-08-13.md`](./QA-REPORT-2026-08-13.md) — functional/UX audit (SP-073…SP-086) |

> Issue numbering continues from the functional audit. Design findings are **SP-087 … SP-094**.

---

## 1. Executive Summary

**The design system itself is in good shape. The design *documentation* is not.**

SmartPocket has a genuinely disciplined token architecture: one source of truth
(`theme.config.js`) feeding both Tailwind and the runtime, three complete colour themes with
light/dark variants, automated WCAG contrast tests, and a capability-gated rendering path that
degrades expensive effects on weak devices. Measured against its own spec, the implementation
gets the fundamentals right — spacing, radii, tabular figures, semantic colour discipline, and
the accessibility rule that meaning is never carried by colour alone.

The problems are of two kinds:

1. **Specification drift (SP-087, SP-088, SP-089).** Both design documents have fallen behind
   the code. Four of eight type tokens and three of eleven colour tokens now disagree with what
   ships, and the entire three-theme system — the app's most visible design feature — is
   undocumented in either spec. In every case the **code looks correct and the docs look stale**:
   the colour drifts are all contrast-hardening moves. The fix is to update the documents.
2. **Token bypass and threshold bugs (SP-090, SP-091, SP-092, SP-094).** A hardcoded `fontSize: 42`
   in the balance hero sidesteps the type scale; four controls fall below the spec's 44×44 touch
   minimum; and the device-tier heuristic silently strips the signature hero gradient on one of
   the most common laptop resolutions in the world.

**Of the five "Known Consistency Fixes" listed at the bottom of `design.md`, three are done, one
is done well, and one — unifying the app name to "SmartPocket" — is still outstanding (SP-093).**

**Design conformance verdict: 🟡 Good system, stale documentation.** Nothing here blocks a
release on visual grounds. The touch-target failures (SP-091) are the only findings with a
direct accessibility impact.

### Findings at a glance

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| SP-087 | Medium | Typography | Type scale in both specs disagrees with the shipped tokens (4 of 8) |
| SP-088 | Medium | Colour | `success`, `warning`, `accent` token values drifted from both specs |
| SP-089 | Medium | Colour / Docs | Hero gradient is 3-stop with a cyan stop; specs document a 2-stop indigo→violet. Three-theme system undocumented |
| SP-090 | Medium | Typography | `fontSize: 42` hardcoded in `BalanceHero`, bypassing the type scale |
| SP-091 | Medium | Accessibility | 4 controls below the spec's 44×44 minimum touch target |
| SP-092 | Low | Visual consistency | Device-tier heuristic disables the hero gradient on 1366×768 non-retina laptops |
| SP-093 | Low | Branding | App name still "Expense Tracker"; `design.md` lists unifying it to "SmartPocket" as a required fix |
| SP-094 | Low | Spacing / Radius | Off-token radii (24px, 28px) and off-grid spacing (14, 30, 34px) |

---

## 2. What Conforms — Verified Passes

These were measured, not assumed. Each is **[Verified]** against the live DOM.

| Spec requirement | Result |
| --- | --- |
| **Colour tokens** `primary` `background` `surface` `foreground` `muted` `border` `error` `secondary` | ✅ **8 of 11 match both specs exactly.** Live DOM renders `error` as `rgb(220,38,38)` = `#DC2626` as specified. |
| **Spacing 4-pt base** (`xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24`) | ✅ All six tokens implemented at the exact spec values, and the dominant measured spacing values on the dashboard (4, 8, 12, 16, 20, 24) are all token values. |
| **Radius** (`sm 8 · md 12 · lg 16 · full`) | ✅ Implemented exactly; 12px and 16px dominate real usage, `full` = 9999px on pills. |
| **"Monetary values use tabular figures"** | ✅ **7/7** monetary elements on the dashboard render `font-variant-numeric: tabular-nums`. Fully compliant. |
| **"Never encode meaning in colour alone — pair with sign (+/−)"** | ✅ **6/6** colour-coded amounts carry an explicit sign. Income `+$3,200.00` in `rgb(4,120,87)`, expenses `−$…` in `rgb(220,38,38)`. The neutral balance total is correctly unsigned and uses `foreground`, not a semantic colour. |
| **Semantic colour discipline** (`success`/`error` reserved for money & destructive) | ✅ No decorative use of `success`/`error` observed on the audited screens. |
| **Type tokens `body` `label` `caption`** | ✅ Match both specs exactly (16/24/400, 14/20/500, 12/16/400) and render at those values. |
| **Hero gradient renders** (`primary → secondary`, dashboard only) | ✅ Renders correctly at every realistic device pixel ratio — verified at dpr 2, dpr 3, and 1440×900/1920×1080 desktops. Gradient appears only on the dashboard. *(Stop values diverge — see SP-089.)* |
| **Light / dark / three colour themes** | ✅ All render distinctly and persist across reload: Aurora light `rgb(248,250,252)`, Aurora dark `rgb(11,15,25)`, Obsidian `rgb(15,23,42)`. |
| **Responsive layout** | ✅ No horizontal overflow at 390×844, 768×1024, 1440×900, 1920×1080 in either scheme. |
| **Elevation "subtle, low-opacity shadows"** | ✅ Implemented as 8–12% alpha tokens, theme-aware via `color-mix` on `--color-foreground`. Matches the spec's intent. |
| **`design.md` known fix — stray `index` tab** | ✅ **FIXED.** Tab bar renders exactly five tabs: Home, Activity, Insights, Loans, Cards. |
| **`design.md` known fix — "Add New Category" as a real Button** | ✅ **FIXED.** Renders 200×48 with 12px radius on a 390px viewport — a Button, not a full-width banner. |
| **`design.md` known fix — Activity filter chips on the `Pill` primitive** | ✅ **FIXED.** All five chips: `border-radius: 9999px`, height 44px — consistent and meeting the touch minimum. |
| **`design.md` known fix — quick actions not overlapping the hero** | ✅ **FIXED.** Add Income / Add Expense render in-flow below the hero card, not overlapping it. |

---

## 3. Findings

### SP-087 — Type scale: both specs disagree with the shipped tokens
**Severity:** Medium · **Category:** Typography / Documentation · **Reproducibility:** Always
**Evidence tag:** [Verified] — static diff + live computed styles

`design.md` and `docs/ux-design-specification.md` publish an identical type scale. The shipped
`theme.config.js` implements a different one. The four largest tokens — every heading in the app
— disagree:

| Token | Both specs say | `theme.config.js` ships | Rendered (live) | Match |
| --- | --- | --- | --- | --- |
| `display` | 32 / 38 · 700 | **36 / 40** · 700 | *(bypassed — see SP-090)* | ❌ |
| `h1` | 28 / 34 · 700 | **30 / 36** · 700 | **30px / 36px / 700** ("Home") | ❌ |
| `h2` | 22 / 28 · 600 | **24 / 32** · 600 | — | ❌ |
| `h3` | 18 / 24 · 600 | **20 / 28** · 600 | **20px / 28px** ("Recent Activity") | ❌ |
| `body` | 16 / 24 · 400 | 16 / 24 · 400 | 16px | ✅ |
| `label` | 14 / 20 · 500 | 14 / 20 · 500 | 14px / 500 ("This Month") | ✅ |
| `caption` | 12 / 16 · 400 | 12 / 16 · 400 | 12px ("Friday, Aug 14") | ✅ |
| `number` | tabular · 600 | 16 / 24 · 600 · tabular-nums | tabular confirmed | ✅ |

The implemented scale is uniformly one step larger. The spec states it was "formalized from
`theme.config.js`" — so the docs were derived from the code once and never re-synced.

Two further mismatches at the edges of the scale: `micro` (10/14) exists in the code but in
neither spec, and the tab-bar label renders at **11px / 600**, which is not any token value.

**Recommended fix:** update both spec tables to the shipped values (the code is the working
system), add `micro`, and move the 11px tab label onto a token.

---

### SP-088 — Colour tokens: `success`, `warning` and `accent` drifted from both specs
**Severity:** Medium · **Category:** Colour / Documentation · **Reproducibility:** Always
**Evidence tag:** [Verified] — static diff + live computed styles

| Token | Both specs say | Ships | Live DOM | Match |
| --- | --- | --- | --- | --- |
| `success` light | `#059669` | **`#047857`** | `rgb(4,120,87)` = `#047857` | ❌ |
| `success` dark | `#34D399` | **`#6EE7B7`** | — | ❌ |
| `warning` light | `#D97706` | **`#B45309`** | — | ❌ |
| `accent` light | `#DB2777` | **`#BE185D`** | — | ❌ |
| the other 8 tokens | — | — | — | ✅ match |

Every drift moves the light-mode colour **darker**, i.e. to a higher contrast ratio against the
near-white background. Combined with the code comment "tuned for WCAG AA" and the repo's
automated contrast tests, this reads clearly as deliberate accessibility hardening that the
documents never caught up with.

**Recommended fix:** update the token tables in both documents. **Do not change the code** —
reverting to the documented values would reduce contrast. Add a note that these values are
contrast-derived so they are not "corrected" back later.

---

### SP-089 — Hero gradient stops and the three-theme system are undocumented
**Severity:** Medium · **Category:** Colour / Documentation · **Reproducibility:** Always
**Evidence tag:** [Verified] — live DOM + static

Both specs state: *"Hero gradient: `primary → secondary` (indigo → violet), used only on the
dashboard balance card."* That describes **two stops**, `#4F46E5 → #7C3AED`.

What actually renders (measured, Aurora light):

```
linear-gradient(119.31deg, rgb(129,140,248), rgb(196,181,253), rgb(103,232,249))
                           #818CF8           #C4B5FD           #67E8F9
                           indigo         → light violet   → CYAN
```

Three stops, ending in a cyan that appears nowhere in either spec's token table. The dark
variant is `#6366F1 → #A855F7 → #22D3EE`.

More significantly, the build ships **three complete themes** — Aurora, Obsidian & Gold, and
Midnight Spectrum — each with its own gradient stops, glass tokens and category palette, plus a
user-facing theme picker in Settings. **Neither design document mentions any of this.** Both
describe a single "Refined Indigo" system. This is the app's most visible design feature and it
is entirely absent from the design specification.

**Recommended fix:** document the multi-theme architecture in the UX specification — the three
palettes, per-theme gradient stops, the glass/elevation tokens, and the rule for which theme is
default. Until then the specification actively misdescribes the product.

---

### SP-090 — `fontSize: 42` hardcoded in the balance hero, bypassing the type scale
**Severity:** Medium · **Category:** Typography / Token discipline · **Reproducibility:** Always
**Evidence tag:** [Verified] — source + live DOM

The balance figure — the single most prominent element in the app — renders at **42px / 700**.
That is neither the spec's `display` (32) nor the implemented `Typography.display` (36).

`components/ui/BalanceHero.tsx:140` sets `fontSize: 42` as a raw literal.

This matters because the project holds itself to exactly this rule elsewhere: `theme.config.js`
states that for motion "no component hardcodes a duration/easing/scale literal". The type scale
deserves the same discipline — a hardcoded size will not participate in future scale changes or
Dynamic Type work.

**Recommended fix:** either add a `hero`/`displayLg` token at 42/48 and consume it, or move the
hero onto `Typography.display` and adjust that token if 36 is too small.

---

### SP-091 — Four controls fall below the 44×44 minimum touch target
**Severity:** Medium · **Category:** Accessibility / Design conformance · **Reproducibility:** Always
**Evidence tag:** [Verified] — measured bounding boxes at 390×844

Both specs require: *"Minimum touch target: 44×44 pt"* / *"Touch targets ≥ 44×44 pt"*.

| Screen | Control | Measured | Shortfall |
| --- | --- | --- | --- |
| `/transactions` | "Recurring transactions" header icon | **36 × 36** | 8px both axes |
| `/transactions` | "Add transaction" header icon | **36 × 36** | 8px both axes |
| `/settings` | AI features switch | **40 × 20** | 24px vertical |
| `/settings` | (second, unlabelled switch) | **40 × 20** | 24px vertical |

Pass rates: `/dashboard` 15/15 ✅, `/categories` 15/15 ✅, `/transactions` 19/21, `/settings` 20/22.

The switches are the more serious case — a 20px-tall hit area is roughly half the minimum, on a
control that toggles whether user data is sent for AI processing.

**Recommended fix:** expand hit areas to 44×44 without changing visual size, via padding or
React Native's `hitSlop`. The Activity filter pills already do this correctly at exactly 44px —
use them as the reference.

---

### SP-092 — Device-tier heuristic strips the hero gradient on common low-DPI laptops
**Severity:** Low · **Category:** Visual consistency / Performance heuristic · **Reproducibility:** Always
**Evidence tag:** [Verified] — reproduced across four device classes

`GradientHero` drops to a flat colour when `getDeviceTier()` returns `low`
(`lib/_core/perf.ts:49-57`), which is computed as `width × height × pixelRatio²` against a
`LOW_TIER_MAX_PIXELS` of 1,200,000. Measured:

| Device class | Physical pixels | Hero renders |
| --- | --- | --- |
| **1366×768 non-retina laptop** | **1,049,088** | ❌ **SOLID FALLBACK** |
| 1440×900 non-retina desktop | 1,296,000 | ✅ GRADIENT |
| 1920×1080 desktop | 2,073,600 | ✅ GRADIENT |
| iPhone 14 @3x (390×844) | 2,962,440 | ✅ GRADIENT |

1366×768 is one of the most widely deployed laptop resolutions in the world. Those users
silently lose the app's signature visual, while a user on a 1440×900 screen — a machine of
broadly similar capability — keeps it. The heuristic conflates *few pixels* with *weak GPU*,
which holds for phones but inverts on desktops: a low-resolution desktop has **fewer** pixels to
push, so it should find the gradient *easier*, not harder.

The degradation mechanism itself is well built — `disableGradient`, reduced-motion and tier
overrides all compose correctly, and there is a proper testID-tagged fallback path. Only the
threshold's applicability to desktop is wrong.

**Recommended fix:** apply the pixel-count tier test to touch/mobile platforms only, or add a
desktop branch that keys off hardware signals (`navigator.hardwareConcurrency`, `deviceMemory`)
rather than raw resolution.

**Note on method:** this finding is also why an earlier observation was *not* filed — testing at
`deviceScaleFactor: 1` on a 390×844 viewport produced 329,160 pixels and triggered the same
fallback. That was a test-harness artifact, not a product defect, and the gradient was confirmed
correct at every realistic DPR before this finding was narrowed to the desktop case.

---

### SP-093 — App name is still "Expense Tracker", not "SmartPocket"
**Severity:** Low · **Category:** Branding / Content · **Reproducibility:** Always
**Evidence tag:** [Verified] — source + runtime

`design.md`'s own "Known Consistency Fixes" list requires: *"Unify app title to **SmartPocket**
(currently shows 'Expense Tracker')."* It is the only one of the five still outstanding.

- `app.config.ts:21` — `appName: "Expense Tracker"`, `appSlug: "expense-tracker-app"`
- Settings → About renders **"Expense Tracker 1.0.0"** at runtime
- The same screen simultaneously says *"Lets **SmartPocket** suggest categories…"*

So a single screen shows the product under two different names. Every user-facing surface
derived from `expoConfig.name` — app icon label, splash, browser tab, install prompt, store
listing — currently reads "Expense Tracker".

**Recommended fix:** set `appName: "SmartPocket"` and `appSlug: "smartpocket"`. Note the slug
change affects deep-link/OAuth redirect URIs, so coordinate it with the auth configuration.

---

### SP-094 — Off-token radii and off-grid spacing
**Severity:** Low · **Category:** Design system conformance · **Reproducibility:** Always
**Evidence tag:** [Verified] — measured computed styles, dashboard

Radius tokens are `8 / 12 / 16 / full`. Measured in use:

| Radius | Occurrences | Status |
| --- | --- | --- |
| 16px | 5 | ✅ `lg` |
| 12px | 4 | ✅ `md` |
| **28px** | 2 | ❌ off-token |
| **24px** | 1 | ❌ off-token |

Spacing is 4-pt based (`4/8/12/16/20/24`). Off-grid values measured: **30px**, **14px**, **34px**
(one occurrence each), plus 2px × 9 — the 2px values are almost certainly hairline borders and
are not counted as violations.

The volume is small and the dominant values are all tokens, so this is drift at the margins
rather than a systemic problem. It is listed because a design system's value decays exactly this
way, one literal at a time.

**Recommended fix:** replace the 24px and 28px radii with `lg` (16) or `full`, and move the 14/30/34px
values onto the nearest token. Consider an ESLint rule banning numeric literals in
`borderRadius`/padding/margin style props.

---

## 4. Typography, Colour and Spacing — Consolidated Conformance Matrix

| Dimension | Spec'd | Implemented | Rendered | Verdict |
| --- | --- | --- | --- | --- |
| Colour tokens | 11 | 11 | 8 sampled live | **8/11 conform** — 3 drifted (SP-088) |
| Type tokens | 8 | 9 (adds `micro`) | 7 distinct sizes measured | **4/8 conform** (SP-087) + 1 bypass (SP-090) |
| Spacing tokens | 6 | 6 | 6 in active use | **6/6 conform**; 3 off-grid literals (SP-094) |
| Radius tokens | 4 | 4 | 2 dominant | **4/4 conform**; 2 off-token literals (SP-094) |
| Tabular numerals | required | implemented | 7/7 | ✅ **full conformance** |
| Sign + colour pairing | required | implemented | 6/6 | ✅ **full conformance** |
| Touch targets ≥44×44 | required | mostly | 69/73 measured | **4 failures** (SP-091) |
| Hero gradient | 2-stop indigo→violet | 3-stop, per-theme | renders at dpr≥2 | **mismatch** (SP-089), tier gap (SP-092) |
| Themes | 1 documented | 3 shipped | 3 verified distinct | **undocumented** (SP-089) |

---

## 5. `design.md` "Known Consistency Fixes" — Status

| # | Fix required by `design.md` | Status |
| --- | --- | --- |
| 1 | Remove the stray `index` tab from the tab bar | ✅ **Done** — exactly 5 tabs render |
| 2 | Fix dashboard quick actions overlapping the balance hero | ✅ **Done** — buttons render in-flow below the hero |
| 3 | Convert "Add New Category" from a full-width banner to a real Button | ✅ **Done** — 200×48, 12px radius |
| 4 | Standardize Activity filter chips on the shared `Pill` primitive | ✅ **Done** — all 5 at `radius 9999px`, height 44px |
| 5 | Unify the app title to "SmartPocket" | ❌ **Outstanding** — SP-093 |

**4 of 5 complete.** This list has been worked through diligently.

---

## 6. Design Observations (not defects)

- **Desktop master/detail wastes horizontal space.** At 1440px, Insights and Transactions confine
  content to roughly the left 550px with an empty right panel until a selection is made. It is a
  deliberate pattern, but the empty half reads as a rendering fault on first view. Consider a
  default detail state or a wider master column. **[Verified]**
- **Empty states are a genuine strength.** Every empty list has an icon, a title, an explanatory
  sentence and — where relevant — a CTA, and they are consistent in structure across Loans,
  Accounts, Budgets, Recurring, Cards and search. This is the most polished aspect of the visual
  design. **[Verified]**
- **The spec is unusually strong on emotional and interaction design** (§ Desired Emotional
  Response, § Micro-Emotions, motion tokens for press/sheet/countUp/celebration). Motion tokens
  are fully centralised with no hardcoded literals — the discipline SP-090 breaks for typography
  is otherwise well maintained.
- **Dynamic Type / 200% text scaling could not be assessed.** Setting the root font size did not
  change rendered text, because React Native Web emits absolute pixel sizes. Verifying the spec's
  "support Dynamic Type up to 200%" (NFR-5) requires a real device with OS-level text scaling.
  **[Untested — method-limited]**

---

## 7. Recommendations

**Documentation (highest value, lowest cost)**
1. **Re-sync both design documents with `theme.config.js`** — the type scale (SP-087) and the
   three colour tokens (SP-088). The code is the working system; the docs are the defect.
2. **Document the three-theme architecture** (SP-089) — it is the app's most visible design
   feature and appears in neither spec.
3. **Record *why* the contrast-hardened colours differ**, so they are not "corrected" back to the
   documented values by a future contributor.

**Implementation**
4. **Fix the four sub-44×44 touch targets** (SP-091) — the only design finding with a direct
   accessibility impact. Use `hitSlop`; the Activity pills are the reference.
5. **Move the balance hero onto a type token** (SP-090).
6. **Scope the device-tier heuristic to touch platforms** (SP-092) so low-DPI laptops keep the
   gradient.
7. **Set the app name to "SmartPocket"** (SP-093), coordinating the slug change with OAuth
   redirect URIs.
8. **Sweep the off-token radii and spacing literals** (SP-094) and consider a lint rule to hold
   the line.

**Process**
9. Add a **token-conformance test** — assert that rendered heading sizes match `Typography`, and
   that no style literal falls outside the spacing/radius token sets. The repo already tests
   contrast this way; extending the same idea to scale and spacing would have caught SP-087,
   SP-090 and SP-094 automatically.

---

## 8. What Was NOT Audited and Why

| Area | Reason |
| --- | --- |
| **Figma / mockup comparison** | No design files were provided. This audit measures the implementation against the repo's **written** specification only — it cannot detect divergence from a visual comp that was never committed. |
| **Dynamic Type / 200% text scaling** | Method-limited: RN Web emits absolute px, so browser font scaling had no effect. Needs a real device. |
| **Native visual rendering (iOS/Android)** | No device or simulator. Blur/glass effects, native shadows, haptics and platform fonts are unverified — the web build approximates several of these. |
| **Motion and animation timing** | Motion tokens were read in source but transitions, press feedback and chart staggering were not timed or frame-captured. |
| **Category colour contrast (WCAG AA)** | The palette is documented as AA-tuned and the repo tests it automatically, but this audit did not independently re-measure all 10 category colours across 3 themes × 2 schemes. |
| **Obsidian & Gold / Midnight Spectrum in depth** | Confirmed to render distinctly and persist; not audited screen-by-screen for token conformance. |
| **Icon set consistency, illustration and imagery** | Icons observed as uniformly Ionicons; no systematic audit of icon weight, size or metaphor consistency. |
| **Screens beyond the audited set** | Token measurement concentrated on Dashboard, Transactions, Categories and Settings. Detail screens and modals were reviewed visually in the functional audit but not measured against tokens here. |

---

*Design QA performed with the Elite QA Engineer skill, Mode C — Design QA. Every conformance
result above was measured from the live DOM or diffed from source in this session; no value was
estimated. Evidence: `docs/qa-evidence/qa-2026-08-14-hero-gradient-correct-dpr3.png`,
`sp-092-gradient-lost-1366x768-laptop.png`, `qa-2026-08-14-dashboard-dark-phone.png`.*
