"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, KeyRound, Trash2, Copy, Check, ShieldAlert, Loader2,
  Globe, Radio, Inbox, Send, AlertCircle, X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MetricTile } from "@/components/admin/Charts";
import { bytes, relativeDate } from "@/lib/format";

interface Overview {
  accounts: {
    id: string; name: string; emailAddress: string; description: string | null;
    domainId: string; usedDiskQuota: number; roles: { "@type": string }; createdAt: string;
  }[];
  domains: { id: string; name: string; isEnabled: boolean; createdAt: string }[];
  dkim: { id: string; selector: string; publicKey: string; "@type": string }[];
  listeners: { id: string; name: string; protocol: string; bind: Record<string, boolean>; tlsImplicit: boolean }[];
  routes: { id: string; name: string; "@type": string; address?: string; port?: number; authUsername?: string }[];
  queue: { id: string; [k: string]: unknown }[];
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--color-page)] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="mono text-[11px] text-[var(--muted)]">{label}</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setDone(true); setTimeout(() => setDone(false), 1500);
            } catch { /* clipboard blocked; the value is selectable anyway */ }
          }}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] hover:bg-[var(--color-hover)]"
        >
          {done ? <Check size={11} style={{ color: "var(--color-state-delivered)" }} /> : <Copy size={11} />}
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mono break-all text-[11.5px] leading-relaxed text-[var(--text)]">{value}</p>
    </div>
  );
}

function NewMailbox({ domainId, onDone }: { domainId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/server/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, secret, domainId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create mailbox");
      return body;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["server-overview"] }); onDone(); },
    onError: (e: Error) => setError(e.message),
  });

  // Generated rather than typed: a mailbox password is never memorised, and a
  // weak one here is a spam relay waiting to happen.
  const generate = () => {
    const bytesArr = new Uint8Array(15);
    crypto.getRandomValues(bytesArr);
    setSecret(btoa(String.fromCharCode(...bytesArr)).replace(/[^A-Za-z0-9]/g, "").slice(0, 18));
  };

  return (
    <div className="fade-up rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <h3 className="mb-3 text-[13px] font-medium">New mailbox</h3>
      <div className="flex flex-wrap items-start gap-3">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="local part, e.g. sales"
          className="h-10 w-[180px] rounded-lg border border-[var(--color-line-strong)] px-3 text-[13px] outline-none focus:border-[var(--accent-strong)]"
        />
        <div className="flex items-center gap-2">
          <input
            value={secret}
            onChange={(e) => { setSecret(e.target.value); setError(null); }}
            placeholder="password"
            className="mono h-10 w-[220px] rounded-lg border border-[var(--color-line-strong)] px-3 text-[13px] outline-none focus:border-[var(--accent-strong)]"
          />
          <button onClick={generate}
                  className="rounded-lg border border-[var(--color-line-strong)] px-3 py-2 text-[12px] hover:bg-[var(--color-hover)]">
            Generate
          </button>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !name || !secret}
          className="flex h-10 items-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Create
        </button>
        <button onClick={onDone} className="grid h-10 w-10 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--color-hover)]">
          <X size={16} />
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-state-bounced)" }}>
          <AlertCircle size={13} /> {error}
        </p>
      )}
      {secret && !create.isPending && (
        <p className="mt-2 text-[12px] text-[var(--muted)]">
          Save this password now - it is hashed on the server and cannot be shown again.
        </p>
      )}
    </div>
  );
}

