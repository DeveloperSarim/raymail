import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { destroyQueued, NotPermitted } from "@/services/stalwart-admin";

export const dynamic = "force-dynamic";

/** Drops messages from the outbound queue. Irreversible, so the UI confirms. */
export async function DELETE(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { ids } = (await req.json()) as { ids?: string[] };
  if (!ids?.length) return NextResponse.json({ error: "No messages selected" }, { status: 400 });

  try {
    await destroyQueued(auth.credential, ids);
    return NextResponse.json({ ok: true, removed: ids.length });
  } catch (e) {
    if (e instanceof NotPermitted) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not remove" }, { status: 400 });
  }
}
