import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { cookies } from "next/headers";

/* The webmail proxies JMAP server-side, so the browser never receives mail
 * credentials. They ride in an httpOnly cookie, encrypted with AES-256-GCM —
 * a stolen cookie file is inert without the server secret, and the GCM tag
 * means a tampered cookie fails closed rather than decrypting to garbage. */

const COOKIE = "raymail_session";
const KEY = scryptSync(process.env.TELEMETRY_SECRET ?? "", "raymail.session.v1", 32);

export function seal(credential: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const body = Buffer.concat([c.update(credential, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal(token: string): string | null {
  const [iv, tag, body] = token.split(".");
  if (!iv || !tag || !body) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;   // tampered, or the secret rotated
  }
}

/** Returns the base64 "user:pass" credential for JMAP, or null when signed out. */
export async function currentCredential(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  return raw ? unseal(raw) : null;
}

export const SESSION_COOKIE = COOKIE;
