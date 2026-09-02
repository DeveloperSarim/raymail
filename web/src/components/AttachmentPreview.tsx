"use client";

import { useEffect, useState } from "react";
import { X, Download, FileText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { Attachment } from "@/types/mail";
import { bytes } from "@/lib/format";

const IMAGE = /^image\/(png|jpeg|gif|webp|avif|bmp)$/i;
const PDF = /^application\/pdf$/i;
const TEXTUAL = /^(text\/plain|text\/csv|application\/json)$/i;

export function isPreviewable(type: string): boolean {
  const t = type.split(";")[0]?.trim() ?? "";
  return IMAGE.test(t) || PDF.test(t) || TEXTUAL.test(t);
}

function href(a: Attachment, inline: boolean): string {
  return `/api/attachments/${a.blobId}?name=${encodeURIComponent(a.name)}${inline ? "&inline=1" : ""}`;
}

function TextBody({ a }: { a: Attachment }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setText(null); setError(false);
    fetch(href(a, true))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("failed"))))
      // Cap it: a 20MB CSV would lock the tab solid.
      .then((t) => alive && setText(t.slice(0, 200_000)))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [a]);

  if (error) return <p className="p-6 text-[14px] text-white/70">Could not load this file.</p>;
  if (text === null) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 size={28} className="animate-spin text-white/60" />
      </div>
    );
  }
  return (
    <pre className="mono h-full overflow-auto bg-white p-5 text-[12.5px] leading-relaxed text-[var(--text)]">
      {text}
    </pre>
  );
}

export function AttachmentPreview({
  items, index, onClose, onIndex,
}: {
  items: Attachment[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const a = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the overlay is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onIndex]);

  if (!a) return null;
  const type = a.type.split(";")[0]?.trim() ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/92" role="dialog" aria-label={`Preview ${a.name}`}>
      <header className="flex h-14 shrink-0 items-center gap-3 px-4 text-white">
        <FileText size={18} className="shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px]">{a.name}</p>
          <p className="text-[12px] text-white/55">{type} &middot; {bytes(a.size)}</p>
        </div>
        <a
          href={href(a, false)}
          className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10"
          title="Download"
        >
          <Download size={18} />
        </a>
        <button onClick={onClose} aria-label="Close preview"
                className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10">
          <X size={20} />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-14">
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} aria-label="Previous"
                  className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronLeft size={22} />
          </button>
        )}

        <div className="h-full w-full max-w-5xl overflow-hidden rounded-lg">
          {IMAGE.test(type) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={href(a, true)} alt={a.name} className="mx-auto h-full max-h-full w-auto max-w-full object-contain" />
          )}

          {PDF.test(type) && (
            // The response carries a `sandbox` CSP, so the document cannot
            // reach our origin even though it is served from it.
            <iframe title={a.name} src={href(a, true)} className="h-full w-full border-0 bg-white" />
          )}

          {TEXTUAL.test(type) && <TextBody a={a} />}

          {!isPreviewable(type) && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <FileText size={44} className="mx-auto mb-3 text-white/40" />
                <p className="text-[15px] text-white">No preview for this file type.</p>
                <a href={href(a, false)}
                   className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[14px] font-medium text-black">
                  <Download size={15} /> Download
                </a>
              </div>
            </div>
          )}
        </div>

        {index < items.length - 1 && (
          <button onClick={() => onIndex(index + 1)} aria-label="Next"
                  className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <p className="pb-4 text-center text-[12px] text-white/50">
          {index + 1} of {items.length}
        </p>
      )}
    </div>
  );
}
