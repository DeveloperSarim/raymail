/* DeepSeek client. The API is OpenAI-compatible, so this is a thin fetch
 * wrapper rather than another dependency. */

const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export class AiUnavailable extends Error {
  constructor(msg = "AI is not configured") { super(msg); this.name = "AiUnavailable"; }
}

export function aiConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export interface AiResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export async function complete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<AiResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AiUnavailable();

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      // Hard ceiling on output: an unbounded completion is the other half of
      // the bill, and every one of our tasks has a natural length.
      max_tokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0.4,
      stream: false,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: body.choices?.[0]?.message?.content?.trim() ?? "",
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
  };
}
