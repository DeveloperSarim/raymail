import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { createAccount, NotPermitted } from "@/services/stalwart-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { name, secret, domainId, description } =
    (await req.json()) as { name?: string; secret?: string; domainId?: string; description?: string };

  if (!name?.trim() || !secret || !domainId) {
    return NextResponse.json({ error: "Mailbox name, password and domain are required" }, { status: 400 });
  }
  // The local part is what becomes the address; keep it to what SMTP accepts
  // rather than letting the server reject it later with a cryptic error.
  if (!/^[a-z0-9._-]+$/i.test(name.trim())) {
    return NextResponse.json(
      { error: "Use only letters, numbers, dot, underscore or hyphen" }, { status: 400 },
    );
  }
  if (secret.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 });
  }

  try {
    const id = await createAccount(auth.credential, {
      name: name.trim().toLowerCase(), secret, domainId, description,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof NotPermitted) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create" }, { status: 400 });
  }
}
