# Gmail send from the Agency OS — setup

Built 2026-08-10. The send path is code-complete and builds clean. It is **inert until three env vars exist** — with no credentials, `gmailEnabled()` is false, the Send button doesn't render, and the send route returns 503. Nothing about the current behavior changes until you finish the steps below.

Everything here is a step only the account owner can take: creating credentials under your Google account and approving the consent screen. The code, the script, and the guardrails are done.

## What you're approving, precisely

A token scoped to **`gmail.compose`** — manage drafts and send mail. Not `gmail.modify`, not `mail.google.com`. **This token cannot read your inbox.** It can send drafts that already exist and nothing else.

## Step 1 — create the OAuth client (Google Cloud Console, ~5 min)

1. <https://console.cloud.google.com/> → create a project, e.g. `sonoran-agency-os`.
2. **APIs & Services → Library** → search "Gmail API" → **Enable**.
3. **APIs & Services → OAuth consent screen** → **Internal** (it's a Workspace domain, so Internal is available and skips Google verification entirely) → app name `Agency OS`, support email = your address → Save.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type **Web application** → under *Authorized redirect URIs* add exactly:

   ```
   http://localhost:871
   ```

5. Save. Copy the **Client ID** and **Client secret**.

## Step 2 — mint the refresh token (your machine, ~2 min)

From the farmhand repo:

```bash
node scripts/gmail-oauth.mjs <CLIENT_ID> <CLIENT_SECRET>
```

It prints a consent URL. Open it, **approve as taylor@sonoranclinicalpartners.com** — that approval is the step that's yours. The script catches the redirect on localhost automatically (or you can paste the `?code=` value), exchanges it, and prints the three variables.

Nothing is written to disk. The refresh token appears in your terminal only.

## Step 3 — put them in Vercel

Project → Settings → Environment Variables:

```
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
```

Redeploy. The **Send** button appears on `/agency/outreach` the moment all three are present.

Treat the refresh token like a password: it can send mail as you until revoked. Revoke any time at <https://myaccount.google.com/permissions>.

## The guardrails, and why they're shaped this way

These are properties of the code, not policy notes:

- **The draft is the payload.** `sendDraft()` calls `users.drafts.send` with a draft id. It cannot compose, edit a body, or choose recipients — what you reviewed in Gmail is byte-for-byte what goes out.
- **One row per request.** The route takes a single queue id. There is no send-all and no send-by-filter, so no call — mistaken, repeated, or malicious — can empty the queue.
- **Only `queued` rows send.** A row already `sent` is a no-op, so a double-click or a retry cannot send twice.
- **Two presses.** The button arms on the first press and sends on the second, and disarms on blur. No single click on that screen puts mail on the wire.
- **No autonomous path.** No cron, no agent, no scheduled trigger calls the send route. It exists to serve a button a human just pressed. The standing rule that agents draft and never send is intact — this changes where *you* press send, not who sends.

## What is not verified

I have no Gmail credentials in the build environment, so the send path is **unrun against live Gmail**. Types check and the app builds; the request shape follows the Gmail API `users.drafts.send` contract, but the first real send is the first proof.

Send one low-stakes row first and confirm it lands in Sent with the right body before working through the queue. If a row 404s, the draft was already sent or discarded in Gmail — mark the row rather than retrying.

## Deliverability note (fact, not advice)

sonoranclinicalpartners.com is a new sending domain. A button that makes sending 39 messages fast doesn't change what spam filters score — volume and spacing still matter. The one-row-per-press design happens to pace it; whether you space the sends further is your call.
