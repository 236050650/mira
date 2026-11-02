import type {
  MessageAcceptedEvent,
  MessageCompletedEvent,
  MessageDeltaEvent,
  MessageFailedEvent,
  SseEventName,
} from "@mira/contracts";

const REFRESH_KEY = "mira_refresh_token";
const THEME_KEY = "mira_theme";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_MIRA_API_URL) ||
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MIRA_API_URL) ||
  "http://127.0.0.1:4000";

export type ApiUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
  preferences?: {
    theme: "light" | "dark" | "system";
    interests: string[];
    defaultModelProfileId: string;
    onboardingCompleted: boolean;
  };
};

export type ApiPersona = {
  id: string;
  slug: string;
  name: string;
  category: string;
  subtitle: string;
  bio: string;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  accent: string | null;
  panel: number | null;
  atlas: string | null;
  image?: string | null;
  artTone?: string | null;
  online: boolean;
  conversations: string | null;
  favorited: boolean;
  version: {
    greeting: string;
    suggestedReplies: string[];
    voice: string | null;
    relationshipPreset?: Record<string, unknown> | string | null;
  } | null;
};

export type CreatePersonaInput = {
  name: string;
  subtitle: string;
  bio: string;
  tags: string[];
  greeting: string;
  suggestedReplies: string[];
  systemPrompt: string;
  speakingStyle?: Record<string, unknown>;
  knowledgeBoundary?: Record<string, unknown>;
  relationshipPreset?: Record<string, unknown>;
  memoryPolicy?: Record<string, unknown>;
  avatarUrl?: string;
  category?: "原创角色";
};

export type ApiConversation = {
  id: string;
  personaId: string;
  title: string;
  summary: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  persona: { id: string; name: string; avatarUrl: string | null; slug: string } | null;
};

export type ApiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: string;
  createdAt: string;
};

export type ModelsStatus = {
  defaultProfileId: string;
  mode: string;
  remoteTokensUsed: number;
  remoteTokenBudget: number;
  profiles: Array<{
    id: string;
    provider: string;
    model: string;
    displayName: string;
    available: boolean;
    latencyMs: number | null;
    detail: string | null;
  }>;
};

export type StreamHandlers = {
  onAccepted?: (data: MessageAcceptedEvent) => void;
  onDelta?: (data: MessageDeltaEvent) => void;
  onCompleted?: (data: MessageCompletedEvent) => void;
  onFailed?: (data: MessageFailedEvent) => void;
};

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let sessionExpiredNotified = false;

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired() {
  clearSession();
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  for (const listener of sessionExpiredListeners) listener();
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getStoredRefreshToken(): string | null {
  if (!hasStorage()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function persistRefreshToken(token: string | null): void {
  if (!hasStorage()) return;
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

export function getStoredTheme(): "light" | "dark" | null {
  if (!hasStorage()) return null;
  const value = localStorage.getItem(THEME_KEY);
  return value === "dark" || value === "light" ? value : null;
}

export function persistTheme(theme: "light" | "dark"): void {
  if (!hasStorage()) return;
  localStorage.setItem(THEME_KEY, theme);
}

export function clearSession(): void {
  accessToken = null;
  persistRefreshToken(null);
}

function setSession(payload: AuthPayload): ApiUser {
  accessToken = payload.accessToken;
  persistRefreshToken(payload.refreshToken);
  sessionExpiredNotified = false;
  return payload.user;
}

async function refresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const data = (await res.json()) as AuthPayload;
      accessToken = data.accessToken;
      persistRefreshToken(data.refreshToken);
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function extractErrorMessage(body: {
  error?: {
    message?: string;
    code?: string;
    details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  };
}): { message: string; code?: string } {
  const fieldErrors = body.error?.details?.fieldErrors;
  if (fieldErrors) {
    for (const messages of Object.values(fieldErrors)) {
      if (messages?.[0]) return { message: messages[0], code: body.error?.code };
    }
  }
  const formError = body.error?.details?.formErrors?.[0];
  if (formError) return { message: formError, code: body.error?.code };
  return { message: body.error?.message || "请求失败", code: body.error?.code };
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const base = API_BASE_URL.replace(/\/$/, "");
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`无法连接 API（${base}），请确认后端已启动`, 0, "NETWORK_ERROR");
  }

  if (res.status === 401 && retry) {
    const hadSession = Boolean(accessToken || getStoredRefreshToken());
    const ok = await refresh();
    if (ok) return request<T>(path, init, false);
    if (hadSession) {
      notifySessionExpired();
      throw new ApiError("登录已过期，请重新登录", 401, "AUTH_TOKEN_EXPIRED");
    }
    throw new ApiError("请先登录", 401, "AUTH_UNAUTHORIZED");
  }

  if (!res.ok) {
    let message = res.statusText || "请求失败";
    let code: string | undefined;
    try {
      const parsed = extractErrorMessage((await res.json()) as Parameters<typeof extractErrorMessage>[0]);
      message = parsed.message;
      code = parsed.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function restoreSession(): Promise<ApiUser | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  const ok = await refresh();
  if (!ok) return null;
  try {
    const data = await request<{ user: ApiUser }>("/v1/auth/me");
    return data.user;
  } catch {
    clearSession();
    return null;
  }
}

export async function register(
  email: string,
  password: string,
  nickname: string,
): Promise<ApiUser> {
  const data = await request<AuthPayload>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, nickname }),
  });
  return setSession(data);
}

export async function login(email: string, password: string): Promise<ApiUser> {
  const data = await request<AuthPayload>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, false);
  return setSession(data);
}

export { refresh };

