"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Webhook, Plus, Trash2, Copy, Check, Send, Loader2, AlertCircle, X, Power,
} from "lucide-react";
import { MetricTile } from "@/components/admin/Charts";
import { relativeDate } from "@/lib/format";

interface Endpoint {
  id: string; url: string; events: string; description: string | null;
  enabled: boolean; createdAt: string; lastUsedAt: string | null; secretHint: string;
}
interface Delivery {
  id: number; endpointId: string; eventType: string; status: string; attempts: number;
  responseCode: number | null; lastError: string | null; createdAt: string;
}
interface Payload {
  endpoints: Endpoint[];
  deliveries: Delivery[];
  availableEvents: string[];
}

const STATUS_TONE: Record<string, string> = {
  delivered: "var(--color-state-delivered)",
  pending: "var(--color-state-opened)",
  failed: "var(--color-state-bounced)",
};

function SecretOnce({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fade-up mb-4 rounded-xl border p-4"
         style={{ borderColor: "var(--color-state-opened)", background: "var(--color-accent-tint)" }}>
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle size={15} style={{ color: "var(--accent-strong)" }} />
        <span className="text-[13px] font-semibold" style={{ color: "var(--accent-strong)" }}>
          Signing secret — shown once
        </span>
        <button onClick={onClose} className="ml-auto text-[var(--muted)] hover:text-[var(--text)]">
          <X size={15} />
        </button>
      </div>
      <p className="mb-2 text-[12.5px] text-[var(--muted)]">
        Store this now. It is not retrievable afterwards — you would have to recreate the endpoint.
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-white p-2.5">
        <code className="mono flex-1 break-all text-[12px]">{secret}</code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
              setCopied(true); setTimeout(() => setCopied(false), 1500);
            } catch { /* clipboard blocked; the value is selectable */ }
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-black/5"
        >
          {copied ? <Check size={14} style={{ color: "var(--color-state-delivered)" }} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function WebhooksPanel() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["webhooks"],
    refetchInterval: 15_000,
    queryFn: async (): Promise<Payload> => {
      const res = await fetch("/api/webhooks");
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not load webhooks");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/webhooks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selected }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create endpoint");
      return body as { secret: string };
    },
    onSuccess: (b) => {
      setFreshSecret(b.secret); setAdding(false); setUrl(""); setSelected([]); setError(null);
      void qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; enabled: boolean }) => {
      await fetch(`/api/webhooks/${v.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: v.enabled }),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/webhooks/${id}`, { method: "DELETE" }); },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const fire = useMutation({
    mutationFn: async (test: boolean) => {
      const res = await fetch(`/api/webhooks/drain${test ? "?test=1" : ""}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Delivery failed");
      return body as { delivered: number; failed: number; retrying: number };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["webhooks"] }),
    onError: (e: Error) => setError(e.message),
  });

  if (q.isLoading) {
    return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="shimmer h-28 rounded-xl" />)}</div>;
  }

  const d = q.data;
  const pending = d?.deliveries.filter((x) => x.status === "pending").length ?? 0;
  const failed = d?.deliveries.filter((x) => x.status === "failed").length ?? 0;

  return (
    <div className="fade-up space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Endpoints" value={String(d?.endpoints.length ?? 0)} />
        <MetricTile label="Pending" value={String(pending)}
                    tone={pending ? "var(--color-state-opened)" : undefined} />
        <MetricTile label="Failed" value={String(failed)}
                    tone={failed ? "var(--color-state-bounced)" : undefined} />
        <MetricTile label="Events" value={String(d?.availableEvents.length ?? 0)} sub="subscribable" />
      </div>

      {freshSecret && <SecretOnce secret={freshSecret} onClose={() => setFreshSecret(null)} />}

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <Webhook size={15} className="text-[var(--muted)]" />
          <h2 className="text-[13px] font-medium">Endpoints</h2>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => fire.mutate(true)}
              disabled={fire.isPending || !d?.endpoints.length}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-[12px] hover:bg-[var(--color-hover)] disabled:opacity-40"
            >
              {fire.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send test event
            </button>
            <button
              onClick={() => { setAdding((v) => !v); setError(null); }}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-[12px] hover:bg-[var(--color-hover)]"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {adding && (
          <div className="fade-up border-b border-[var(--line)] p-4">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://your-app.example.com/hooks/raymail"
              className="mono mb-3 h-10 w-full rounded-lg border border-[var(--color-line-strong)] px-3 text-[13px] outline-none focus:border-[var(--accent-strong)]"
            />
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(d?.availableEvents ?? []).map((ev) => {
                const on = selected.includes(ev);
                return (
                  <button
                    key={ev}
                    onClick={() => setSelected((s) => on ? s.filter((x) => x !== ev) : [...s, ev])}
                    className={`mono rounded-full border px-2.5 py-1 text-[11px] transition-colors
                      ${on ? "border-[var(--accent-strong)] bg-[var(--color-accent-tint)]"
                           : "border-[var(--line)] hover:bg-[var(--color-hover)]"}`}
                  >
                    {ev}
                  </button>
                );
              })}
            </div>
            <p className="mb-3 text-[12px] text-[var(--muted)]">
              Select none to receive every event.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !url.trim()}
                className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-[13px] font-medium text-white disabled:opacity-40"
              >
                {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Create endpoint
              </button>
              <button onClick={() => setAdding(false)}
                      className="h-9 rounded-lg px-3 text-[13px] text-[var(--muted)] hover:bg-[var(--color-hover)]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 border-b border-[var(--line)] px-4 py-2.5 text-[12.5px]"
             style={{ color: "var(--color-state-bounced)" }}>
            <AlertCircle size={13} /> {error}
          </p>
        )}

        {d?.endpoints.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">
            No endpoints yet.
            <br />
            <span className="text-[var(--faint)]">
              Add one to push delivery, open, click and bounce events into your own systems.
            </span>
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {d?.endpoints.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: e.enabled ? "var(--color-state-delivered)" : "var(--color-ink-faint)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="mono truncate text-[12.5px]">{e.url}</p>
                    <p className="text-[11.5px] text-[var(--muted)]">
                      {e.events === "*" ? "all events" : e.events.split(",").join(" · ")}
                      {" · "}
                      <span className="mono">{e.secretHint}</span>
                      {e.lastUsedAt && ` · last fired ${relativeDate(e.lastUsedAt)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle.mutate({ id: e.id, enabled: !e.enabled })}
                    title={e.enabled ? "Disable" : "Enable"}
                    className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
                  >
                    <Power size={15} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete this endpoint and its delivery history?`)) remove.mutate(e.id); }}
                    title="Delete"
                    className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[13px] font-medium">Recent deliveries</h2>
          <button
            onClick={() => fire.mutate(false)}
            disabled={fire.isPending}
            className="ml-auto rounded-full border border-[var(--color-line-strong)] px-3 py-1 text-[12px] hover:bg-[var(--color-hover)] disabled:opacity-40"
          >
            Deliver pending now
          </button>
        </div>

        {d?.deliveries.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">
            Nothing delivered yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[var(--faint)]">
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Attempts</th>
                  <th className="px-4 py-2.5 text-right font-medium">Code</th>
                  <th className="px-4 py-2.5 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {d?.deliveries.slice(0, 25).map((x) => (
                  <tr key={x.id} className="border-t border-[var(--line)]">
                    <td className="mono px-4 py-2.5 text-[12px]">{x.eventType}</td>
                    <td className="px-4 py-2.5">
                      <span className="mono text-[11.5px]" style={{ color: STATUS_TONE[x.status] }}>
                        {x.status}
                      </span>
                      {x.lastError && (
                        <span className="ml-2 text-[11px] text-[var(--muted)]">{x.lastError}</span>
                      )}
                    </td>
                    <td className="mono px-4 py-2.5 text-right text-[12px]">{x.attempts}</td>
                    <td className="mono px-4 py-2.5 text-right text-[12px] text-[var(--muted)]">
                      {x.responseCode ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11.5px] text-[var(--muted)]">
                      {relativeDate(x.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
