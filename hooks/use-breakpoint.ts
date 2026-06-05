import { useWindowDimensions } from "react-native";

const LG_BREAKPOINT = 1024;

export function useBreakpoints() {
  const { width } = useWindowDimensions();
  return {
    isLg: width >= LG_BREAKPOINT,
  };
}
