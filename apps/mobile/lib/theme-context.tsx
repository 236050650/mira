import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { resolveTheme, type AppTheme, type ThemeMode } from "./theme";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  resolved: ThemeMode;
  theme: AppTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPreference = "light",
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);

  const resolved: ThemeMode = useMemo(() => {
    if (preference === "system") {
      return systemScheme === "dark" ? "dark" : "light";
    }
    return preference;
  }, [preference, systemScheme]);

  const theme = useMemo(() => resolveTheme(resolved), [resolved]);

  const setPreferenceStable = useCallback((value: ThemePreference) => {
    setPreference(value);
  }, []);

  const value = useMemo(
    () => ({ preference, setPreference: setPreferenceStable, resolved, theme }),
    [preference, setPreferenceStable, resolved, theme],
  );

  useEffect(() => {
    /* sync hook for future persistence */
  }, [preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
