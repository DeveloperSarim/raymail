"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

export interface AiStatus {
  configured: boolean;
  model: string;
  usage: { calls: number; tokensIn: number; tokensOut: number; cachedEntries: number };
}

export interface Summary {
  summary: string;
  actions: string[];
  urgency: "low" | "normal" | "high";
  cached?: boolean;
}

export interface Overview {
  headline: string;
  themes: { label: string; detail: string }[];
  needsReply: string[];
  cached?: boolean;
  counted?: number;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "AI request failed");
  return json as T;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: async (): Promise<AiStatus> => {
      const res = await fetch("/api/ai/status");
      if (!res.ok) return { configured: false, model: "", usage: { calls: 0, tokensIn: 0, tokensOut: 0, cachedEntries: 0 } };
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

/** Summaries are cached server-side, so re-opening a message is free. */
export function useSummary(messageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["ai-summary", messageId],
    enabled: Boolean(messageId) && enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: () => post<Summary>("/api/ai/summarize", { messageId }),
  });
}

export function useOverview(mailboxId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["ai-overview", mailboxId],
    enabled: Boolean(mailboxId) && enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => post<Overview>("/api/ai/overview", { mailboxId }),
  });
}

export function useDraft() {
  return useMutation({
    mutationFn: (input: {
      mode: "compose" | "reply";
      prompt?: string;
      tone?: string;
      messageId?: string;
    }) => post<{ html: string; usage?: { tokensIn: number; tokensOut: number } }>("/api/ai/draft", input),
  });
}
