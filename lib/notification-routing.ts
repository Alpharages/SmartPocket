import type * as Notifications from "expo-notifications";
import type { Id } from "@/drizzle/schema";
import { isUlid } from "@shared/ulid";

export const LOAN_REMINDER_DATA_TYPE = "loan_reminder";

export function extractLoanIdFromNotificationResponse(
  response: Notifications.NotificationResponse,
): Id | null {
  const data = response.notification.request.content.data;
  // Loan ids are ULIDs now. The old guard bounded a number (`> 0`); the
  // equivalent for a string id is that it is actually a well-formed ULID —
  // notification payloads survive across app upgrades, so a reminder scheduled
  // before the id migration will still carry a number here and must be
  // rejected rather than routed to a URL that resolves to nothing.
  if (
    data?.type === LOAN_REMINDER_DATA_TYPE &&
    isUlid(data.loanId)
  ) {
    return data.loanId;
  }
  return null;
}

export function buildLoanDetailPath(loanId: Id): string {
  return `/loan/${loanId}`;
}

export function handleLoanNotificationResponse(
  response: Notifications.NotificationResponse,
  navigate: (path: string) => void,
): boolean {
  const loanId = extractLoanIdFromNotificationResponse(response);
  if (loanId == null) {
    return false;
  }
  navigate(buildLoanDetailPath(loanId));
  return true;
}
