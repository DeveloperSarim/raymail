"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Paperclip, Send, Eye, MousePointerClick, Loader2, Sparkles, Minus, AlertCircle,
} from "lucide-react";
import { useUi } from "@/lib/store";
import { useSend } from "@/hooks/useMail";
import { useDraft } from "@/hooks/useAi";
import { bytes } from "@/lib/format";
import type { EmailAddress } from "@/types/mail";

interface Pending { blobId: string; name: string; type: string; size: number }

function parseAddresses(raw: string): EmailAddress[] {
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));
}

const TONES = ["professional", "friendly", "direct", "apologetic"] as const;

export function Composer({ aiReady }: { aiReady: boolean }) {
  const { composer, closeComposer } = useUi();
  const send = useSend();
  const draft = useDraft();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const bodyRef = useRef<HTMLDivElement>(null);

  // Prefill from the mode. Previously Reply opened a blank composer, which
  // meant every reply had to be addressed by hand.
  useEffect(() => {
    if (!composer) return;
    if (composer.kind === "reply") {
      setTo(composer.to);
      setSubject(composer.subject.replace(/^(re:\s*)*/i, "Re: "));
    } else if (composer.kind === "forward") {
      setTo("");
      setSubject(composer.subject.replace(/^(fwd:\s*)*/i, "Fwd: "));
    } else {
      setTo(""); setSubject("");
    }
    setFiles([]); setAiPrompt(""); setAiOpen(false); setMinimised(false);
    if (bodyRef.current) bodyRef.current.innerHTML = "";
  }, [composer]);

  const submit = useCallback(() => {
    const recipients = parseAddresses(to);
    if (recipients.length === 0 || !subject.trim()) return;
    send.mutate(
      {
        to: recipients,
        subject,
        html: bodyRef.current?.innerHTML ?? "",
        trackOpens, trackClicks,
        attachments: files,
        inReplyTo: composer?.kind === "reply" ? composer.messageId : undefined,
      },
      { onSuccess: () => closeComposer() },
    );
  }, [to, subject, trackOpens, trackClicks, files, send, closeComposer, composer]);

  useEffect(() => {
    if (!composer) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
      if (e.key === "Escape") closeComposer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composer, submit, closeComposer]);

  const upload = useCallback(async (list: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(list)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) continue;
      const uploaded = (await res.json()) as Pending;
      setFiles((f) => [...f, uploaded]);
    }
    setUploading(false);
  }, []);

  const generate = useCallback(() => {
    if (!composer) return;
    const isReply = composer.kind === "reply";
    draft.mutate(
      {
        mode: isReply ? "reply" : "compose",
        prompt: aiPrompt,
        tone,
        messageId: isReply ? composer.messageId : undefined,
      },
      {
        onSuccess: (r) => {
          if (bodyRef.current) bodyRef.current.innerHTML = r.html;
          setAiOpen(false);
        },
      },
    );
  }, [composer, aiPrompt, tone, draft]);

  if (!composer) return null;

  const title = composer.kind === "reply" ? "Reply"
    : composer.kind === "forward" ? "Forward" : "New message";

  return (
    <div
      role="dialog"
      aria-label={title}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
      className={`fixed z-50 flex flex-col overflow-hidden bg-white shadow-[0_8px_28px_rgba(32,33,36,.35)]
        inset-x-0 bottom-0 top-0 sm:inset-auto sm:bottom-0 sm:right-6 sm:w-[540px] sm:rounded-t-xl
        ${minimised ? "sm:h-12" : "sm:h-[600px]"}
        ${dragging ? "ring-2 ring-[var(--color-accent-ring)]" : ""}`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between bg-[#F2F6FC] px-4">
        <span className="text-[14px] font-medium">{title}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimised((v) => !v)} aria-label="Minimise"
                  className="hidden h-8 w-8 place-items-center rounded-full hover:bg-black/5 sm:grid">
            <Minus size={16} />
          </button>
          <button onClick={closeComposer} aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5">
            <X size={17} />
          </button>
        </div>
      </header>

      {!minimised && (
        <>
          <div className="shrink-0 px-4">
            <label className="flex items-center gap-3 border-b border-[var(--line)]">
              <span className="w-12 shrink-0 text-[13px] text-[var(--muted)]">To</span>
              <input value={to} onChange={(e) => setTo(e.target.value)}
                     placeholder="name@example.com"
                     className="h-11 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--faint)]" />
            </label>
            <label className="flex items-center gap-3 border-b border-[var(--line)]">
              <span className="w-12 shrink-0 text-[13px] text-[var(--muted)]">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                     className="h-11 flex-1 bg-transparent text-[14px] outline-none" />
            </label>
          </div>

          {aiReady && aiOpen && (
            <div className="fade-up shrink-0 border-b border-[var(--line)] bg-[var(--color-accent-tint)] px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={14} style={{ color: "var(--accent-strong)" }} />
                <span className="text-[12px] font-semibold" style={{ color: "var(--accent-strong)" }}>
                  {composer.kind === "reply" ? "Draft a reply" : "Write with AI"}
                </span>
              </div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                placeholder={composer.kind === "reply"
                  ? "What should the reply say? (optional)"
                  : "e.g. ask Ali for the Q3 invoice, mention the deadline is Friday"}
                className="w-full resize-none rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-ring)]"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {TONES.map((t) => (
                  <button key={t} onClick={() => setTone(t)}
                          className={`rounded-full px-3 py-1 text-[12px] capitalize transition-colors
                            ${tone === t ? "bg-[var(--accent-strong)] text-white" : "bg-white text-[var(--muted)] hover:bg-black/5"}`}>
                    {t}
                  </button>
                ))}
                <button
                  onClick={generate}
                  disabled={draft.isPending || (composer.kind !== "reply" && !aiPrompt.trim())}
                  className="ml-auto flex items-center gap-1.5 rounded-full bg-[var(--accent-strong)] px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  {draft.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Generate
                </button>
              </div>
              {draft.error && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-state-bounced)" }}>
                  <AlertCircle size={13} /> {(draft.error as Error).message}
                </p>
              )}
            </div>
          )}

          {/* contentEditable rather than a rich-text dependency: the browser's
              own command stack covers bold/italic/lists. */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Message body"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[14px] leading-relaxed outline-none"
          />

          {files.length > 0 && (
            <ul className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--line)] px-4 py-2">
              {files.map((f) => (
                <li key={f.blobId}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[12px] text-[var(--muted)]">
                  <Paperclip size={11} />{f.name}
                  <span className="text-[var(--faint)]">{bytes(f.size)}</span>
                  <button onClick={() => setFiles((x) => x.filter((y) => y.blobId !== f.blobId))}
                          aria-label={`Remove ${f.name}`} className="ml-1 hover:text-[var(--text)]">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {send.error && (
            <p className="shrink-0 border-t border-[var(--line)] px-4 py-2 text-[13px]"
               style={{ color: "var(--color-state-bounced)" }}>
              {(send.error as Error).message}
            </p>
          )}

          <footer className="flex shrink-0 items-center gap-1 border-t border-[var(--line)] px-4 py-3">
            <button
              onClick={submit}
              disabled={send.isPending || uploading}
              className="flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-6 py-2 text-[14px] font-medium text-white disabled:opacity-40"
            >
              {send.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Send
            </button>

            <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-[var(--muted)] hover:bg-black/5"
                   title="Attach files">
              <Paperclip size={17} />
              <input type="file" multiple hidden
                     onChange={(e) => e.target.files && void upload(e.target.files)} />
            </label>

            {aiReady && (
              <button onClick={() => setAiOpen((v) => !v)} aria-pressed={aiOpen} title="Write with AI"
                      className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"
                      style={{ color: aiOpen ? "var(--accent-strong)" : "var(--muted)" }}>
                <Sparkles size={17} />
              </button>
            )}

            <div className="flex-1" />

            <button onClick={() => setTrackOpens((v) => !v)} aria-pressed={trackOpens} title="Track opens"
                    className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"
                    style={{ color: trackOpens ? "var(--accent-strong)" : "var(--faint)" }}>
              <Eye size={17} />
            </button>
            <button onClick={() => setTrackClicks((v) => !v)} aria-pressed={trackClicks} title="Track clicks"
                    className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"
                    style={{ color: trackClicks ? "var(--accent-strong)" : "var(--faint)" }}>
              <MousePointerClick size={17} />
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
