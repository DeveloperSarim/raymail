import { DatabaseSync } from "node:sqlite";
import { DELIVERY_STAGES, type DeliveryStage } from "@/types/telemetry";

/* Telemetry lives in SQLite rather than a new Postgres container: the write
 * volume is one row per send plus one per open/click, and the host already
 * runs enough databases. node:sqlite is in the Node runtime, so this adds no
 * dependency and no native build step. */

const DB_PATH = process.env.RAYMAIL_DB ?? "/data/raymail.db";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tracked_message (
  id              TEXT PRIMARY KEY,
  message_id      TEXT,
  submission_id   TEXT,
  recipient       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  sent_at         TEXT NOT NULL,
  stage           TEXT NOT NULL DEFAULT 'queued',
  open_count      INTEGER NOT NULL DEFAULT 0,
  click_count     INTEGER NOT NULL DEFAULT 0,
  first_opened_at TEXT,
  last_event_at   TEXT,
  bounce_reason   TEXT
);
CREATE TABLE IF NOT EXISTS telemetry_event (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_id  TEXT NOT NULL,
  type        TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  target_url  TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_tracked ON telemetry_event(tracked_id);
CREATE INDEX IF NOT EXISTS idx_event_time    ON telemetry_event(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tracked_sent  ON tracked_message(sent_at);

CREATE TABLE IF NOT EXISTS attachment_index (
  blob_id    TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  sender     TEXT NOT NULL,
  seen_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_type ON attachment_index(type);

-- Model output is expensive enough to be worth caching, and keyed by task plus
-- a content hash an unchanged message is never paid for twice.
CREATE TABLE IF NOT EXISTS ai_cache (
  key        TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  result     TEXT NOT NULL,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;

let handle: DatabaseSync | undefined;

export function db(): DatabaseSync {
  if (!handle) {
    handle = new DatabaseSync(DB_PATH);
    // WAL lets the pixel endpoint write while the dashboard reads.
    handle.exec("PRAGMA journal_mode = WAL");
    handle.exec("PRAGMA busy_timeout = 4000");
    handle.exec(SCHEMA);
    // Older databases predate submission_id; ALTER is the cheapest migration
    // and SQLite has no IF NOT EXISTS for columns.
    try { handle.exec("ALTER TABLE tracked_message ADD COLUMN submission_id TEXT"); }
    catch { /* already present */ }
  }
  return handle;
}

/** Cache lookup for an AI task. Returns null on a miss. */
export function aiCacheGet(key: string): string | null {
  const row = db().prepare("SELECT result FROM ai_cache WHERE key = ?").get(key) as
    | { result: string } | undefined;
  return row?.result ?? null;
}

export function aiCachePut(
  key: string, kind: string, result: string, tokensIn: number, tokensOut: number,
): void {
  db().prepare(
    `INSERT OR REPLACE INTO ai_cache (key, kind, result, tokens_in, tokens_out, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(key, kind, result, tokensIn, tokensOut, new Date().toISOString());
}

/** Stages only advance. An open arriving after a click must not regress the
 *  record, and a bounce wins from wherever the message currently sits. */
export function advanceStage(current: DeliveryStage, next: DeliveryStage): DeliveryStage {
  if (current === "bounced" || next === "bounced") return "bounced";
  const a = DELIVERY_STAGES.indexOf(current as (typeof DELIVERY_STAGES)[number]);
  const b = DELIVERY_STAGES.indexOf(next as (typeof DELIVERY_STAGES)[number]);
  return b > a ? next : current;
}
