import React, { useCallback, useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import { createRemoteSyncClient } from "@/lib/sync/remote-client";
import { runGuardedSync } from "@/lib/sync/auto-sync";
import {
  isSyncEnabled,
  isSyncSupported,
  setSyncEnabled,
} from "@/lib/sync/sync-state";
import {
  resolveFirstSync,
  resolveStaleCursor,
  type FirstSyncChoice,
  type SyncChoiceReason,
} from "@/lib/sync/sync-worker";

const SYNC_EXPLANATION =
  "Keep this phone's data backed up and available on your other devices.";

const CHOICE_SHEET_COPY: Record<
  SyncChoiceReason,
  { title: string; body: string; keepPhoneLabel: string; keepPhoneHint: string }
> = {
  "first-sync": {
    title: "This account already has data",
    body: "This phone and this account both have expense data already. Choose what to do before turning sync on.",
    keepPhoneLabel: "Keep this phone's data",
    keepPhoneHint: "Keep this phone's data, replacing the account's",
  },
  "stale-cursor": {
    title: "This phone hasn't synced in a while",
    body: "Other devices on this account may have made changes since this phone last synced. Choosing this phone's data will overwrite whatever they added.",
    keepPhoneLabel: "Keep this phone's data anyway",
    keepPhoneHint:
      "Keep this phone's data, overwriting changes made on other devices",
  },
};

function FirstSyncChoiceSheet({
  visible,
  busy,
  reason,
  onChoose,
  onClose,
}: {
  visible: boolean;
  busy: boolean;
  reason: SyncChoiceReason;
  onChoose: (choice: FirstSyncChoice) => void;
  onClose: () => void;
}) {
  const copy = CHOICE_SHEET_COPY[reason];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={copy.title}
      testID="first-sync-choice-sheet"
    >
      <View className="px-lg pb-lg">
        <Text className="mb-lg text-body text-muted">{copy.body}</Text>
        <View className="gap-md">
          <Button
            variant="secondary"
            label={copy.keepPhoneLabel}
            onPress={() => onChoose("keep-phone")}
            disabled={busy}
            accessibilityLabel={copy.keepPhoneHint}
          />
          <Button
            variant="secondary"
            label="Keep the account's data"
            onPress={() => onChoose("keep-account")}
            disabled={busy}
            accessibilityLabel="Keep the account's data, discarding this phone's"
          />
          <Button
            variant="secondary"
            label="Merge both"
            onPress={() => onChoose("merge")}
            disabled={busy}
            accessibilityLabel="Merge both — some entries may end up duplicated"
          />
          <Button
            variant="ghost"
            label="Cancel"
            onPress={onClose}
            disabled={busy}
          />
        </View>
      </View>
    </Sheet>
  );
}

/**
 * local-first-sync-plan.md phase 4: the Settings sync toggle and the
 * first-sync choice prompt it can surface. Native only — web has no local
 * SQLite to sync from (lib/sync/sync-state.ts's isSyncSupported).
 */
