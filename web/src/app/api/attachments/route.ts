import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Document Vault index. Populated as messages are opened (see the reader),
 *  which keeps it cheap — no background crawl of every mailbox. */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const d = db();
  const files = d.prepare(
    `SELECT blob_id AS blobId, message_id AS messageId, name, type, size,
            sender, seen_at AS seenAt
       FROM attachment_index ORDER BY seen_at DESC LIMIT 500`,
  ).all() as unknown as Record<string, unknown>[];

  const byType = d.prepare(
    `SELECT type, COUNT(*) AS count, SUM(size) AS bytes
       FROM attachment_index GROUP BY type ORDER BY bytes DESC`,
  ).all() as unknown as { type: string; count: number; bytes: number }[];

  const total = d.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(size),0) AS bytes FROM attachment_index`,
  ).get() as { count: number; bytes: number };

  return NextResponse.json({ files, byType, total });
}
