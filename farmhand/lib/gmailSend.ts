/**
 * Gmail send — the only code in this app that can transmit mail.
 *
 * Deliberately narrow: it sends an EXISTING draft by id. It cannot compose,
 * cannot alter a body, cannot read the mailbox, and cannot pick recipients.
 * Whatever Taylor reviewed in Gmail is exactly what goes out, because the
 * draft is the payload.
 *
 * Scope requested is gmail.compose ("manage drafts and send"), not gmail.modify
 * or mail.google.com — this token cannot read the inbox.
 *
 * Env (all three required; absent → gmailEnabled() is false and every call is
 * a safe no-op, same graceful-degrade contract as lib/supabase.ts):
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN     minted once by scripts/gmail-oauth.mjs
 */

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || "";

export function gmailEnabled(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

type TokenCache = { token: string; expiresAt: number };
let cached: TokenCache | null = null;

/** Exchange the refresh token for a short-lived access token (cached ~55m). */
async function getAccessToken(): Promise<string | null> {
  if (!gmailEnabled()) return null;
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cached = {
      token: j.access_token,
      expiresAt: Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000,
    };
    return cached.token;
  } catch {
    return null;
  }
}

export type SendResult =
  | { ok: true; messageId: string | null; threadId: string | null }
  | { ok: false; error: string };

/**
 * Send an existing Gmail draft by id. The draft's own recipients, subject and
 * body are what get sent — nothing here can change them.
 */
export async function sendDraft(draftId: string): Promise<SendResult> {
  if (!draftId) return { ok: false, error: "draft id required" };
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "gmail not configured or token refresh failed" };
  try {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = (await r.json().catch(() => ({}))) as {
      id?: string;
      threadId?: string;
      error?: { message?: string };
    };
    if (!r.ok) {
      // 404 here almost always means the draft was already sent or discarded
      const detail = body?.error?.message || `HTTP ${r.status}`;
      return { ok: false, error: r.status === 404 ? `draft not found (already sent or discarded) — ${detail}` : detail };
    }
    return { ok: true, messageId: body.id || null, threadId: body.threadId || null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
