# QA Test Report — SmartPocket on a physical Android device

**Date:** 2026-08-15
**Mode:** A — Live Device QA (`.claude/skills/elite-qa-engineer/SKILL.md`)
**Issue numbering:** continues from SP-099; first new finding is **SP-100**.

---

## 1. Executive Summary

Nineteen findings (SP-100 … SP-118), of which **three are release blockers and all three are
fixed and re-verified on the device**:

| # | Severity | Title | Status |
|---|----------|-------|--------|
| SP-100 | **Critical** | Every sheet and overlay in the app renders transparent, unpadded and with no backdrop | **Fixed [Verified]** |
| SP-101 | **High** | The keyboard covers the sheet body including Save, and the sheet never moves | **Fixed [Verified]** |
| SP-102 | **High** | The user's balances and transactions stay in the accessibility tree behind the App Lock screen | **Fixed [Verified]** |

SP-100 alone made all 20 overlays unusable — the screen behind showed straight through the
sheet and its content sat flush against the left edge. It is the single most consequential
defect in this pass, it is invisible to the web suite, and its root cause is the same
`cssInterop`-over-a-Reanimated-wrapper mechanism that SP-D02 found on `AnimatedPressable`
in the previous device pass. The registration was removed for `Animated.View`/`ScrollView`/
`Text`/`Image` and the whole 19-route sweep re-run to prove no regression.

The remaining sixteen findings are Medium and Low: one real security gap (no brute-force
protection on the App Lock PIN), the device-tier heuristic silently disabling the app's
signature gradient on any 720p phone, six sub-44dp touch targets, and a set of polish and
consistency items.

**Seven candidate findings were investigated and withdrawn** rather than filed — see §12.
Five of them were artifacts of the test harness, one was my own un-migrated database, and one
was a feature the project's own docs already record as unbuilt. They are listed in full
because a report that hides its false starts cannot be audited.

**Release decision: Passed with Minor Issues** — after the three fixes in this report. No
Critical or High defect remains open. Two Medium items (SP-103 PIN brute force, SP-105 tier
heuristic) warrant a decision before a production release.

---

## 2. Test Environment

| | |
|---|---|
| Device | **vivo V2352** (`10FE7N0ALJ0001Y`), USB |
| Android | **16** |
| Screen | **720 × 1608 px**, **300 dpi** → scale **1.875×**, logical **384 × 857.6 dp** |
| Physical pixels | 1,157,760 — relevant to SP-105 |
| Build | debug, `npx expo run:android`, Metro on `192.168.0.39:8081` |
| API | `localhost:3001`, `NODE_ENV=development` |
| Database | **local MySQL** (see the deviation note below) |
| User | dev auto-login (`dev_local_user`) |
| Branch | `docs/realign-to-react-native` |
| Tested | 2026-08-15, 01:44 – 05:30 local |

### Deviation from the prompt's environment — declared

The prompt specifies an **in-memory seeded dev database** (`DATABASE_URL` unset). This run used
the repository's existing **local MySQL** instead, because it was already running and populated.
Consequences, both material:

1. Row counts differ from the prompt's expectation (4 transactions / 4 categories / 1 card).
   Actual at start: 19 transactions, 6 categories, 2 cards, 2 accounts, 1 loan, 0 budgets,
   0 recurring rules.
2. The database was **behind on migrations**. `security.setPin` failed with
   `Unknown column 'pinHash' in 'field list'` until `npx drizzle-kit migrate` was run. That was
   **my environment, not a defect** — migration `0010_add_pin_sync_to_users.sql` exists in the
   repo. It is recorded as withdrawn finding **W6** in §12.

Using the real database is arguably closer to production, but it cost a false alarm. A future
run should follow the prompt and use the in-memory DB.

---

## 3. Test Scope

### Routes — 19 of 22 exercised

`/dashboard` `/transactions` `/summary` `/loans` `/cards` `/categories` `/accounts` `/budgets`
`/recurring` `/add-transaction` `/budget-form` `/import-csv` `/security` `/settings`
`/transaction/[id]` `/loan/[id]` `/card/[id]` `/loan/record-repayment` `/dev/theme-lab`

Not exercised: `/login`, `/oauth/callback`, and the `/` redirector — see §12.

### Overlays — 18 of 20 opened through the UI

Settings: currency picker · first-day-of-week picker · export CSV · export JSON ·
clear-all-data confirm · sign-out confirm · theme picker (inline on Settings).
Accounts: add · edit · transfer · delete confirm · move-activity (reassign).
Cards: add · edit. Loans: new loan. Categories: add · delete confirm.
Recurring: add rule. Transaction detail: edit sheet. Add Transaction: date picker.
Plus the **Toast** in both success and failure states, and the **App Lock gate**.

Not opened: the Transactions-list swipe/long-press delete confirm (the detail-screen delete
covers the same `confirmDestructive` path and was exercised).

### Colour schemes × themes

All three themes (Aurora Glass, Obsidian & Gold, Midnight Spectrum) in both light and dark,
across Dashboard, Activity, Insights, Cards and Loans — 30 measured screens. All six
combinations render correctly and the only dp violations found are theme-independent.

### Native-only surfaces

App Lock (enable, PIN set, confirm-mismatch, wrong PIN, repeated wrong PIN, persistence across
force-stop, lock-on-background, unlock, biometric toggle, Forgot PIN, disable) ·
`expo-secure-store` persistence · `Alert.alert` destructive confirms · hardware back on screens
and sheets · haptics · 200% font scale · rotation · accessibility tree inspection.

---

## 4. Measurement Technique

Every screen and overlay was captured with `adb shell uiautomator dump` plus
`adb exec-out screencap`, and the element tree parsed by a purpose-written script that converts
every node's bounds to **dp** (`dp = px / (300/160)`) and flags:

- clickable nodes below **44 × 44 dp**
- clickable nodes overlapping other clickable nodes
- nodes extending past the screen or their parent
- clickable nodes with neither text nor `content-desc`
- text nodes collapsed to zero size

