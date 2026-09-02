import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { setAccountPassword, destroyAccount, NotPermitted } from "@/services/stalwart-admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { secret } = (await req.json()) as { secret?: string };
  if (!secret || secret.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 });
  }

  try {
    await setAccountPassword(auth.credential, id, secret);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotPermitted) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not update" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    await destroyAccount(auth.credential, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotPermitted) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete" }, { status: 400 });
  }
}
