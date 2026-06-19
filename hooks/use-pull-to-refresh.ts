import { useCallback, useState } from "react";
import type { RefreshControlProps } from "react-native";

import { useColors } from "@/hooks/use-colors";

type PullToRefreshProps = Pick<
  RefreshControlProps,
  "refreshing" | "onRefresh" | "tintColor" | "colors"
>;

/**
 * Manages pull-to-refresh state and returns props for {@link RefreshControl}.
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
): PullToRefreshProps {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return {
    refreshing,
    onRefresh: handleRefresh,
    tintColor: colors.primary,
    colors: [colors.primary],
  };
}
