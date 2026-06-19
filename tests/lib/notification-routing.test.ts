import { describe, expect, it, vi } from "vitest";

import {
  buildLoanDetailPath,
  extractLoanIdFromNotificationResponse,
  handleLoanNotificationResponse,
  LOAN_REMINDER_DATA_TYPE,
} from "@/lib/notification-routing";

describe("notification-routing", () => {
  it("extracts loan id from loan reminder notification data", () => {
    const loanId = extractLoanIdFromNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              type: LOAN_REMINDER_DATA_TYPE,
              loanId: 7,
              route: "/loan/7",
            },
          },
        },
      },
    } as never);

    expect(loanId).toBe(7);
    expect(buildLoanDetailPath(7)).toBe("/loan/7");
  });

  it("returns null for unrelated notification payloads", () => {
    expect(
      extractLoanIdFromNotificationResponse({
        notification: {
          request: {
            content: {
              data: { type: "other", loanId: 7 },
            },
          },
        },
      } as never),
    ).toBeNull();
  });

  it("navigates to loan detail when handling a loan reminder response", () => {
    const navigate = vi.fn();
    const handled = handleLoanNotificationResponse(
      {
        notification: {
          request: {
            content: {
              data: {
                type: LOAN_REMINDER_DATA_TYPE,
                loanId: 12,
              },
            },
          },
        },
      } as never,
      navigate,
    );

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/loan/12");
  });
});
