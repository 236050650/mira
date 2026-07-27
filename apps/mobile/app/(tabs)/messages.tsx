import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { listConversations, type ApiConversation } from "@/lib/api";
import { useAppTheme } from "@/lib/theme-context";

function formatTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MessagesScreen() {
  const { theme } = useAppTheme();
  const [items, setItems] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listConversations();
      setItems(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.bg }}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={theme.primary}
        />
      }
      contentContainerStyle={items.length === 0 ? styles.center : { padding: 16 }}
      ListEmptyComponent={
        <Text style={{ color: theme.muted, fontSize: 14 }}>暂无会话，从角色详情开始聊天</Text>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={() => router.push(`/chat/${item.id}`)}
        >
          <View style={[styles.avatar, { backgroundColor: theme.surface2 }]}>
            <Text style={{ color: theme.primary, fontWeight: "700" }}>
              {item.persona?.name?.slice(0, 1) ?? "?"}
            </Text>
          </View>
          <View style={styles.body}>
            <View style={styles.top}>
              <Text style={[styles.title, { color: theme.text }]}>
                {item.persona?.name ?? item.title}
              </Text>
              <Text style={{ color: theme.muted2, fontSize: 11 }}>
                {formatTime(item.lastMessageAt)}
              </Text>
            </View>
            <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={1}>
              {item.summary ?? "开始新的对话"}
            </Text>
          </View>
          {item.unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.coral }]}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, marginLeft: 12 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "600" },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
