import React from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/utils";

export interface TwoPaneLayoutProps extends ViewProps {
  /** Content rendered in the left (master) pane. */
  master: React.ReactNode;
  /** Content rendered in the right (detail) pane. */
  detail: React.ReactNode;
  /** Additional className for the outer container. */
  containerClassName?: string;
  /** Additional className for the master pane. */
  masterClassName?: string;
  /** Additional className for the detail pane. */
  detailClassName?: string;
}

/**
 * A responsive two-pane master/detail layout.
 *
 * On mobile (`base`) only the `master` pane is visible.
 * At the `lg` breakpoint (≥1024px) both panes render side-by-side with
 * fluid, fractional widths — no hardcoded pixel values.
 *
 * Usage:
 * ```tsx
 * <TwoPaneLayout
 *   master={<TransactionList />}
 *   detail={<TransactionDetail id={selectedId} />}
 * />
 * ```
 */
export function TwoPaneLayout({
  master,
  detail,
  className,
  containerClassName,
  masterClassName,
  detailClassName,
  style,
  ...props
}: TwoPaneLayoutProps) {
  return (
    <View
      className={cn(
        "flex-1 flex-col lg:flex-row",
        className,
        containerClassName,
      )}
      style={style}
      {...props}
    >
      {/* Master pane — always visible */}
      <View
        className={cn(
          "flex-1",
          // At lg the master pane takes 2/5 of the available width (fluid).
          "lg:flex-[2]",
          masterClassName,
        )}
      >
        {master}
      </View>

      {/* Detail pane — hidden on mobile, visible at lg */}
      <View
        className={cn(
          "hidden",
          // At lg the detail pane takes 3/5 of the available width (fluid).
          "lg:flex lg:flex-[3]",
          detailClassName,
        )}
      >
        {detail}
      </View>
    </View>
  );
}
