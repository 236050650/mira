import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  createConversation,
  favoritePersona,
  getPersona,
  type ApiPersona,
} from "@/lib/api";
import { useAppTheme } from "@/lib/theme-context";

export default function PersonaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useAppTheme();
  const [persona, setPersona] = useState<ApiPersona | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setPersona(await getPersona(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFavorite() {
    if (!persona) return;
    const next = !persona.favorited;
    await favoritePersona(persona.id, next);
    setPersona({ ...persona, favorited: next });
  }

  async function onChat() {
    if (!persona) return;
    setStarting(true);
    try {
      const conversation = await createConversation(persona.id);
      router.push(`/chat/${conversation.id}`);
    } finally {
      setStarting(false);
    }
  }

  if (loading || !persona) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const accent = persona.accent ?? theme.coral;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={styles.page}>
      <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={[styles.avatar, { backgroundColor: `${accent}33` }]}>
          <Text style={[styles.avatarText, { color: accent }]}>{persona.name.slice(0, 1)}</Text>
        </View>
        <Text style={[styles.name, { color: theme.text }]}>{persona.name}</Text>
        <Text style={{ color: theme.muted, marginTop: 6 }}>{persona.subtitle}</Text>
        <Text style={{ color: theme.muted2, marginTop: 8, fontSize: 13 }}>
          {persona.category} · {persona.conversations ?? "—"} 对话
        </Text>
      </View>

      <Text style={[styles.section, { color: theme.text }]}>简介</Text>
      <Text style={[styles.bio, { color: theme.muted }]}>{persona.bio}</Text>

      {persona.version?.greeting ? (
        <>
          <Text style={[styles.section, { color: theme.text }]}>开场</Text>
          <Text style={[styles.hook, { color: theme.primary }]}>{persona.version.greeting}</Text>
        </>
      ) : null}

      <View style={styles.tags}>
        {persona.tags.map((tag) => (
          <View
            key={tag}
            style={[styles.tag, { backgroundColor: theme.surface2, borderColor: theme.line }]}
          >
            <Text style={{ color: theme.muted, fontSize: 12 }}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.secondary, { borderColor: theme.line, backgroundColor: theme.surface }]}
          onPress={() => void onFavorite()}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>
            {persona.favorited ? "已收藏" : "收藏"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.primary, { backgroundColor: theme.primary }]}
          onPress={() => void onChat()}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>开始聊天</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { padding: 20, paddingBottom: 40 },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "700" },
  section: { marginTop: 22, marginBottom: 8, fontSize: 16, fontWeight: "600" },
  bio: { fontSize: 14, lineHeight: 22 },
  hook: { fontSize: 14, lineHeight: 22 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 28 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primary: {
    flex: 2,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
});
