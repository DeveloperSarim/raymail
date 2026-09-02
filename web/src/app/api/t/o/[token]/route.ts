import { NextResponse } from "next/server";
import { db, advanceStage } from "@/lib/db";
import { readOpenToken } from "@/lib/telemetry";
import { PIXEL_GIF } from "@/lib/outgoing";
import type { DeliveryStage } from "@/types/telemetry";

export const dynamic = "force-dynamic";

/* Read receipt. Always returns the pixel — a failed lookup must not tell a
 * recipient whether an id was valid, and must never break message rendering. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const trackedId = readOpenToken(token);

  if (trackedId) {
    try {
      const d = db();
      const row = d.prepare("SELECT stage, open_count FROM tracked_message WHERE id = ?")
        .get(trackedId) as { stage: string; open_count: number } | undefined;

      if (row) {
        const now = new Date().toISOString();
        const ua = req.headers.get("user-agent");
        // The proxy is ours, so the left-most XFF hop is the real client.
        const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;

        d.prepare(
          `INSERT INTO telemetry_event (tracked_id, type, occurred_at, ip, user_agent)
           VALUES (?, 'open', ?, ?, ?)`,
        ).run(trackedId, now, ip, ua);

        d.prepare(
          `UPDATE tracked_message
              SET open_count = open_count + 1,
                  stage = ?,
                  first_opened_at = COALESCE(first_opened_at, ?),
                  last_event_at = ?
            WHERE id = ?`,
        ).run(advanceStage(row.stage as DeliveryStage, "opened"), now, now, trackedId);
      }
    } catch {
      // Telemetry is best-effort; never fail the image response.
    }
  }

  return new NextResponse(new Uint8Array(PIXEL_GIF), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL_GIF.length),
      // Zero-cache: without these, one proxy hit hides every later open.
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
