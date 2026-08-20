import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined";

export const NOTIFICATION_PERMISSION_DENIED_MESSAGE =
  "Reminders are off — enable notifications in system settings.";

export type ScheduleLocalNotificationInput = {
  title: string;
  body: string;
  triggerAt: Date;
  data?: Record<string, unknown>;
  /** Stable id — rescheduling with the same identifier replaces the prior notification. */
  identifier?: string;
};

function isNativePlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

if (isNativePlatform()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function isPermissionGranted(
  status: Notifications.NotificationPermissionsStatus,
): boolean {
  if (status.granted) {
    return true;
  }
  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function mapPermissionStatus(
  status: Notifications.NotificationPermissionsStatus,
): NotificationPermissionStatus {
  if (isPermissionGranted(status)) {
    return "granted";
  }

  const iosStatus = status.ios?.status;
  if (iosStatus === Notifications.IosAuthorizationStatus.NOT_DETERMINED) {
    return "undetermined";
  }

  if (status.canAskAgain) {
    return "undetermined";
  }

  return "denied";
}

export async function areNotificationsAvailable(): Promise<boolean> {
  return isNativePlatform();
}

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (!isNativePlatform()) {
    return "denied";
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    const existingStatus = mapPermissionStatus(existing);
    if (existingStatus !== "undetermined") {
      return existingStatus;
    }

    const requested = await Notifications.requestPermissionsAsync();
    return mapPermissionStatus(requested);
  } catch {
    return "denied";
  }
}

async function hasNotificationPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }

  try {
    const status = await Notifications.getPermissionsAsync();
    return isPermissionGranted(status);
  } catch {
    return false;
  }
}

export async function scheduleLocalNotification(
  input: ScheduleLocalNotificationInput,
): Promise<string | null> {
  if (!isNativePlatform()) {
    return null;
  }

  try {
    const permitted = await hasNotificationPermission();
    if (!permitted) {
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      identifier: input.identifier,
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.triggerAt,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelScheduledNotification(id: string): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Unknown or already-cancelled ids must not throw.
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Best-effort cleanup.
  }
}
