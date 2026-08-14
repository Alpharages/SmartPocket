// The real package ships untranspiled TypeScript that the test transformer
// can't parse, so it's aliased to this stub in vitest.config.ts — same pattern
// as the other native modules in this directory.
export type DateTimePickerEvent = {
  type: "set" | "dismissed";
  nativeEvent: { timestamp?: number };
};

export default function DateTimePicker() {
  return null;
}