The script needed three corrections during the run, each prompted by a false positive it
produced. Those corrections are themselves part of the findings integrity story:

1. **Scroll-viewport clipping.** A half-scrolled row is reported by uiautomator at its clipped
   size, so a 68 dp transaction row appeared as a "12.3 dp touch target". Nodes cut by a
   scrollable ancestor's edge are now excluded from size checks, along the scroller's own axis
   only, so genuine clipping on the other axis still surfaces.
2. **Sub-pixel rounding.** A 44 dp box at 1.875× lands on 82 or 83 px and measures 43.7 dp. The
   floor is now `44 − 1/1.875` so device rounding is never filed as a defect.
3. **LogBox chrome.** React Native's dev warning toast contributes an unlabelled 20 dp dismiss
   button that floats over the tab bar. Its nodes are now excluded.

**A limitation of this technique, stated plainly:** uiautomator reports *node* bounds, not glyph
bounds. Text that overflows *within* a correctly-sized node is invisible to the script. All
typography findings in this report therefore rest on screenshots, not measurements.

---

## 5. Issues Log

| ID | Severity | Priority | Type | Area | Summary | Status |
|----|----------|----------|------|------|---------|--------|
| SP-100 | Critical | P1 | UI | All sheets/overlays | Sheet panel renders with no background, no top radius and no padding; backdrop scrim absent; screen behind fully legible through the sheet | **Fixed [Verified]** |
| SP-101 | High | P1 | UX | All sheets with inputs | Keyboard covers the sheet body including Save; panel does not move or resize | **Fixed [Verified]** |
| SP-102 | High | P1 | Security | App Lock | Balances, categories and transaction amounts remain in the accessibility tree while the app is locked | **Fixed [Verified]** |
| SP-103 | Medium | P2 | Security | App Lock | No brute-force protection on the PIN gate — 12 wrong PINs in 14 s, no lockout, no delay, no counter | Open |
| SP-104 | Medium | P3 | Accessibility | add-transaction, budget-form, record-repayment | The screen behind a `transparentModal` sheet route stays in the accessibility tree | Open |
| SP-105 | Medium | P2 | UX / Design | Theme system | Hero gradient and glass blur silently degrade to a flat fill on any 720p phone | Open |
| SP-106 | Medium | P3 | Accessibility | Dashboard | Balance hero wraps mid-number at 200% font — "Rs 0.0" / "0" on two lines | Open |
| SP-107 | Medium | P3 | UX | App-wide | Press and tab haptics are gated to iOS only, so Android gets none; no success/error haptics exist on any platform | Open |
| SP-108 | Low | P3 | Accessibility | App-wide | No `TextInput` in the app meets the 44 dp minimum — every field measures 41.6–42.7 dp | Open |
| SP-109 | Low | P3 | Accessibility | Category & card forms | Colour swatch buttons are 42.1 × 42.1 dp | Open |
| SP-110 | Low | P4 | Accessibility | Activity | The "All" filter chip is 42.7 dp wide | Open |
| SP-111 | Low | P4 | Accessibility | Security | The App Lock switch is 46.9 × 27.2 dp | Open |
| SP-112 | Low | P4 | Accessibility | Transaction detail | The account radio row is 41.1 dp tall | Open |
| SP-113 | Low | P4 | Accessibility | dev/theme-lab | Tier-override buttons are 33.6 dp tall (dev-only screen) | Open |
| SP-114 | Low | P3 | UI | App-wide | The Toast overlay covers the screen header — title and back button are hidden for its duration | Open |
| SP-115 | Low | P3 | UI consistency | Destructive confirms | Two different confirm UIs ship side by side; Android's `Alert.alert` gives the destructive action no visual weight | Open |
| SP-116 | Low | P3 | Functional | Navigation | `Looks like you have configured linking in multiple places` logged on deep links; deep-link navigation observed to be unreliable | Open |
| SP-117 | Low | P4 | Dev tooling | dev/theme-lab | The device-tier override does not re-render already-mounted glass/gradient surfaces | Open |
| SP-118 | Low | P4 | Maintenance | Dependencies | `SafeAreaView has been deprecated` warning at rest, from a dependency | Open |

---

## 6. Bug Reports

### SP-100 — Every sheet and overlay renders transparent, unpadded and with no backdrop

**Severity** Critical · **Priority** P1 · **Type** UI · **Reproducibility** Always (4/4)

**Steps to Reproduce**
1. Open Settings → tap **Currency**.
2. Observe the sheet.

**Actual Result**
The sheet panel paints no background, no top corner radius, no `paddingTop` and no
`paddingHorizontal`. The backdrop scrim is absent. The Settings screen behind is fully legible
*through* the sheet, and the sheet's own text sits flush against x = 0. Measured: panel node
`[0,572]–[720,1608]` with its first child at x = 0 despite a declared 16 dp horizontal padding,
and the drag handle at the panel's exact top edge despite a declared 8 dp `paddingTop`.

**Expected Result**
Opaque `colors.surface` panel, 16 dp top radius, 8/16 dp padding, and a 65%-opacity scrim over
the screen behind.

**Evidence** `sp-100-before-sheet-transparent.png`, `sp-100-before-addaccount-unpadded.png`

**Isolation** Injected `#FF00FF` on the panel and `#00FF00` on the backdrop and cold-started.
**Neither colour painted** — proving the entire inline `style` object was being discarded, not
that a token resolved wrongly. The Reanimated `translateY` in the same style array still
applied, which is the signature of the failure.

**Root Cause**
`cssInterop(Animated.View, { className: "style" })` in `lib/_core/nativewind-pressable.ts`. The
interop rebuilds the target prop from scratch (`applyRules` → `assignToTarget`); on a Reanimated
wrapper whose `style` is an array ending in a `useAnimatedStyle` object, the round-trip keeps the
animated entry and **drops the plain inline objects beside it**. Any `Animated.View` that styles
itself through `style` and passes no `className` therefore lost its own styling. This is the
same mechanism SP-D02 documented for `AnimatedPressable`; the fix was applied there and the four
`Animated.*` registrations were left live.

