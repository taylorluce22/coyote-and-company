#!/usr/bin/env python3
"""
Day 1 guided setup: gets you from nothing to (1) email infrastructure warming,
(2) a CRM full of real buyers, (3) five supplier pitches sent.

Run it on your own machine:

    python3 setup-day1.py             # start or resume the walkthrough
    python3 setup-day1.py --status    # see where you left off
    python3 setup-day1.py --dry-run   # print every step without opening anything
    python3 setup-day1.py --reset     # start over

It opens each signup/config page in your browser at the right moment, tells you
exactly what to do there, captures the values you'll need later (domains, keys),
and runs the prospect-pull scripts for you. Progress saves after every step, so
closing the terminal loses nothing.

Time: roughly 2 hours of actual work. Domain warm-up then runs for 2-3 weeks in
the background, which is why step 1 comes first.
"""

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import webbrowser

HERE = pathlib.Path(__file__).resolve().parent
PROGRESS_FILE = HERE / ".setup-progress.json"
CONFIG_FILE = HERE / ".setup-config.json"

B = "\033[1m"; DIM = "\033[2m"; G = "\033[32m"; Y = "\033[33m"; C = "\033[36m"; R = "\033[0m"

# Set by --dry-run. Guards every write: previewing the walkthrough must never mark
# real progress complete or persist placeholder config values.
DRY_RUN = False


