import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { listMessages } from "@/services/jmap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const mailboxId = new URL(req.url).searchParams.get("mailboxId");
  if (!mailboxId) return NextResponse.json({ error: "mailboxId required" }, { status: 400 });

  return NextResponse.json({
    messages: await listMessages(auth.session, auth.credential, mailboxId),
  });
}
