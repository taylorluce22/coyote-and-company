/* ============================================================
   Agency OS · Money layer — real MRR math for Sonoran Clinical
   Partners, computed from actual records (agreements, meetings,
   collections). Pure functions, no I/O — the API route feeds it
   Supabase rows; agencyMoney.test.mjs proves the math with node.

   Definitions (from agency-os/docs/05-dashboard.md, adapted to
   what the agency can observe — supplier-reported collections):

   • Commission on a collection = amount × the matching agreement's
     commission_pct. An agreement matches when its supplier matches,
     status is signed_active, and its effective window covers the
     collection date. Collections with NO matching signed agreement
     are never silently dropped — they surface as `unattributed`
     (that's gate G7 as arithmetic).
   • Account = the introduced buyer (supplier + buyer pair).
   • Recurring account = ≥2 collections in the trailing 120 days
     AND the latest collection within the last 60 days.
   • MRR = Σ over recurring accounts of trailing-90-day commission ÷ 3.
   • New MRR = contribution of accounts recurring now that were not
     recurring 30 days ago. Churned MRR = contribution 30 days ago
     of accounts no longer recurring now.
   • Meeting fees are pay-on-performance one-time revenue — reported
     monthly, never counted in MRR.
   ============================================================ */

const DAY = 86_400_000;

/** @param {string|Date} d */
const ts = (d) => (d instanceof Date ? d : new Date(d + "T12:00:00Z")).getTime();

/**
 * @param {{supplier:string,status:string,commission_pct:number,effective:string,end_date:string|null}[]} agreements
 * @param {string} supplier @param {number} when
 */
function matchAgreement(agreements, supplier, when) {
  return agreements.find(
    (a) =>
      a.supplier === supplier &&
      a.status === "signed_active" &&
      ts(a.effective) <= when &&
      (!a.end_date || ts(a.end_date) >= when)
  );
}

/**
 * Commission-bearing view of collections at a reference time.
 * @param {object[]} collections rows {supplier,buyer,amount,collected_on}
 * @param {object[]} agreements
 * @param {number} asOf epoch ms
 */
function attribute(collections, agreements, asOf) {
  const attributed = [];
  const unattributed = [];
  for (const c of collections) {
    const when = ts(c.collected_on);
    if (when > asOf) continue; // never count the future
    const a = matchAgreement(agreements, c.supplier, when);
    if (a) attributed.push({ ...c, when, commission: c.amount * a.commission_pct });
    else unattributed.push({ ...c, when });
  }
  return { attributed, unattributed };
}

/** Per-account recurring test + trailing-90d commission, at a point in time. */
function accountsAt(attributed, asOf) {
  /** @type {Map<string, {supplier:string,buyer:string,rows:{when:number,commission:number}[]}>} */
  const map = new Map();
  for (const c of attributed) {
    const key = `${c.supplier}::${c.buyer}`;
    if (!map.has(key)) map.set(key, { supplier: c.supplier, buyer: c.buyer, rows: [] });
    map.get(key).rows.push(c);
  }
  const out = new Map();
  for (const [key, acc] of map) {
    const in120 = acc.rows.filter((r) => r.when >= asOf - 120 * DAY && r.when <= asOf);
    const latest = Math.max(...acc.rows.map((r) => r.when));
    const recurring = in120.length >= 2 && latest >= asOf - 60 * DAY;
    const commission90 = acc.rows
      .filter((r) => r.when >= asOf - 90 * DAY && r.when <= asOf)
      .reduce((s, r) => s + r.commission, 0);
    out.set(key, {
      supplier: acc.supplier,
      buyer: acc.buyer,
      recurring,
      mrrContribution: recurring ? commission90 / 3 : 0,
    });
  }
  return out;
}

/**
 * The money snapshot the /agency screen renders.
 * @param {object} rows {agreements, meetings, collections}
 * @param {string|Date} [asOfInput] defaults to now
 */
export function computeMoney({ agreements = [], meetings = [], collections = [] }, asOfInput) {
  const asOf = asOfInput ? ts(asOfInput) : Date.now();
  const { attributed, unattributed } = attribute(collections, agreements, asOf);

  const now = accountsAt(attributed, asOf);
  const prior = accountsAt(attributed, asOf - 30 * DAY);

  let mrr = 0, newMrr = 0, churnedMrr = 0;
  const accounts = [];
  for (const [key, acc] of now) {
    mrr += acc.mrrContribution;
    const before = prior.get(key);
    if (acc.recurring && !(before && before.recurring)) newMrr += acc.mrrContribution;
    accounts.push(acc);
  }
  for (const [key, acc] of prior) {
    const current = now.get(key);
    if (acc.recurring && !(current && current.recurring)) churnedMrr += acc.mrrContribution;
  }

  const asOfDate = new Date(asOf);
  const monthStart = Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1);
  const commissionThisMonth = attributed
    .filter((c) => c.when >= monthStart)
    .reduce((s, c) => s + c.commission, 0);
  const meetingsThisMonth = meetings.filter((m) => {
    const w = ts(m.held_on);
    return w >= monthStart && w <= asOf;
  });
  const meetingFeesThisMonth = meetingsThisMonth.reduce((s, m) => s + (m.fee || 0), 0);
  const commissionsUnpaid = attributed
    .filter((c) => !c.commission_paid_at)
    .reduce((s, c) => s + c.commission, 0);

  const round = (n) => Math.round(n * 100) / 100;
  return {
    asOf: asOfDate.toISOString().slice(0, 10),
    mrr: round(mrr),
    newMrr: round(newMrr),
    churnedMrr: round(churnedMrr),
    recurringAccounts: accounts.filter((a) => a.recurring).length,
    totalAccounts: accounts.length,
    grossThisMonth: round(commissionThisMonth + meetingFeesThisMonth),
    commissionThisMonth: round(commissionThisMonth),
    meetingFeesThisMonth: round(meetingFeesThisMonth),
    meetingsHeldThisMonth: meetingsThisMonth.length,
    commissionsUnpaid: round(commissionsUnpaid),
    unattributedCollections: unattributed.map((c) => ({
      supplier: c.supplier, buyer: c.buyer, amount: c.amount, collected_on: c.collected_on,
      reason: "no signed_active agreement covering this date (G7)",
    })),
    accounts,
  };
}
