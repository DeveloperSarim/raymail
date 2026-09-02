import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { getMessage, setKeyword, moveMessage } from "@/services/jmap";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const message = await getMessage(auth.session, auth.credential, id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Feed the Document Vault opportunistically: reading a message is the only
  // moment we already hold its attachment metadata, so indexing here avoids a
  // background crawl over every mailbox.
  try {
    const stmt = db().prepare(
      `INSERT OR IGNORE INTO attachment_index
         (blob_id, message_id, name, type, size, sender, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const sender = message.from[0]?.email ?? "unknown";
    const now = new Date().toISOString();
    for (const a of message.attachments) {
      if (a.disposition !== "attachment") continue;
      stmt.run(a.blobId, message.id, a.name, a.type, a.size, sender, now);
    }
  } catch {
    // Indexing must never block reading mail.
  }

  return NextResponse.json({ message });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await req.json()) as
    { keyword?: string; value?: boolean; moveTo?: string; from?: string };

  if (body.moveTo) {
    await moveMessage(auth.session, auth.credential, id, body.from ?? null, body.moveTo);
    return NextResponse.json({ ok: true });
  }

  if (!body.keyword || typeof body.value !== "boolean") {
    return NextResponse.json({ error: "keyword and value, or moveTo, required" }, { status: 400 });
  }
  await setKeyword(auth.session, auth.credential, id, body.keyword, body.value);
  return NextResponse.json({ ok: true });
}
