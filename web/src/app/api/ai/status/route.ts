import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { aiConfigured } from "@/lib/ai";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lets the UI disable AI affordances rather than offering buttons that 503,
 *  and surfaces what the assistant has actually cost so far. */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  let usage = { calls: 0, tokensIn: 0, tokensOut: 0, cachedEntries: 0 };
  try {
    const row = db().prepare(
      `SELECT COUNT(*) AS cachedEntries,
              COALESCE(SUM(tokens_in),0)  AS tokensIn,
              COALESCE(SUM(tokens_out),0) AS tokensOut
         FROM ai_cache`,
    ).get() as { cachedEntries: number; tokensIn: number; tokensOut: number };
    usage = { calls: row.cachedEntries, ...row };
  } catch {
    // Table may not exist yet on a cold database.
  }

  return NextResponse.json({
    configured: aiConfigured(),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    usage,
  });
}