def load(path: pathlib.Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def save(path: pathlib.Path, data: dict) -> None:
    if DRY_RUN:
        return
    path.write_text(json.dumps(data, indent=2))


def banner(text: str) -> None:
    print(f"\n{B}{C}{'=' * 72}{R}")
    print(f"{B}{C}  {text}{R}")
    print(f"{B}{C}{'=' * 72}{R}\n")


def step_header(num: str, title: str, why: str) -> None:
    print(f"\n{B}{Y}[{num}] {title}{R}")
    print(f"{DIM}{why}{R}\n")


def open_url(url: str, label: str, dry: bool) -> None:
    print(f"  {G}→{R} {label}")
    print(f"    {DIM}{url}{R}")
    if not dry:
        try:
            webbrowser.open(url)
        except Exception:
            print(f"    {Y}(couldn't auto-open — copy the URL above){R}")


def do(text: str) -> None:
    print(f"    {B}·{R} {text}")


def paste_block(title: str, lines: list[str]) -> None:
    print(f"\n    {B}{title}{R}")
    for line in lines:
        print(f"      {C}{line}{R}")
    print()


def confirm(prompt: str, dry: bool) -> bool:
    if dry:
        print(f"  {DIM}[dry-run: would wait for '{prompt}']{R}")
        return True
    while True:
        ans = input(f"\n  {B}{prompt}{R} [y = done / s = skip for now / q = quit]: ").strip().lower()
        if ans in ("y", "yes", ""):
            return True
        if ans in ("s", "skip"):
            return False
        if ans in ("q", "quit"):
            print("\n  Progress saved. Re-run this script to pick up where you left off.\n")
            sys.exit(0)


def ask(prompt: str, cfg: dict, key: str, dry: bool) -> str:
    if dry:
        return f"<{key}>"
    if cfg.get(key):
        keep = input(f"  {key} is saved as '{cfg[key]}'. Keep it? [Y/n]: ").strip().lower()
        if keep in ("", "y", "yes"):
            return cfg[key]
    val = input(f"  {B}{prompt}{R}: ").strip()
    if val:
        cfg[key] = val
        save(CONFIG_FILE, cfg)
    return val


# --------------------------------------------------------------------------
# STEP 1 — Email infrastructure (start first: 2-3 week warm-up clock)
# --------------------------------------------------------------------------
def step1(prog: dict, cfg: dict, dry: bool) -> None:
    banner("STEP 1 — EMAIL INFRASTRUCTURE (start the warm-up clock today)")
    print("  Nothing sends at volume until sending domains are warm, and warming takes")
    print("  2-3 weeks. Everything else you build today waits on this, so it goes first.\n")
    print(f"  {DIM}Rule from the research: sending domains must be recognizable variants of your{R}")
    print(f"  {DIM}real brand with a real postal address and working reply-to. No unrelated{R}")
    print(f"  {DIM}lookalike domains — truthful sender identity is law (CAN-SPAM + CA 17529.5),{R}")
    print(f"  {DIM}not style.{R}")

    # 1a - domains
    if not prog.get("1a"):
        step_header("1a", "Buy your domains",
                    "One brand domain you'll actually use, plus two sending variants.")
        open_url("https://porkbun.com/products/domains", "Porkbun (cheapest, clean DNS UI)", dry)
        open_url("https://dash.cloudflare.com/?to=/:account/domains/register",
                 "Cloudflare Registrar (at-cost pricing, best DNS)", dry)
        do("Buy your BRAND domain — the one on your business card. Example: coyoteandco.com")
        do("Buy TWO sending variants of it. Good patterns:")
        print(f"        {C}getcoyoteandco.com   ·   coyoteandco.co   ·   trycoyoteandco.com{R}")
        do("Bad patterns (these violate the truthful-identity rule): unrelated words,")
        print(f"        {DIM}random strings, or names implying a different company.{R}")
        do("Total cost: roughly $30-45/year for all three.")
        if confirm("Domains purchased?", dry):
            cfg["brand_domain"] = ask("Your BRAND domain (e.g. coyoteandco.com)", cfg, "brand_domain", dry)
            cfg["sending_domain_1"] = ask("Sending domain 1", cfg, "sending_domain_1", dry)
            cfg["sending_domain_2"] = ask("Sending domain 2", cfg, "sending_domain_2", dry)
            prog["1a"] = True

    # 1b - mailboxes
    if not prog.get("1b"):
        step_header("1b", "Create mailboxes (Google Workspace)",
                    "Cold-email platforms send through real mailboxes. You need one per sending domain.")
        open_url("https://workspace.google.com/business/signup/welcome", "Google Workspace signup", dry)
        do(f"Sign up using your BRAND domain: {cfg.get('brand_domain', '<brand domain>')}")
        do("Business Starter (~$7/user/mo) is enough.")
        do("Create your main mailbox: you@brand-domain")
        do("Then Admin console → Domains → Add a domain → add BOTH sending domains")
        print(f"        {DIM}as 'secondary domains' (free — no extra license per domain).{R}")
        do("Create 1-2 mailboxes on EACH sending domain (e.g. firstname@sending-domain).")
        print(f"        {DIM}Two mailboxes per domain lets you split volume and stay under caps.{R}")
        if confirm("Workspace set up with mailboxes on all three domains?", dry):
            prog["1b"] = True

    # 1c - DNS auth
    if not prog.get("1c"):
        step_header("1c", "Authenticate every domain (SPF, DKIM, DMARC)",
                    "Google and Yahoo reject unauthenticated bulk mail outright. This is non-negotiable.")
        open_url("https://admin.google.com/ac/apps/gmail/authenticateemail", "Google Admin → DKIM generation", dry)
        do("In Google Admin, generate a 2048-bit DKIM key for EACH domain, then add the")
        print(f"        {DIM}TXT record it shows you at your registrar's DNS panel.{R}")
        do("Add these records at your DNS host for EACH of the three domains:")
        paste_block("SPF  (TXT record, host: @)", ["v=spf1 include:_spf.google.com ~all"])
        paste_block("DMARC  (TXT record, host: _dmarc)",
                    [f"v=DMARC1; p=none; rua=mailto:dmarc@{cfg.get('brand_domain', 'yourdomain.com')}"])
        paste_block("MX  (host: @, priority 1)", ["smtp.google.com"])
        do("DKIM host/value comes from the Google Admin page above — it's unique per domain.")
        do("Start DMARC at p=none (monitor only). Move to p=quarantine after ~30 days of")
        print(f"        {DIM}clean reports — tightening too early can bounce your own real mail.{R}")
        print(f"\n    {Y}Verify before moving on:{R}")
        open_url("https://mxtoolbox.com/SuperTool.aspx", "MXToolbox — check SPF/DKIM/DMARC per domain", dry)
        if confirm("All three domains authenticated and verifying clean?", dry):
            prog["1c"] = True

    # 1d - sending platform
    if not prog.get("1d"):
        step_header("1d", "Sending platform + warm-up (this starts the clock)",
                    "Warm-up gradually builds sender reputation. Start it today even if you have nothing to send.")
        open_url("https://app.instantly.ai/auth/register", "Instantly signup", dry)
        do("Connect each sending-domain mailbox (Instantly walks you through Google OAuth).")
        do("Turn ON warm-up for every connected mailbox immediately.")
        do("Set daily sending limit to 30/mailbox to start — ramp later, never at launch.")
        do("Settings → enable custom tracking domain and a CUSTOM unsubscribe page.")
        print(f"        {Y}Important:{R} your CRM's suppression list is the master, not Instantly's.")
        print(f"        {DIM}The webhook wiring in mvp/automations.md keeps them in sync both ways.{R}")
        if confirm("Mailboxes connected and warm-up running?", dry):
            prog["1d"] = True

    # 1e - supporting accounts
    if not prog.get("1e"):
        step_header("1e", "Supporting accounts (5 minutes, needed later this week)",
                    "Free or near-free. Getting them now means the automation wiring isn't blocked.")
        open_url("https://www.millionverifier.com/", "MillionVerifier — email verification (pay as you go)", dry)
        open_url("https://cal.com/signup", "Cal.com — meeting booking (free tier)", dry)
        open_url("https://www.make.com/en/register", "Make — automation engine (free tier to start)", dry)
        do("Create all three. No configuration needed yet — mvp/automations.md covers wiring.")
        do("In Cal.com, create a 20-minute 'Intro Call' event type and copy its booking link.")
        cfg["booking_link"] = ask("Paste your Cal.com booking link", cfg, "booking_link", dry)
        if confirm("Accounts created?", dry):
            prog["1e"] = True

    save(PROGRESS_FILE, prog); save(CONFIG_FILE, cfg)
    print(f"\n  {G}{B}STEP 1 COMPLETE.{R} Warm-up is now running in the background for 2-3 weeks.")
    print(f"  {DIM}You don't wait on it — steps 2 and 3 happen today.{R}")


# --------------------------------------------------------------------------
# STEP 2 — Fill the CRM with real buyers
# --------------------------------------------------------------------------
def step2(prog: dict, cfg: dict, dry: bool) -> None:
    banner("STEP 2 — PULL REAL BUYERS INTO THE CRM")
    print("  NPPES is the federal NPI registry: authoritative, current, free, no API key.")
    print("  This gives you verified clinic organizations with names, addresses, phones,")
    print("  and each org's named authorized official.\n")

    if not prog.get("2a"):
        step_header("2a", "Check Python and scripts", "Both scripts are standard library only.")
        print(f"    Python: {B}{sys.version.split()[0]}{R}")
        for script in ("build-prospects.py", "import-prospects.py"):
            exists = (HERE / script).exists()
            mark = f"{G}found{R}" if exists else f"{Y}MISSING{R}"
            print(f"    {script}: {mark}")
        if confirm("Ready to pull?", dry):
            prog["2a"] = True

    if not prog.get("2b"):
        step_header("2b", "Pull licensed clinic organizations (free)",
                    "Ophthalmology, dermatology, urology, plastics across your launch states.")
        raw = HERE / "raw"; out = HERE / "out"
        cmd = [sys.executable, str(HERE / "build-prospects.py"), "nppes",
               "--taxonomy", "ophthalmology,dermatology,urology,plastic-surgery",
               "--state", "AZ,TX,CO,NV",
               "-o", str(raw / "clinics-launch.csv")]
        print(f"    Command:\n      {C}{' '.join(cmd)}{R}\n")
        if dry:
            print(f"    {DIM}[dry-run: would create {raw} and run the pull]{R}")
        elif confirm("Run this now? (takes a few minutes)", dry):
            raw.mkdir(exist_ok=True); out.mkdir(exist_ok=True)
            try:
                subprocess.run(cmd, check=False)
                prog["2b"] = True
            except Exception as exc:
                print(f"    {Y}Failed: {exc}{R}")
                print(f"    {DIM}If this is a network error, you're not on an open connection.{R}")

    if not prog.get("2c"):
        step_header("2c", "Med spas and IV clinics (optional today, needs a Google key)",
                    "These rarely hold NPIs, so NPPES misses them. Skip if you want to move fast.")
        open_url("https://console.cloud.google.com/google/maps-apis/credentials",
                 "Google Cloud — create a Places API key", dry)
        do("Enable 'Places API', create an API key, then:")
        print(f"      {C}export GOOGLE_PLACES_API_KEY=your_key{R}")
        do("Then run (costs a few dollars):")
        print(f"""      {C}python3 build-prospects.py places \\
        --query "med spa,IV therapy,men's health clinic" \\
        --cities "Phoenix AZ,Scottsdale AZ,Mesa AZ,Tucson AZ,Las Vegas NV,Denver CO,Dallas TX,Austin TX" \\
        --details -o raw/wellness-launch.csv{R}""")
        if confirm("Done (or skipping for today)?", dry):
            prog["2c"] = True

    if not prog.get("2d"):
        step_header("2d", "Transform to CRM imports", "Dedupes, enforces carve-outs, flags what needs qualification.")
        cmd = [sys.executable, str(HERE / "import-prospects.py"), str(HERE / "raw"), str(HERE / "out")]
        print(f"    Command:\n      {C}{' '.join(cmd)}{R}\n")
        if dry:
            print(f"    {DIM}[dry-run: would run transform]{R}")
        elif confirm("Run the transform?", dry):
            subprocess.run(cmd, check=False)
            prog["2d"] = True

    if not prog.get("2e"):
        step_header("2e", "Import into your CRM", "Four files, three of them are work queues.")
        do("buyers-import.csv          → import to your Buyers table")
        do("contacts-import.csv        → import to Contacts (emails blank until verified)")
        do("qualification-worklist.csv → med spas/IV clinics with no named medical director.")
        print(f"        {Y}These can't be qualified as buyers until you find one — that's the{R}")
        print(f"        {Y}eligibility gate, not optional cleanup.{R}")
        do("near-duplicate-review.csv  → eyeball these; never auto-merged on purpose")
        do("rejects.csv                → carve-out states and dupes; nothing dropped silently")
        if confirm("Imported?", dry):
            prog["2e"] = True

    save(PROGRESS_FILE, prog); save(CONFIG_FILE, cfg)
    print(f"\n  {G}{B}STEP 2 COMPLETE.{R} Your CRM now holds real, verifiable buyers.")


# --------------------------------------------------------------------------
# STEP 3 — Pitch the suppliers (the actual revenue action)
# --------------------------------------------------------------------------
TIER1 = [
    ("Pine Pharmaceuticals", "Alfonse J. Muto, PharmD (co-owner)",
     "https://www.linkedin.com/in/alfonsejmuto", "sales@pinepharmaceuticals.com",
     "Ophthalmology practices re-sourcing after the California licensure shake-up; their expanded capacity is the landing spot."),
    ("Belmar Pharma Solutions", "Bonnie Scerbo (Dir. Marketing) → Rob Kilgore (CEO)",
     "https://www.linkedin.com/in/bonnie-scerbo", "(contact form / 800-525-9473)",
     "Their AmSpa membership says they want med spa buyers; you deliver them verified. Pasco expansion = capacity to fill."),
    ("Olympia Pharmaceuticals", "Joshua Fritzler (President, new May 2026)",
     "https://www.linkedin.com/search/results/people/?keywords=Joshua%20Fritzler%20Olympia%20Pharmaceuticals",
     "(via site contact)",
     "New in seat and building his own wins. You cover the long tail their in-house reps can't economically reach."),
    ("AnazaoHealth", "Michelle Kennedy (VP Sales & Marketing) → Hal Weaver",
     "https://www.linkedin.com/in/michelle-kennedy-7725585", "(via site contact)",
     "Their menu maps 1:1 to med spa / IV / men's health demand. Say non-GLP-1 only, upfront."),
    ("Nubratori RX", "Robert P. Nickell (Founder & CEO)",
     "https://www.linkedin.com/search/results/people/?keywords=Robert%20Nickell%20Nubratori",
     "(via site contact)",
     "Inc. 5000 congrats opener; founder-led means a fast yes or no. Focus on their non-California footprint."),
]


def step3(prog: dict, cfg: dict, dry: bool) -> None:
    banner("STEP 3 — SEND THE FIVE SUPPLIER PITCHES")
    print("  These are 1:1 relationship emails from your real business address. They do NOT")
    print("  need warm sending domains — send them today.\n")
    print(f"  {B}{Y}Do this after step 2 for one reason:{R} you can now write a real number.")
    print("  \"We've mapped N verified clinic buyers across your ship-to states\" is a different")
    print("  pitch than \"we'll build you a pipeline.\" One is an asset, the other is a promise.\n")

    count = ask("How many buyer rows did step 2 produce? (for your pitch line)", cfg, "buyer_count", dry)
    link = cfg.get("booking_link", "<your Cal.com link>")

    print(f"\n  {B}Full drafts:{R} {C}gtm/first-touches.md{R} — copy each one, personalize, send.")
    print(f"  {B}Your booking link:{R} {link}")
    print(f"  {B}Your pitch line:{R} \"We've mapped {count or '<N>'} license-verifiable clinic buyers")
    print(f"    across the states you ship to.\"\n")

    for i, (company, person, li, email, angle) in enumerate(TIER1, 1):
        key = f"3-{i}"
        if prog.get(key):
            print(f"  {G}✓{R} {company} — already sent")
            continue
        step_header(f"3.{i}", f"{company} — {person}", angle)
        open_url(li, "LinkedIn profile — connect with a short note (under 300 chars)", dry)
        print(f"    {B}Email:{R} {email}")
        do("Send the LinkedIn note today; email tomorrow (day 1 of the sequence).")
        do(f"Use the {company} draft in gtm/first-touches.md — add your buyer-count line.")
        do("Log the touch in your CRM as a Message/Task before moving on.")
        if confirm(f"{company} — LinkedIn note sent?", dry):
            prog[key] = True
            save(PROGRESS_FILE, prog)

    save(PROGRESS_FILE, prog); save(CONFIG_FILE, cfg)
    print(f"\n  {G}{B}STEP 3 COMPLETE.{R} Follow-ups: A2 at day 3, A3 at day 7, A4 breakup at day 14.")
    print(f"  {DIM}Those cadence emails are in gtm/outreach-templates.md.{R}")


def show_status(prog: dict, cfg: dict) -> None:
    banner("SETUP STATUS")
    groups = [
        ("STEP 1 — Email infrastructure", [
            ("1a", "Domains purchased"), ("1b", "Mailboxes created"),
            ("1c", "SPF/DKIM/DMARC authenticated"), ("1d", "Warm-up running"),
            ("1e", "Supporting accounts"),
        ]),
        ("STEP 2 — Buyer pipeline", [
            ("2a", "Scripts ready"), ("2b", "NPPES pull"), ("2c", "Places pull (optional)"),
            ("2d", "Transform"), ("2e", "CRM import"),
        ]),
        ("STEP 3 — Supplier pitches", [(f"3-{i}", c[0]) for i, c in enumerate(TIER1, 1)]),
    ]
    for title, items in groups:
        print(f"  {B}{title}{R}")
        for key, label in items:
            mark = f"{G}✓{R}" if prog.get(key) else f"{DIM}·{R}"
            print(f"    {mark} {label}")
        print()
    if cfg:
        print(f"  {B}Saved values{R}")
        for k, v in cfg.items():
            print(f"    {k}: {C}{v}{R}")
        print()


def main() -> int:
    ap = argparse.ArgumentParser(description="Day 1 guided setup")
    ap.add_argument("--status", action="store_true", help="show progress and exit")
    ap.add_argument("--reset", action="store_true", help="clear progress and start over")
    ap.add_argument("--dry-run", action="store_true", help="print every step without opening or waiting")
    ap.add_argument("--step", choices=["1", "2", "3"], help="jump to one step")
    args = ap.parse_args()

    global DRY_RUN
    DRY_RUN = args.dry_run

    if args.reset:
        for f in (PROGRESS_FILE, CONFIG_FILE):
            if f.exists():
                f.unlink()
        print("Progress cleared.")
        return 0

    prog, cfg = load(PROGRESS_FILE), load(CONFIG_FILE)

    if args.status:
        show_status(prog, cfg)
        return 0

    banner("AGENCY OS — DAY 1 SETUP")
    print("  Three steps, about two hours of real work:")
    print(f"    {B}1.{R} Email infrastructure  {DIM}(start first — 2-3 week warm-up clock){R}")
    print(f"    {B}2.{R} Pull real buyers into the CRM  {DIM}(free, ~1 hour){R}")
    print(f"    {B}3.{R} Send five supplier pitches  {DIM}(the revenue action){R}")
    print(f"\n  {DIM}Progress saves after every step. Quit anytime with 'q' and re-run to resume.{R}")
    if not args.dry_run and not shutil.which("python3"):
        print(f"  {Y}Note: python3 not on PATH — scripts may need a full path.{R}")

    steps = {"1": step1, "2": step2, "3": step3}
    for key in ([args.step] if args.step else ["1", "2", "3"]):
        steps[key](prog, cfg, args.dry_run)

    banner("DAY 1 DONE")
    show_status(prog, cfg)
    print("  Next: follow-up cadence on the pitches (day 3 / 7 / 14), Google Places pull if")
    print("  you skipped it, and the Make automation wiring in mvp/automations.md.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
