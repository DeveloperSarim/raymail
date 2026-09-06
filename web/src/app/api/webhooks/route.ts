import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { requireSession } from "@/lib/guard";
import {
  listEndpoints, createEndpoint, recentDeliveries, WEBHOOK_EVENTS,
} from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/* A webhook URL is attacker-controllable input that the *server* then fetches.
 * Without this check, anyone who can sign in could point an endpoint at
 * 169.254.169.254 or a service on the private network and use RayMail as a
 * proxy into it. Resolve the host first and refuse anything not publicly
 * routable. */
const PRIVATE_V4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  return PRIVATE_V4.some((re) => re.test(ip));
}

async function validateUrl(raw: string): Promise<string | null> {
  let url: URL;
  try { url = new URL(raw); } catch { return "That is not a valid URL"; }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "Only http and https URLs are supported";
  }
  // Payloads carry telemetry about real people; plaintext is a poor default.
  if (url.protocol === "http:" && !isPrivateAddress(url.hostname)) {
    return "Use https for a public endpoint";
  }

  try {
    const { address } = await lookup(url.hostname);
    if (isPrivateAddress(address)) {
      return "That host resolves to a private address and cannot be used";
    }
  } catch {
    return "That hostname does not resolve";
  }
  return null;
}

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  // The secret is shown once, at creation. Listing returns only a prefix so an
  // operator can tell endpoints apart without the value leaking again.
  const endpoints = listEndpoints().map((e) => ({
    id: e.id, url: e.url, events: e.events, description: e.description,
    enabled: Boolean(e.enabled), createdAt: e.createdAt, lastUsedAt: e.lastUsedAt,
    secretHint: `${e.secret.slice(0, 11)}...`,
  }));

  return NextResponse.json({
    endpoints,
    deliveries: recentDeliveries(50),
    availableEvents: WEBHOOK_EVENTS,
  });
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as
    { url?: string; events?: string[]; description?: string };

  if (!body.url) return NextResponse.json({ error: "A URL is required" }, { status: 400 });

  const problem = await validateUrl(body.url);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const events = (body.events ?? []).filter((e) =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e));

  const created = createEndpoint(body.url, events, body.description?.slice(0, 120) ?? null);

  // The only time the full secret is ever returned.
  return NextResponse.json({
    ok: true,
    endpoint: {
      id: created.id, url: created.url, events: created.events,
      description: created.description, createdAt: created.createdAt,
    },
    secret: created.secret,
  });
}
