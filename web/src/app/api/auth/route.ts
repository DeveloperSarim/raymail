import { NextResponse } from "next/server";
import { getSession, JmapError } from "@/services/jmap";
import { seal, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as { username?: string; password?: string };
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const credential = Buffer.from(`${username}:${password}`, "utf8").toString("base64");

  // Authenticate by actually opening a JMAP session; we never keep our own
  // user table, so Stalwart stays the single source of truth for identity.
  try {
    const session = await getSession(credential);
    const res = NextResponse.json({ ok: true, username: session.username });
    res.cookies.set(SESSION_COOKIE, seal(credential), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e) {
    const status = e instanceof JmapError && e.status === 401 ? 401 : 502;
    return NextResponse.json(
      { error: status === 401 ? "Incorrect username or password" : "Mail server unreachable" },
      { status },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
