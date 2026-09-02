"use client";

import {
  Inbox, Send, FileText, Trash2, Archive, ShieldAlert, Folder,
  Pencil, BarChart3, X,
} from "lucide-react";
import type { Mailbox, MailboxRole } from "@/types/mail";
import { useUi } from "@/lib/store";
import { Logo } from "@/components/Logo";

const ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2,
  archive: Archive, junk: ShieldAlert,
};

const iconFor = (role: MailboxRole) => (role && ICONS[role]) || Folder;

function Rail({ mailboxes, loading }: { mailboxes: Mailbox[]; loading: boolean }) {
  const { selectedMailboxId, selectMailbox, openComposer } = useUi();

  return (
    <div className="flex h-full flex-col">
      {/* Gmail's compose is a raised pill, not a bar button - it is the one
          action the whole left rail exists to make reachable. */}
      <div className="px-2 pb-3 pt-2">
        <button
          onClick={() => openComposer({ kind: "new" })}
          className="flex h-14 items-center gap-3 rounded-2xl bg-[var(--color-accent-tint)] pl-4 pr-6
                     text-[14px] font-medium text-[var(--text)]
                     shadow-[0_1px_3px_rgba(32,33,36,.2)] transition-shadow
                     hover:shadow-[0_2px_6px_rgba(32,33,36,.28)]"
        >
          <Pencil size={18} style={{ color: "var(--accent-strong)" }} />
          Compose
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-4 pr-2">
        <ul>
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <li key={i} className="px-2 py-1">
                <div className="shimmer h-8 rounded-r-full" />
              </li>
            ))}

          {mailboxes.map((m) => {
            const Icon = iconFor(m.role);
            const active = m.id === selectedMailboxId;
            return (
              <li key={m.id}>
                <button
                  onClick={() => selectMailbox(m.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-8 w-full items-center gap-4 rounded-r-full pl-6 pr-4 text-left text-[14px]
                    transition-colors
                    ${active
                      ? "bg-[var(--color-accent-tint)] font-semibold text-[var(--text)]"
                      : "text-[var(--text)] hover:bg-[var(--color-hover)]"}`}
                >
                  <Icon size={17} className="shrink-0" style={{ color: active ? "var(--accent-strong)" : "var(--muted)" }} />
                  <span className="flex-1 truncate">{m.name}</span>
                  {m.unreadEmails > 0 && (
                    <span className="text-[12px] font-semibold">{m.unreadEmails}</span>
                  )}
                </button>
              </li>
            );
          })}

          <li className="mt-2 border-t border-[var(--line)] pt-2">
            <a
              href="/admin"
              className="flex h-8 items-center gap-4 rounded-r-full pl-6 pr-4 text-[14px] text-[var(--text)] hover:bg-[var(--color-hover)]"
            >
              <BarChart3 size={17} className="shrink-0 text-[var(--muted)]" />
              Insights
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function Sidebar({ mailboxes, loading }: { mailboxes: Mailbox[]; loading: boolean }) {
  const { drawerOpen, setDrawer } = useUi();

  return (
    <>
      <aside className="hidden w-[240px] shrink-0 md:block">
        <Rail mailboxes={mailboxes} loading={loading} />
      </aside>

      {/* Mobile drawer. Without this the folder list was unreachable on a
          phone - the rail was simply hidden with no way to summon it. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close folders"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="fade-up absolute inset-y-0 left-0 w-[280px] bg-[var(--color-page)] shadow-xl">
            <div className="flex h-16 items-center gap-3 px-4">
              <button
                onClick={() => setDrawer(false)}
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
              >
                <X size={20} />
              </button>
              <Logo size={24} withWordmark />
            </div>
            <div className="h-[calc(100%-4rem)]">
              <Rail mailboxes={mailboxes} loading={loading} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
