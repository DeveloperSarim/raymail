"use client";

import { Menu, Search, X, RefreshCw, Sparkles } from "lucide-react";
import { useUi } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { AccountMenu } from "@/components/AccountMenu";

export function TopBar({
  username, onRefresh, refreshing, aiReady, onToggleOverview, overviewOpen,
}: {
  username: string;
  onRefresh: () => void;
  refreshing: boolean;
  aiReady: boolean;
  onToggleOverview: () => void;
  overviewOpen: boolean;
}) {
  const { search, setSearch, setDrawer } = useUi();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 bg-[var(--color-page)] px-2 sm:px-4">
      <button
        onClick={() => setDrawer(true)}
        aria-label="Open folders"
        className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)] md:hidden"
      >
        <Menu size={20} />
      </button>

      <a href="/" className="mr-2 hidden items-center gap-2 sm:flex" aria-label="RayMail home">
        <Logo size={26} withWordmark />
      </a>

      {/* Gmail's search is the widest thing on the bar - it signals that the
          archive, not the folder tree, is how you find mail. */}
      <div className="relative flex min-w-0 max-w-[720px] flex-1 items-center">
        <Search size={18} className="pointer-events-none absolute left-4 text-[var(--muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mail"
          aria-label="Search mail"
          className="h-12 w-full rounded-full bg-[#EAEEF6] pl-12 pr-10 text-[14px] text-[var(--text)]
                     outline-none transition-shadow placeholder:text-[var(--muted)]
                     focus:bg-white focus:shadow-[0_1px_3px_rgba(32,33,36,.28)]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {aiReady && (
          <button
            onClick={onToggleOverview}
            aria-pressed={overviewOpen}
            title="Inbox overview"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--color-hover)]"
            style={{ color: overviewOpen ? "var(--accent-strong)" : "var(--muted)" }}
          >
            <Sparkles size={19} />
          </button>
        )}
        <button
          onClick={onRefresh}
          aria-label="Refresh"
          className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </button>
        <AccountMenu username={username} />
      </div>
    </header>
  );
}
