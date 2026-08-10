import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeOutreach, gmailThreadUrl, gmailDraftSearchUrl } from "./agencyOutreach.mjs";

const row = (over = {}) => ({
  id: "1",
  facility: "Acme 503B",
  email: "info@acme.test",
  stage: "A2",
  subject: "Re: Introduction work for 503B facilities",
  status: "queued",
  drafted_on: "2026-08-10",
  gmail_draft_id: "r-123",
  gmail_thread_id: "19fd0000000000aa",
  ...over,
});

test("empty queue summarizes to honest zeros", () => {
  const s = summarizeOutreach([], "2026-08-11");
  assert.equal(s.total, 0);
  assert.equal(s.queued, 0);
  assert.equal(s.oldestQueuedDays, 0);
  assert.deepEqual(s.items, []);
});

test("counts by status and by stage", () => {
  const s = summarizeOutreach(
    [
      row({ id: "1" }),
      row({ id: "2", status: "sent", sent_on: "2026-08-11" }),
      row({ id: "3", status: "replied" }),
      row({ id: "4", status: "skipped" }),
      row({ id: "5", stage: "A3" }),
    ],
    "2026-08-11"
  );
  assert.equal(s.total, 5);
  assert.equal(s.queued, 2);
  assert.equal(s.sent, 1);
  assert.equal(s.replied, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.byStage.A2.queued, 1);
  assert.equal(s.byStage.A3.queued, 1);
});

test("age is measured from drafted_on, so a stale draft reads stale", () => {
  const s = summarizeOutreach([row({ drafted_on: "2026-08-10" })], "2026-08-17");
  assert.equal(s.items[0].ageDays, 7);
  assert.equal(s.oldestQueuedDays, 7);
});

test("oldest queued ignores sent and skipped rows", () => {
  const s = summarizeOutreach(
    [
      row({ id: "1", drafted_on: "2026-07-01", status: "sent" }),
      row({ id: "2", drafted_on: "2026-08-09", status: "skipped" }),
      row({ id: "3", drafted_on: "2026-08-10", status: "queued" }),
    ],
    "2026-08-12"
  );
  assert.equal(s.oldestQueuedDays, 2);
});

test("queued sorts first, oldest draft first", () => {
  const s = summarizeOutreach(
    [
      row({ id: "1", facility: "Sent Co", status: "sent" }),
      row({ id: "2", facility: "Newer", drafted_on: "2026-08-10" }),
      row({ id: "3", facility: "Older", drafted_on: "2026-08-05" }),
    ],
    "2026-08-11"
  );
  assert.deepEqual(s.items.map((i) => i.facility), ["Older", "Newer", "Sent Co"]);
});

test("unknown status falls back to queued rather than vanishing", () => {
  const s = summarizeOutreach([row({ status: "weird" })], "2026-08-11");
  assert.equal(s.total, 1);
  assert.equal(s.queued, 1);
  assert.equal(s.items[0].status, "queued");
});

test("gmail link points at the thread the draft lives in", () => {
  assert.equal(
    gmailThreadUrl("19fd0000000000aa"),
    "https://mail.google.com/mail/u/0/#all/19fd0000000000aa"
  );
  assert.equal(gmailThreadUrl(null), null);
});

test("row with no thread falls back to a drafts search on the address", () => {
  const s = summarizeOutreach([row({ gmail_thread_id: null })], "2026-08-11");
  assert.equal(s.items[0].gmailUrl, gmailDraftSearchUrl("info@acme.test"));
  assert.match(s.items[0].gmailUrl, /in%3Adraft/);
});
