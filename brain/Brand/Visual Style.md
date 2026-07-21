# Visual Style

What Farmhand's feed looks like. Two lanes, deliberately mixed.

## Lane 1 — Message cards (built today)

The Post Studio template: big typography on dimmed backgrounds, punchline
highlight, slide counter, @handle. Right tool for number-led and list posts
("3 questions", "red flags"). Backgrounds come from Higgsfield in rotating
aesthetic packs — see `farmhand/lib/postVisuals.ts` and the playbook.

## Lane 2 — Realistic moments (the direction Taylor wants more of)

Photoreal, candid, smartphone-authentic scenes where **the image is the
content** and the caption carries the message. Reference: a consultant in a
black polo showing a homeowner a tablet in front of a solar roof — believable,
warm, zero template feel. Higgsfield Soul is built for exactly this.

Scene bank to draw from (match scene to post theme):
- doorstep consult, tablet in hand, solar roof behind (buyer-education)
- homeowner at a kitchen table staring at a paper bill (bill-breakdown)
- installer crew on a tile roof mid-install, morning light (social-proof)
- family in a backyard at dusk, house lit warm behind them (referral)
- EV charging in a garage next to a wall battery (battery-ev)

Rules for this lane: one candid moment per image, natural imperfect framing,
no visible brand logos (generic dark polo), no text in image, faces okay but
see the standing question below.

## Lane 3 — Proof-of-work (owner direction, 2026-07-20)

The grid needs to visibly show REAL activity: homeowner meetings, install
walkthroughs, properly-installed equipment. This is what separates "an
established local pro actively posting" from a content mill — see the
[[Feed Director]] grid test. Two sources, never confused:

- **Real photos** (`brain/Brand/refs/`, Taylor's camera roll): the ONLY
  material that may be presented as documentation of an actual job,
  meeting, or install. These are Lane 3's backbone.
- **Higgsfield illustrative scenes**: generic, representative recreations
  of the SAME kind of moment (a consult, a walkthrough, a close-up of
  correct flashing) used when a real photo doesn't exist yet for that
  post. Styled from the real photos via Soul reference/moodboard so the
  AI output matches Taylor's actual light, gear, and neighborhoods —
  but never captioned as a specific documented event. See the
  authenticity rules in [[Feed Director]] — they are binding, not
  optional, because this is the trust brand's whole moat.

Practical rule of thumb: "we just installed this in Buckeye" → real photo
or don't post it. "Here's what a clean install looks like" → AI
illustration is fine, worded as general education.

## Anti-repetition + signature (both lanes)

Rotate aesthetic packs (Golden Hour / Editorial Minimal / Blue Hour /
Phone-Cam / High-Key / Nocturne — never two posts in a row alike; the app
enforces this). The constant signature: Arizona desert-suburb setting,
warm undertone, honest light.

## Taylor's reference photos

Drop real photos (installs, truck, neighborhoods, yourself if willing) into
`brain/Brand/refs/` and list them here with one line on what each captures,
plus whether each is: **postable** (usable directly as a Lane 3 post) or
**style-only** (reference for Higgsfield, not for direct posting — e.g. a
photo with a visible customer face without documented consent to publish).
Agents treat these as ground truth for look and authenticity, and once
~10+ exist they seed a Higgsfield Soul style reference so illustrative
scenes match Taylor's real work instead of generic stock-AI look.

- (no files committed to `brain/Brand/refs/` yet — Taylor is sending
  photos in chat batches; a session will commit + list them here once
  received. Two batches described so far, 2026-07-20:)
  - **Batch 1** — style-reference-ONLY, NOT postable: Aurora Solar
    design-tool screenshots (shading/production simulation UI); an SRP
    dedicated DER meter close-up (generic equipment, no address/name
    visible — likely fine to post once committed, re-confirm).
  - **Batch 2** — same SunSolar-branded proposal material as batch 1
    (a "YOUR HOME. POWERED BY THE SUN." design PDF + an email screenshot
    of it, both for a named homeowner "John Matthews," Peoria AZ, and a
    bill-comparison graphic, same branding). Still contains a **named
    third party's address and production/billing numbers** — NOT
    postable regardless of whose company this is, until Taylor confirms
    consent to publish that specific client's info (or these get
    replaced with a redacted/anonymized version).
  - **Batch 3** — mix of personal/candid and genuine proof-of-work:
    (1)-(2) Taylor + a colleague greeting a dog at dusk outside a house —
    personal/candid, low proof-of-work value, postable as texture if
    Taylor's OK with the casual vibe; (3) a man on a kitchen counter
    photographing a ceiling fixture, context unclear — hold, low value;
    (4) **team photo**, Taylor + 3 colleagues, one holding a "SunSolar
    Solutions · REC Certified Professional" tote — real team, real
    branding; (5) **door-meeting photo**: Taylor in a SunSolar-branded
    polo with a real homeowner, holding a "Welcome to the neighborhood"
    branded flyer (stock family photo on it, no client PII visible in
    this specific shot) — genuinely the kind of doorstep proof-of-work
    Lane 3 wants, PENDING confirmation the homeowner consented to being
    photographed/posted.
  - **⚠ Open question for Taylor**: batches 1-3 all carry "SunSolar
    Solutions" branding, including on YOUR OWN polo and a team photo.
    Batch 1/2 were provisionally logged as "competitor material" — that
    may be wrong. Please confirm: is SunSolar Solutions your own company/
    employer/brand, or a different company's material you have some
    other access to? This changes IP framing but NOT the consent
    requirement — a named client's info still needs their OK to publish
    either way.

## Standing decision: on-camera minimized (owner, 2026-07-20)

Taylor's preference: minimize being on camera. Lane 3 leans on real
equipment/detail photos and install walkthroughs (faces optional, gear and
craft mandatory) rather than talking-head content. Where a person is
useful in frame (a consult moment, scale for an install), prefer
over-the-shoulder / hands-and-tablet / partial framing — real when
possible, generic AI illustration otherwise — over a recurring synthetic
"face of the brand," which still risks a trust mismatch if a prospect
meets the real Taylor. AI images of people stay generic/replaceable, never
a consistent invented persona.
