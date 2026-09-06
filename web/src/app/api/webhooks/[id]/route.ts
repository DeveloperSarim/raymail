import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { setEndpointEnabled, deleteEndpoint } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { enabled } = (await req.json()) as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }
  setEndpointEnabled(id, enabled);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  deleteEndpoint(id);
  return NextResponse.json({ ok: true });
}
