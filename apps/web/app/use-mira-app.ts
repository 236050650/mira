"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  type ApiConversation,
  type ApiPersona,
  type ApiUser,
  completeOnboarding,
  createConversation,
  createPersona,
  favorite,
  listConversations,
  listPersonas,
  login,
  onSessionExpired,
  publishPersona,
  register,
  restoreSession,
  updatePreferences,
} from "../lib/api";
import { personas as demoPersonas, type Persona } from "./data";

export type RecentChat = {
  conversationId?: string;
  persona: Persona;
  preview: string;
  time: string;
  unread: number;
};

function relationshipLabel(
  preset: Record<string, unknown> | string | null | undefined,
): string {
  if (typeof preset === "string" && preset.trim()) return preset;
  if (!preset || typeof preset !== "object") return "新朋友";

  const initialRelationship = preset["初始关系"];
  if (typeof initialRelationship === "string" && initialRelationship.trim()) {
    return initialRelationship;
  }

  const firstTextValue = Object.values(preset).find(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  );
  return firstTextValue ?? "新朋友";
}

function formatChatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86_400_000) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 172_800_000) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function apiPersonaToPersona(p: ApiPersona): Persona {
  const atlas = p.atlas as Persona["atlas"] | null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    category: p.category,
    tags: p.tags,
    intro: p.bio,
    hook: p.version?.greeting ?? "",
    accent: p.accent ?? "#a64b3c",
    panel: p.panel ?? 0,
    atlas: atlas ?? undefined,
    image: p.image ?? undefined,
    artTone: p.artTone ?? undefined,
    online: p.online,
    conversations: p.conversations ?? "—",
    relation: relationshipLabel(p.version?.relationshipPreset),
    voice: p.version?.voice ?? "—",
    suggestedReplies: p.version?.suggestedReplies,
  };
}

export function findPersonaByKey(list: Persona[], key: string): Persona | undefined {
  return list.find((p) => p.id === key || p.slug === key);
}

export function findHeroPersona(list: Persona[]): Persona {
  return (
    findPersonaByKey(list, "huo-qubing") ??
    list.find((p) => p.name === "霍去病") ??
    list[0] ??
    demoPersonas[0]
  );
}

