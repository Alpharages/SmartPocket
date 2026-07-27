import React from "react";

/** Test double for `expo-blur` (aliased in vitest.config.ts) — a passthrough
 * host node so GlassSurface renders in the node/vitest environment without
 * the native BlurView. */
// eslint-disable-next-line react/display-name -- test double, never rendered by name
export const BlurView = React.forwardRef<any, any>(
  ({ children, ...props }, ref) =>
    React.createElement("BlurView", { ref, ...props }, children),
);
(BlurView as any).displayName = "BlurView";
