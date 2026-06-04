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

interface MockPanEvent {
  translationY: number;
}

class MockPanGesture {
  private _updateFn?: (e: MockPanEvent) => void;
  private _endFn?: (e: MockPanEvent) => void;
  onUpdate(fn: (e: MockPanEvent) => void) { this._updateFn = fn; return this; }
  onEnd(fn: (e: MockPanEvent) => void) { this._endFn = fn; return this; }
  enabled(_v?: boolean) { return this; }
  activeOffsetY(_range: number[]) { return this; }
  failOffsetX(_range: number[]) { return this; }
  triggerUpdate(e: MockPanEvent) { this._updateFn?.(e); }
  triggerEnd(e: MockPanEvent) { this._endFn?.(e); }
}

export const __gesture = { latestPan: null as MockPanGesture | null };

export const Gesture = {
  Pan: () => {
    __gesture.latestPan = new MockPanGesture();
    return __gesture.latestPan;
  },
};

export const GestureDetector = ({
  children,
  gesture: _gesture,
  ...props
}: {
  children?: React.ReactNode;
  gesture?: unknown;
  [key: string]: unknown;
}) => React.createElement("div", { "data-testid": "gesture-detector", ...props }, children);
