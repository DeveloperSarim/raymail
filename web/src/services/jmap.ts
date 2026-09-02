import type { Mailbox, MessageSummary, MessageBody, EmailAddress } from "@/types/mail";

/* Minimal JMAP (RFC 8621) client. Only the methods the UI actually calls are
 * modelled; the server is Stalwart, reached over the internal docker network so
 * the browser never holds mail credentials. */

const ENDPOINT = process.env.JMAP_ENDPOINT ?? "http://stalwart:8080";

export interface JmapSession {
  apiUrl: string;
  uploadUrl: string;
  accountId: string;
  username: string;
}

interface SessionResponse {
  apiUrl: string;
  uploadUrl: string;
  primaryAccounts: Record<string, string>;
  username: string;
}

type MethodCall = [string, Record<string, unknown>, string];

export class JmapError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "JmapError";
  }
}

function authHeader(credential: string): string {
  return `Basic ${credential}`;
}

export async function getSession(credential: string): Promise<JmapSession> {
  const res = await fetch(`${ENDPOINT}/.well-known/jmap`, {
    headers: { Authorization: authHeader(credential) },
    cache: "no-store",
  });
  if (!res.ok) throw new JmapError("JMAP session rejected", res.status);
  const body = (await res.json()) as SessionResponse;
  const accountId = body.primaryAccounts["urn:ietf:params:jmap:mail"];
  if (!accountId) throw new JmapError("No mail account on this principal", 403);
  // Stalwart returns an absolute apiUrl built from its own advertised hostname;
  // rewrite it onto our internal endpoint so we don't depend on that matching.
  const apiPath = new URL(body.apiUrl, ENDPOINT).pathname;
  // uploadUrl is a URI template containing {accountId}; resolve it here.
  const uploadPath = new URL(body.uploadUrl.replace("{accountId}", accountId), ENDPOINT).pathname;
  return {
    apiUrl: `${ENDPOINT}${apiPath}`,
    uploadUrl: `${ENDPOINT}${uploadPath}`,
    accountId,
    username: body.username,
  };
}

