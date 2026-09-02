import { JMAP_ENDPOINT } from "@/services/jmap";

/* Stalwart's management API. Everything here is issued with the *caller's own*
 * credential, never a stored admin secret: Stalwart already enforces the
 * permission model (a normal mailbox gets `forbidden`), so proxying the user's
 * identity means there is no permission logic to reimplement here, nothing to
 * escalate through, and no admin password living in this app. */

const MANAGEMENT_URN = "urn:stalwart:jmap";

export class NotPermitted extends Error {
  constructor() { super("You are not authorized to manage the server"); this.name = "NotPermitted"; }
}

interface MethodResponse {
  notCreated?: Record<string, { description?: string; type?: string }>;
  notUpdated?: Record<string, { description?: string; type?: string }>;
  notDestroyed?: Record<string, { description?: string; type?: string }>;
  type?: string;
  description?: string;
  [k: string]: unknown;
}

export async function manage<T = MethodResponse>(
  credential: string, method: string, args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${JMAP_ENDPOINT}/jmap/`, {
    method: "POST",
    headers: { Authorization: `Basic ${credential}`, "Content-Type": "application/json" },
    body: JSON.stringify({ using: [MANAGEMENT_URN], methodCalls: [[method, args, "0"]] }),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new NotPermitted();
  if (!res.ok) throw new Error(`Management call failed (${res.status})`);

  const body = (await res.json()) as { methodResponses: [string, T, string][] };
  const first = body.methodResponses[0]?.[1];
  if ((first as MethodResponse)?.type === "forbidden") throw new NotPermitted();
  return first as T;
}

/** Surfaces the first per-object error a /set call reported, or null. */
export function setError(r: MethodResponse): string | null {
  for (const bucket of [r.notCreated, r.notUpdated, r.notDestroyed]) {
    const first = bucket && Object.values(bucket)[0];
    if (first) return first.description ?? first.type ?? "Rejected";
  }
  return null;
}

export interface ServerAccount {
  id: string;
  name: string;
  emailAddress: string;
  description: string | null;
  domainId: string;
  usedDiskQuota: number;
  quotas: Record<string, number>;
  roles: { "@type": string };
  createdAt: string;
  "@type": string;
}

export interface ServerDomain {
  id: string;
  name: string;
  isEnabled: boolean;
  description: string | null;
  createdAt: string;
}

export interface DkimRecord {
  id: string;
  selector: string;
  publicKey: string;
  "@type": string;
  stage: string;
  createdAt: string;
}

export interface QueuedItem {
  id: string;
  [k: string]: unknown;
}

export async function listAccounts(cred: string): Promise<ServerAccount[]> {
  const r = await manage<{ list?: ServerAccount[] }>(cred, "x:Account/get", { ids: null });
  return r.list ?? [];
}

export async function createAccount(
  cred: string,
  input: { name: string; secret: string; domainId: string; description?: string },
): Promise<string | null> {
  const r = await manage<MethodResponse & { created?: Record<string, { id: string }> }>(
    cred, "x:Account/set",
    {
      create: {
        u: {
          "@type": "User",
          name: input.name,
          domainId: input.domainId,
          description: input.description ?? null,
          credentials: {
            "0": { "@type": "Password", secret: input.secret, expiresAt: null, allowedIps: {} },
          },
          roles: { "@type": "User" },
          permissions: { "@type": "Inherit" },
          quotas: {},
          aliases: {},
          locale: "en-US",
          encryptionAtRest: { "@type": "Disabled" },
        },
      },
    },
  );
  const err = setError(r);
  if (err) throw new Error(err);
  return r.created?.["u"]?.id ?? null;
}

export async function setAccountPassword(cred: string, id: string, secret: string): Promise<void> {
  const r = await manage<MethodResponse>(cred, "x:Account/set", {
    update: {
      [id]: {
        credentials: { "0": { "@type": "Password", secret, expiresAt: null, allowedIps: {} } },
      },
    },
  });
  const err = setError(r);
  if (err) throw new Error(err);
}

export async function destroyAccount(cred: string, id: string): Promise<void> {
  const r = await manage<MethodResponse>(cred, "x:Account/set", { destroy: [id] });
  const err = setError(r);
  if (err) throw new Error(err);
}

export async function listDomains(cred: string): Promise<ServerDomain[]> {
  const r = await manage<{ list?: ServerDomain[] }>(cred, "x:Domain/get", { ids: null });
  return r.list ?? [];
}

export async function listDkim(cred: string): Promise<DkimRecord[]> {
  const r = await manage<{ list?: DkimRecord[] }>(cred, "x:DkimSignature/get", { ids: null });
  return r.list ?? [];
}

export async function listQueue(cred: string): Promise<QueuedItem[]> {
  const r = await manage<{ list?: QueuedItem[] }>(cred, "x:QueuedMessage/get", { ids: null });
  return r.list ?? [];
}

export async function destroyQueued(cred: string, ids: string[]): Promise<void> {
  const r = await manage<MethodResponse>(cred, "x:QueuedMessage/set", { destroy: ids });
  const err = setError(r);
  if (err) throw new Error(err);
}

export async function listListeners(cred: string): Promise<
  { id: string; name: string; protocol: string; bind: Record<string, boolean>; tlsImplicit: boolean }[]
> {
  const r = await manage<{ list?: { id: string; name: string; protocol: string; bind: Record<string, boolean>; tlsImplicit: boolean }[] }>(
    cred, "x:NetworkListener/get", { ids: null },
  );
  return r.list ?? [];
}

export async function listRoutes(cred: string): Promise<
  { id: string; name: string; "@type": string; address?: string; port?: number; authUsername?: string }[]
> {
  const r = await manage<{ list?: { id: string; name: string; "@type": string; address?: string; port?: number; authUsername?: string }[] }>(
    cred, "x:MtaRoute/get", { ids: null },
  );
  return r.list ?? [];
}
