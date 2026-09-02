"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";

export function SignIn({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else setError(((await res.json()) as { error?: string }).error ?? "Sign in failed");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-page)] px-4 py-10">
      <div className="w-full max-w-[450px]">
        {/* Gmail's sign-in is a single white card on a tinted page: one column,
            generous padding, one primary action. */}
        <div className="rounded-3xl border border-[var(--line)] bg-white px-8 py-10 sm:px-12">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size={40} />
            <h1 className="mt-5 text-[24px] font-normal text-[var(--text)]">Sign in</h1>
            <p className="mt-1.5 text-[14px] text-[var(--muted)]">Continue to RayMail</p>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="relative mb-5">
              <input
                id="rm-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder=" "
                aria-invalid={Boolean(error)}
                className="peer h-14 w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-4 pt-2
                           text-[15px] outline-none transition-colors
                           focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              />
              {/* Floating label - the field keeps its name once it has content,
                  which a placeholder alone would throw away. */}
              <label
                htmlFor="rm-user"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-white px-1 text-[15px] text-[var(--muted)]
                           transition-all peer-focus:top-0 peer-focus:text-[12px] peer-focus:text-[var(--accent-strong)]
                           peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[12px]"
              >
                Email address
              </label>
            </div>

            <div className="relative mb-2">
              <input
                id="rm-pass"
                type={reveal ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder=" "
                aria-invalid={Boolean(error)}
                className="peer h-14 w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-4 pr-12 pt-2
                           text-[15px] outline-none transition-colors
                           focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              />
              <label
                htmlFor="rm-pass"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-white px-1 text-[15px] text-[var(--muted)]
                           transition-all peer-focus:top-0 peer-focus:text-[12px] peer-focus:text-[var(--accent-strong)]
                           peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[12px]"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--color-hover)]"
              >
                {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && (
              <p role="alert" className="mb-3 text-[13px]" style={{ color: "var(--color-state-bounced)" }}>
                {error}
              </p>
            )}

            <div className="mt-8 flex items-center justify-between gap-4">
              <p className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                <Lock size={12} /> Encrypted session
              </p>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-7 py-2.5 text-[14px] font-medium text-white
                           transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Next
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 px-2 text-center text-[12px] leading-relaxed text-[var(--muted)]">
          Use the same address and password as your IMAP and SMTP client.
          Credentials are never stored in your browser.
        </p>
      </div>
    </main>
  );
}
