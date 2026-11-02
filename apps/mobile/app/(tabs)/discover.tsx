import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { listPersonas, type ApiPersona } from "@/lib/api";
import { useAppTheme } from "@/lib/theme-context";

const CATEGORIES = ["为你推荐", "中国历史", "思想家", "军事家", "动漫角色", "原创角色"];

export default function DiscoverScreen() {
  const { theme } = useAppTheme();
  const [category, setCategory] = useState("为你推荐");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [personas, setPersonas] = useState<ApiPersona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listPersonas({
        category: category === "为你推荐" ? undefined : category,
        query: debouncedQuery || undefined,
      });
      setPersonas(items);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const chips = useMemo(
    () =>
      CATEGORIES.map((item) => (
        <Pressable
          key={item}
          onPress={() => setCategory(item)}
          style={[
            styles.chip,
            {
              backgroundColor: category === item ? theme.primary : theme.surface2,
              borderColor: theme.line,
            },
          ]}
        >
          <Text
            style={{
              color: category === item ? "#fff" : theme.text,
              fontSize: 13,
              fontWeight: "500",
            }}
          >
            {item}
          </Text>
        </Pressable>
      )),
    [category, theme],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索角色、标签或简介"
          placeholderTextColor={theme.muted2}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>
      <View style={styles.chips}>{chips}</View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={personas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.muted }]}>暂无匹配角色</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}
              onPress={() => router.push(`/persona/${item.id}`)}
            >
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.sub, { color: theme.muted }]}>{item.subtitle}</Text>
              <View style={styles.tags}>
                {item.tags.slice(0, 3).map((tag) => (
                  <View
                    key={tag}
                    style={[styles.tag, { backgroundColor: theme.surface2, borderColor: theme.line }]}
                  >
                    <Text style={{ color: theme.muted, fontSize: 11 }}>{tag}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { fontSize: 15 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  name: { fontSize: 17, fontWeight: "600" },
  sub: { marginTop: 4, fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
