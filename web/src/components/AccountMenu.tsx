"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, BarChart3, Copy, Check, Server } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

/* Clicking the avatar used to sign you straight out with no confirmation -
 * a destructive action on a single stray click. It now opens a menu, and the
 * sign-out lives inside it. */
export function AccountMenu({ username }: { username: string }) {
  // The mail host is whatever the account lives on - deriving it from the
  // signed-in address keeps this correct on every installation.
  const mailHost = username.split("@")[1] ?? "";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = username.split("@")[0] ?? username;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="ml-1 rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-[var(--color-line-strong)]"
      >
        <Avatar person={{ email: username }} size={32} />
      </button>

      {open && (
        <div
          role="menu"
          className="fade-up absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-2xl border border-[var(--line)]
                     bg-white shadow-[0_8px_28px_rgba(32,33,36,.28)]"
        >
          <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
            <Avatar person={{ email: username }} size={64} />
            <p className="mt-1 text-[15px] font-medium capitalize text-[var(--text)]">{name}</p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(username);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch { /* clipboard blocked - the address is visible anyway */ }
              }}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-[var(--muted)] hover:bg-[var(--color-hover)]"
              title="Copy address"
            >
              {username}
              {copied ? <Check size={13} style={{ color: "var(--color-state-delivered)" }} /> : <Copy size={13} />}
            </button>
          </div>

          <div className="border-t border-[var(--line)] py-1">
            <a
              role="menuitem"
              href="/admin"
              className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--text)] hover:bg-[var(--color-hover)]"
            >
              <BarChart3 size={16} className="text-[var(--muted)]" />
              Insights &amp; vault
            </a>
            <div className="flex items-start gap-3 px-4 py-2.5 text-[13px] text-[var(--muted)]">
              <Server size={16} className="mt-0.5 shrink-0" />
              <span>
                IMAP 993 &middot; SMTP 587
                {mailHost && (<><br />{mailHost}</>)}
              </span>
            </div>
          </div>

          <div className="border-t border-[var(--line)] p-2">
            <button
              role="menuitem"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await fetch("/api/auth", { method: "DELETE" });
                location.reload();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-line-strong)]
                         px-4 py-2 text-[14px] text-[var(--text)] hover:bg-[var(--color-hover)] disabled:opacity-50"
            >
              <LogOut size={15} />
              {busy ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
