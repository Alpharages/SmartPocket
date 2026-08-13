# ClickUp Bug Tracking (Opt-In Only)

## The Golden Rule

**Never create, update, or delete anything in ClickUp without the user's explicit "yes" in this conversation.**

- Having ClickUp connected is NOT permission. Connection ≠ consent.
- "Being helpful" is NOT permission.
- A previous session's permission does NOT carry over — ask again in each new session.
- If the answer is ambiguous ("maybe", "hmm", "later", silence, or a topic change), treat it as no. Do not ask a second time in the same session.

## When to Ask

Ask exactly once, **after** delivering the QA report:

> "Would you like me to log these bugs in ClickUp as tasks? I found N confirmed bugs (X Critical, Y High, Z Medium/Low)."

Do not ask before or during testing. Do not file bugs incrementally while testing.

## If the User Says Yes

### Step 1 — Confirm the destination before creating anything

Before creating any task, confirm with the user:

- **Which List** the bugs should go into. Use the workspace hierarchy to show them their spaces/folders/lists and let them pick, or ask if they have a dedicated Bugs/QA list. If they name a list, verify it exists first.
- **Which bugs to file** — all confirmed bugs, or only Critical/High? (Suggest all confirmed bugs by default; "Observed once — needs confirmation" items are excluded unless the user asks for them.)
- **Assignee** — leave unassigned unless the user names someone.

Do not create a new list, folder, or space unless the user explicitly asks for one.

### Step 2 — Task format

Create one task per bug:

- **Task name**: `[BUG-001][High] Login form accepts empty password`  → format: `[Bug ID][Severity] One-line title`
- **Description** (markdown): the full bug report — module/page, bug type, severity, priority, environment, preconditions, steps to reproduce, test data, actual result, expected result, reproducibility, evidence notes, suggested fix, and the linked test case ID (e.g., "Found by TC-017").
- **Priority mapping** (QA priority → ClickUp priority):
  - P1 → Urgent
  - P2 → High
  - P3 → Normal
  - P4 → Low
- **Tags**: add `qa-bug` plus the bug type as a tag (e.g., `functional`, `ui`, `validation`) if tags are available on the list.

### Step 3 — Report back

After creating the tasks, give the user a summary table: Bug ID → ClickUp task name → link/ID. If any task creation failed, say so explicitly — never claim a task was created when it wasn't.

## Regression Mode (Mode D) with ClickUp

If the user says yes to ClickUp during a regression run:

- For **reopened** bugs that already exist as ClickUp tasks (user provides the task IDs or asks you to search), add a comment with the retest result rather than creating a duplicate task — but only after confirming with the user.
- For **newly found** bugs, follow the normal flow above.
- Never change task statuses (e.g., closing a task) unless the user explicitly asks for that specific change.

## What Never to Do in ClickUp

- Never delete tasks.
- Never bulk-modify existing tasks.
- Never file "Inferred" or unconfirmed findings as bugs.
- Never put credentials, tokens, or sensitive personal data into task descriptions.
- Never file the same bug twice — check the bugs you created this session before creating.