**Fix** Removed the `cssInterop` registrations for `Animated.View`, `Animated.ScrollView`,
`Animated.Text` and `Animated.Image`. `className` keeps working without them because Reanimated
renders the underlying primitive via `createElement(View, …)`, which passes through NativeWind's
patched JSX runtime where `View`/`ScrollView`/`Text`/`Image` are registered by default.

**Verification** Currency sheet and Add-account sheet now render opaque, padded, rounded and
dimmed. The **full 19-route sweep was re-run post-fix and is byte-for-byte equivalent to the
pre-fix sweep** on every route, confirming no regression to the ~25 call sites that pass
`className` to an `Animated.View`.
**Evidence** `sp-100-after-sheet-opaque.png`, `sp-100-after-addaccount-padded.png`

---

### SP-101 — The keyboard covers the sheet body including Save

**Severity** High · **Priority** P1 · **Type** UX · **Reproducibility** Always (2/2 on Add
account, 1/1 on Add Transaction)

**Steps to Reproduce**
1. Accounts → **Add account**.
2. Tap the **Account name** field.

**Actual Result**
The keyboard opens and the sheet does not move or resize. Panel bounds are **identical** before
and after: `[0,829]–[720,1608]`. The keyboard's top edge is at y ≈ 965, so the name field
(y 1042–1125), the type chips, the currency row, **Cancel and Save** (y 1441–1530) are all
hidden. The user cannot see what they are typing and cannot reach Save. On Add Transaction the
Amount field happens to sit above the fold, but everything below it — including Save at
y 1479–1575 — is unreachable while typing.

**Expected Result** The sheet lifts so its content, and at minimum its primary action, stay
above the keyboard.

**Evidence** `sp-101-before-keyboard-covers-sheet.png`

**Root Cause** — two compounding halves:
1. `app.config.ts` sets `edgeToEdgeEnabled: true`. Under edge-to-edge, Android stops resizing
   the window for the IME, so `android:windowSoftInputMode="adjustResize"` is a no-op and the
   app must consume the inset itself. This hits the `noModal` sheets on the three
   `transparentModal` routes.
2. A React Native `Modal` is its own Dialog window and never inherited `adjustResize` in the
   first place. This hits every other sheet.

The `KeyboardAvoidingView` inside the panel therefore received no inset in either case and was
completely inert.

**Fix** (`components/ui/Sheet.tsx`) Removed the inert `KeyboardAvoidingView`. The panel now
grows its own `paddingBottom` by the keyboard height and caps `maxHeight` to 90% of the space
left above the IME. The height is `max(useAnimatedKeyboard().height, JS Keyboard events)` —
the Reanimated hook reads the activity window and covers the `noModal` path; the JS `Keyboard`
listener works inside the `Modal` window where the Reanimated hook cannot see the inset.

**Verification on device**
- Add account: panel top **829 → 239 px**, Save **1441–1530 → 851–940 px** — the whole form is
  above the keyboard and Save was tapped successfully with the keyboard up, creating the account.
- Add Transaction: panel top **539 → 104 px**, Save **1479–1575 → 910–1006 px**.

**Regression test** `tests/components/Sheet.test.tsx` — *"lifts the panel above the keyboard by
its height"*. It replaces the previous assertion that a `KeyboardAvoidingView` is present; that
was exactly the contract the device disproved. `useAnimatedKeyboard` was added to
`__mocks__/react-native-reanimated.ts`.
**Evidence** `sp-101-after-keyboard-avoids.png`, `sp-101-after-addtransaction.png`,
`sp-101-save-reachable-with-keyboard.png`

---

### SP-102 — Financial data stays in the accessibility tree behind the App Lock screen

**Severity** High · **Priority** P1 · **Type** Security / Privacy · **Reproducibility** Always
(4/4)

**Steps to Reproduce**
1. Settings → App Lock → set a PIN.
2. Background the app and return, so the lock screen shows.
3. `adb shell uiautomator dump` — or point any accessibility service at the screen.

**Actual Result**
While "Enter your PIN" is displayed, the dump contains **146 nodes**, 16–20 of which carry the
protected data:

```
Button   'Salary, income, +Rs 500.00, July 2'
Button   'Groceries, expense, -Rs 25.50, July 20'
TextView 'This Month, balance Pakistani Rupee 0.00'
Button   'Add Income' / 'Add Expense' / 'Recent Activity'
```

TalkBack — or any accessibility service, including a malicious one — can read the user's
balances and transaction history aloud without the PIN. The same leak was observed with the
Security screen behind the gate.

**Expected Result** Nothing behind the lock screen is reachable by assistive technology.

**Evidence** `applock-gate-cold-start.png`

**Root Cause** The gate already sets `importantForAccessibility="no-hide-descendants"` on the
wrapper around `children`, and `accessibilityViewIsModal` on the overlay. **Neither works
here**: `accessibilityViewIsModal` is iOS-only, and React Navigation's native-stack hosts each
route in a `react-native-screens` container that the ancestor flag does not reach. The
mitigation was present in the code and ineffective on the device — which is why only a device
pass could find it.

**Fix** (`components/app-lock-gate.tsx`) The wrapper now takes `display: "none"` while locked.
That removes the subtree from layout *and* from the accessibility tree, while React keeps it
**mounted** — so the navigator survives and `dismissPresentedRoutes()` still operates on a live
navigator, exactly as the design comment at the top of that file requires.

An earlier attempt that simply did not render `children` also closed the leak, but it broke that
contract (`The action 'POP_TO_TOP' was not handled by any navigator`) and would have dropped the
user's place in the app on every relock. It was discarded in favour of `display: "none"`.

**Verification** Locked dump falls from **146 nodes / 16 sensitive** to **53 nodes / 0
sensitive**, with **zero** `POP_TO_TOP` errors in logcat. Unlocking with the correct PIN
restores the Dashboard normally and the post-unlock audit is clean.
**Regression test** `tests/components/app-lock-gate.test.tsx` — *"takes the covered content out
of the tree with display:none while locked (SP-117)"*.
**Evidence** `sp-117-after-locked-no-data-behind.png`

