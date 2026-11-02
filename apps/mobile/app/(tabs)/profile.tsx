import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { me, updatePreferences } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAppTheme, type ThemePreference } from "@/lib/theme-context";

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
  { id: "system", label: "跟随系统" },
];

export default function ProfileScreen() {
  const { theme, preference, setPreference } = useAppTheme();
  const { user, setUser, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const fresh = await me();
        setUser(fresh);
        if (fresh.preferences?.theme) {
          setPreference(fresh.preferences.theme);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [setUser, setPreference]);

  async function onThemeChange(next: ThemePreference) {
    setPreference(next);
    setSyncing(true);
    try {
      const updated = await updatePreferences({ theme: next });
      setUser(updated);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={styles.page}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={[styles.avatar, { backgroundColor: theme.surface2 }]}>
          <Text style={{ fontSize: 28, color: theme.primary, fontWeight: "700" }}>
            {user?.nickname?.slice(0, 1) ?? "我"}
          </Text>
        </View>
        <Text style={[styles.name, { color: theme.text }]}>{user?.nickname ?? "访客"}</Text>
        <Text style={{ color: theme.muted, marginTop: 4 }}>{user?.email}</Text>
        {user?.bio ? (
          <Text style={{ color: theme.muted2, marginTop: 8, fontSize: 13 }}>{user.bio}</Text>
        ) : null}
      </View>

      <Text style={[styles.section, { color: theme.text }]}>外观</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        {THEME_OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            style={styles.row}
            onPress={() => void onThemeChange(opt.id)}
            disabled={syncing}
          >
            <Text style={{ color: theme.text, fontSize: 15 }}>{opt.label}</Text>
            <View
              style={[
                styles.radio,
                {
                  borderColor: preference === opt.id ? theme.primary : theme.line,
                  backgroundColor: preference === opt.id ? theme.primary : "transparent",
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.section, { color: theme.text }]}>模型</Text>
      <Pressable
        style={[styles.link, { backgroundColor: theme.surface, borderColor: theme.line }]}
        onPress={() => router.push("/models")}
      >
        <Text style={{ color: theme.text, fontSize: 15 }}>模型状态与配置</Text>
        <Text style={{ color: theme.muted2 }}>›</Text>
      </Pressable>

      <Pressable
        style={[styles.logout, { borderColor: theme.coral }]}
        onPress={() => void signOut()}
      >
        <Text style={{ color: theme.coral, fontWeight: "600" }}>退出登录</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "700" },
  section: { marginTop: 24, marginBottom: 10, fontSize: 16, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  link: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  logout: {
    marginTop: 32,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
});
