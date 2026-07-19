# Farmhand Brain

This folder is a shared workspace ("vault") for **you + the AI agents** that
operate Farmhand. Everything in here is plain markdown, versioned in git —
which means:

- **You** read and edit it in **Obsidian** (or any editor, or GitHub).
- **AI agents** (Claude sessions and scheduled Routines) read it for context
  and write their work back into it — drafts, decisions, logs.
- **Git is the sync layer.** Every agent push lands here; every note you
  change guides the next agent run.

## Hook up Obsidian (one-time, ~5 minutes)

1. Install Obsidian (desktop) from obsidian.md.
2. Clone this repo to your computer (GitHub Desktop is the easy way:
   File → Clone Repository → `taylorluce22/coyote-and-company`).
3. In Obsidian: **Open folder as vault** → pick the repo folder (the whole
   repo, not just `brain/` — that way the knowledge bases in
   `farmhand/docs/` are browsable too).
4. Optional but recommended: install the community plugin **Obsidian Git**
   and set it to auto-pull/push every few minutes. Then agent updates appear
   in your vault on their own, and your edits flow back without touching a
   terminal.

## Map

- [[Home]] — the Command Center: agent status board + what needs Taylor
- [[Tasks]] · [[Schedule]] · [[Tools]] — the OS layer (the Schedule is LIVE:
  a cloud Routine runs the Orchestrator Mon/Thu/Fri 9 AM Phoenix)
- `Brand/` — [[Voice]] and [[Visual Style]]: the taste the agents must match
- `Agents/` — [[Orchestrator]] + specialist charters (Creative Director,
  Copywriter, Art Director, Analyst)
- `Queue/` — [[Content Queue]]: the production pipeline you approve from
- `Pipelines/` · `Analytics/` — [[Lead Pipeline]] and [[Content Analytics]]
- [[Log]] — every agent run appends what it did and why

Knowledge bases (same vault, app-facing):
- `farmhand/docs/az-energy-knowledge-2026.md` — AZ utility facts
- `farmhand/docs/higgsfield-instagram-playbook.md` — content craft manual

## Rules for agents working in this vault

1. Read [[Home]], your charter in `Agents/`, and both Brand notes before
   producing anything.
2. Never invent facts — ground claims in `farmhand/docs/` knowledge bases.
3. Write outputs into `Queue/` following the statuses in [[Content Queue]];
   never mark your own work **approved** — only Taylor does that.
4. Append a dated entry to [[Log]] for every run: what you did, what you
   spent (credits/tokens), what needs a human decision.
5. Commit messages from agents start with `brain:` so history stays scannable.
