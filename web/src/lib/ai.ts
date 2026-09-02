import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { aiCacheGet, aiCachePut } from "@/lib/db";
import { complete, aiConfigured, AiUnavailable } from "@/services/deepseek";

export function cacheKey(kind: string, ...parts: string[]): string {
  return `${kind}:${createHash("sha256").update(parts.join(" ")).digest("hex").slice(0, 32)}`;
}

/** Runs a task through the cache first, then the model. A cache hit costs
 *  nothing, which matters most for summaries: the same message gets opened
 *  many times but only ever needs summarising once. */
export async function cachedComplete(opts: {
  kind: string;
  key: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; cached: boolean; tokensIn: number; tokensOut: number }> {
  const hit = aiCacheGet(opts.key);
  if (hit !== null) return { text: hit, cached: true, tokensIn: 0, tokensOut: 0 };

  const r = await complete({
    system: opts.system,
    user: opts.user,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });
  aiCachePut(opts.key, opts.kind, r.text, r.promptTokens, r.completionTokens);
  return { text: r.text, cached: false, tokensIn: r.promptTokens, tokensOut: r.completionTokens };
}

export function aiErrorResponse(e: unknown): NextResponse {
  if (e instanceof AiUnavailable) {
    return NextResponse.json(
      { error: "AI is not configured - set DEEPSEEK_API_KEY in .env" },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "AI request failed" },
    { status: 502 },
  );
}

export { aiConfigured };
