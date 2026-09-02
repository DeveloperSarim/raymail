import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

/* Tracking tokens are HMAC-signed. Without this, anyone who can read a message
 * body could forge opens and clicks for any tracked id, or point the click
 * redirector at an arbitrary host and use it as an open redirect. */

const SECRET = process.env.TELEMETRY_SECRET ?? "";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 24);
}

export function newTrackingId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20);
}

/** Token for the open pixel: <trackedId>.<sig> */
export function openToken(trackedId: string): string {
  return `${trackedId}.${sign(`o:${trackedId}`)}`;
}

/** Token for a click: <trackedId>.<base64url(url)>.<sig> — the destination is
 *  inside the signature, so the redirector can never be repointed. */
export function clickToken(trackedId: string, url: string): string {
  const enc = Buffer.from(url, "utf8").toString("base64url");
  return `${trackedId}.${enc}.${sign(`c:${trackedId}:${enc}`)}`;
}

function verify(expected: string, got: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function readOpenToken(token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  return verify(sign(`o:${id}`), sig) ? id : null;
}

export function readClickToken(token: string): { id: string; url: string } | null {
  const [id, enc, sig] = token.split(".");
  if (!id || !enc || !sig) return null;
  if (!verify(sign(`c:${id}:${enc}`), sig)) return null;
  const url = Buffer.from(enc, "base64url").toString("utf8");
  // Defence in depth: even a correctly signed token may only redirect to http(s).
  if (!/^https?:\/\//i.test(url)) return null;
  return { id, url };
}
