import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** The signed-in identity. The top bar previously showed the open message's
 *  recipient, which is not the account and was wrong whenever you read mail
 *  addressed to an alias. */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    username: auth.session.username,
    accountId: auth.session.accountId,
  });
}
