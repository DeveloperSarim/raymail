import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { JMAP_ENDPOINT } from "@/services/jmap";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Types we are willing to render in the browser rather than force to disk.
 * Anything outside this list downloads, because serving attacker-supplied
 * content inline from our own origin is how an attachment becomes stored XSS. */
const INLINE_SAFE = [
  /^image\/(png|jpeg|gif|webp|avif|bmp)$/i,
  /^application\/pdf$/i,
  /^text\/plain$/i,
  /^text\/csv$/i,
  /^application\/json$/i,
];

function inlineAllowed(type: string): boolean {
  return INLINE_SAFE.some((re) => re.test(type.split(";")[0]?.trim() ?? ""));
}

/** Streams a blob out of Stalwart. Auth is re-checked here - a blobId is not a
 *  capability, so an unauthenticated caller must not be able to fetch one. */
export async function GET(req: Request, ctx: { params: Promise<{ blobId: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { blobId } = await ctx.params;
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "attachment";
  const wantsInline = url.searchParams.get("inline") === "1";

  const res = await fetch(
    `${JMAP_ENDPOINT}/jmap/download/${auth.session.accountId}/${blobId}/${encodeURIComponent(name)}`,
    { headers: { Authorization: `Basic ${auth.credential}` } },
  );
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Attachment not available" }, { status: 404 });
  }

  // Stalwart hands every blob back as application/octet-stream, so the real
  // type has to come from our own index. Deliberately not from a query param:
  // the decision to render something inline is a security decision, and it
  // must not be steerable by whoever crafts the URL.
  let type = res.headers.get("content-type") ?? "application/octet-stream";
  if (type === "application/octet-stream") {
    try {
      const row = db().prepare("SELECT type FROM attachment_index WHERE blob_id = ?")
        .get(blobId) as { type: string } | undefined;
      if (row?.type) type = row.type;
    } catch {
      // Not indexed yet - fall through and serve it as a download.
    }
  }
  const inline = wantsInline && inlineAllowed(type);

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`,
    "Cache-Control": "private, no-store",
    // Never let the browser second-guess the type into something executable.
    "X-Content-Type-Options": "nosniff",
  };

  if (inline) {
    // `sandbox` strips scripts, plugins and same-origin privileges from the
    // response itself, so even a malicious PDF or SVG cannot reach our origin.
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'";
  }

  return new NextResponse(res.body, { headers });
}
