"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, Reply, ReplyAll, Forward, Trash2, Paperclip, ImageOff,
  Sparkles, ChevronDown, AlertCircle, Download,
} from "lucide-react";
import type { MessageBody } from "@/types/mail";
import { displayName, relativeDate, bytes } from "@/lib/format";
import { useUi } from "@/lib/store";
import { Avatar } from "@/components/ui/Avatar";
import { useSummary } from "@/hooks/useAi";
import { AttachmentPreview, isPreviewable } from "@/components/AttachmentPreview";

/* Remote images stay blocked until asked for. Shipping open-tracking and then
 * loading everyone else's beacons on sight would be incoherent. */
function stripRemote(html: string): string {
  return html
    .replace(/(<img\b[^>]*?)\ssrc\s*=\s*["']https?:\/\/[^"']*["']/gi, "$1")
    .replace(/background\s*=\s*["']https?:\/\/[^"']*["']/gi, "");
}

const ESCAPE: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;" };

function documentFor(html: string): string {
  // No allow-scripts on the iframe, so nothing here executes. The CSP is a
  // second wall if that sandbox is ever loosened.
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'">
<style>
 html,body{margin:0;padding:0 8px 24px;background:#fff;color:#1F2328;
  font:14px/1.6 Roboto,ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif;
  word-break:break-word;overflow-wrap:anywhere}
 img{max-width:100%;height:auto}
 a{color:#8A5A0B}
 table{max-width:100%}
 blockquote{margin:0 0 0 12px;padding-left:12px;border-left:2px solid #E4E7EC;color:#5B6169}
 pre{white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace}
</style></head><body>${html}</body></html>`;
}

function AiSummary({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const q = useSummary(messageId, open);

  const tone =
    q.data?.urgency === "high" ? "var(--color-state-bounced)"
    : q.data?.urgency === "normal" ? "var(--accent-strong)"
    : "var(--muted)";

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--color-accent-tint)]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <Sparkles size={15} style={{ color: "var(--accent-strong)" }} />
        <span className="flex-1 text-[13px] font-semibold" style={{ color: "var(--accent-strong)" }}>
          Summarise this email
        </span>
        {q.data?.cached && <span className="text-[11px] text-[var(--muted)]">cached</span>}
        <ChevronDown size={16} className={`text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--line)] bg-white px-4 py-3">
          {q.isLoading && (
            <div className="space-y-2">
              <div className="shimmer h-4 w-3/4 rounded" />
              <div className="shimmer h-4 w-1/2 rounded" />
            </div>
          )}
          {q.isError && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
              <AlertCircle size={14} /> {(q.error as Error).message}
            </p>
          )}
          {q.data && (
            <>
              <p className="text-[14px] text-[var(--text)]">{q.data.summary}</p>
              {q.data.actions?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {q.data.actions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-[var(--text)]">
                      <span aria-hidden style={{ color: tone }}>&bull;</span>{a}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Reader({
  message, loading, aiReady, onDelete,
}: {
  message: MessageBody | null;
  loading: boolean;
  aiReady: boolean;
  onDelete: () => void;
}) {
  const { selectMessage, openComposer } = useUi();
  const [showRemote, setShowRemote] = useState(false);
  const [previewAt, setPreviewAt] = useState<number | null>(null);

  const raw = message?.htmlBody
    ?? (message?.textBody
      ? `<pre>${message.textBody.replace(/[<>&]/g, (c) => ESCAPE[c] ?? c)}</pre>`
      : "");

  const hadRemote = useMemo(() => /<img\b[^>]*src\s*=\s*["']https?:/i.test(raw), [raw]);
  const srcDoc = useMemo(() => documentFor(showRemote ? raw : stripRemote(raw)), [raw, showRemote]);

  if (loading) {
    return (
      <div className="h-full space-y-3 bg-[var(--panel)] p-6">
        <div className="shimmer h-6 w-2/3 rounded" />
        <div className="shimmer h-4 w-1/3 rounded" />
        <div className="shimmer h-40 w-full rounded" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="grid h-full place-items-center bg-[var(--panel)] px-6 text-center">
        <p className="text-[14px] text-[var(--muted)]">Select a message to read.</p>
      </div>
    );
  }

  const from = message.from[0];
  const attachments = message.attachments.filter((a) => a.disposition === "attachment");
  const replyTo = (message.replyTo[0] ?? from)?.email ?? "";
  const others = [...message.to, ...message.cc].map((a) => a.email);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel)]">
      <header className="shrink-0 px-4 pt-4 sm:px-6">
        <div className="mb-4 flex items-start gap-2">
          <button
            onClick={() => selectMessage(null)}
            aria-label="Back"
            className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)] md:hidden"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-[20px] leading-7 text-[var(--text)]">{message.subject}</h1>
          <button
            onClick={onDelete}
            aria-label="Delete"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex items-start gap-3">
          <Avatar person={from} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[14px] font-semibold">{displayName(from)}</span>
              <span className="truncate text-[13px] text-[var(--muted)]">&lt;{from?.email}&gt;</span>
            </div>
            <div className="truncate text-[13px] text-[var(--muted)]">
              to {others.join(", ") || "me"}
            </div>
          </div>
          <time className="shrink-0 text-[12px] text-[var(--muted)]" dateTime={message.receivedAt}>
            {relativeDate(message.receivedAt)}
          </time>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6">
        {aiReady && <AiSummary messageId={message.id} />}

        {hadRemote && !showRemote && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-hover)] px-3 py-2">
            <ImageOff size={14} className="text-[var(--muted)]" />
            <span className="flex-1 text-[13px] text-[var(--muted)]">
              Images blocked - loading them tells the sender you opened this.
            </span>
            <button
              onClick={() => setShowRemote(true)}
              className="rounded px-2 py-1 text-[13px] font-medium hover:bg-black/5"
              style={{ color: "var(--accent-strong)" }}
            >
              Show images
            </button>
          </div>
        )}

        {/* Sandboxed: no scripts, no same-origin, no forms. Popups only, so a
            link the reader clicks can still open. */}
        <iframe
          title="Message body"
          sandbox="allow-popups"
          srcDoc={srcDoc}
          className="h-[60vh] w-full border-0 bg-white"
        />

        {attachments.length > 0 && (
          <div className="border-t border-[var(--line)] py-4">
            <p className="mb-3 text-[13px] text-[var(--muted)]">
              {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
            </p>
            <ul className="flex flex-wrap gap-3">
              {attachments.map((a, i) => {
                const previewable = isPreviewable(a.type);
                const isImage = /^image\//i.test(a.type);
                return (
                  <li key={a.blobId}>
                    <div className="group w-[180px] overflow-hidden rounded-lg border border-[var(--line)] transition-shadow hover:shadow-[0_1px_4px_rgba(32,33,36,.3)]">
                      <button
                        onClick={() => previewable && setPreviewAt(i)}
                        disabled={!previewable}
                        className="block h-[110px] w-full bg-[var(--color-hover)] disabled:cursor-default"
                        aria-label={previewable ? `Preview ${a.name}` : a.name}
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/attachments/${a.blobId}?name=${encodeURIComponent(a.name)}&inline=1`}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="grid h-full place-items-center">
                            <Paperclip size={22} className="text-[var(--muted)]" />
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-2 border-t border-[var(--line)] px-2.5 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px]">{a.name}</span>
                          <span className="block text-[11px] text-[var(--muted)]">{bytes(a.size)}</span>
                        </span>
                        <a
                          href={`/api/attachments/${a.blobId}?name=${encodeURIComponent(a.name)}`}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pb-6 pt-4">
          <button
            onClick={() => openComposer({
              kind: "reply", messageId: message.id, to: replyTo,
              subject: message.subject, replyAll: false,
            })}
            className="flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] px-4 py-2 text-[14px] hover:bg-[var(--color-hover)]"
          >
            <Reply size={16} /> Reply
          </button>
          {others.length > 1 && (
            <button
              onClick={() => openComposer({
                kind: "reply", messageId: message.id,
                to: [replyTo, ...others.filter((e) => e !== replyTo)].join(", "),
                subject: message.subject, replyAll: true,
              })}
              className="flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] px-4 py-2 text-[14px] hover:bg-[var(--color-hover)]"
            >
              <ReplyAll size={16} /> Reply all
            </button>
          )}
          <button
            onClick={() => openComposer({ kind: "forward", messageId: message.id, subject: message.subject })}
            className="flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] px-4 py-2 text-[14px] hover:bg-[var(--color-hover)]"
          >
            <Forward size={16} /> Forward
          </button>
        </div>
      </div>

      {previewAt !== null && (
        <AttachmentPreview
          items={attachments}
          index={previewAt}
          onIndex={setPreviewAt}
          onClose={() => setPreviewAt(null)}
        />
      )}
    </section>
  );
}
