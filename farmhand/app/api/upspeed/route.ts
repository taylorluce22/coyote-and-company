import { NextRequest, NextResponse } from "next/server";

/**
 * Upload speed preflight sink: the client POSTs a few hundred KB and times
 * it, so the UI can predict how long a real clip will take (or refuse a
 * dead connection) BEFORE committing to a multi-hundred-MB transfer.
 * The body is read fully and discarded.
 */
export async function POST(req: NextRequest) {
  const bytes = await req.arrayBuffer().catch(() => null);
  return NextResponse.json({ ok: true, bytes: bytes ? bytes.byteLength : 0 });
}
