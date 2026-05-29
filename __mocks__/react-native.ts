export const Platform = {
  select: <T>(spec: {
    ios?: T;
    android?: T;
    web?: T;
    default?: T;
  }): T | undefined => {
    return spec.default ?? spec.ios ?? spec.android ?? spec.web;
  },
  OS: "ios",
};
