import { NextResponse } from "next/server";
import { db, advanceStage } from "@/lib/db";
import { readClickToken } from "@/lib/telemetry";
import type { DeliveryStage } from "@/types/telemetry";

export const dynamic = "force-dynamic";

/* Click redirector. The destination is covered by the token signature, so this
 * endpoint cannot be turned into an open redirect by editing the URL. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const parsed = readClickToken(token);

  // Unsigned or tampered token: refuse rather than redirect anywhere.
  if (!parsed) {
    return new NextResponse("Invalid or expired link", { status: 400 });
  }

  try {
    const d = db();
    const row = d.prepare("SELECT stage FROM tracked_message WHERE id = ?")
      .get(parsed.id) as { stage: string } | undefined;

    if (row) {
      const now = new Date().toISOString();
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;

      d.prepare(
        `INSERT INTO telemetry_event (tracked_id, type, occurred_at, ip, user_agent, target_url)
         VALUES (?, 'click', ?, ?, ?, ?)`,
      ).run(parsed.id, now, ip, req.headers.get("user-agent"), parsed.url);

      d.prepare(
        `UPDATE tracked_message
            SET click_count = click_count + 1, stage = ?, last_event_at = ?
          WHERE id = ?`,
      ).run(advanceStage(row.stage as DeliveryStage, "clicked"), now, parsed.id);
    }
  } catch {
    // Never strand the recipient because telemetry failed.
  }

  return NextResponse.redirect(parsed.url, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
