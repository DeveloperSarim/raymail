"use client";

import { Sparkles, AlertCircle } from "lucide-react";
import { useOverview } from "@/hooks/useAi";

/** Inbox briefing. Built from envelope lines only - see the overview route -
 *  so it costs a few hundred tokens rather than the whole mailbox. */
export function AiOverview({ mailboxId }: { mailboxId: string | null }) {
  const q = useOverview(mailboxId, true);

  return (
    <div className="fade-up border-b border-[var(--line)] bg-[var(--color-accent-tint)] px-4 py-3 sm:px-6">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={15} style={{ color: "var(--accent-strong)" }} />
        <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent-strong)" }}>
          Inbox overview
        </span>
        {q.data?.cached && (
          <span className="text-[11px] text-[var(--muted)]">cached - no tokens used</span>
        )}
      </div>

      {q.isLoading && (
        <div className="space-y-2">
          <div className="shimmer h-4 w-2/3 rounded" />
          <div className="shimmer h-4 w-1/2 rounded" />
        </div>
      )}

      {q.isError && (
        <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
          <AlertCircle size={14} />
          {(q.error as Error).message}
        </p>
      )}

      {q.data && (
        <div className="space-y-2">
          <p className="text-[14px] text-[var(--text)]">{q.data.headline}</p>

          {q.data.themes?.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {q.data.themes.map((t) => (
                <li key={t.label} className="text-[13px] text-[var(--muted)]">
                  <span className="font-medium text-[var(--text)]">{t.label}</span>
                  {t.detail ? ` - ${t.detail}` : ""}
                </li>
              ))}
            </ul>
          )}

          {q.data.needsReply?.length > 0 && (
            <p className="text-[13px] text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">Waiting on you: </span>
              {q.data.needsReply.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
