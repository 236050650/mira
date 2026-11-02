import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  listMessages,
  regenerateMessage,
  stopGeneration,
  streamMessage,
  type ApiMessage,
} from "@/lib/api";
import { useAppTheme } from "@/lib/theme-context";

type ChatRow = ApiMessage & { streaming?: boolean };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useAppTheme();
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const rows = await listMessages(id);
      setMessages(rows);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSend() {
    const text = input.trim();
    if (!text || !id || sending) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatRow = {
      id: tempId,
      role: "user",
      content: text,
      status: "completed",
      createdAt: new Date().toISOString(),
    };

    setInput("");
    setSending(true);
    setGenerationId(null);
    setMessages((prev) => [...prev, optimistic]);

    let assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
        streaming: true,
      },
    ]);

    try {
      await streamMessage(
        id,
        text,
        {
          onAccepted: (data) => {
            assistantId = data.assistantMessageId;
            setGenerationId(data.generationId);
          },
          onDelta: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId || (m.streaming && m.role === "assistant")
                  ? { ...m, id: data.assistantMessageId, content: m.content + data.delta }
                  : m,
              ),
            );
          },
          onCompleted: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.streaming ? { ...m, streaming: false, status: "completed" } : m,
              ),
            );
            setGenerationId(null);
          },
          onFailed: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.streaming
                  ? {
                      ...m,
                      streaming: false,
                      status: data.code === "GENERATION_INTERRUPTED" ? "interrupted" : "failed",
                      content: m.content || data.message,
                    }
                  : m,
              ),
            );
            setGenerationId(null);
          },
        },
        { signal: abort.signal },
      );
      void load();
    } catch (e) {
      if (!abort.signal.aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.streaming
              ? {
                  ...m,
                  streaming: false,
                  status: "failed",
                  content: e instanceof Error ? e.message : "发送失败",
                }
              : m,
          ),
        );
      }
    } finally {
      setSending(false);
      setGenerationId(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function onStop() {
    if (!id || !generationId) {
      abortRef.current?.abort();
      setSending(false);
      return;
    }
    try {
      await stopGeneration(id, generationId);
    } finally {
      abortRef.current?.abort();
      setSending(false);
      setGenerationId(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming ? { ...m, streaming: false, status: "interrupted" } : m,
        ),
      );
    }
  }

  async function onRegenerate(messageId: string) {
    if (!id || sending) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setSending(true);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: "", status: "streaming", streaming: true } : m,
      ),
    );

    try {
      await regenerateMessage(
        id,
        messageId,
        {
          onAccepted: (data) => setGenerationId(data.generationId),
          onDelta: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId || m.id === data.assistantMessageId
                  ? { ...m, id: data.assistantMessageId, content: m.content + data.delta }
                  : m,
              ),
            );
          },
          onCompleted: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.streaming ? { ...m, streaming: false, status: "completed" } : m,
              ),
            );
          },
          onFailed: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.streaming
                  ? { ...m, streaming: false, status: "failed", content: data.message }
                  : m,
              ),
            );
          },
        },
        { signal: abort.signal },
      );
    } finally {
      setSending(false);
      setGenerationId(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View>
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.assistantBubble,
                  {
                    backgroundColor: isUser ? theme.primary : theme.surface,
                    borderColor: theme.line,
                    alignSelf: isUser ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <Text style={{ color: isUser ? "#fff" : theme.text, lineHeight: 21 }}>
                  {item.content || (item.streaming ? "…" : "")}
                </Text>
              </View>
              {!isUser && !item.streaming && item.content ? (
                <Pressable
                  onPress={() => void onRegenerate(item.id)}
                  style={{ alignSelf: "flex-start", marginBottom: 8, marginLeft: 4 }}
                >
                  <Text style={{ color: theme.muted2, fontSize: 12 }}>重新生成</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
      <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="输入消息…"
          placeholderTextColor={theme.muted2}
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface2 }]}
          multiline
        />
        {sending ? (
          <Pressable style={[styles.send, { backgroundColor: theme.coral }]} onPress={() => void onStop()}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>停止</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.send, { backgroundColor: theme.primary }]}
            onPress={() => void onSend()}
            disabled={!input.trim()}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>发送</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userBubble: { borderBottomRightRadius: 4 },
  assistantBubble: { borderBottomLeftRadius: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  send: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: "center",
  },
});