---

### SP-103 — No brute-force protection on the App Lock PIN

**Severity** Medium · **Priority** P2 · **Type** Security · **Reproducibility** Always

**Steps to Reproduce** With App Lock on and the gate showing, enter a wrong 4-digit PIN
repeatedly.

**Actual Result** **12 consecutive wrong PINs were accepted in 14 seconds** with no lockout, no
back-off delay and no attempt counter — only "Incorrect PIN. Try again." each time. A 4-digit
PIN is 10,000 combinations; at the observed rate an attacker with physical access can exhaust
the entire space in roughly three hours of automated tapping.

**Expected Result** Escalating delay or lockout after a small number of failures.

**Root Cause** `components/app-lock-gate.tsx` calls the **local** `verifyPin()`, a plain string
comparison against SecureStore. The server-side policy — `MAX_PIN_ATTEMPTS`, `PIN_LOCKOUT_MS`,
`pinFailedAttempts`, `pinLockedUntil`, and the `security.verifyPin` procedure that enforces them
— exists and is **never invoked by the gate**.

**Suggested Fix** Track failures locally (SecureStore) with an escalating delay so the guarantee
holds offline, and route verification through `security.verifyPin` when the network is available
so the existing server-side lockout is actually used.

**Evidence** `sp-117-no-lockout-after-12-attempts.png`

**Not fixed** — the local/remote split is a security-design decision, not a QA edit.

---

### SP-104 — The screen behind a `transparentModal` sheet route stays in the accessibility tree

**Severity** Medium · **Priority** P3 · **Type** Accessibility · **Reproducibility** Always

`add-transaction`, `budget-form` and `loan/record-repayment` are declared
`presentation: "transparentModal"` in `app/_layout.tsx` and render a `<Sheet noModal>`. With the
sheet open, the underlying screen's buttons remain in the dump with their `content-desc`
intact, so TalkBack can focus content behind the modal. Visually the sheet is opaque (after
SP-100), so this is an assistive-technology-only defect.

**Suggested Fix** Apply the same `display: "none"` treatment SP-102 used, or set
`importantForAccessibility="no-hide-descendants"` on the route beneath while a sheet is
presented. Now that SP-100 is fixed, it is also worth retesting whether the plain `Modal` path
works on these three routes — the "nested Modal cannot cover elevated views" constraint the
`noModal` escape hatch was built for may itself have been a symptom of SP-100.

---

### SP-105 — Hero gradient and glass blur silently degrade on a real phone

**Severity** Medium · **Priority** P2 · **Type** UX / Design · **Reproducibility** Always

**Actual Result** On this device the Dashboard hero renders as a **flat `#818CF8` fill** rather
than the Aurora indigo → violet → cyan gradient, and `GlassSurface` renders opaque rather than
frosted. `dev/theme-lab` reports **"Active tier: low"**.

**Root Cause** `lib/_core/perf.ts` sets `LOW_TIER_MAX_PIXELS = 1_200_000`. This phone is
720 × 1608 = **1,157,760** physical pixels, just under the band, so `getDeviceTier()` returns
`low` → `shouldDegradeEffects` → `gradientComplexity: "reduced"` → `GradientHero` paints
`colors[0]`. The threshold excludes **every 720p Android phone**, which is a large share of the
Android market, from the app's signature visual.

**Isolation** `GradientHero` and `GlassSurface` are not broken: the theme-lab `GradientHero`
preview tile renders the full gradient when the tier is forced high, and a cold start with
`LOW_TIER_MAX_PIXELS` lowered restores the full gradient *and* the frosted glass on the
Dashboard. The single variable is the threshold.

**Evidence** `sp-108-device-tier.png`, `sp-108-hero-tier-high.png`,
`sp-108-hero-gradient-when-tier-not-low.png`

**Note** The prompt's stated expectation — "on a real phone it should be `full`" — is **not met**
on this device. Whether that is a bug or a deliberate product trade-off is a product call; a
pixel count is a poor proxy for GPU capability, which is the same class of mistake SP-092 fixed
for desktop.

---

### SP-106 — The balance hero wraps mid-number at 200% font

**Severity** Medium · **Priority** P3 · **Type** Accessibility · **Reproducibility** Always

At the OS's largest font setting, verified on a **cold start**, the Dashboard balance renders as
"Rs 0.0" on one line and "0" on the next. Splitting a currency figure across lines is a
correctness problem in a finance app, not just a cosmetic one. `BalanceHero` already passes
`maxFontSizeMultiplier={MAX_FONT_SCALE}`, but `MAX_FONT_SCALE` is `2`, so at exactly 200% the
cap does not bite.

The rest of the Dashboard behaves acceptably at 200%: headings and labels render in full, and
button and tab labels truncate with an ellipsis ("Add Inc…", "Activ…") rather than clipping
glyphs.

**Suggested Fix** Give the hero figure `adjustsFontSizeToFit` with a floor, or lower its
specific cap below 2.

**Evidence** `sp-118-dashboard-clipped-at-200pct.png`

> **Important:** an earlier, far more alarming version of this finding — "text clipped across
> every screen, PIN pad digits unreadable, app unusable" — was **withdrawn**. See W3 and W4
> in §12.

---

### SP-107 — Haptics never fire on Android

**Severity** Medium · **Priority** P3 · **Type** UX · **Reproducibility** Always

With system haptics enabled (`haptic_feedback_enabled = 1`), tapping tab bar items and buttons
produced **no `expo-haptics` vibrator events** in `dumpsys vibrator_manager`.

**Root Cause** Both call sites gate on iOS:
`hooks/use-press-feedback.ts` → `if (… && process.env.EXPO_OS === "ios") Haptics.impactAsync(…)`;
`components/haptic-tab.tsx` → the same guard. Additionally, **no success or error haptics exist
anywhere in the codebase** — there is not one `Haptics.notificationAsync` or
`NotificationFeedbackType` reference on any platform.

