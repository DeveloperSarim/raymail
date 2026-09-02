"use client";

import { useMemo } from "react";
import { Star, Paperclip, Trash2, MailOpen, Mail, Inbox } from "lucide-react";
import type { MessageSummary } from "@/types/mail";
import { useUi } from "@/lib/store";
import { displayName, relativeDate } from "@/lib/format";
import { AiOverview } from "@/components/AiOverview";

function Row({
  m, active, onOpen, onStar, onToggleRead, onDelete,
}: {
  m: MessageSummary;
  active: boolean;
  onOpen: () => void;
  onStar: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`group relative flex items-center gap-1 border-b border-[var(--line)] pl-2 pr-2
        transition-shadow hover:z-10 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_rgba(60,64,67,.3)]
        ${active ? "bg-[var(--color-accent-tint)]" : m.isUnread ? "bg-white" : "bg-[var(--color-read-row)]"}`}
    >
      <button
        onClick={onStar}
        aria-label={m.isFlagged ? "Remove star" : "Star"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
      >
        <Star
          size={17}
          className={m.isFlagged ? "" : "text-[var(--color-ink-faint)]"}
          style={m.isFlagged ? { fill: "#E8A33D", color: "#E8A33D" } : undefined}
        />
      </button>

      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
        <span
          className={`w-[150px] shrink-0 truncate text-[14px] sm:w-[180px]
            ${m.isUnread ? "font-bold text-[var(--text)]" : "text-[var(--text)]"}`}
        >
          {displayName(m.from[0])}
        </span>

        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className={`shrink-0 max-w-[55%] truncate text-[14px] ${m.isUnread ? "font-bold" : ""}`}>
            {m.subject}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--muted)]">
            {m.preview && `- ${m.preview}`}
          </span>
        </span>

        {m.hasAttachment && <Paperclip size={14} className="shrink-0 text-[var(--muted)]" />}
      </button>

      {/* Date is replaced by the action cluster on hover, exactly as Gmail
          does - it keeps the row height fixed and the list calm. */}
      <span className={`w-[86px] shrink-0 pr-1 text-right text-[12px] group-hover:invisible
        ${m.isUnread ? "font-bold text-[var(--text)]" : "text-[var(--muted)]"}`}>
        {relativeDate(m.receivedAt)}
      </span>

      <div className="row-actions absolute right-2 flex items-center gap-0.5">
        <button onClick={onToggleRead} title={m.isUnread ? "Mark as read" : "Mark as unread"}
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-black/5">
          {m.isUnread ? <MailOpen size={17} /> : <Mail size={17} />}
        </button>
        <button onClick={onDelete} title="Delete"
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-black/5">
          <Trash2 size={17} />
        </button>
      </div>
    </li>
  );
}

export function ThreadList({
  messages, loading, error, mailboxId, aiReady, overviewOpen,
  onStar, onToggleRead, onDelete,
}: {
  messages: MessageSummary[];
  loading: boolean;
  error: string | null;
  mailboxId: string | null;
  aiReady: boolean;
  overviewOpen: boolean;
  onStar: (m: MessageSummary) => void;
  onToggleRead: (m: MessageSummary) => void;
  onDelete: (m: MessageSummary) => void;
}) {
  const { selectedMessageId, selectMessage, search } = useUi();

  // Client-side filter over what is already loaded. Server-side JMAP search is
  // the obvious upgrade; this covers the common "where was that mail" case
  // without a round trip per keystroke.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      m.subject.toLowerCase().includes(q) ||
      m.preview.toLowerCase().includes(q) ||
      m.from.some((f) => (f.name ?? "").toLowerCase().includes(q) || f.email.toLowerCase().includes(q)),
    );
  }, [messages, search]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-tl-2xl bg-[var(--panel)]">
      {aiReady && overviewOpen && <AiOverview mailboxId={mailboxId} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <p className="px-6 py-6 text-[14px]" style={{ color: "var(--color-state-bounced)" }}>{error}</p>
        )}

        {loading && messages.length === 0 && (
          <ul>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                <div className="shimmer h-4 w-[160px] rounded" />
                <div className="shimmer h-4 flex-1 rounded" />
              </li>
            ))}
          </ul>
        )}

        {!loading && filtered.length === 0 && (
          <div className="grid place-items-center px-6 py-20 text-center">
            <Inbox size={40} className="mb-3 text-[var(--color-line-strong)]" />
            <p className="text-[15px] text-[var(--muted)]">
              {search ? `No mail matches "${search}"` : "Nothing here yet."}
            </p>
          </div>
        )}

        <ul>
          {filtered.map((m) => (
            <Row
              key={m.id}
              m={m}
              active={m.id === selectedMessageId}
              onOpen={() => selectMessage(m.id)}
              onStar={() => onStar(m)}
              onToggleRead={() => onToggleRead(m)}
              onDelete={() => onDelete(m)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
