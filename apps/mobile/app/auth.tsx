import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { ApiError, login, register } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAppTheme } from "@/lib/theme-context";

type Mode = "login" | "register";

export default function AuthScreen() {
  const { theme } = useAppTheme();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password, nickname.trim() || "镜语旅人");
      setUser(user);
      router.replace("/(tabs)");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : mode === "register"
            ? "注册失败，请检查网络与密码规则"
            : "登录失败，请检查账号密码",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: theme.text }]}>MIRA</Text>
        <Text style={[styles.sub, { color: theme.muted }]}>镜语 · 登录后继续对话</Text>

        <View style={styles.tabs}>
          {(["login", "register"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.tab,
                {
                  backgroundColor: mode === m ? theme.primary : theme.surface2,
                  borderColor: theme.line,
                },
              ]}
            >
              <Text style={{ color: mode === m ? "#fff" : theme.text, fontWeight: "600" }}>
                {m === "login" ? "登录" : "注册"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {mode === "register" ? (
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="昵称"
              placeholderTextColor={theme.muted2}
              style={[styles.input, { color: theme.text, borderColor: theme.line }]}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="邮箱"
            placeholderTextColor={theme.muted2}
            style={[styles.input, { color: theme.text, borderColor: theme.line }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="密码（至少 8 位，含字母与数字）"
            placeholderTextColor={theme.muted2}
            style={[styles.input, { color: theme.text, borderColor: theme.line }]}
          />
          {error ? <Text style={{ color: theme.coral, marginBottom: 8 }}>{error}</Text> : null}
          <Pressable
            style={[styles.submit, { backgroundColor: theme.primary }]}
            onPress={() => void onSubmit()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{mode === "login" ? "登录" : "注册"}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 72 },
  brand: { fontSize: 36, fontWeight: "800", letterSpacing: 2 },
  sub: { marginTop: 8, marginBottom: 28, fontSize: 15 },
  tabs: { flexDirection: "row", gap: 10, marginBottom: 16 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  form: { borderRadius: 20, borderWidth: 1, padding: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  submit: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
