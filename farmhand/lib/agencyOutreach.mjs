/**
 * Agency OS · Outreach queue — pure logic, no I/O.
 *
 * The queue mirrors real Gmail drafts. Every row points at a draft that
 * actually exists in Taylor's account (gmail_draft_id) inside a real thread
 * (gmail_thread_id). Nothing here sends mail and nothing here invents a
 * conversation: if a row exists, a draft exists.
 *
 * Status vocabulary — the only four states a queued touch can be in:
 *   queued  — draft written, sitting in Gmail, not sent
 *   sent    — Taylor sent it (recorded when he marks it, or by a mail sweep)
 *   replied — the counterparty came back; the touch did its job
 *   skipped — Taylor decided against sending this one
 *
 * Cadence ages are computed from drafted_on, so a draft that sits for a week
 * reads as a week old rather than silently looking fresh.
 */

/** Gmail deep link: opens the conversation with the draft in it, ready to send. */
export function gmailThreadUrl(threadId, userIndex = 0) {
  if (!threadId) return null;
  return `https://mail.google.com/mail/u/${userIndex}/#all/${threadId}`;
}

/** Gmail deep link to the drafts list, filtered to one recipient. */
export function gmailDraftSearchUrl(email, userIndex = 0) {
  if (!email) return null;
  return `https://mail.google.com/mail/u/${userIndex}/#search/in%3Adraft+${encodeURIComponent(email)}`;
}

const DAY = 86400000;

function startOfDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysBetween(fromISO, asOf) {
  if (!fromISO) return null;
  const from = startOfDay(fromISO);
  if (Number.isNaN(from.getTime())) return null;
  return Math.max(0, Math.round((startOfDay(asOf) - from) / DAY));
}

const RANK = { queued: 0, replied: 1, sent: 2, skipped: 3 };

/**
 * Summarize the queue for the OS screen.
 * Rows are the raw agency_outreach records; asOfInput lets tests pin the date.
 */
export function summarizeOutreach(rows = [], asOfInput) {
  const asOf = asOfInput ? new Date(asOfInput) : new Date();

  const counts = { queued: 0, sent: 0, replied: 0, skipped: 0 };
  const byStage = {};

  const items = rows.map((r) => {
    const status = counts[r.status] === undefined ? "queued" : r.status;
    counts[status] += 1;

    const stage = r.stage || "?";
    byStage[stage] = byStage[stage] || { queued: 0, sent: 0, replied: 0, skipped: 0 };
    byStage[stage][status] += 1;

    return {
      id: r.id,
      facility: r.facility,
      email: r.email,
      stage,
      subject: r.subject,
      status,
      draftedOn: r.drafted_on || null,
      sentOn: r.sent_on || null,
      ageDays: daysBetween(r.drafted_on, asOf),
      gmailUrl: gmailThreadUrl(r.gmail_thread_id) || gmailDraftSearchUrl(r.email),
      draftId: r.gmail_draft_id || null,
    };
  });

  // queued first (oldest draft first), then replied, sent, skipped
  items.sort((a, b) => {
    const byStatus = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
    if (byStatus) return byStatus;
    const ad = a.draftedOn || "";
    const bd = b.draftedOn || "";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (a.facility || "").localeCompare(b.facility || "");
  });

  const queuedAges = items.filter((i) => i.status === "queued" && i.ageDays !== null).map((i) => i.ageDays);

  return {
    asOf: asOf.toISOString().slice(0, 10),
    total: items.length,
    ...counts,
    byStage,
    oldestQueuedDays: queuedAges.length ? Math.max(...queuedAges) : 0,
    items,
  };
}
