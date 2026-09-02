import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;   // matches the usual 25MB message ceiling

/** Streams an attachment into Stalwart's blob store and hands back the blobId. */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Attachment exceeds 25 MB" }, { status: 413 });
  }

  const res = await fetch(auth.session.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth.credential}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: new Uint8Array(await file.arrayBuffer()),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Upload rejected by mail server" }, { status: 502 });
  }

  const blob = (await res.json()) as { blobId: string; size: number; type: string };
  return NextResponse.json({
    blobId: blob.blobId, name: file.name, type: file.type, size: file.size,
  });
}
