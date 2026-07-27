import { miraTokens } from "@mira/ui";

export type ThemeMode = "light" | "dark";

export const lightTheme = {
  mode: "light" as const,
  bg: "#f6f4ee",
  bgSoft: "#efede6",
  surface: "#ffffff",
  surface2: "#f1efe9",
  text: "#202328",
  muted: "#696d70",
  muted2: "#92938f",
  line: "rgba(32, 35, 40, 0.1)",
  primary: miraTokens.light.indigo,
  primary2: "#58739a",
  coral: miraTokens.light.cinnabar,
  shadow: "rgba(49, 45, 36, 0.14)",
};

export const darkTheme = {
  mode: "dark" as const,
  bg: "#0e1114",
  bgSoft: "#14181c",
  surface: "#1a1f23",
  surface2: "#22282d",
  text: "#f4f3ef",
  muted: "#a6a7a4",
  muted2: "#777c80",
  line: "rgba(255, 255, 255, 0.09)",
  primary: miraTokens.dark.indigo,
  primary2: "#9eb5d5",
  coral: miraTokens.dark.cinnabar,
  shadow: "rgba(0, 0, 0, 0.36)",
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

export function resolveTheme(mode: ThemeMode): AppTheme {
  return mode === "dark" ? darkTheme : lightTheme;
}
