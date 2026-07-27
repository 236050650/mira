import { ActivityIndicator, View } from "react-native";
import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider, useAppTheme } from "@/lib/theme-context";

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const inAuth = segments[0] === "auth";

  useEffect(() => {
    if (loading) return;
    if (!user && !inAuth) {
      router.replace("/auth");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, loading, inAuth]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootNavigator() {
  const { theme, resolved } = useAppTheme();

  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="persona/[id]" options={{ title: "角色详情" }} />
        <Stack.Screen name="chat/[id]" options={{ title: "对话" }} />
        <Stack.Screen name="models" options={{ title: "模型状态" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider initialPreference="light">
      <AuthProvider>
        <AuthGate>
          <RootNavigator />
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
