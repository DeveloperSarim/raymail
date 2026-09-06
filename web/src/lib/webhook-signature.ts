import { createHmac, timingSafeEqual } from "node:crypto";

/* Signing is pure crypto with no persistence, so it lives on its own: the
 * verification path can be exercised directly by the test suite, and a
 * receiver can copy this file verbatim.
 *
 *     X-RayMail-Signature: t=1699999999,v1=<hex hmac of "t.body">
 *
 * Deliberately the same shape Stripe uses, so existing verification snippets
 * port with almost no change. The timestamp is inside the signed material, so
 * a captured request cannot be replayed later against a receiver that checks
 * the tolerance window. */

export function signPayload(secret: string, body: string, timestamp: number): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export function verifySignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;

  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const idx = piece.indexOf("=");
    if (idx > 0) parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim();
  }

  const t = Number(parts["t"]);
  const v1 = parts["v1"];
  if (!Number.isFinite(t) || !v1) return false;

  // Window check first: a replayed request is rejected without a compare.
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
