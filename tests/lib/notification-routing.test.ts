import { describe, expect, it, vi } from "vitest";

import {
  buildLoanDetailPath,
  extractLoanIdFromNotificationResponse,
  handleLoanNotificationResponse,
  LOAN_REMINDER_DATA_TYPE,
} from "@/lib/notification-routing";
import { testId, syncColumns } from "../helpers/ids";

describe("notification-routing", () => {
  it("extracts loan id from loan reminder notification data", () => {
    const loanId = extractLoanIdFromNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              type: LOAN_REMINDER_DATA_TYPE,
              loanId: testId(7),
              route: `/loan/${testId(7)}`,
            },
          },
        },
      },
    } as never);

    expect(loanId).toBe(testId(7));
    expect(buildLoanDetailPath(testId(7))).toBe(`/loan/${testId(7)}`);
  });

  it("rejects a numeric loanId left over from before the id migration", () => {
    // Notifications outlive an app upgrade: a reminder scheduled against an
    // autoincrement id must not route to a URL that resolves to nothing.
    expect(
      extractLoanIdFromNotificationResponse({
        notification: {
          request: {
            content: {
              data: { type: LOAN_REMINDER_DATA_TYPE, loanId: 7 },
            },
          },
        },
      } as never),
    ).toBeNull();
  });

  it("returns null for unrelated notification payloads", () => {
    expect(
      extractLoanIdFromNotificationResponse({
        notification: {
          request: {
            content: {
              data: { type: "other", loanId: testId(7) },
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
                loanId: testId(12),
              },
            },
          },
        },
      } as never,
      navigate,
    );

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith(`/loan/${testId(12)}`);
  });
});