export function SyncSettingsSection() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const colors = useColors();
  const toast = useToast();
  const { refreshAll } = useExpense();

  const [enabled, setEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [choiceReason, setChoiceReason] = useState<SyncChoiceReason | null>(
    null,
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!isSyncSupported()) return;
    isSyncEnabled().then(setEnabled);
  }, []);

  // `runGuardedSync` rather than `runSync` directly: the automatic trigger
  // (components/sync-gate.tsx) can have a cycle in flight already, and two
  // overlapping cycles would push the same rows twice and race on the pull
  // cursor. `silent` is the on-mount check below, which must surface a
  // pending choice without shouting about a failure nobody asked for.
  const performSync = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!user) return;
      setSyncing(true);
      try {
        const outcome = await runGuardedSync(user.id);
        if (!outcome) return;
        if (outcome.status === "needs-first-sync-choice") {
          setChoiceReason(outcome.reason);
          return;
        }
        if (outcome.status === "synced") {
          setLastSyncedAt(new Date());
          // See components/sync-gate.tsx for why this is refreshAll rather
          // than a cache invalidation.
          if (outcome.pulled > 0) void refreshAll();
        }
      } catch {
        if (options.silent) return;
        toast.show({
          type: "error",
          message: "Sync failed. Tap Sync now to try again.",
        });
      } finally {
        setSyncing(false);
      }
    },
    [user, toast, refreshAll],
  );

  // Opening Settings with sync already on runs a cycle. This is the only
  // place the first-sync choice sheet can appear, and the automatic trigger
  // deliberately does not prompt from the background — without this, a device
  // whose first sync needs an answer would sit there never syncing and never
  // saying why.
  useEffect(() => {
    if (!isSyncSupported() || !user) return;
    isSyncEnabled().then((on) => {
      if (on) void performSync({ silent: true });
    });
  }, [user, performSync]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      setEnabled(value);
      await setSyncEnabled(value);
      if (value) {
        await performSync();
      }
    },
    [performSync],
  );

  const handleChoice = useCallback(
    async (choice: FirstSyncChoice) => {
      if (!user || !choiceReason) return;
      const reason = choiceReason;
      setChoiceReason(null);
      setSyncing(true);
      try {
        const client = createRemoteSyncClient();
        if (reason === "stale-cursor") {
          await resolveStaleCursor(client, choice, user.id);
        } else {
          await resolveFirstSync(client, choice, user.id);
        }
        const outcome = await runGuardedSync(user.id);
        if (outcome?.status === "synced") {
          setLastSyncedAt(new Date());
          if (outcome.pulled > 0) void refreshAll();
          toast.show({ type: "success", message: "Sync complete" });
        }
      } catch {
        toast.show({
          type: "error",
          message: "Sync failed. Tap Sync now to try again.",
        });
      } finally {
        setSyncing(false);
      }
    },
    [user, toast, choiceReason, refreshAll],
  );

  if (!isSyncSupported()) return null;

  if (!isAuthenticated) {
    // This copy used to be the whole signed-out state — an instruction to sign
    // in, with nothing to sign in *with*. On native that made sync unreachable
    // on a fresh install: `AuthGate` only redirects on web, and every other
    // route to /login (signing out, forgetting a PIN) is reachable only by
    // someone who already has an account. The button is the entry point.
    return (
      <View className="px-lg py-md">
        <Text className="text-body text-muted">
          Sign in to back up this phone&apos;s data and use it on other devices.
        </Text>
        <View className="mt-md">
          <Button
            variant="secondary"
            label="Sign in"
            onPress={() => router.push("/login")}
            testID="sync-sign-in"
            accessibilityLabel="Sign in to enable sync"
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <View
        className="flex-row items-center px-lg py-md"
        style={{ minHeight: 44 }}
      >
        <View className="flex-1 pr-md">
          <Text className="text-body font-medium text-foreground">Sync</Text>
          <Text className="mt-xs text-caption text-muted">
            {SYNC_EXPLANATION}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={syncing}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
          accessibilityRole="switch"
          accessibilityLabel="Sync"
          accessibilityHint={SYNC_EXPLANATION}
          accessibilityState={{ checked: enabled }}
          hitSlop={12}
          style={{ minHeight: 44, minWidth: 44 }}
        />
      </View>
      {enabled ? (
        <View className="px-lg pb-md">
          <Text className="mb-sm text-caption text-muted">
            {syncing
              ? "Syncing…"
              : lastSyncedAt
                ? `Last synced ${lastSyncedAt.toLocaleTimeString()}`
                : "Not yet synced"}
          </Text>
          <Button
            variant="secondary"
            label="Sync now"
            onPress={() => performSync()}
            loading={syncing}
            disabled={syncing}
          />
        </View>
      ) : null}
      <FirstSyncChoiceSheet
        visible={choiceReason !== null}
        busy={syncing}
        reason={choiceReason ?? "first-sync"}
        onChoose={handleChoice}
        onClose={() => setChoiceReason(null)}
      />
    </>
  );
}
