"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, HardDrive, Search, Sparkles, Activity, Send, Download,
  FileText, Image as ImageIcon, RefreshCw, Server,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { StageBadge } from "@/components/ui/StageBadge";
import { MetricTile, Funnel, Engagement } from "@/components/admin/Charts";
import { ServerConsole } from "@/components/admin/ServerConsole";
import { AttachmentPreview, isPreviewable } from "@/components/AttachmentPreview";
import { useAiStatus } from "@/hooks/useAi";
import { bytes, relativeDate } from "@/lib/format";
import type { TelemetrySummary, TrackedMessage } from "@/types/telemetry";
import type { Attachment } from "@/types/mail";

interface TelemetryPayload {
  summary: TelemetrySummary;
  recent: TrackedMessage[];
  daily: { day: string; type: string; n: number }[];
}
interface VaultFile {
  blobId: string; name: string; type: string; size: number; sender: string; seenAt: string;
}
interface VaultPayload {
  files: VaultFile[];
  byType: { type: string; count: number; bytes: number }[];
  total: { count: number; bytes: number };
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

type Tab = "overview" | "delivery" | "vault" | "server";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "delivery", label: "Delivery", icon: Send },
  { id: "vault", label: "Vault", icon: HardDrive },
  { id: "server", label: "Mail server", icon: Server },
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [previewAt, setPreviewAt] = useState<number | null>(null);

  const t = useQuery({
    queryKey: ["telemetry", days],
    queryFn: () => get<TelemetryPayload>(`/api/telemetry?days=${days}`),
  });
  const v = useQuery({ queryKey: ["vault"], queryFn: () => get<VaultPayload>("/api/attachments") });
  const ai = useAiStatus();

  const s = t.data?.summary;

  const audit = useMemo(() => {
    const rows = t.data?.recent ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.recipient.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.stage.includes(q),
    );
  }, [t.data, query]);

  const files = useMemo(() => {
    const rows = v.data?.files ?? [];
    return typeFilter ? rows.filter((f) => f.type === typeFilter) : rows;
  }, [v.data, typeFilter]);

  // The preview overlay speaks the mail Attachment shape; the vault stores a
  // flatter row, so adapt rather than duplicating the viewer.
  const asAttachments: Attachment[] = files.map((f) => ({
    blobId: f.blobId, name: f.name, type: f.type, size: f.size, disposition: "attachment",
  }));

  return (
    <main className="min-h-dvh bg-[var(--color-page)]">
      <header className="sticky top-0 z-30 bg-[var(--color-page)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <a href="/" aria-label="Back to mail"
             className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]">
            <ArrowLeft size={19} />
          </a>
          <Logo size={22} withWordmark />
          <span className="rounded-full bg-[var(--color-accent-tint)] px-2.5 py-0.5 text-[11px] font-medium"
                style={{ color: "var(--accent-strong)" }}>
            Admin
          </span>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Time window"
              className="h-9 rounded-full border border-[var(--color-line-strong)] bg-white px-3 text-[13px] outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => { void t.refetch(); void v.refetch(); }}
              aria-label="Refresh"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
            >
              <RefreshCw size={16} className={t.isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((x) => {
            const active = tab === x.id;
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] transition-colors
                  ${active
                    ? "border-[var(--accent-strong)] font-medium text-[var(--accent-strong)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`}
              >
                <x.icon size={15} />
                {x.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {t.isError && (
          <p className="rounded-xl border border-[var(--line)] bg-white p-4 text-[14px]"
             style={{ color: "var(--color-state-bounced)" }}>
            Sign in to view insights.
          </p>
        )}

        {tab === "overview" && (
          <div className="fade-up space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile label="Sent" value={s ? String(s.totalSent) : "-"} sub={`last ${days} days`} />
              <MetricTile label="Open rate" value={s ? `${s.openRate}%` : "-"}
                          tone="var(--color-state-opened)"
                          sub={s ? `${s.uniqueOpens} unique - ${s.totalOpens} total` : undefined} />
              <MetricTile label="Click rate" value={s ? `${s.clickRate}%` : "-"}
                          tone="var(--color-state-clicked)"
                          sub={s ? `${s.uniqueClicks} unique` : undefined} />
              <MetricTile label="Bounce rate" value={s ? `${s.bounceRate}%` : "-"}
                          tone={s && s.bounceRate > 5 ? "var(--color-state-bounced)" : undefined}
                          sub={s ? `${s.bounced} bounced` : undefined} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-medium">Delivery funnel</h2>
                <Funnel
                  sent={s?.totalSent ?? 0}
                  delivered={s?.delivered ?? 0}
                  opened={s?.uniqueOpens ?? 0}
                  clicked={s?.uniqueClicks ?? 0}
                />
              </section>

              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <h2 className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-medium">Engagement over time</h2>
                <Engagement daily={t.data?.daily ?? []} />
              </section>
            </div>

            {ai.data?.configured && (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <h2 className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3 text-[13px] font-medium">
                  <Sparkles size={14} style={{ color: "var(--accent-strong)" }} />
                  AI assistant
                  <span className="mono ml-auto text-[11px] text-[var(--faint)]">{ai.data.model}</span>
                </h2>
                <div className="grid grid-cols-3 divide-x divide-[var(--line)]">
                  <div className="p-4">
                    <div className="mono text-[20px]">{ai.data.usage.tokensIn.toLocaleString()}</div>
                    <div className="text-[12px] text-[var(--muted)]">tokens in</div>
                  </div>
                  <div className="p-4">
                    <div className="mono text-[20px]">{ai.data.usage.tokensOut.toLocaleString()}</div>
                    <div className="text-[12px] text-[var(--muted)]">tokens out</div>
                  </div>
                  <div className="p-4">
                    <div className="mono text-[20px]" style={{ color: "var(--color-state-delivered)" }}>
                      {ai.data.usage.cachedEntries.toLocaleString()}
                    </div>
                    <div className="text-[12px] text-[var(--muted)]">cached, reused free</div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "delivery" && (
          <section className="fade-up rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-[13px] font-medium">Transaction audit</h2>
              <div className="relative ml-auto w-full max-w-[280px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by recipient, subject, stage"
                  className="h-9 w-full rounded-full border border-[var(--color-line-strong)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[var(--accent-strong)]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-[var(--faint)]">
                    <th className="px-4 py-2.5 font-medium">Recipient</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium">Stage</th>
                    <th className="px-4 py-2.5 text-right font-medium">Opens</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clicks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((m) => (
                    <tr key={m.id} className="border-t border-[var(--line)] hover:bg-[var(--color-hover)]">
                      <td className="mono max-w-[220px] truncate px-4 py-2.5 text-[12px]">{m.recipient}</td>
                      <td className="max-w-[280px] truncate px-4 py-2.5 text-[13px] text-[var(--muted)]">
                        {m.subject}
                        {m.bounceReason && (
                          <span className="block truncate text-[11px]" style={{ color: "var(--color-state-bounced)" }}>
                            {m.bounceReason}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><StageBadge stage={m.stage} /></td>
                      <td className="mono px-4 py-2.5 text-right text-[12px]">{m.openCount}</td>
                      <td className="mono px-4 py-2.5 text-right text-[12px]">{m.clickCount}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-[var(--muted)]">{relativeDate(m.sentAt)}</td>
                    </tr>
                  ))}
                  {audit.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">
                        {query ? `Nothing matches "${query}".` : "Nothing sent in this window."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "vault" && (
          <section className="fade-up space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile label="Files" value={String(v.data?.total.count ?? 0)} />
              <MetricTile label="Storage" value={v.data ? bytes(v.data.total.bytes) : "-"} />
              <MetricTile label="Types" value={String(v.data?.byType.length ?? 0)} />
            </div>

            {v.data && v.data.byType.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTypeFilter(null)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors
                    ${typeFilter === null
                      ? "border-[var(--accent-strong)] bg-[var(--color-accent-tint)]"
                      : "border-[var(--line)] bg-white hover:bg-[var(--color-hover)]"}`}
                >
                  All
                </button>
                {v.data.byType.map((b) => (
                  <button
                    key={b.type}
                    onClick={() => setTypeFilter(b.type === typeFilter ? null : b.type)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors
                      ${typeFilter === b.type
                        ? "border-[var(--accent-strong)] bg-[var(--color-accent-tint)]"
                        : "border-[var(--line)] bg-white hover:bg-[var(--color-hover)]"}`}
                  >
                    {b.type.split("/").pop()}
                    <span className="ml-1.5 text-[var(--faint)]">{b.count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              {files.length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-[var(--muted)]">
                  No attachments indexed yet.
                  <br />
                  <span className="text-[var(--faint)]">Files are catalogued as messages are opened.</span>
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {files.map((f, i) => (
                    <li key={f.blobId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-hover)]">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-hover)]">
                        {/^image\//i.test(f.type)
                          ? <ImageIcon size={16} className="text-[var(--muted)]" />
                          : <FileText size={16} className="text-[var(--muted)]" />}
                      </span>
                      <button
                        onClick={() => isPreviewable(f.type) && setPreviewAt(i)}
                        disabled={!isPreviewable(f.type)}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                      >
                        <span className="block truncate text-[13px]">{f.name}</span>
                        <span className="block truncate text-[11px] text-[var(--muted)]">{f.sender}</span>
                      </button>
                      <span className="mono hidden w-20 text-right text-[11px] text-[var(--muted)] sm:block">
                        {bytes(f.size)}
                      </span>
                      <a
                        href={`/api/attachments/${f.blobId}?name=${encodeURIComponent(f.name)}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-black/5"
                        title="Download"
                      >
                        <Download size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {tab === "server" && <ServerConsole />}
      </div>

      {previewAt !== null && (
        <AttachmentPreview
          items={asAttachments}
          index={previewAt}
          onIndex={setPreviewAt}
          onClose={() => setPreviewAt(null)}
        />
      )}
    </main>
  );
}
