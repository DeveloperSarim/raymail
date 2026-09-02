import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { listMessages } from "@/services/jmap";
import { cachedComplete, cacheKey, aiErrorResponse } from "@/lib/ai";

export const dynamic = "force-dynamic";

/* Inbox overview. Deliberately built from envelope data only - sender, subject
 * and the preview line - never message bodies. Twenty full emails would be tens
 * of thousands of tokens; twenty preview lines is a few hundred, and it answers
 * the same question ("what is waiting for me?"). */

const SYSTEM = [
  "You brief a busy person on their inbox.",
  "Reply with strict JSON only, no prose and no code fences:",
  '{"headline": string, "themes": [{"label": string, "detail": string}], "needsReply": string[]}',
  "headline: one sentence on the state of the inbox.",
  "themes: at most 4 groupings of what is waiting, detail is one short sentence.",
  "needsReply: senders or subjects that look like they are waiting on this reader, at most 5.",
  "Base everything strictly on the lines given. Never invent senders or topics.",
].join(" ");

const MAX_MESSAGES = 25;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { mailboxId } = (await req.json()) as { mailboxId?: string };
  if (!mailboxId) return NextResponse.json({ error: "mailboxId required" }, { status: 400 });

  const messages = (await listMessages(auth.session, auth.credential, mailboxId, MAX_MESSAGES));
  if (messages.length === 0) {
    return NextResponse.json({ headline: "Nothing waiting - this folder is empty.", themes: [], needsReply: [], cached: true });
  }

  const lines = messages.map((m) => {
    const who = m.from[0]?.name || m.from[0]?.email || "unknown";
    const unread = m.isUnread ? "UNREAD " : "";
    return `- ${unread}${who} | ${m.subject} | ${m.preview.slice(0, 140)}`;
  });
  const digest = lines.join("\n");

  try {
    const r = await cachedComplete({
      kind: "overview",
      // Keyed on the digest, so the overview is recomputed only when the
      // inbox actually changed - not on every dashboard visit.
      key: cacheKey("overview", mailboxId, digest),
      system: SYSTEM,
      user: `${messages.length} most recent messages:\n\n${digest}`,
      maxTokens: 420,
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(r.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      return NextResponse.json({
        ...parsed, cached: r.cached, counted: messages.length,
        usage: { tokensIn: r.tokensIn, tokensOut: r.tokensOut },
      });
    } catch {
      return NextResponse.json({ headline: r.text, themes: [], needsReply: [], cached: r.cached });
    }
  } catch (e) {
    return aiErrorResponse(e);
  }
}