export function useMiraApp(isApiMode: boolean) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [personaList, setPersonaList] = useState<Persona[]>(demoPersonas);
  const [favorites, setFavorites] = useState<string[]>(["huo-qubing", "pikachu"]);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [booting, setBooting] = useState(isApiMode);
  const [authLoading, setAuthLoading] = useState(false);
  const [globalToast, setGlobalToast] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setGlobalToast(message);
    window.setTimeout(() => setGlobalToast(""), 2600);
  }, []);

  const showRequestError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError && error.code === "AUTH_TOKEN_EXPIRED") return;
      showToast(error instanceof ApiError ? error.message : fallback);
    },
    [showToast],
  );

  useEffect(() => {
    return onSessionExpired(() => {
      setUser(null);
      setConversations([]);
      setConversationId(null);
      showToast("登录已过期，请重新登录");
    });
  }, [showToast]);

  const loadPersonas = useCallback(async () => {
    const items = await listPersonas();
    const mapped = items.map(apiPersonaToPersona);
    setPersonaList(mapped);
    setFavorites(items.filter((p) => p.favorited).map((p) => p.id));
    return mapped;
  }, []);

  const loadConversations = useCallback(async () => {
    const items = await listConversations();
    setConversations(items);
    return items;
  }, []);

  const refreshApiData = useCallback(async () => {
    await Promise.all([loadPersonas(), loadConversations()]);
  }, [loadConversations, loadPersonas]);

  useEffect(() => {
    if (!isApiMode) {
      setPersonaList(demoPersonas);
      setFavorites(["huo-qubing", "pikachu"]);
      setConversations([]);
      setUser(null);
      setConversationId(null);
      setBooting(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setBooting(true);
      try {
        const restored = await restoreSession();
        if (cancelled) return;
        if (restored) {
          setUser(restored);
          await refreshApiData();
        }
      } catch (error) {
        if (!cancelled) showRequestError(error, "连接服务器失败，请稍后重试");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isApiMode, refreshApiData, showRequestError]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    [conversations],
  );

  const recentChats: RecentChat[] = useMemo(() => {
    if (!isApiMode) return [];
    return conversations.slice(0, 3).flatMap((conv) => {
      const persona = personaList.find((p) => p.id === conv.personaId);
      if (!persona) return [];
      return [
        {
          conversationId: conv.id,
          persona,
          preview: conv.summary ?? "开始新的对话",
          time: formatChatTime(conv.lastMessageAt),
          unread: conv.unreadCount,
        },
      ];
    });
  }, [conversations, isApiMode, personaList]);

  const messageChats: RecentChat[] = useMemo(() => {
    if (!isApiMode) return [];
    return conversations.flatMap((conv) => {
      const persona = personaList.find((p) => p.id === conv.personaId);
      if (!persona) return [];
      return [
        {
          conversationId: conv.id,
          persona,
          preview: conv.summary ?? "开始新的对话",
          time: formatChatTime(conv.lastMessageAt),
          unread: conv.unreadCount,
        },
      ];
    });
  }, [conversations, isApiMode, personaList]);

  const handleAuth = useCallback(
    async (params: {
      isSignup: boolean;
      email: string;
      password: string;
      nickname?: string;
      skipAuth?: boolean;
    }): Promise<"home" | "onboarding" | "auth"> => {
      if (params.skipAuth || !isApiMode) {
        return params.isSignup ? "onboarding" : "home";
      }

      setAuthLoading(true);
      try {
        const nextUser = params.isSignup
          ? await register(params.email, params.password, params.nickname || "探索者")
          : await login(params.email, params.password);
        setUser(nextUser);
        await refreshApiData();
        return nextUser.preferences?.onboardingCompleted ? "home" : "onboarding";
      } catch (error) {
        const fallback = params.isSignup
          ? "注册失败，请检查邮箱与密码（至少 8 位，含字母和数字）"
          : "登录失败，请检查账号密码";
        showRequestError(error, fallback);
        return "auth";
      } finally {
        setAuthLoading(false);
      }
    },
    [isApiMode, refreshApiData, showRequestError],
  );

  const completeOnboardingFlow = useCallback(
    async (interests: string[], skipped = false) => {
      if (!isApiMode) return;
      try {
        const nextUser = await completeOnboarding(interests, skipped);
        setUser(nextUser);
      } catch (error) {
        showRequestError(error, "保存偏好失败");
      }
    },
    [isApiMode, showRequestError],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const next = !favorites.includes(id);
      setFavorites((items) =>
        next ? [...items, id] : items.filter((item) => item !== id),
      );

      if (!isApiMode) return;

      try {
        await favorite(id, next);
        setPersonaList((items) =>
          items.map((persona) =>
            persona.id === id
              ? { ...persona, relation: persona.relation }
              : persona,
          ),
        );
      } catch (error) {
        setFavorites((items) =>
          next ? items.filter((item) => item !== id) : [...items, id],
        );
        showRequestError(error, "收藏操作失败");
      }
    },
    [favorites, isApiMode, showRequestError],
  );

  const ensureConversation = useCallback(
    async (personaId: string, existingId?: string | null) => {
      if (existingId) {
        setConversationId(existingId);
        return existingId;
      }
      const found = conversations.find((item) => item.personaId === personaId);
      if (found) {
        setConversationId(found.id);
        return found.id;
      }
      const created = await createConversation(personaId);
      setConversations((items) => [created, ...items.filter((item) => item.id !== created.id)]);
      setConversationId(created.id);
      return created.id;
    },
    [conversations],
  );

  const openChat = useCallback(
    async (persona: Persona, existingConversationId?: string) => {
      if (!isApiMode) {
        const guestPersonaId = window.localStorage.getItem("mira-guest-persona-id");
        if (guestPersonaId && guestPersonaId !== persona.id) {
          showToast("游客最多体验一个角色会话，注册后可继续探索更多角色");
          return false;
        }
        window.localStorage.setItem("mira-guest-persona-id", persona.id);
        setConversationId(null);
        return true;
      }
      try {
        await ensureConversation(persona.id, existingConversationId ?? null);
        return true;
      } catch (error) {
        showRequestError(error, "无法打开对话");
        return false;
      }
    },
    [ensureConversation, isApiMode, showRequestError, showToast],
  );

  const syncThemePreference = useCallback(
    async (theme: "light" | "dark") => {
      if (!isApiMode || !user) return;
      try {
        const nextUser = await updatePreferences({ theme });
        setUser(nextUser);
      } catch {
        /* 主题仍以本地为准，静默失败 */
      }
    },
    [isApiMode, user],
  );

  const createPersonaFlow = useCallback(
    async (input: Parameters<typeof createPersona>[0]) => {
      if (!isApiMode) {
        const local: Persona = {
          id: `custom-${Date.now()}`,
          slug: `custom-${Date.now()}`,
          name: input.name,
          subtitle: input.subtitle,
          category: "原创角色",
          tags: input.tags,
          intro: input.bio,
          hook: input.greeting,
          accent: "#6f6256",
          panel: 0,
          image: input.avatarUrl,
          artTone: "#e9e4dc",
          online: true,
          conversations: "新角色",
          relation: "初见",
          voice: "自定义",
          suggestedReplies: input.suggestedReplies,
        };
        setPersonaList((items) => [local, ...items]);
        return local;
      }

      const draft = await createPersona(input);
      await publishPersona(draft.id);
      const published = apiPersonaToPersona({ ...draft, status: "published" } as ApiPersona);
      setPersonaList((items) => [published, ...items.filter((item) => item.id !== published.id)]);
      return published;
    },
    [isApiMode],
  );

  const applyUserTheme = useCallback((value: ApiUser | null) => {
    const theme = value?.preferences?.theme;
    if (theme === "light" || theme === "dark") return theme;
    return null;
  }, []);

  const displayName = isApiMode && user ? user.nickname : "林墨";

  return {
    user,
    personaList,
    favorites,
    conversations,
    booting,
    authLoading,
    globalToast,
    conversationId,
    unreadTotal,
    recentChats,
    messageChats,
    displayName,
    showToast,
    showRequestError,
    handleAuth,
    completeOnboardingFlow,
    toggleFavorite,
    openChat,
    syncThemePreference,
    applyUserTheme,
    refreshApiData,
    loadPersonas,
    createPersonaFlow,
  };
}
