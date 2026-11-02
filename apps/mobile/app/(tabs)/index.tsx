import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { listPersonas, type ApiPersona } from "@/lib/api";
import { useAppTheme } from "@/lib/theme-context";

function HeroCard({ persona }: { persona: ApiPersona | null }) {
  const { theme } = useAppTheme();
  const accent = persona?.accent ?? "#a64b3c";

  return (
    <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={[styles.heroBadge, { backgroundColor: `${accent}22` }]}>
        <Text style={[styles.heroBadgeText, { color: accent }]}>主视觉占位</Text>
      </View>
      <Text style={[styles.heroTitle, { color: theme.text }]}>
        {persona?.name ?? "霍去病"}
      </Text>
      <Text style={[styles.heroSubtitle, { color: theme.muted }]}>
        {persona?.subtitle ?? "十八岁出征的汉家冠军侯"}
      </Text>
      <Text style={[styles.heroHook, { color: theme.primary }]}>
        {persona?.version?.greeting ??
          "地图已经摊开。若只有一支轻骑，你会让它从哪里穿过大漠？"}
      </Text>
      {persona ? (
        <Pressable
          style={[styles.heroButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push(`/persona/${persona.id}`)}
        >
          <Text style={styles.heroButtonText}>进入角色</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PersonaRow({ item }: { item: ApiPersona }) {
  const { theme } = useAppTheme();
  const accent = item.accent ?? theme.coral;

  return (
    <Pressable
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}
      onPress={() => router.push(`/persona/${item.id}`)}
    >
      <View style={[styles.avatar, { backgroundColor: `${accent}33` }]}>
        <Text style={[styles.avatarText, { color: accent }]}>{item.name.slice(0, 1)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.muted2 }]}>
          {item.category} · {item.conversations ?? "—"} 对话
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: item.online ? "#4caf7a" : theme.muted2 }]} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const { theme } = useAppTheme();
  const [personas, setPersonas] = useState<ApiPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listPersonas();
      setPersonas(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featured =
    personas.find((p) => p.slug === "huo-qubing") ?? personas[0] ?? null;

  if (loading && personas.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={styles.page}>
      <Text style={[styles.brand, { color: theme.text }]}>MIRA 镜语</Text>
      <Text style={[styles.lead, { color: theme.muted }]}>与历史人物、思想家持续对话</Text>
      <HeroCard persona={featured} />
      {error ? (
        <Pressable onPress={() => void load()}>
          <Text style={[styles.error, { color: theme.coral }]}>{error} · 点击重试</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>角色列表</Text>
      <FlatList
        data={personas}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => <PersonaRow item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 28, fontWeight: "700", letterSpacing: 0.5 },
  lead: { marginTop: 6, marginBottom: 20, fontSize: 15 },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "600" },
  heroTitle: { fontSize: 26, fontWeight: "700" },
  heroSubtitle: { marginTop: 6, fontSize: 15 },
  heroHook: { marginTop: 14, fontSize: 14, lineHeight: 22 },
  heroButton: {
    marginTop: 18,
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroButtonText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700" },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { marginTop: 2, fontSize: 13 },
  rowMeta: { marginTop: 4, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  error: { marginBottom: 12, fontSize: 14 },
});
