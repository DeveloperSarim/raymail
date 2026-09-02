import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { listMailboxes } from "@/services/jmap";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ mailboxes: await listMailboxes(auth.session, auth.credential) });
}
