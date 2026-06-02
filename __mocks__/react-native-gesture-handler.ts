import React from "react";

export const Swipeable = ({
  children,
  renderRightActions,
  ...props
}: {
  children?: React.ReactNode;
  renderRightActions?: () => React.ReactNode;
  [key: string]: any;
}) => {
  return React.createElement(
    "div",
    { "data-testid": "swipeable", ...props },
    children,
    renderRightActions?.(),
  );
};

export const GestureHandlerRootView = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: any;
}) => {
  return React.createElement("div", props, children);
};

export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

export const Directions = {
  LEFT: 1,
  RIGHT: 2,
  UP: 4,
  DOWN: 8,
};