export async function logout(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  try {
    if (refreshToken) {
      await request("/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    clearSession();
  }
}

export async function me(): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>("/v1/auth/me");
  return data.user;
}

export async function updatePreferences(body: {
  theme?: "light" | "dark" | "system";
  interests?: string[];
  defaultModelProfileId?: string;
  nickname?: string;
}): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>("/v1/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return data.user;
}

export async function completeOnboarding(interests: string[], skipped = false): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>("/v1/me/onboarding", {
    method: "POST",
    body: JSON.stringify({ interests, skipped }),
  });
  return data.user;
}

export async function listPersonas(params?: {
  category?: string;
  query?: string;
  favorite?: boolean;
}): Promise<ApiPersona[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.query) search.set("query", params.query);
  if (params?.favorite) search.set("favorite", "true");
  search.set("limit", "100");
  const items: ApiPersona[] = [];
  for (;;) {
    search.set("offset", String(items.length));
    const data = await request<{ items: ApiPersona[]; hasMore?: boolean }>(`/v1/personas?${search}`);
    items.push(...data.items);
    if (!data.hasMore || !data.items.length) return items;
  }
}

export async function getPersona(id: string): Promise<ApiPersona> {
  const data = await request<{ persona: ApiPersona }>(`/v1/personas/${id}`);
  return data.persona;
}

export async function favorite(id: string, favorited: boolean): Promise<void> {
  await request(`/v1/personas/${id}/favorite`, {
    method: favorited ? "POST" : "DELETE",
  });
}

export async function createPersona(body: CreatePersonaInput): Promise<ApiPersona> {
  const data = await request<{ persona: ApiPersona }>("/v1/personas", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.persona;
}

export async function publishPersona(id: string): Promise<void> {
  await request(`/v1/personas/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listConversations(): Promise<ApiConversation[]> {
  const data = await request<{ items: ApiConversation[] }>("/v1/conversations");
  return data.items;
}

export async function createConversation(personaId: string): Promise<ApiConversation> {
  const data = await request<{ conversation: ApiConversation }>("/v1/conversations", {
    method: "POST",
    body: JSON.stringify({ personaId }),
  });
  return data.conversation;
}

export async function listMessages(conversationId: string): Promise<ApiMessage[]> {
  const data = await request<{ items: ApiMessage[] }>(
    `/v1/conversations/${conversationId}/messages`,
  );
  return data.items;
}

function parseSseBlock(block: string): { event: SseEventName; data: unknown } | null {
  let event: SseEventName = "message.delta";
  let dataLine = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim() as SseEventName;
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

function dispatchSse(event: SseEventName, data: unknown, handlers: StreamHandlers) {
  switch (event) {
    case "message.accepted":
      handlers.onAccepted?.(data as MessageAcceptedEvent);
      break;
    case "message.delta":
      handlers.onDelta?.(data as MessageDeltaEvent);
      break;
    case "message.completed":
      handlers.onCompleted?.(data as MessageCompletedEvent);
      break;
    case "message.failed":
      handlers.onFailed?.(data as MessageFailedEvent);
      break;
  }
}

async function readSseResponse(res: Response, handlers: StreamHandlers, signal?: AbortSignal) {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    for (const block of text.split("\n\n")) {
      const parsed = parseSseBlock(block);
      if (parsed) dispatchSse(parsed.event, parsed.data, handlers);
    }
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const block of parts) {
      const parsed = parseSseBlock(block);
      if (parsed) dispatchSse(parsed.event, parsed.data, handlers);
    }
  }
  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    if (parsed) dispatchSse(parsed.event, parsed.data, handlers);
  }
}

async function authorizedSseFetch(url: string, body?: unknown, signal?: AbortSignal) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(url, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 401) {
    const hadSession = Boolean(accessToken || getStoredRefreshToken());
    const ok = await refresh();
    if (!ok) {
      if (hadSession) {
        notifySessionExpired();
        throw new ApiError("登录已过期，请重新登录", 401, "AUTH_TOKEN_EXPIRED");
      }
      throw new ApiError("请先登录", 401, "AUTH_UNAUTHORIZED");
    }
    headers.Authorization = `Bearer ${accessToken}`;
    res = await fetch(url, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  }

  return res;
}

export async function streamMessage(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const base = API_BASE_URL.replace(/\/$/, "");
  const clientMessageId = crypto.randomUUID();
  const res = await authorizedSseFetch(
    `${base}/v1/conversations/${conversationId}/messages/stream`,
    { clientMessageId, content },
    options?.signal,
  );
  if (!res.ok) throw new ApiError("发送失败", res.status);
  await readSseResponse(res, handlers, options?.signal);
}

export async function regenerateMessage(
  conversationId: string,
  messageId: string,
  handlers: StreamHandlers,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const base = API_BASE_URL.replace(/\/$/, "");
  const res = await authorizedSseFetch(
    `${base}/v1/conversations/${conversationId}/messages/${messageId}/regenerate`,
    {},
    options?.signal,
  );
  if (!res.ok) throw new ApiError("重新生成失败", res.status);
  await readSseResponse(res, handlers, options?.signal);
}

export async function stopGeneration(conversationId: string, generationId: string): Promise<void> {
  await request(`/v1/conversations/${conversationId}/generations/${generationId}/stop`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function modelsStatus(): Promise<ModelsStatus> {
  return request<ModelsStatus>("/v1/models/status");
}

export const miraApi = {
  register,
  login,
  refresh,
  me,
  updatePreferences,
  completeOnboarding,
  listPersonas,
  getPersona,
  favorite,
  createPersona,
  publishPersona,
  listConversations,
  createConversation,
  listMessages,
  streamMessage,
  regenerateMessage,
  stopGeneration,
  modelsStatus,
  restoreSession,
  logout,
  clearSession,
  onSessionExpired,
};
