import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { drain, enqueue } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
// Delivering a batch can outlive the default budget when receivers are slow.
export const maxDuration = 60;

/** Delivers everything currently due.
 *
 *  Called by the admin UI, and intended to be called on a schedule:
 *      * * * * * curl -s -X POST http://127.0.0.1:3880/api/webhooks/drain
 *
 *  `?test=1` first queues a synthetic event, so an operator can prove an
 *  endpoint works without waiting for real mail. */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  if (new URL(req.url).searchParams.get("test") === "1") {
    const queued = enqueue("message.sent", {
      trackedId: "test_0000000000000000",
      subject: "RayMail webhook test",
      recipients: ["test@example.com"],
      sentAt: new Date().toISOString(),
      test: true,
    });
    if (queued === 0) {
      return NextResponse.json(
        { error: "No enabled endpoint is subscribed to message.sent" }, { status: 400 },
      );
    }
  }

  return NextResponse.json(await drain(50));
}
