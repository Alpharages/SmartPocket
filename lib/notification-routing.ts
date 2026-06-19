import type * as Notifications from "expo-notifications";

export const LOAN_REMINDER_DATA_TYPE = "loan_reminder";

export function extractLoanIdFromNotificationResponse(
  response: Notifications.NotificationResponse,
): number | null {
  const data = response.notification.request.content.data;
  if (
    data?.type === LOAN_REMINDER_DATA_TYPE &&
    typeof data.loanId === "number" &&
    Number.isFinite(data.loanId) &&
    data.loanId > 0
  ) {
    return data.loanId;
  }
  return null;
}

export function buildLoanDetailPath(loanId: number): string {
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
