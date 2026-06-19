import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notificationsMock = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
}));

vi.mock("expo-notifications", () => notificationsMock);

const platformMock = vi.hoisted(() => ({ OS: "ios" as string }));

vi.mock("react-native", () => ({
  Platform: platformMock,
}));

describe("notifications util", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformMock.OS = "ios";
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: "undetermined",
    });
    notificationsMock.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    notificationsMock.scheduleNotificationAsync.mockResolvedValue("notif-1");
    notificationsMock.cancelScheduledNotificationAsync.mockResolvedValue(
      undefined,
    );
    notificationsMock.cancelAllScheduledNotificationsAsync.mockResolvedValue(
      undefined,
    );
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function loadNotifications() {
    return import("@/lib/notifications");
  }

  it("registers a foreground notification handler on native platforms", async () => {
    await loadNotifications();
    expect(notificationsMock.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        handleNotification: expect.any(Function),
      }),
    );
  });

  it("requests permission when undetermined and returns granted", async () => {
    const { requestNotificationPermissions } = await loadNotifications();
    const status = await requestNotificationPermissions();
    expect(notificationsMock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(status).toBe("granted");
  });

  it("does not re-request when permission is already granted", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: "granted",
    });
    const { requestNotificationPermissions } = await loadNotifications();
    const status = await requestNotificationPermissions();
    expect(notificationsMock.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(status).toBe("granted");
  });

  it("returns denied without throwing when permission is denied", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: "denied",
    });
    const { requestNotificationPermissions } = await loadNotifications();
    await expect(requestNotificationPermissions()).resolves.toBe("denied");
    expect(notificationsMock.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("schedules a local notification with an absolute date trigger", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: "granted",
    });
    const triggerAt = new Date("2026-07-01T09:00:00");
    const { scheduleLocalNotification } = await loadNotifications();
    const id = await scheduleLocalNotification({
      title: "Rent due",
      body: "Monthly rent",
      triggerAt,
      data: { ruleId: 1 },
    });
    expect(id).toBe("notif-1");
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Rent due",
        body: "Monthly rent",
        data: { ruleId: 1 },
      },
      trigger: {
        type: "date",
        date: triggerAt,
      },
    });
  });

  it("passes identifier through when scheduling", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: "granted",
    });
    const triggerAt = new Date("2026-07-01T09:00:00");
    const { scheduleLocalNotification } = await loadNotifications();
    await scheduleLocalNotification({
      title: "Loan due",
      body: "Repayment due",
      triggerAt,
      identifier: "loan-due-5",
    });
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "loan-due-5" }),
    );
  });

  it("returns null when permission is denied", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: "denied",
    });
    const { scheduleLocalNotification } = await loadNotifications();
    const id = await scheduleLocalNotification({
      title: "Rent due",
      body: "Monthly rent",
      triggerAt: new Date("2026-07-01T09:00:00"),
    });
    expect(id).toBeNull();
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("treats web as unavailable and no-ops scheduling", async () => {
    platformMock.OS = "web";
    const { areNotificationsAvailable, scheduleLocalNotification } =
      await loadNotifications();
    expect(await areNotificationsAvailable()).toBe(false);
    const id = await scheduleLocalNotification({
      title: "Rent due",
      body: "Monthly rent",
      triggerAt: new Date("2026-07-01T09:00:00"),
    });
    expect(id).toBeNull();
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels a scheduled notification by id", async () => {
    const { cancelScheduledNotification } = await loadNotifications();
    await cancelScheduledNotification("notif-42");
    expect(
      notificationsMock.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("notif-42");
  });

  it("does not throw when cancelling an unknown notification id", async () => {
    notificationsMock.cancelScheduledNotificationAsync.mockRejectedValue(
      new Error("not found"),
    );
    const { cancelScheduledNotification } = await loadNotifications();
    await expect(cancelScheduledNotification("missing")).resolves.toBeUndefined();
  });
});
