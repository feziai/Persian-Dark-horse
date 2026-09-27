import { useCallback, useEffect, useState } from "react";

export type AccountProfile = {
  username: string | null;
  displayName: string;
  avatarId: string;
  bio: string;
  maritalStatus: string;
  lifeStage: string;
  occupation: string;
  valuesText: string;
  interestsText: string;
  customInstructions: string;
  interactionStyle: string;
  personalization: {
    language: "en" | "fa";
    theme: "light" | "dark" | "system";
    accent: string;
    sidebarCollapsed: boolean;
    notificationsEnabled: boolean;
    voiceEnabled: boolean;
  };
};

export type AccountSnapshot = {
  profile: AccountProfile;
  activity: Array<{ id: string; type: string; label: string; detail: string; createdAt: string }>;
  files: Array<{ id: string; name: string; mimeType: string; kind: string; createdAt: string }>;
  purchases: Array<{ id: string; planId: string; currencyId: string; txId: string; status: string; createdAt: string }>;
  memories: Array<{ id: string; userId: string; content: string; source: string; createdAt: string; updatedAt: string }>;
};

async function accountRequest<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, { credentials: "include", ...init });
  if (!response.ok) {
    let message = "Account request failed";
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Preserve a useful generic error when the server response is not JSON.
    }
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export function useAccount(enabled = true, userId?: string | null) {
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setAccount(null);
      setError(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      setAccount(await accountRequest<AccountSnapshot>("/api/account"));
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId]);

  useEffect(() => {
    setAccount(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onAccountUpdated = () => { void refresh(); };
    window.addEventListener("fezi-account-updated", onAccountUpdated);
    return () => window.removeEventListener("fezi-account-updated", onAccountUpdated);
  }, [enabled, refresh]);

  const saveProfile = useCallback(async (profile: Record<string, string | boolean | null>) => {
    const result = await accountRequest<{ profile: AccountProfile }>("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setAccount((current) => current ? { ...current, profile: result.profile } : current);
    window.dispatchEvent(new Event("fezi-account-updated"));
    return result.profile;
  }, []);

  const clearProfile = useCallback(async () => {
    await accountRequest<void>("/api/account/profile", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const saveMemory = useCallback(async (content: string, source = "chat") => {
    const result = await accountRequest<{ memory: AccountSnapshot["memories"][number] }>("/api/account/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, source }),
    });
    setAccount((current) => current ? { ...current, memories: [result.memory, ...current.memories] } : current);
    return result.memory;
  }, []);

  const updateMemory = useCallback(async (id: string, content: string) => {
    const result = await accountRequest<{ memory: AccountSnapshot["memories"][number] }>(`/api/account/memories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setAccount((current) => current ? { ...current, memories: current.memories.map((memory) => memory.id === id ? result.memory : memory) } : current);
    return result.memory;
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    await accountRequest<void>(`/api/account/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
    setAccount((current) => current ? { ...current, memories: current.memories.filter((memory) => memory.id !== id) } : current);
  }, []);

  return { account, isLoading, error, refresh, saveProfile, clearProfile, saveMemory, updateMemory, deleteMemory };
}