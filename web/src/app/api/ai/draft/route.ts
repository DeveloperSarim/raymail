import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { getMessage } from "@/services/jmap";
import { complete } from "@/services/deepseek";
import { aiErrorResponse } from "@/lib/ai";
import { prepareForModel } from "@/lib/textract";

export const dynamic = "force-dynamic";

/* Writing a new mail and replying to one are the same task with different
 * context, so they share a route. Drafts are deliberately NOT cached: the user
 * asking again means they want a different draft. */

const SYSTEM = [
  "You write email for a professional user.",
  "Return only the email body as simple HTML using <p>, <ul>, <li>, <strong> and <a>.",
  "No <html>, <head>, <body> or style attributes. No markdown fences.",
  "Do not invent facts, names, figures or commitments that were not given to you.",
  "Do not write a subject line and do not add a signature block.",
  "Match the requested tone. Be concise - shorter is better.",
].join(" ");

interface Body {
  mode?: "compose" | "reply";
  prompt?: string;
  tone?: string;
  /** Reply mode only: the message being replied to. */
  messageId?: string;
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as Body;
  const mode = body.mode ?? "compose";
  const tone = (body.tone ?? "professional").slice(0, 40);
  const prompt = (body.prompt ?? "").slice(0, 1200);

  if (mode === "compose" && !prompt.trim()) {
    return NextResponse.json({ error: "Tell the assistant what to write" }, { status: 400 });
  }

  let user: string;

  if (mode === "reply") {
    if (!body.messageId) {
      return NextResponse.json({ error: "messageId is required to reply" }, { status: 400 });
    }
    const msg = await getMessage(auth.session, auth.credential, body.messageId);
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    // Only the parts that change the answer: who, what subject, and the body
    // with markup and quoted history already stripped.
    const context = prepareForModel({ html: msg.htmlBody, text: msg.textBody }, 5000);
    user = [
      `Write a ${tone} reply to this email.`,
      prompt ? `The reply should: ${prompt}` : "Reply appropriately to what it asks.",
      "",
      `From: ${msg.from[0]?.email ?? "unknown"}`,
      `Subject: ${msg.subject}`,
      "",
      context,
    ].join("\n");
  } else {
    user = `Write a ${tone} email. It should: ${prompt}`;
  }

  try {
    const r = await complete({ system: SYSTEM, user, maxTokens: 700, temperature: 0.6 });
    // Models still fence output occasionally despite the instruction.
    const html = r.text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();
    return NextResponse.json({
      html,
      usage: { tokensIn: r.promptTokens, tokensOut: r.completionTokens },
    });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
