import React from "react";

/** Test double for `expo-linear-gradient` (aliased in vitest.config.ts) — a
 * passthrough host node so GradientHero renders in the node/vitest
 * environment without the native LinearGradient. */
// eslint-disable-next-line react/display-name -- test double, never rendered by name
export const LinearGradient = React.forwardRef<any, any>(
  ({ children, ...props }, ref) =>
    React.createElement("LinearGradient", { ref, ...props }, children),
);
(LinearGradient as any).displayName = "LinearGradient";
