#!/usr/bin/env node
/**
 * Mint a Gmail refresh token for the Agency OS send path.
 *
 * Run once, on a machine with a browser. Prints a consent URL, you approve as
 * taylor@sonoranclinicalpartners.com, paste the code back, and it prints the
 * refresh token to put in Vercel. Nothing is written to disk and nothing is
 * sent anywhere — the token is printed to your terminal only.
 *
 *   node scripts/gmail-oauth.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * Scope: gmail.compose — manage drafts and send. This token CANNOT read the
 * inbox. Redirect URI is the out-of-band loopback flow, so no hosting needed.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";
import { createServer } from "node:http";

const SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const PORT = 871;
const REDIRECT = `http://localhost:${PORT}`;

const [clientId, clientSecret] = argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("usage: node scripts/gmail-oauth.mjs <CLIENT_ID> <CLIENT_SECRET>");
  console.error("\nGet both from Google Cloud Console → APIs & Services → Credentials");
  console.error(`→ OAuth client ID → Web application, with redirect URI: ${REDIRECT}`);
  exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token even on re-runs
  });

console.log("\n1. Open this URL and approve as taylor@sonoranclinicalpartners.com:\n");
console.log(authUrl);
console.log(`\n2. Waiting for the redirect on ${REDIRECT} ...`);
console.log("   (If the browser is on another machine, copy the ?code= value and paste it here.)\n");

/** Catch the redirect locally so the code never has to be copied by hand. */
function waitForCode() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT);
      const code = url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(code ? "Approved. You can close this tab." : "No code in redirect.");
      if (code) {
        server.close();
        resolve(code);
      }
    });
    server.listen(PORT);

    // parallel path: paste the code manually
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question("   ...or paste the code here: ").then((typed) => {
      if (typed && typed.trim()) {
        rl.close();
        try {
          server.close();
        } catch {
          /* already closed by the redirect path */
        }
        resolve(typed.trim());
      }
    });
  });
}

const code = await waitForCode();

const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});

const j = await r.json();
if (!r.ok || !j.refresh_token) {
  console.error("\nToken exchange failed:", JSON.stringify(j, null, 2));
  console.error("\nIf refresh_token is missing but the rest looks fine, revoke prior access at");
  console.error("https://myaccount.google.com/permissions and run this again.");
  exit(1);
}

console.log("\n✓ Done. Set these three in Vercel (Project → Settings → Environment Variables):\n");
console.log(`GMAIL_CLIENT_ID=${clientId}`);
console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
console.log(`GMAIL_REFRESH_TOKEN=${j.refresh_token}`);
console.log("\nRedeploy after saving. The Send button appears once all three are present.");
console.log("Treat the refresh token like a password — it can send mail as you until revoked.\n");
exit(0);
