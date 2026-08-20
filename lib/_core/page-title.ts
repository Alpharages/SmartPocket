/**
 * Web document titles (SP-079).
 *
 * Every route rendered an empty `<title>`, so browser tabs, bookmarks and
 * history entries were all unlabelled and a screen reader announcing the page
 * had nothing to read. The tab screens already set React Navigation `title`
 * options, but those never reached `document.title` under Expo Router here, so
 * the mapping is explicit and unit-testable instead of implicit.
 *
 * Native platforms have no document title; `useDocumentTitle` is a no-op there.
 */

/** Route pathname (no query/hash) -> human screen name. */
const TITLES: Record<string, string> = {
  "/": "SmartPocket",
  "/dashboard": "Home",
  "/transactions": "Activity",
  "/summary": "Insights",
  "/loans": "Loans",
  "/cards": "Cards",
  "/categories": "Categories",
  "/accounts": "Accounts",
  "/budgets": "Budgets",
  "/budget-form": "Budget",
  "/add-transaction": "Add Transaction",
  "/recurring": "Recurring",
  "/import-csv": "Import CSV",
  "/security": "Security",
  "/settings": "Settings",
  "/login": "Sign in",
  "/signup": "Create account",
  "/loan/record-repayment": "Record Repayment",
  "/dev/theme-lab": "Theme Lab",
};

/** Dynamic segments, matched after the exact table misses. */
const PATTERNS: [RegExp, string][] = [
  [/^\/transaction\/[^/]+$/, "Transaction"],
  [/^\/loan\/[^/]+$/, "Loan"],
  [/^\/card\/[^/]+$/, "Card"],
];

/**
 * Builds the document title for a pathname. The app name always appears, so a
 * user scanning a row of tabs can tell which one is SmartPocket, and the
 * screen name leads so it survives truncation in a narrow tab.
 */
export function getPageTitle(pathname: string, appName: string): string {
  const path = (pathname || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const screen =
    TITLES[path] ?? PATTERNS.find(([re]) => re.test(path))?.[1] ?? null;

  if (!screen) return appName;
  return screen === appName ? appName : `${screen} · ${appName}`;
}