The QA prompt lists "haptics on press, save success and error" as in scope; none of the three
works on Android and the latter two are unimplemented everywhere. The iOS guard is Expo's
default template code rather than an evidently deliberate product decision, so this needs a
product call rather than a silent fix.

---

### SP-108 … SP-113 — Touch targets below 44 dp

**Severity** Low · **Type** Accessibility · **Reproducibility** Always

Measured in dp on the device, all comfortably outside the 1 px rounding tolerance:

| ID | Element | Measured | Where |
|----|---------|----------|-------|
| SP-108 | Every `TextInput` in the app | 41.6 – 42.7 dp tall | Search, add/edit account, add/edit card, new loan, add/edit category, transaction edit, budget amount, recurring amount, all date fields |
| SP-109 | Colour swatch buttons | 42.1 × 42.1 dp | Add/edit category, add/edit card |
| SP-110 | "All" filter chip | 42.7 dp wide | Activity |
| SP-111 | App Lock switch | 46.9 × 27.2 dp | Security |
| SP-112 | Account radio row | 41.1 dp tall | Transaction detail |
| SP-113 | Tier-override buttons | 33.6 dp tall | dev/theme-lab (dev-only) |

**SP-108 has a single root cause worth naming:** there is **no shared `Input` primitive**. Every
field is styled inline with a different padding utility — `py-md`, `py-3`, `py-3.5` — and none
sets a minimum height, so all ~20 land just under 44 dp and are inconsistent with each other.
One shared class constant or a small `Input` wrapper fixes the whole set and the inconsistency
at the same time.

Not fixed here: touching ~20 form files at the end of a QA pass is a change that deserves its
own review.

---

### SP-114 — The Toast covers the screen header

**Severity** Low · **Priority** P3 · **Type** UI · **Reproducibility** Always

`components/ui/ToastProvider.tsx` positions the toast overlay at `top: insets.top + Spacing.sm`,
which is exactly where every `ScreenHeader` sits. Measured on Budgets: toast
`[20,88]–[700,192]` completely covering the back button at `[30,102]–[113,185]`, with the screen
title hidden for the toast's full 3.5 s.

**Evidence** `sp-114-toast-covers-back-button.png`

> A stronger claim — that the covered back button was also **untappable** — was investigated and
> **withdrawn**; the failed taps were caused by the sheet-dismiss backdrop, not the toast. See
> W5 in §12. Only the visual occlusion is established.

**Suggested Fix** Offset the overlay below the header, or move toasts to the bottom. Both are
design decisions about global chrome, which is why no fix was attempted.

---

### SP-115 — Two different destructive-confirm UIs ship side by side

**Severity** Low · **Priority** P3 · **Type** UI consistency

- Categories, Accounts and Settings' clear-all use the app's own themed `ConfirmSheet` — opaque
  panel, dimmed backdrop, red Delete.
- Transaction detail, loan detail, the transactions list, budget form and the App Lock gate use
  `confirmDestructive()` → `Alert.alert`, which on Android renders the OS dialog with the
  platform's teal accent and **no visual weight on the destructive action** —
  `style: "destructive"` is iOS-only, so CANCEL and DELETE look identical.

The native date picker shows the same platform accent. Both `Alert.alert` and the date picker
were verified working end-to-end on the device (delete removed the row from the database;
picking a date updated the field), which closes SP-D14's `[Untested: dialog interaction]` gap.

**Evidence** `sp-alert-native-transaction-delete.png`, `ov-datepicker.png`,
`sp-alert-category-delete-confirm.png`

---

### SP-116 — Deep-link / navigator configuration warning

**Severity** Low · **Priority** P3 · **Type** Functional

Logcat records, repeatedly:

```
'Looks like you have configured linking in multiple places. This is likely an error since
deep links should only be handled in one place to avoid conflicts…'
```

`android:launchMode="singleTask"` *is* set in the manifest, so the likely cause is a second
`linking`-enabled navigation container. Symptomatically, deep-link navigation became unreliable
partway through the session — `manusexpensetrackerapp://security` landed on the Dashboard
several times in a row and had to be reached through the UI instead. Not proven to be the same
cause, but they are consistent.

---

### SP-117 — Device-tier override does not re-render mounted surfaces (dev-only)

**Severity** Low · **Priority** P4 · **Type** Dev tooling

Forcing tier `high` in `dev/theme-lab` (confirmed by its own "Active tier: high" readout) left
the Dashboard hero on the solid fallback. Only a cold start with a changed threshold restored the
gradient. `useGlassCapability` discards the `useSyncExternalStore` return value, so with the
React Compiler enabled `degrade` is memoised on `[reducedMotion]` alone and never recomputes.
Cosmetically, the selected tier chip also resets to `auto` on remount while the module-global
override persists.

Dev-only, but it makes the 12.11 fallback toggle untrustworthy for exactly the testing it exists
for.

---

### SP-118 — `SafeAreaView` deprecation warning at rest

**Severity** Low · **Priority** P4 · **Type** Maintenance

`W/ReactNativeJS: SafeAreaView has been deprecated and will be removed in a future release.`
No application file imports the deprecated component — `components/screen-container.tsx`
explicitly documents avoiding it — so this comes from a dependency. It surfaces a LogBox toast
over the tab bar on every dev build, which is noise for anyone testing the app.

---

## 7. Coverage Matrix

✅ Pass · ❌ Fail (bug id) · ⛔ Blocked · ⬜ Untested

