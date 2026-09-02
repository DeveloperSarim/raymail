import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { listMailboxes, sendEmail } from "@/services/jmap";
import { prepareOutgoingHtml } from "@/lib/outgoing";
import { newTrackingId } from "@/lib/telemetry";
import { db } from "@/lib/db";
import type { EmailAddress } from "@/types/mail";

export const dynamic = "force-dynamic";

interface SendBody {
  to: EmailAddress[]; cc?: EmailAddress[]; bcc?: EmailAddress[];
  subject: string; html: string; inReplyTo?: string;
  trackOpens?: boolean; trackClicks?: boolean;
  attachments?: { blobId: string; name: string; type: string; size: number }[];
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as SendBody;
  if (!body.to?.length) return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
  if (!body.subject?.trim()) return NextResponse.json({ error: "Subject is required" }, { status: 400 });

  const appUrl = process.env.APP_URL ?? "https://mail.sarimtools.com";
  const trackedId = newTrackingId();
  const trackOpens = body.trackOpens ?? true;
  const trackClicks = body.trackClicks ?? true;

  const html = prepareOutgoingHtml(body.html ?? "", {
    trackedId, appUrl, trackOpens, trackClicks,
  });

  const mailboxes = await listMailboxes(auth.session, auth.credential);
  const from: EmailAddress = { email: auth.session.username };

  // Record as `queued` BEFORE submitting: if the submission throws, the row is
  // still there to reconcile against, rather than a silently lost send.
  const now = new Date().toISOString();
  const recipients = [...body.to, ...(body.cc ?? []), ...(body.bcc ?? [])];
  const d = db();
  d.prepare(
    `INSERT INTO tracked_message (id, recipient, subject, sent_at, stage)
     VALUES (?, ?, ?, ?, 'queued')`,
  ).run(trackedId, recipients.map((r) => r.email).join(", "), body.subject, now);

  const result = await sendEmail(auth.session, auth.credential, mailboxes, {
    from, to: body.to, cc: body.cc ?? [], bcc: body.bcc ?? [],
    subject: body.subject, html, inReplyTo: body.inReplyTo,
    attachments: body.attachments ?? [],
  });

  if (result.error) {
    d.prepare(
      `UPDATE tracked_message SET stage='bounced', bounce_reason=?, last_event_at=? WHERE id=?`,
    ).run(result.error, new Date().toISOString(), trackedId);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  d.prepare(
    `UPDATE tracked_message
        SET stage='sent', message_id=?, submission_id=?, last_event_at=? WHERE id=?`,
  ).run(result.emailId, result.submissionId, new Date().toISOString(), trackedId);

  return NextResponse.json({ ok: true, trackedId, emailId: result.emailId });
}