export function ServerConsole() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState("");

  const q = useQuery({
    queryKey: ["server-overview"],
    retry: false,
    queryFn: async (): Promise<Overview> => {
      const res = await fetch("/api/server/overview");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not reach the mail server");
      return body;
    },
  });

  const resetPw = useMutation({
    mutationFn: async (v: { id: string; secret: string }) => {
      const res = await fetch(`/api/server/accounts/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: v.secret }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => { setResetting(null); setNewSecret(""); },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/server/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["server-overview"] }),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="shimmer h-24 rounded-xl" />)}
      </div>
    );
  }

  if (q.isError) {
    const forbidden = (q.error as Error).message.toLowerCase().includes("authoriz");
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-8 text-center">
        <ShieldAlert size={32} className="mx-auto mb-3 text-[var(--muted)]" />
        <p className="text-[15px] font-medium">{forbidden ? "Administrator access required" : "Mail server unreachable"}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-[var(--muted)]">
          {forbidden
            ? "This console is available to the server administrator account. Sign in as the admin mailbox to manage accounts, domains and the queue."
            : (q.error as Error).message}
        </p>
      </div>
    );
  }

  const d = q.data!;
  const domain = d.domains[0];

  return (
    <div className="fade-up space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Mailboxes" value={String(d.accounts.length)} />
        <MetricTile label="Domains" value={String(d.domains.length)} />
        <MetricTile label="Listeners" value={String(d.listeners.length)} />
        <MetricTile
          label="Queued"
          value={String(d.queue.length)}
          tone={d.queue.length > 0 ? "var(--color-state-opened)" : undefined}
          sub={d.queue.length ? "awaiting delivery" : "nothing waiting"}
        />
      </div>

      {/* ---- mailboxes ---- */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <Inbox size={15} className="text-[var(--muted)]" />
          <h2 className="text-[13px] font-medium">Mailboxes</h2>
          <button
            onClick={() => setAdding((v) => !v)}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-3 py-1.5 text-[12px] hover:bg-[var(--color-hover)]"
          >
            <UserPlus size={13} /> Add
          </button>
        </div>

        {adding && domain && (
          <div className="border-b border-[var(--line)] p-4">
            <NewMailbox domainId={domain.id} onDone={() => setAdding(false)} />
          </div>
        )}

        <ul className="divide-y divide-[var(--line)]">
          {d.accounts.map((a) => {
            const isAdmin = a.roles?.["@type"] === "Admin";
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar person={{ email: a.emailAddress }} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px]">{a.emailAddress}</span>
                      {isAdmin && (
                        <span className="rounded-full bg-[var(--color-accent-tint)] px-2 py-0.5 text-[10px] font-medium"
                              style={{ color: "var(--accent-strong)" }}>
                          admin
                        </span>
                      )}
                    </div>
                    <span className="text-[11.5px] text-[var(--muted)]">
                      {bytes(a.usedDiskQuota)} used &middot; created {relativeDate(a.createdAt)}
                    </span>
                  </div>

                  <button
                    onClick={() => { setResetting(resetting === a.id ? null : a.id); setNewSecret(""); }}
                    title="Change password"
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${a.emailAddress}? All of its mail is removed and this cannot be undone.`)) {
                        removeAccount.mutate(a.id);
                      }
                    }}
                    disabled={isAdmin}
                    title={isAdmin ? "The administrator account cannot be deleted here" : "Delete mailbox"}
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)] disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {resetting === a.id && (
                  <div className="fade-up mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-page)] p-3">
                    <input
                      value={newSecret}
                      onChange={(e) => setNewSecret(e.target.value)}
                      placeholder="new password (min 10 chars)"
                      className="mono h-9 w-[240px] rounded-lg border border-[var(--color-line-strong)] px-3 text-[13px] outline-none"
                    />
                    <button
                      onClick={() => resetPw.mutate({ id: a.id, secret: newSecret })}
                      disabled={newSecret.length < 10 || resetPw.isPending}
                      className="h-9 rounded-lg bg-[var(--accent-strong)] px-4 text-[13px] text-white disabled:opacity-40"
                    >
                      {resetPw.isPending ? "Saving..." : "Set password"}
                    </button>
                    {resetPw.error && (
                      <span className="text-[12px]" style={{ color: "var(--color-state-bounced)" }}>
                        {(resetPw.error as Error).message}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- domain + DNS ---- */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <Globe size={15} className="text-[var(--muted)]" />
          <h2 className="text-[13px] font-medium">Domain &amp; DNS</h2>
          {domain && (
            <span className="mono ml-auto text-[12px] text-[var(--muted)]">{domain.name}</span>
          )}
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {d.dkim.map((k) => (
            <CopyField
              key={k.id}
              label={`${k.selector}._domainkey`}
              value={`v=DKIM1; k=${k["@type"].includes("Rsa") ? "rsa" : "ed25519"}; p=${k.publicKey}`}
            />
          ))}
          {domain && (
            <>
              <CopyField
                label="SPF (TXT on the mail host)"
                value={`v=spf1 mx a:${domain.name} ~all`}
              />
              <CopyField
                label="DMARC (_dmarc)"
                value={`v=DMARC1; p=none; rua=mailto:dmarc@${domain.name}; adkim=r; aspf=r; pct=100`}
              />
            </>
          )}
        </div>
      </section>

      {/* ---- transport ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
            <Radio size={15} className="text-[var(--muted)]" />
            <h2 className="text-[13px] font-medium">Listeners</h2>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {d.listeners.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="mono w-[110px] shrink-0 text-[12px]">{Object.keys(l.bind)[0]}</span>
                <span className="text-[12.5px] uppercase text-[var(--muted)]">{l.protocol}</span>
                <span className="ml-auto text-[11px]"
                      style={{ color: l.tlsImplicit ? "var(--color-state-delivered)" : "var(--muted)" }}>
                  {l.tlsImplicit ? "implicit TLS" : "STARTTLS"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
            <Send size={15} className="text-[var(--muted)]" />
            <h2 className="text-[13px] font-medium">Outbound routes</h2>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {d.routes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[12.5px]">{r.name}</span>
                <span className="rounded-full bg-[var(--color-hover)] px-2 py-0.5 text-[10.5px] text-[var(--muted)]">
                  {r["@type"]}
                </span>
                {r.address && (
                  <span className="mono ml-auto truncate text-[11.5px] text-[var(--muted)]">
                    {r.address}:{r.port}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
