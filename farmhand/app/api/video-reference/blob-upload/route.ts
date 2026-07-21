import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Issues short-lived client tokens so the browser can upload reel clips
 * straight to Vercel Blob storage, bypassing the ~4.5MB request-body cap
 * on Vercel serverless functions (iPhone reels regularly run 20-60MB).
 * The clip is deleted again right after /api/video-reference finishes
 * analyzing it — Blob is a transfer hop, not a permanent store.
 */
/** Status probe for the Connectors screen — is a Blob store attached? */
export async function GET() {
  return NextResponse.json({ configured: !!process.env.BLOB_READ_WRITE_TOKEN });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp", "video/x-msvideo"],
        addRandomSuffix: true,
        maximumSizeInBytes: 200 * 1024 * 1024,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "upload token failed" }, { status: 400 });
  }
}
