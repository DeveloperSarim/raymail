import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import {
  listDomains, listDkim, listListeners, listRoutes, listQueue, listAccounts, NotPermitted,
} from "@/services/stalwart-admin";

export const dynamic = "force-dynamic";

/** Everything the server console needs, in one round trip rather than six. */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const [accounts, domains, dkim, listeners, routes, queue] = await Promise.all([
      listAccounts(auth.credential),
      listDomains(auth.credential),
      listDkim(auth.credential),
      listListeners(auth.credential),
      listRoutes(auth.credential),
      listQueue(auth.credential),
    ]);
    return NextResponse.json({ accounts, domains, dkim, listeners, routes, queue });
  } catch (e) {
    if (e instanceof NotPermitted) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mail server unreachable" }, { status: 502 },
    );
  }
}
