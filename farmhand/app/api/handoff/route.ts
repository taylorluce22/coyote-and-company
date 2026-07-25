import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

/**
 * Phone handoff transfer hop. The browser uploads an ENCRYPTED client
 * bundle (AES-GCM; the key never leaves the sending device except inside
 * the link's #fragment) to Blob, the phone downloads + imports it, then
 * calls back here to delete the blob. Blob is a hop, not a store — same
 * philosophy as the reel-upload route.
 *
 * GET             → { configured }
 * POST (tokens)   → handleUpload flow for paths under handoff/
 * POST { del }    → delete a handoff blob after successful import
 */

export async function GET() {
  return NextResponse.json({ configured: !!process.env.BLOB_READ_WRITE_TOKEN });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody & { del?: string };

  // cleanup call from the receiving device
  if (typeof body.del === "string" && body.del) {
    try {
      const u = new URL(body.del);
      if (/\.vercel-storage\.com$/.test(u.hostname) && u.pathname.includes("handoff")) {
        await del(body.del);
        return NextResponse.json({ ok: true });
      }
    } catch {}
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("handoff/")) throw new Error("bad path");
        return {
          allowedContentTypes: ["application/octet-stream"],
          addRandomSuffix: true,
          maximumSizeInBytes: 100 * 1024 * 1024,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "handoff token failed" }, { status: 400 });
  }
}
