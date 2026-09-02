import { NextResponse } from "next/server";
import { currentCredential } from "@/lib/session";
import { getSession, type JmapSession } from "@/services/jmap";

/** Resolves the caller's JMAP session, or returns the 401 to send back.
 *  Every authenticated route funnels through here so the check can't be
 *  forgotten on a new endpoint. */
export async function requireSession(): Promise<
  { ok: true; session: JmapSession; credential: string } | { ok: false; response: NextResponse }
> {
  const credential = await currentCredential();
  if (!credential) {
    return { ok: false, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  try {
    return { ok: true, session: await getSession(credential), credential };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
}