| Feature | Functional | Negative | Boundary | UI | Themes×Schemes | A11y | Native |
|---------|-----------|----------|----------|----|----------------|------|--------|
| Dashboard | ✅ | ⬜ | ⬜ | ✅ | ✅ | ❌ SP-106 | ✅ |
| Activity (Transactions) | ✅ | ⬜ | ⬜ | ✅ | ✅ | ❌ SP-108/110 | ✅ |
| Insights (Summary) | ✅ | ⬜ | ⬜ | ✅ | ✅ | ✅ | ✅ |
| Loans | ✅ | ⬜ | ⬜ | ✅ | ✅ | ❌ SP-108 | ✅ |
| Cards | ✅ | ⬜ | ⬜ | ✅ | ✅ | ❌ SP-108/109 | ✅ |
| Categories CRUD | ✅ | ✅ | ⬜ | ✅ | ⬜ | ❌ SP-108/109 | ✅ |
| Accounts CRUD | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ❌ SP-108 | ✅ |
| Budgets CRUD | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ✅ | ✅ |
| Recurring CRUD | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ❌ SP-108 | ✅ |
| Add Transaction | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ❌ SP-108 | ✅ |
| Transaction detail / edit | ✅ | ⬜ | ⬜ | ✅ | ⬜ | ❌ SP-108/112 | ✅ |
| Settings | ✅ | n/a | n/a | ✅ | ✅ | ✅ | ✅ |
| Sheets & overlays (18) | ✅ | ⬜ | ⬜ | ❌ SP-100 | ⬜ | ❌ SP-104 | ❌ SP-101 |
| Toast (success + error) | ✅ | ✅ | n/a | ❌ SP-114 | ⬜ | ✅ | ✅ |
| App Lock | ✅ | ✅ | ❌ SP-103 | ✅ | ⬜ | ❌ SP-102 | ✅ |
| Destructive confirms | ✅ | ✅ | n/a | ❌ SP-115 | ⬜ | ✅ | ✅ |
| Import CSV | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ✅ | ⬜ |
| Export CSV / JSON | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ✅ | ⬜ |
| Login / OAuth | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Notifications | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |

---

## 8. Passed Scenarios

**Regression checks named in the prompt — all pass:**

| Check | Result |
|-------|--------|
| `Button` renders its icon beside the label, not stacked | ✅ Budgets button, Expense/Income chips |
| Sheet-footer buttons split the row evenly (`flex-1`) | ✅ Cancel/Save on every sheet |
| `TransactionRow` on one line, ~56–68 dp tall | ✅ measured 67.2 – 68.3 dp across 5 rows |
| Card type chips ≥ 44 dp | ✅ 170.1 × 43.7 dp, 171.2 × 43.7 dp |
| Loan direction chips ≥ 44 dp | ✅ 170.1 × 44.3 dp, 171.2 × 44.3 dp |
| Loan periodicity chips ≥ 44 dp | ✅ 62.9 – 80.0 × 43.7 dp |
| Add Transaction labels not clipped | ✅ "Transaction Type" renders in full |
| Recurring Frequency/Ends chips align with other controls | ✅ chips at x = 16 dp, same as labels and fields |
| Account delete completes | ✅ created and deleted "QA Throwaway"; gone from UI and database |
| Recurring loads and creates | ✅ rule persisted (id 1, monthly, Rs 55.00) |
| Budgets load and create | ✅ budget persisted (id 1, monthly, Rs 300.00) |

**Other verified passes:**

- Filter pills expose `RadioButton` + `checkable=true` + `checked=true` on the selected pill —
  the native equivalent of SP-080 holds.
- Hardware back closes only the open sheet and stays on the screen beneath.
- Screen layout fully restores after a keyboard open/close cycle — zero node movement across
  124 nodes.
- Pull-to-refresh picks up out-of-band data changes.
- App Lock: PIN survives a force-stop cold start (`expo-secure-store`); confirm-mismatch is
  caught ("PINs didn't match"); wrong PIN is rejected; lock re-arms on background; correct PIN
  unlocks; the biometric preference persists; **Forgot PIN** signs out, clears the PIN, and dev
  auto-login returns the user to the Dashboard; disabling App Lock correctly requires the
  current PIN.
- When the PIN could not sync to the account, the app degraded gracefully — "PIN saved on this
  device, but couldn't sync to your account" — and kept the lock working locally.
- `Alert.alert` destructive confirm deletes the record and it is gone from the database.
- The native date picker opens, applies the chosen date, and cancels cleanly.
- Rotation: the activity stays `port` / `ROTATION_0`, matching the declared portrait lock.
- All three themes × both colour schemes render correctly; semantic income-green /
  expense-red is preserved in every combination.
- Money is always signed as well as coloured (`+Rs 500.00`, `-Rs 25.50`), and `-0` is
  normalised — SP-D15 holds.
- No JS errors in logcat at rest after the fixes.

---

## 9. Accessibility Observations

**Good:** `content-desc` coverage is genuinely thorough — every transaction row carries a
composed label ("Salary, income, +Rs 500.00, July 2"), icon-only buttons are labelled,
decorative icons are hidden from the tree, filter pills announce as radios with correct checked
state, and toasts use `accessibilityLiveRegion`.

**Gaps:** the six sub-44 dp target findings (SP-108 – SP-113); the two accessibility-tree leaks
(SP-102, now fixed, and SP-104, open); and the balance hero wrapping at 200% font (SP-106).

**TalkBack** was **not** run as a screen reader. Focus order, announcement quality and gesture
navigation are therefore **[Untested]**. What is reported here comes from inspecting the
accessibility tree that TalkBack consumes, which is a strong but not complete proxy — it
establishes that data *is* exposed (SP-102) but not how it *sounds*.

---

## 10. Performance Observations

- FPS overlay in `dev/theme-lab` read **52–57** while scrolling a deliberately heavy dev screen,
  against a 60 target. Acceptable, not measured on production screens.
- Cold start was not measured against the 3 s `COLD_START_BUDGET_MS` — a debug build loading a
  Metro bundle over Wi-Fi is not representative and the number would have been misleading.
- Device classified `low` tier, which is the subject of SP-105.

---

## 11. Security Observations

- **SP-102** (fixed) and **SP-103** (open) are the substantive findings.
- The PIN is stored via `expo-secure-store` (Android Keystore-backed), and the server stores a
  separate `pinHash`. Local verification is a plain string comparison against the stored PIN
  rather than a hash; given Keystore encryption at rest this is a hardening opportunity rather
  than a defect, and it is what makes SP-103 possible.
