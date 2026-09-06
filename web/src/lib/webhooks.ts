import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { signPayload, verifySignature } from "@/lib/webhook-signature";
import type { TelemetryEventType } from "@/types/telemetry";

/* Outbound webhooks.
 *
 * Telemetry that cannot leave the box is only useful to a person looking at a
 * dashboard. Webhooks are what make it useful to a business: a delivery lands
 * in the CRM, a bounce suppresses a contact, a click notifies Slack.
 *
 * Deliveries are queued to SQLite rather than fired inline. A tracking pixel
 * must return in milliseconds no matter how slow the receiver is, and a
 * receiver that is down must not lose the event.
 */

export const WEBHOOK_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.opened",
  "message.clicked",
  "message.bounced",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Maps an internal telemetry event onto its public webhook name. */
export function eventNameFor(type: TelemetryEventType | "sent"): WebhookEvent {
  switch (type) {
    case "open": return "message.opened";
    case "click": return "message.clicked";
    case "delivered": return "message.delivered";
    case "bounced": return "message.bounced";
    default: return "message.sent";
  }
}

export interface Endpoint {
  id: string;
  url: string;
  secret: string;
  events: string;
  description: string | null;
  enabled: number;
  createdAt: string;
  lastUsedAt: string | null;
}

export function newSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export { signPayload, verifySignature };

export function listEndpoints(): Endpoint[] {
  return db().prepare(
    `SELECT id, url, secret, events, description, enabled,
            created_at AS createdAt, last_used_at AS lastUsedAt
       FROM webhook_endpoint ORDER BY created_at DESC`,
  ).all() as unknown as Endpoint[];
}

export function createEndpoint(
  url: string, events: string[], description: string | null,
): Endpoint {
  const id = randomUUID().slice(0, 18);
  const secret = newSecret();
  db().prepare(
    `INSERT INTO webhook_endpoint (id, url, secret, events, description, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  ).run(id, url, secret, events.length ? events.join(",") : "*", description,
        new Date().toISOString());
  return listEndpoints().find((e) => e.id === id)!;
}

export function deleteEndpoint(id: string): void {
  const d = db();
  d.prepare("DELETE FROM webhook_endpoint WHERE id = ?").run(id);
  d.prepare("DELETE FROM webhook_delivery WHERE endpoint_id = ?").run(id);
}

export function setEndpointEnabled(id: string, enabled: boolean): void {
  db().prepare("UPDATE webhook_endpoint SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}

function subscribes(endpoint: Endpoint, event: WebhookEvent): boolean {
  return endpoint.events === "*" || endpoint.events.split(",").includes(event);
}

/** Queues one event for every endpoint subscribed to it. Never throws: a
 *  webhook problem must not break the request that produced the event. */
export function enqueue(event: WebhookEvent, data: Record<string, unknown>): number {
  try {
    const now = new Date().toISOString();
    const payload = JSON.stringify({
      id: `evt_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      type: event,
      createdAt: now,
      data,
    });

    const targets = listEndpoints().filter((e) => e.enabled && subscribes(e, event));
    const stmt = db().prepare(
      `INSERT INTO webhook_delivery (endpoint_id, event_type, payload, status, next_attempt_at, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    );
    for (const t of targets) stmt.run(t.id, event, payload, now, now);
    return targets.length;
  } catch {
    return 0;
  }
}

// Attempt n waits 1m, 5m, 25m, 2h, 10h — five tries across roughly half a day,
// which covers a receiver restart without hammering one that is simply gone.
const BACKOFF_SECONDS = [60, 300, 1500, 7200, 36000];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length;

interface PendingRow {
  id: number; endpointId: string; eventType: string; payload: string; attempts: number;
  url: string; secret: string;
}

/** Delivers everything currently due. Returns what happened, for the admin UI
 *  and for the cron entry that calls it. */
export async function drain(limit = 25): Promise<{ delivered: number; failed: number; retrying: number }> {
  const d = db();
  const now = new Date().toISOString();

  const rows = d.prepare(
    `SELECT wd.id, wd.endpoint_id AS endpointId, wd.event_type AS eventType,
            wd.payload, wd.attempts, we.url, we.secret
       FROM webhook_delivery wd
       JOIN webhook_endpoint we ON we.id = wd.endpoint_id
      WHERE wd.status = 'pending' AND wd.next_attempt_at <= ? AND we.enabled = 1
      ORDER BY wd.next_attempt_at LIMIT ?`,
  ).all(now, limit) as unknown as PendingRow[];

  let delivered = 0, failed = 0, retrying = 0;

  for (const row of rows) {
    const attempt = row.attempts + 1;
    const ts = Math.floor(Date.now() / 1000);
    let code: number | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(row.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "RayMail-Webhooks/1.0",
          "X-RayMail-Event": row.eventType,
          "X-RayMail-Signature": signPayload(row.secret, row.payload, ts),
        },
        body: row.payload,
        // A slow receiver must not hold the queue; it gets retried instead.
        signal: AbortSignal.timeout(10_000),
      });
      code = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "request failed";
    }

    if (!error) {
      d.prepare(
        `UPDATE webhook_delivery SET status='delivered', attempts=?, response_code=?,
                delivered_at=?, last_error=NULL WHERE id=?`,
      ).run(attempt, code, new Date().toISOString(), row.id);
      d.prepare("UPDATE webhook_endpoint SET last_used_at=? WHERE id=?")
        .run(new Date().toISOString(), row.endpointId);
      delivered++;
    } else if (attempt >= MAX_ATTEMPTS) {
      d.prepare(
        `UPDATE webhook_delivery SET status='failed', attempts=?, response_code=?,
                last_error=? WHERE id=?`,
      ).run(attempt, code, error, row.id);
      failed++;
    } else {
      const wait = BACKOFF_SECONDS[attempt] ?? 3600;
      d.prepare(
        `UPDATE webhook_delivery SET attempts=?, response_code=?, last_error=?,
                next_attempt_at=? WHERE id=?`,
      ).run(attempt, code, error, new Date(Date.now() + wait * 1000).toISOString(), row.id);
      retrying++;
    }
  }

  return { delivered, failed, retrying };
}

export interface DeliveryRow {
  id: number; endpointId: string; eventType: string; status: string;
  attempts: number; responseCode: number | null; lastError: string | null;
  createdAt: string; deliveredAt: string | null;
}

export function recentDeliveries(limit = 50): DeliveryRow[] {
  return db().prepare(
    `SELECT id, endpoint_id AS endpointId, event_type AS eventType, status, attempts,
            response_code AS responseCode, last_error AS lastError,
            created_at AS createdAt, delivered_at AS deliveredAt
       FROM webhook_delivery ORDER BY id DESC LIMIT ?`,
  ).all(limit) as unknown as DeliveryRow[];
}
