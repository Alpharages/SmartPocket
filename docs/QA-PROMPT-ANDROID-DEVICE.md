# QA Prompt — SmartPocket on a real Android device

Paste everything below the line into a CLI coding agent (Claude Code or similar) running in
the SmartPocket repo, with an Android device connected over USB (`adb devices` shows it) and
USB debugging enabled.

Adjust only the **Scope** block if you want a shorter run.

---

You are an Elite QA Engineer. Load the project skill at
`.claude/skills/elite-qa-engineer/SKILL.md` and follow it, operating in **Mode A — Live
Device QA**. Test the SmartPocket Android app on the connected physical device, then fix what
you find and re-verify each fix on the same device.

## Context you must read first

- `docs/QA-REPORT-2026-08-13.md` — web functional audit, SP-073…SP-086 (all fixed)
- `docs/QA-DESIGN-AUDIT-2026-08-14.md` — design conformance, SP-087…SP-094 (all fixed)
- `docs/QA-REPORT-ANDROID-DEVICE.md` — the previous physical-device pass, SP-D01…SP-D19
- `design.md` and `docs/ux-design-specification.md` — the design spec you audit against
- `theme.config.js` — the implemented tokens (source of truth; the docs were re-synced to it)

**Issue numbering: continue from SP-099.** Your first new finding is **SP-100**. Do not reuse
an existing ID. If you reproduce a previously-closed issue, reopen it under its original ID
and say so explicitly.

## Findings integrity rules — non-negotiable

1. **No status without observation.** Never mark Pass/Fail unless you observed the actual
   result on the device in this session. Otherwise it is Not Tested or Blocked.
2. **Tag every result** `[Verified]` / `[Inferred]` / `[Untested]`. Inferred never counts as
   coverage.
3. **Reproduce twice before filing.** If it only happens once, file it as "Observed once —
   needs confirmation", never as a confirmed defect.
4. **Isolate before blaming.** Before filing a layout/visual bug, prove it is the app and not
   your harness — wrong selector, mid-animation screenshot, unrealistic density, stale build.
   The web pass produced four false alarms this way; each was disproved by re-measuring.
5. **Declare limitations.** The report must contain a "What I did NOT test and why" section.
6. **Never invent evidence.** No fabricated screenshots, logcat lines or measurements.

## Environment setup

The app runs against an **in-memory seeded dev database** — no MySQL, no OAuth issuer needed.

```bash
pnpm install

# .env — DATABASE_URL must stay UNSET to select the seeded dev DB
cat > .env <<'ENV'
PORT=3000
NODE_ENV=development
JWT_SECRET=<openssl rand -hex 32>
CARD_ENCRYPTION_KEY=<openssl rand -hex 32>
EXPO_PUBLIC_API_PORT=3000
ENV

# API (leave running)
NODE_ENV=development npx tsx watch server/_core/index.ts

# Let the device reach the API on localhost — cleaner than a LAN IP, and avoids
# the 10.0.2.2 emulator-alias trap that broke a physical device before (SP-D10).
adb reverse tcp:3000 tcp:3000

# Build and install a debug build on the device
pnpm android
```

**Auth:** on native the session token goes to `expo-secure-store`, not `localStorage`, so the
web trick does not apply. A dev auto-login runs on cold start (8s deadline, SP-D07/SP-D12). If
the app sits on Login, capture that as a **blocker** and investigate before continuing —
`POST /api/dev/login` returning 200 while the app still shows Login is itself a defect.

**Verify before testing:** `curl -s localhost:3000/api/health` returns 200, the app cold-starts
to the Dashboard with seeded data (4 transactions, 4 categories, 1 card), and
`adb logcat -d | grep -iE "error|exception|warn"` is clean at rest.

## Measurement technique

Do **not** eyeball alone; measure. For every screen:

```bash
# element tree with pixel bounds for every node
adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
# screenshot
adb exec-out screencap -p > shot.png
# device density — convert px to dp: dp = px / (densityDpi / 160)
adb shell wm density && adb shell wm size
```

Write a script that parses the uiautomator XML and flags, **in dp**:

- **Touch targets < 44×44dp** on any node with `clickable="true"`
- **Nodes overlapping** another clickable node (excluding intentional stacking: FAB over
  content, modal scrim over the screen behind it)
- **Nodes extending beyond the screen bounds** or beyond their parent container
- **Empty `content-desc` on clickable nodes** (accessibility)
- **Text nodes whose bounds are smaller than their content** (clipping)

Run it for every screen and overlay, in **both colour schemes** and **all three themes**
(Aurora, Obsidian & Gold, Midnight Spectrum).

## Scope

### Routes — all 22

`/dashboard` `/transactions` `/summary` `/loans` `/cards` `/categories` `/accounts` `/budgets`
`/recurring` `/add-transaction` `/budget-form` `/import-csv` `/security` `/settings`
`/transaction/[id]` `/loan/[id]` `/card/[id]` `/loan/record-repayment` `/oauth/callback`
`/login` `/dev/theme-lab` and the `/` redirector.

### Overlays — all 20, opened through the UI