async function call<T>(
  session: JmapSession,
  credential: string,
  methods: MethodCall[],
): Promise<T[]> {
  const res = await fetch(session.apiUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader(credential),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:submission"],
      methodCalls: methods,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new JmapError(await res.text(), res.status);
  const body = (await res.json()) as { methodResponses: [string, T, string][] };
  return body.methodResponses.map((r) => r[1]);
}

// Stalwart returns mailboxes in creation order, which puts Deleted Items above
// Inbox. Every mail client shows the special-use folders in a conventional
// order instead, so impose it here rather than in the component.
const ROLE_ORDER: Record<string, number> = {
  inbox: 0, drafts: 1, sent: 2, archive: 3, junk: 4, trash: 5,
};

export async function listMailboxes(s: JmapSession, cred: string): Promise<Mailbox[]> {
  const [result] = await call<{ list: Mailbox[] }>(s, cred, [
    ["Mailbox/get", { accountId: s.accountId, ids: null }, "0"],
  ]);
  return (result?.list ?? []).sort((a, b) => {
    const ra = a.role ? ROLE_ORDER[a.role] ?? 90 : 99;
    const rb = b.role ? ROLE_ORDER[b.role] ?? 90 : 99;
    if (ra !== rb) return ra - rb;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

const SUMMARY_PROPS = [
  "id", "threadId", "mailboxIds", "from", "to", "subject", "preview",
  "receivedAt", "keywords", "hasAttachment", "size",
];

interface RawEmail {
  id: string; threadId: string; mailboxIds: Record<string, boolean>;
  from?: EmailAddress[]; to?: EmailAddress[]; cc?: EmailAddress[]; bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  subject?: string; preview?: string; receivedAt: string;
  keywords?: Record<string, boolean>; hasAttachment?: boolean; size: number;
  htmlBody?: { partId?: string }[]; textBody?: { partId?: string }[];
  bodyValues?: Record<string, { value: string }>;
  attachments?: { blobId: string; name?: string; type?: string; size?: number;
                  disposition?: string; cid?: string }[];
}

function toSummary(e: RawEmail): MessageSummary {
  return {
    id: e.id,
    threadId: e.threadId,
    mailboxIds: Object.keys(e.mailboxIds ?? {}),
    from: e.from ?? [],
    to: e.to ?? [],
    subject: e.subject ?? "(no subject)",
    preview: e.preview ?? "",
    receivedAt: e.receivedAt,
    isUnread: !(e.keywords?.["$seen"] ?? false),
    isFlagged: e.keywords?.["$flagged"] ?? false,
    hasAttachment: e.hasAttachment ?? false,
    size: e.size,
  };
}

export async function listMessages(
  s: JmapSession, cred: string, mailboxId: string, limit = 60,
): Promise<MessageSummary[]> {
  const responses = await call<{ list?: RawEmail[] }>(s, cred, [
    ["Email/query", {
      accountId: s.accountId,
      filter: { inMailbox: mailboxId },
      sort: [{ property: "receivedAt", isAscending: false }],
      limit,
    }, "0"],
    ["Email/get", {
      accountId: s.accountId,
      "#ids": { resultOf: "0", name: "Email/query", path: "/ids" },
      properties: SUMMARY_PROPS,
    }, "1"],
  ]);
  return (responses[1]?.list ?? []).map(toSummary);
}

export async function getMessage(
  s: JmapSession, cred: string, id: string,
): Promise<MessageBody | null> {
  const [result] = await call<{ list?: RawEmail[] }>(s, cred, [
    ["Email/get", {
      accountId: s.accountId,
      ids: [id],
      properties: [...SUMMARY_PROPS, "cc", "bcc", "replyTo", "htmlBody", "textBody",
                   "bodyValues", "attachments"],
      fetchHTMLBodyValues: true,
      fetchTextBodyValues: true,
      maxBodyValueBytes: 700_000,
    }, "0"],
  ]);
  const e = result?.list?.[0];
  if (!e) return null;

  const pick = (parts?: { partId?: string }[]): string | null => {
    const partId = parts?.[0]?.partId;
    if (!partId) return null;
    return e.bodyValues?.[partId]?.value ?? null;
  };

  return {
    ...toSummary(e),
    cc: e.cc ?? [],
    bcc: e.bcc ?? [],
    replyTo: e.replyTo ?? [],
    htmlBody: pick(e.htmlBody),
    textBody: pick(e.textBody),
    attachments: (e.attachments ?? []).map((a) => ({
      blobId: a.blobId,
      name: a.name ?? "untitled",
      type: a.type ?? "application/octet-stream",
      size: a.size ?? 0,
      disposition: a.disposition === "inline" ? "inline" as const : "attachment" as const,
      cid: a.cid,
    })),
  };
}

export async function setKeyword(
  s: JmapSession, cred: string, id: string, keyword: string, value: boolean,
): Promise<void> {
  await call(s, cred, [
    ["Email/set", {
      accountId: s.accountId,
      update: { [id]: { [`keywords/${keyword}`]: value ? true : null } },
    }, "0"],
  ]);
}

/** Moves a message between mailboxes. Passing `from` removes it from that
 *  mailbox in the same patch, which is what "delete" means here - JMAP has no
 *  destructive delete for a normal mailbox move. */
export async function moveMessage(
  s: JmapSession, cred: string, id: string, from: string | null, to: string,
): Promise<void> {
  const patch: Record<string, boolean | null> = { [`mailboxIds/${to}`]: true };
  if (from) patch[`mailboxIds/${from}`] = null;
  await call(s, cred, [
    ["Email/set", { accountId: s.accountId, update: { [id]: patch } }, "0"],
  ]);
}

export { ENDPOINT as JMAP_ENDPOINT };

export interface SendAttachment {
  blobId: string;
  name: string;
  type: string;
  size: number;
}

export interface SendInput {
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  html: string;
  inReplyTo?: string;
  attachments: SendAttachment[];
}

/** Creates the Email in Drafts, submits it, then files it into Sent — the
 *  three-step dance RFC 8621 requires for a tracked send. */
export async function sendEmail(
  s: JmapSession, cred: string, mailboxes: Mailbox[], input: SendInput,
): Promise<{ emailId: string | null; submissionId: string | null; error: string | null }> {
  const drafts = mailboxes.find((m) => m.role === "drafts");
  const sent = mailboxes.find((m) => m.role === "sent");
  if (!drafts) return { emailId: null, submissionId: null, error: "No Drafts mailbox on this account" };

  const identityRes = await call<{ list?: { id: string; email: string }[] }>(s, cred, [
    ["Identity/get", { accountId: s.accountId }, "0"],
  ]);
  const identity = identityRes[0]?.list?.find((i) => i.email === input.from.email)
                ?? identityRes[0]?.list?.[0];
  if (!identity) return { emailId: null, submissionId: null, error: "No sending identity available" };

  const responses = await call<Record<string, unknown>>(s, cred, [
    ["Email/set", {
      accountId: s.accountId,
      create: {
        draft: {
          mailboxIds: { [drafts.id]: true },
          keywords: { $draft: true },
          from: [input.from],
          to: input.to,
          ...(input.cc.length ? { cc: input.cc } : {}),
          ...(input.bcc.length ? { bcc: input.bcc } : {}),
          subject: input.subject,
          ...(input.inReplyTo ? { inReplyTo: [input.inReplyTo] } : {}),
          bodyStructure: input.attachments.length
            ? {
                type: "multipart/mixed",
                subParts: [
                  { type: "text/html", partId: "body" },
                  ...input.attachments.map((a) => ({
                    blobId: a.blobId,
                    type: a.type || "application/octet-stream",
                    name: a.name,
                    disposition: "attachment",
                  })),
                ],
              }
            : { type: "text/html", partId: "body" },
          bodyValues: { body: { value: input.html } },
        },
      },
    }, "0"],
    ["EmailSubmission/set", {
      accountId: s.accountId,
      create: {
        submit: {
          emailId: "#draft",
          identityId: identity.id,
          envelope: {
            mailFrom: { email: input.from.email },
            rcptTo: [...input.to, ...input.cc, ...input.bcc].map((r) => ({ email: r.email })),
          },
        },
      },
      // Move out of Drafts into Sent, and drop the $draft keyword, atomically.
      onSuccessUpdateEmail: {
        "#submit": {
          [`mailboxIds/${drafts.id}`]: null,
          ...(sent ? { [`mailboxIds/${sent.id}`]: true } : {}),
          "keywords/$draft": null,
          "keywords/$seen": true,
        },
      },
    }, "1"],
  ]);

  const emailSet = responses[0] as { created?: { draft?: { id: string } }; notCreated?: Record<string, { description?: string }> };
  const subSet = responses[1] as { notCreated?: Record<string, { description?: string; type?: string }> };

  const emailErr = emailSet?.notCreated?.["draft"];
  if (emailErr) return { emailId: null, submissionId: null, error: emailErr.description ?? "Draft rejected" };

  const subErr = subSet?.notCreated?.["submit"];
  if (subErr) {
    return { emailId: null, submissionId: null, error: subErr.description ?? subErr.type ?? "Submission rejected" };
  }
  return {
    emailId: emailSet?.created?.draft?.id ?? null,
    submissionId: (responses[1] as { created?: { submit?: { id: string } } })?.created?.submit?.id ?? null,
    error: null,
  };
}

/** Delivery state straight from the MTA, so the `delivered` stage reflects what
 *  actually happened rather than being inferred from a successful submission. */
export async function getSubmissionStatus(
  s: JmapSession, cred: string, ids: string[],
): Promise<Record<string, "queued" | "yes" | "no" | "unknown">> {
  if (ids.length === 0) return {};
  const [res] = await call<{ list?: { id: string; deliveryStatus?: Record<string, { delivered?: string }> }[] }>(
    s, cred, [["EmailSubmission/get", { accountId: s.accountId, ids }, "0"]],
  );
  const out: Record<string, "queued" | "yes" | "no" | "unknown"> = {};
  for (const sub of res?.list ?? []) {
    const states = Object.values(sub.deliveryStatus ?? {}).map((d) => d.delivered);
    out[sub.id] = states.includes("no") ? "no"
      : states.length > 0 && states.every((x) => x === "yes") ? "yes"
      : states.includes("queued") ? "queued" : "unknown";
  }
  return out;
}
