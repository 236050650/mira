"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../lib/api";

export type ApiMode = "demo" | "api";

const MODE_OVERRIDE_KEY = "mira_api_mode_override";

function readEnvApiUrl(): string | null {
  const viteUrl =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_MIRA_API_URL
      : undefined;
  const nextUrl =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MIRA_API_URL : undefined;
  const url = (viteUrl || nextUrl || "").trim();
  return url || null;
}

function readOverride(): ApiMode | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(MODE_OVERRIDE_KEY);
  return value === "demo" || value === "api" ? value : null;
}

/**
 * Demo 为默认模式；当 VITE_MIRA_API_URL 或 NEXT_PUBLIC_MIRA_API_URL 存在时自动启用 API 模式。
 * 可通过 setMode 在开发时手动切换（仅影响前端数据源选择，不存储消息等业务数据）。
 *
 * 首屏固定为 demo，等 mount 后再读 env/localStorage，避免 SSR hydration mismatch。
 */
export function useApiMode() {
  const envApiUrl = useMemo(() => readEnvApiUrl(), []);
  const defaultMode: ApiMode = envApiUrl ? "api" : "demo";
  const canUseApiMode =
    Boolean(envApiUrl) ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"));

  const [override, setOverrideState] = useState<ApiMode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOverrideState(readOverride());
    setHydrated(true);
  }, []);

  const mode: ApiMode =
    hydrated && canUseApiMode ? (override ?? defaultMode) : "demo";
  const apiUrl = envApiUrl ?? API_BASE_URL;

  const setMode = useCallback((next: ApiMode | null) => {
    if (next === "api" && !canUseApiMode) {
      setOverrideState(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(MODE_OVERRIDE_KEY);
      }
      return;
    }
    setOverrideState(next);
    if (typeof window === "undefined") return;
    if (next) localStorage.setItem(MODE_OVERRIDE_KEY, next);
    else localStorage.removeItem(MODE_OVERRIDE_KEY);
  }, [canUseApiMode]);

  return {
    mode,
    isApiMode: mode === "api",
    isDemoMode: mode === "demo",
    apiUrl,
    envApiUrl,
    canUseApiMode,
    setMode,
    resetMode: () => setMode(null),
  };
}