- Disabling App Lock correctly requires the current PIN.
- Forgot PIN is a deliberate, confirmed sign-out, and the code takes care to clear the
  account-linked PIN before dropping the session.
- No credentials, tokens or PINs appear in this report or its evidence.

---

## 12. What I Did NOT Test, and Why

**Blocked or out of reach**

| Area | Reason |
|------|--------|
| **Notifications** (scheduling, delivery, deep-link on tap) | Not implemented yet. `docs/epics.md` marks **FR-19 as 🔲 planned** and **AR-5** records "`expo-notifications` not wired". Confirmed on device: `POST_NOTIFICATIONS granted=false`, notification importance `NONE`, zero scheduled alarms; `requestNotificationPermissions()` has no callers outside tests, and `remindersEnabled` has no UI or mutation to turn it on. The library code and `lib/notification-routing.ts` exist ahead of the wiring. **Not filed as a defect.** |
| **Login / OAuth / `/oauth/callback`** | Dev auto-login is the only path in this environment; no OAuth issuer was available. The three login-related routes are untested. |
| **`/` redirector** | Only exercised implicitly by cold starts. |
| **Biometric authentication** | The Face-unlock *toggle* and its persistence were verified; the actual OS biometric prompt cannot be satisfied by automation — no face to present. |
| **TalkBack as a screen reader** | Accessibility tree inspected; focus order, announcement text and gesture navigation not exercised. |
| **Split-screen** | Not attempted. |
| **Landscape layout** | The app declares and enforces portrait; there is no landscape layout to test. |
| **Import CSV / Export CSV / Export JSON end-to-end** | Overlays opened and audited; no file was actually imported or exported (needs the system document picker and a prepared file). |
| **Cold-start timing vs NFR-2** | A debug build over Metro is not representative; a measurement would have been misleading. |
| **Negative and boundary testing on most forms** | Only category and account creation were tested negatively. Amount bounds, long strings, special characters and duplicate names were **not** exercised — SP-D18's bounds are covered by unit tests, not by this pass. |
| **Slow-network and offline behaviour** | Not simulated. |

**Harness limitations that bound these results**

- uiautomator reports node bounds, not glyph bounds, so text overflowing *inside* a correctly
  sized node is invisible to the measurement script. All typography findings rest on
  screenshots.
- Changing `font_scale` on a running app leaves React Native with stale text layout. **Only
  cold-start captures are valid at non-default font scales** — this invalidated two findings
  (W3, W4) before they reached this report.
- The device had system haptics disabled initially (`haptic_feedback_enabled = 0`); it was
  enabled before the haptics conclusion was drawn.

### Withdrawn candidate findings

Seven candidates were investigated and **not** filed. Each is listed with what disproved it.

| # | Candidate | Why withdrawn |
|---|-----------|---------------|
| **W1** | "Sheet overlaps the screen behind on add-transaction / budget-form / record-repayment" | Once SP-100 was fixed the panel is opaque; the overlap is accessibility-tree-only. Re-filed accurately as **SP-104**. |
| **W2** | "theme-lab tier override never applies" | Partly disproved — the override *does* apply to the panel's own readout; only already-mounted surfaces miss it. Re-filed accurately as **SP-117**. |
| **W3** | "Text is clipped across every screen at 200% font — titles, amounts, button and tab labels all cut off" | Artifact. The captures were taken after changing `font_scale` on a **running** app. On a cold start the Dashboard renders headings in full and truncates button/tab labels gracefully with an ellipsis. Only the hero's mid-number wrap survived, as **SP-106**. |
| **W4** | "PIN pad digits unreadable at 200% font — app cannot be unlocked" | Same artifact. On a cold start at 200% every digit is fully legible. A `maxFontSizeMultiplier` cap had already been written for this and was **reverted** — it was fixing a bug that does not exist. |
| **W5** | "The Toast blocks the back button underneath it" | Confounded. The failed taps happened while the sheet-dismiss **backdrop** was still animating out and swallowing touches; the "control" test that appeared to prove it simply waited long enough for that backdrop to go. A `pointerEvents="box-none"` change was written and **reverted**. Only the visual occlusion (**SP-114**) is established. |
| **W6** | "`security.setPin` fails — `Unknown column 'pinHash'`" | My environment. The local MySQL was behind on migrations; `drizzle/0010_add_pin_sync_to_users.sql` exists in the repo. Resolved with `npx drizzle-kit migrate`. |
| **W7** | "Loan reminder notifications never fire" | Real behaviour, but **not a defect** — `docs/epics.md` records FR-19 as planned and AR-5 as unwired. Moved to the blocked table above. |

Five of the seven were artifacts of my own harness. They are documented at this length because
the alternative — a report that quietly drops its false starts — would leave the reader unable
to judge how much to trust the rest.

---

## 13. Risk Areas

1. **Reanimated + NativeWind interop.** SP-100 is the second instance of the same failure mode
   (SP-D02 was the first) and it stayed hidden for a whole release cycle because it is invisible
   on web. Any future `cssInterop` registration over a Reanimated wrapper should be treated as
   suspect, and sheets should be spot-checked on a device after any NativeWind or Reanimated
   upgrade.
2. **Anything that only exists on native.** The keyboard inset (SP-101), the accessibility tree
   behind the lock screen (SP-102) and the PIN gate (SP-103) were all invisible to the web
   suite. Edge-to-edge in particular changes long-standing Android assumptions.
