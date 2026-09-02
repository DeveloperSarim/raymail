import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { db, advanceStage } from "@/lib/db";
import { getSubmissionStatus } from "@/services/jmap";
import type { TelemetrySummary, TrackedMessage } from "@/types/telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const days = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const d = db();

  // Reconcile anything still sitting at `sent` against the MTA. Without this
  // the pipeline jumps sent -> opened and `delivered` is never recorded.
  try {
    const pending = d.prepare(
      `SELECT id, submission_id AS submissionId, stage FROM tracked_message
        WHERE stage = 'sent' AND submission_id IS NOT NULL AND sent_at >= ?
        LIMIT 100`,
    ).all(since) as unknown as { id: string; submissionId: string; stage: string }[];

    if (pending.length > 0) {
      const statuses = await getSubmissionStatus(
        auth.session, auth.credential, pending.map((p) => p.submissionId),
      );
      const now = new Date().toISOString();
      for (const p of pending) {
        const st = statuses[p.submissionId];
        if (st === "yes") {
          d.prepare("UPDATE tracked_message SET stage=?, last_event_at=? WHERE id=?")
            .run(advanceStage("sent", "delivered"), now, p.id);
          d.prepare(
            `INSERT INTO telemetry_event (tracked_id, type, occurred_at) VALUES (?, 'delivered', ?)`,
          ).run(p.id, now);
        } else if (st === "no") {
          d.prepare(
            "UPDATE tracked_message SET stage='bounced', bounce_reason=?, last_event_at=? WHERE id=?",
          ).run("Rejected by the receiving server", now, p.id);
          d.prepare(
            `INSERT INTO telemetry_event (tracked_id, type, occurred_at) VALUES (?, 'bounced', ?)`,
          ).run(p.id, now);
        }
      }
    }
  } catch {
    // Reconciliation is opportunistic; never fail the dashboard over it.
  }

  const agg = d.prepare(
    `SELECT
       COUNT(*)                                            AS totalSent,
       SUM(CASE WHEN stage IN ('delivered','opened','clicked') THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN stage = 'bounced' THEN 1 ELSE 0 END)  AS bounced,
       SUM(CASE WHEN open_count  > 0 THEN 1 ELSE 0 END)    AS uniqueOpens,
       SUM(open_count)                                     AS totalOpens,
       SUM(CASE WHEN click_count > 0 THEN 1 ELSE 0 END)    AS uniqueClicks
     FROM tracked_message WHERE sent_at >= ?`,
  ).get(since) as Record<string, number | null>;

  const n = (v: number | null | undefined) => Number(v ?? 0);
  const totalSent = n(agg["totalSent"]);
  const pct = (part: number) => (totalSent === 0 ? 0 : +((part / totalSent) * 100).toFixed(1));

  const summary: TelemetrySummary = {
    totalSent,
    delivered: n(agg["delivered"]),
    bounced: n(agg["bounced"]),
    uniqueOpens: n(agg["uniqueOpens"]),
    totalOpens: n(agg["totalOpens"]),
    uniqueClicks: n(agg["uniqueClicks"]),
    openRate: pct(n(agg["uniqueOpens"])),
    clickRate: pct(n(agg["uniqueClicks"])),
    bounceRate: pct(n(agg["bounced"])),
  };

  const recent = d.prepare(
    `SELECT id, message_id AS messageId, recipient, subject, sent_at AS sentAt,
            stage, open_count AS openCount, click_count AS clickCount,
            first_opened_at AS firstOpenedAt, last_event_at AS lastEventAt,
            bounce_reason AS bounceReason
       FROM tracked_message WHERE sent_at >= ? ORDER BY sent_at DESC LIMIT 100`,
  ).all(since) as unknown as TrackedMessage[];

  // Opens bucketed by day, for the distribution graph.
  const daily = d.prepare(
    `SELECT substr(occurred_at,1,10) AS day, type, COUNT(*) AS n
       FROM telemetry_event WHERE occurred_at >= ?
      GROUP BY day, type ORDER BY day`,
  ).all(since) as unknown as { day: string; type: string; n: number }[];

  return NextResponse.json({ summary, recent, daily });
}
