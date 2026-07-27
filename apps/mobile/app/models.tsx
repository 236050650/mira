import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { modelsStatus, type ModelsStatus } from "@/lib/api";
import { useAppTheme } from "@/lib/theme-context";

export default function ModelsScreen() {
  const { theme } = useAppTheme();
  const [status, setStatus] = useState<ModelsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await modelsStatus());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !status) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.page}
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
    >
      <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Text style={[styles.label, { color: theme.muted }]}>运行模式</Text>
        <Text style={[styles.value, { color: theme.text }]}>{status?.mode ?? "—"}</Text>
        <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>默认配置</Text>
        <Text style={[styles.value, { color: theme.text }]}>{status?.defaultProfileId ?? "—"}</Text>
        <Text style={[styles.label, { color: theme.muted, marginTop: 12 }]}>远程 Token 用量</Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {status?.remoteTokensUsed ?? 0} / {status?.remoteTokenBudget ?? 0}
        </Text>
      </View>

      {status?.profiles.map((profile) => (
        <View
          key={profile.id}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}
        >
          <View style={styles.row}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{profile.displayName}</Text>
            <View
              style={[
                styles.pill,
                { backgroundColor: profile.available ? "#4caf7a22" : `${theme.coral}22` },
              ]}
            >
              <Text style={{ color: profile.available ? "#4caf7a" : theme.coral, fontSize: 12 }}>
                {profile.available ? "可用" : "不可用"}
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.muted, marginTop: 6, fontSize: 13 }}>
            {profile.provider} · {profile.model}
          </Text>
          {profile.latencyMs != null ? (
            <Text style={{ color: theme.muted2, marginTop: 4, fontSize: 12 }}>
              延迟 {profile.latencyMs} ms
            </Text>
          ) : null}
          {profile.detail ? (
            <Text style={{ color: theme.muted2, marginTop: 4, fontSize: 12 }}>{profile.detail}</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { padding: 16, paddingBottom: 32, gap: 12 },
  summary: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 4 },
  label: { fontSize: 12 },
  value: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