3. **Dynamic Type.** The type scale pairs every `fontSize` with a fixed `lineHeight` (directly
   in seven places, and through Tailwind's `text-*` utilities everywhere else). The Dashboard
   survives 200% better than expected, but this has not been checked screen by screen on a cold
   start and is the most likely place for further clipping.
4. **Low-tier degradation.** SP-105 means a large slice of the Android market never sees the
   design the app was built around, and nobody testing on a flagship would notice.

---

## 14. Recommendations

**Before release**
1. Decide on SP-103 (PIN brute force) — the fix is small and the exposure is real.
2. Decide on SP-105 (tier threshold) — either raise the band, replace the pixel-count heuristic
   with a real capability signal, or accept it explicitly and record the decision.

**Soon**
3. Introduce a shared `Input` primitive with a 44 dp minimum height. It closes SP-108, removes
   the `py-md`/`py-3`/`py-3.5` inconsistency across ~20 fields, and gives future fields one
   place to inherit from.
4. Close SP-104 with the same `display: "none"` technique that fixed SP-102, and retest whether
   the plain `Modal` path now works on the three `transparentModal` routes — the constraint that
   forced `noModal` may have been an SP-100 symptom.
5. Pick one destructive-confirm UI (SP-115). Two is a visible inconsistency, and the Android
   `Alert.alert` variant gives a destructive action no visual weight at all.
6. Resolve the duplicate `linking` configuration (SP-116); unreliable deep links also make
   automated testing markedly harder.

**Testing practice**
7. Add a device smoke test that opens one sheet and asserts an opaque panel. SP-100 would have
   been caught on the first run.
8. When testing font scaling, always cold-start after changing the setting. This pass produced
   two false findings by not doing so.
9. Follow the prompt's in-memory database next time; the real database cost one false alarm and
   makes counts non-reproducible.

---

## 15. Final Assessment

| | Count |
|---|---|
| Findings filed | **19** (SP-100 … SP-118) |
| Critical | 1 — fixed |
| High | 2 — both fixed |
| Medium | 5 — open |
| Low | 11 — open |
| Fixed and re-verified on device | **3** |
| Candidates investigated and withdrawn | **7** |
| Routes exercised | 19 of 22 |
| Overlays exercised | 18 of 20 |
| Theme × scheme combinations | 6 of 6 |

**Quality ratings**

| Dimension | Rating | Note |
|-----------|--------|------|
| Functional correctness | **Good** | Every CRUD flow tested persisted correctly to the database |
| Visual design | **Good** (was Unusable) | After SP-100; all three themes are coherent in both schemes |
| Forms & input | **Fair** | SP-101 fixed; targets and the missing shared primitive remain |
| Navigation | **Good** | Hardware back correct everywhere; SP-116 is the exception |
| Accessibility | **Fair** | Strong labelling; six target-size gaps and one open tree leak |
| Security | **Fair** | SP-102 fixed; SP-103 open |
| Performance | **Good** | 52–57 fps on a deliberately heavy screen |

**Test suite after fixes:** `pnpm test` **1,617 passed / 1 skipped** (was 1,616 — one regression
test added), `npx tsc --noEmit` **0 errors**, `npx eslint .` **0 errors** (78 pre-existing
warnings, unchanged).

### Release decision

> **Passed with Minor Issues.** No Critical or High defect remains open. SP-103 and SP-105 should
> get an explicit decision before a production release; the remaining Low items are safe to
> schedule.

---

## Appendix A — Evidence

All files in `docs/qa-evidence/`.

| File | Shows |
|------|-------|
| `sp-100-before-sheet-transparent.png` | Currency sheet transparent over Settings |
| `sp-100-before-addaccount-unpadded.png` | Add-account sheet unpadded, screen behind visible |
| `sp-100-after-sheet-opaque.png` | Same sheet opaque, padded, rounded, dimmed backdrop |
| `sp-100-after-addaccount-padded.png` | Add-account sheet correct |
| `sp-101-before-keyboard-covers-sheet.png` | Keyboard covering the whole Add-account form |
| `sp-101-after-keyboard-avoids.png` | Whole form, Cancel and Save above the keyboard |
| `sp-101-after-addtransaction.png` | Add Transaction lifted above the keyboard |
| `sp-101-save-reachable-with-keyboard.png` | Save tapped with the keyboard up |
| `applock-gate-cold-start.png` | Lock screen after force-stop (PIN persisted) |
| `sp-117-after-locked-no-data-behind.png` | Locked gate after the SP-102 fix |
| `sp-117-no-lockout-after-12-attempts.png` | SP-103 — no lockout after 12 wrong PINs |
| `applock-pin-mismatch.png` | "PINs didn't match" |
| `applock-enabled.png` | App Lock on; PIN-sync failure toast (error toast case) |
| `applock-biometric-toggle.png` | Face-unlock toggle enabled |
| `applock-forgot-pin-confirm.png` / `applock-after-forgot-pin.png` | Forgot PIN flow |
| `applock-lockout.png` | Repeated wrong-PIN attempts |
| `sp-108-device-tier.png` | theme-lab reporting "Active tier: low" |
| `sp-108-hero-tier-high.png` | Hero still flat with the tier forced high |
| `sp-108-hero-gradient-when-tier-not-low.png` | Full gradient and frosted glass with the threshold lowered |
| `sp-118-dashboard-clipped-at-200pct.png` | SP-106 — hero wrapping mid-number at 200% (cold start) |
| `sp-114-toast-covers-back-button.png` | Toast over the screen header |
| `sp-alert-native-transaction-delete.png` | Native `Alert.alert` destructive confirm |
| `sp-alert-category-delete-confirm.png` / `sp-alert-account-delete-confirm.png` | Themed ConfirmSheet variants |
| `ov-datepicker.png` | Native date picker (closes SP-D14's untested gap) |
| `ov-recurring-add.png` | Recurring sheet, chip alignment check |
| `ov-firstday.png` | First-day-of-week picker |
| `budget-created.png` / `recurring-created.png` | Success toast and created records |
| `theme-obsidian-dark-dashboard.png`, `theme-obsidian-light-dashboard.png`, `theme-spectrum-dark-dashboard.png`, `theme-aurora-dark-insights.png` | Theme × scheme matrix |

Filenames retain the `sp-117`/`sp-118`/`sp-108` prefixes from capture time; the mapping to the
final issue IDs is given in the table above.

## Appendix B — Traceability

- `docs/qa-evidence/qa-android-2026-08-15-bugs.csv`
- `docs/qa-evidence/qa-android-2026-08-15-testcases.csv`

Every Fail links to a bug ID; every bug links back to the test case that found it.
