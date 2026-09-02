import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { getMessage } from "@/services/jmap";
import { cachedComplete, cacheKey, aiErrorResponse } from "@/lib/ai";
import { prepareForModel } from "@/lib/textract";

export const dynamic = "force-dynamic";

/* Single-message summary. Cached on the message content hash, so re-opening a
 * message never costs a second call. */

const SYSTEM = [
  "You summarise email for a busy reader.",
  "Reply with strict JSON only, no prose and no code fences:",
  '{"summary": string, "actions": string[], "urgency": "low"|"normal"|"high"}',
  "summary: at most two sentences, plain text.",
  "actions: what THIS reader must do, imperative, at most 3, empty array if none.",
  "urgency: high only for a real deadline or an explicit blocker.",
  "Never invent details that are not in the message.",
].join(" ");

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { messageId } = (await req.json()) as { messageId?: string };
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const msg = await getMessage(auth.session, auth.credential, messageId);
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const text = prepareForModel({ html: msg.htmlBody, text: msg.textBody }, 6000);
  if (text.length < 40) {
    // Not worth a round trip - the preview already says everything.
    return NextResponse.json({
      summary: msg.preview || "(no readable content)", actions: [], urgency: "low", cached: true,
    });
  }

  try {
    const r = await cachedComplete({
      kind: "summary",
      // Hash the content, not the id: an edited draft resummarises, an
      // unchanged message never does.
      key: cacheKey("summary", messageId, text),
      system: SYSTEM,
      user: `Subject: ${msg.subject}\nFrom: ${msg.from[0]?.email ?? "unknown"}\n\n${text}`,
      maxTokens: 260,
      temperature: 0.2,
    });

    try {
      const parsed = JSON.parse(r.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      return NextResponse.json({ ...parsed, cached: r.cached, usage: { tokensIn: r.tokensIn, tokensOut: r.tokensOut } });
    } catch {
      // Model drifted off JSON - still useful as plain text.
      return NextResponse.json({ summary: r.text, actions: [], urgency: "normal", cached: r.cached });
    }
  } catch (e) {
    return aiErrorResponse(e);
  }
}
