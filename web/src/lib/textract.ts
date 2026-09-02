/* Token budget control. The single biggest cost lever with an LLM over email is
 * what you *don't* send: raw HTML mail is mostly markup, tracking pixels and
 * quoted history, and none of it changes the answer. */

const BLOCK = /<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi;

/** HTML -> plain text. Drops script/style outright rather than escaping them. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(BLOCK, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip the quoted history. A reply chain repeats the whole thread on every
 *  message; summarising it again is paying twice for the same tokens. */
export function stripQuoted(text: string): string {
  const lines = text.split("\n");
  const cut = lines.findIndex((l) =>
    /^\s*>/.test(l) ||
    /^\s*On .{4,80}\bwrote:\s*$/i.test(l) ||
    /^\s*-{2,}\s*Original Message\s*-{2,}/i.test(l) ||
    /^\s*From:\s.+\bSent:\s/i.test(l),
  );
  return (cut > 0 ? lines.slice(0, cut) : lines).join("\n").trim();
}

/** ~4 chars per token is close enough for budgeting; we cap on characters so
 *  there is no tokeniser dependency in the request path. */
export function budget(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // Keep the head: the ask in an email is almost always near the top.
  return text.slice(0, maxChars) + "\n…[truncated]";
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** One call for the whole cleanup pipeline. */
export function prepareForModel(
  body: { html?: string | null; text?: string | null },
  maxChars = 6000,
): string {
  const raw = body.text?.trim() || (body.html ? htmlToText(body.html) : "");
  return budget(stripQuoted(raw), maxChars);
}
