"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Mailbox, MessageSummary, MessageBody } from "@/types/mail";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: Infinity,
    queryFn: () => get<{ username: string; accountId: string }>("/api/me"),
  });
}

export function useMailboxes() {
  return useQuery({
    queryKey: ["mailboxes"],
    queryFn: () => get<{ mailboxes: Mailbox[] }>("/api/mailboxes").then((r) => r.mailboxes),
  });
}

export function useMessages(mailboxId: string | null) {
  return useQuery({
    queryKey: ["messages", mailboxId],
    enabled: Boolean(mailboxId),
    queryFn: () =>
      get<{ messages: MessageSummary[] }>(
        `/api/messages?mailboxId=${encodeURIComponent(mailboxId ?? "")}`,
      ).then((r) => r.messages),
  });
}

export function useMessage(id: string | null) {
  return useQuery({
    queryKey: ["message", id],
    enabled: Boolean(id),
    queryFn: () => get<{ message: MessageBody }>(`/api/messages/${id}`).then((r) => r.message),
  });
}

export function useSetKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; keyword: string; value: boolean }) => {
      const res = await fetch(`/api/messages/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: v.keyword, value: v.value }),
      });
      if (!res.ok) throw new Error("Could not update message");
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["mailboxes"] });
    },
  });
}

export function useMoveMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; from: string | null; moveTo: string }) => {
      const res = await fetch(`/api/messages/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveTo: v.moveTo, from: v.from }),
      });
      if (!res.ok) throw new Error("Could not move message");
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["mailboxes"] });
    },
  });
}

export function useSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: unknown) => {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Send failed");
      return body;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