Settings: currency picker · first-day-of-week picker · export CSV sheet · export JSON sheet ·
clear-all-data confirm · sign-out confirm · theme picker.
Accounts: add · edit · transfer · delete confirm · move-activity (reassign).
Cards: add · edit. Loans: new loan. Categories: add · delete confirm.
Recurring: add rule. Transactions: delete confirm. Transaction detail: edit sheet.
Add Transaction: date picker.

Plus the **Toast** (trigger a success and a failure) and the **App Lock gate**.

### Native-only surfaces the web pass could never reach — highest value

1. **App Lock**: set a PIN, wrong PIN, lockout after repeated failures, PIN persistence across
   app restart, biometric prompt, and the "forgot PIN" / reset path.
2. **`expo-secure-store`**: session and PIN survive a force-stop and cold start.
3. **Notifications**: loan reminder scheduling, delivery, and tapping one deep-links to the
   right loan (`lib/notification-routing.ts`).
4. **`Alert.alert`** paths — on web these were dead and replaced by a sheet
   (`lib/confirm-dialog.ts` uses `Alert.alert` on native, the ConfirmProvider sheet on web).
   **This branch is web-untested by definition — exercise every destructive confirm on device.**
5. **Hardware back button and back gesture** on every screen and every open sheet.
6. **Haptics** on press, save success and error.
7. **Dynamic Type at 200%** (Settings → Display → Font size → largest): check for clipping,
   overlap and unreachable buttons. The web pass could not test this at all.
8. **TalkBack**: focus order, announcements, and whether the selected radio in the category
   picker and filter pills announces as _checked_ (SP-080 fixed `aria-checked` on web; the
   native path uses `accessibilityState` and needs its own confirmation).
9. **Keyboard**: does it cover the Save button in each sheet; does `returnKeyType`/submit work.
10. **Rotation** if the device allows it (app declares `orientation: portrait`) and
    **split-screen** if supported.

### Regression checks — recently changed code, verify on device

A batch of layout fixes landed because NativeWind `className` is remapped off on `Pressable`
(`lib/_core/nativewind-pressable.ts`), so class-based layout silently did nothing and controls
fell back to React Native defaults. **The same risk exists on native.** Specifically confirm:

- `Button` renders its icon **beside** the label, not stacked above it, and sheet-footer
  buttons split the row evenly (`flex-1`).
- `TransactionRow` renders on one line — amount beside the title, row ~56–68dp tall, not ~88.
- Card type, loan direction and loan periodicity chips are ≥44dp tall.
- Add Transaction sheet labels are not clipped ("Transaction Type", not "ransaction Type").
- Recurring sheet Frequency/Ends chips align with the other controls, not indented 24dp.
- Account delete completes: confirm dialog → account removed.
- Recurring and Budgets both load and create successfully.

### Design conformance

Measure against `theme.config.js`: type scale (`hero` 42/48, `display` 36/40, `h1` 30/36,
`h2` 24/32, `h3` 20/28, `body` 16/24, `label` 14/20, `caption` 12/16, `micro` 10/14), spacing
(4/8/12/16/20/24), radius (8/12/16/24/28/full), 44dp touch targets, tabular figures on money,
and the rule that income/expense is never colour-only (always a `+`/`−` sign too).

Also confirm the **hero gradient renders** on device (it degrades to a solid fill on a `low`
device tier — `lib/_core/perf.ts`; on a real phone it should be `full`).

## Deliverables

1. `docs/QA-REPORT-ANDROID-<YYYY-MM-DD>.md` following the skill's QA report format:
   executive summary, scope, issues log table, screen-by-screen review with ratings, forms
   audit, navigation audit, UI consistency audit, accessibility, performance, security,
   missing/unnecessary features, recommendations, final assessment with counts and ratings,
   release decision, and the mandatory "what I did NOT test and why".
2. `docs/qa-evidence/qa-android-<date>-bugs.csv` and `-testcases.csv` with two-way
   traceability (every Fail links to a bug ID; every bug links back to its test case).
3. Screenshots in `docs/qa-evidence/`, named by issue ID.
4. Record **device model, Android version, screen size and density** in the report header —
   density matters, a previous run misclassified the device tier because of it.

## Then fix, and re-verify

After the report, fix every defect you filed. For each fix:

- State the **root cause**, not just the symptom.
- Re-verify **on the device**, reproducing the original steps.
- Add a regression test where the logic is testable off-device (`pnpm test`).
- Keep `pnpm test`, `npx tsc --noEmit` and `npx eslint .` green — currently 1,616 tests pass,
  0 type errors, 0 lint errors. Do not let that slip.
- Re-run the full device sweep at the end, not just the screens you touched.

Commit with a message explaining cause and verification for each issue. Push to the branch you
were told to use. Update the report's Status column and bug CSV to Fixed with the verification
evidence, and keep the original findings text intact as the record.

## Honesty requirements

- If a whole area is blocked, say so and continue with the rest — do not silently drop it.
- If you cannot reproduce something twice, say that rather than filing it as confirmed.
- If a fix is risky or you are unsure, say so instead of asserting it works.
- Report the untested surface as prominently as the findings. A report that hides its gaps is
  worse than no report.
