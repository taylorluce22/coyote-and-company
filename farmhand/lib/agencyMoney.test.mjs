/* node lib/agencyMoney.test.mjs — proves the money math with real scenarios. */
import { computeMoney } from "./agencyMoney.mjs";
import assert from "node:assert/strict";

const AS_OF = "2026-08-10";
let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const prorx = {
  supplier: "ProRx", status: "signed_active", commission_pct: 0.03,
  effective: "2026-08-01", end_date: null,
};

test("empty state → all zeros, nothing invented", () => {
  const m = computeMoney({}, AS_OF);
  assert.equal(m.mrr, 0);
  assert.equal(m.newMrr, 0);
  assert.equal(m.churnedMrr, 0);
  assert.equal(m.totalAccounts, 0);
  assert.equal(m.unattributedCollections.length, 0);
});

test("draft agreement attributes nothing — G7 as arithmetic", () => {
  const m = computeMoney({
    agreements: [{ ...prorx, status: "draft" }],
    collections: [{ supplier: "ProRx", buyer: "Clinic A", amount: 10000, collected_on: "2026-08-05" }],
  }, AS_OF);
  assert.equal(m.mrr, 0);
  assert.equal(m.commissionThisMonth, 0);
  assert.equal(m.unattributedCollections.length, 1);
  assert.match(m.unattributedCollections[0].reason, /G7/);
});

test("one account, two collections in window → recurring, MRR = 90d commission / 3", () => {
  const m = computeMoney({
    agreements: [prorx],
    collections: [
      { supplier: "ProRx", buyer: "Clinic A", amount: 10000, collected_on: "2026-08-01" },
      { supplier: "ProRx", buyer: "Clinic A", amount: 10000, collected_on: "2026-08-08" },
    ],
  }, AS_OF);
  // commission = 2 × 10000 × 0.03 = 600 over trailing 90d → MRR 200
  assert.equal(m.recurringAccounts, 1);
  assert.equal(m.mrr, 200);
  assert.equal(m.newMrr, 200); // not recurring 30 days ago → all of it is new
  assert.equal(m.commissionsUnpaid, 600);
});

test("single collection → account exists but not recurring", () => {
  const m = computeMoney({
    agreements: [prorx],
    collections: [{ supplier: "ProRx", buyer: "Clinic B", amount: 5000, collected_on: "2026-08-05" }],
  }, AS_OF);
  assert.equal(m.totalAccounts, 1);
  assert.equal(m.recurringAccounts, 0);
  assert.equal(m.mrr, 0);
  assert.equal(m.commissionThisMonth, 150); // still real revenue this month
});

test("stale account churns: recurring 30d ago, silent for 60+ days now", () => {
  const agr = { ...prorx, effective: "2026-01-01" };
  const m = computeMoney({
    agreements: [agr],
    collections: [
      { supplier: "ProRx", buyer: "Clinic C", amount: 10000, collected_on: "2026-05-20" },
      { supplier: "ProRx", buyer: "Clinic C", amount: 10000, collected_on: "2026-06-05" },
    ],
  }, AS_OF);
  // At July 11 (asOf-30d): both collections in 120d window, latest (Jun 5) within 60d → recurring then.
  // At Aug 10: latest is 66 days old → no longer recurring. Its prior contribution churns.
  assert.equal(m.recurringAccounts, 0);
  assert.equal(m.mrr, 0);
  assert.ok(m.churnedMrr > 0, `expected churn, got ${m.churnedMrr}`);
});

test("agreement window respected: collections before effective date don't attribute", () => {
  const m = computeMoney({
    agreements: [prorx], // effective 2026-08-01
    collections: [{ supplier: "ProRx", buyer: "Clinic D", amount: 8000, collected_on: "2026-07-15" }],
  }, AS_OF);
  assert.equal(m.unattributedCollections.length, 1);
});

test("meeting fees are one-time revenue, never MRR", () => {
  const m = computeMoney({
    agreements: [prorx],
    meetings: [
      { supplier: "ProRx", buyer: "Clinic A", held_on: "2026-08-06", fee: 400 },
      { supplier: "ProRx", buyer: "Clinic B", held_on: "2026-07-20", fee: 400 }, // last month
    ],
  }, AS_OF);
  assert.equal(m.meetingFeesThisMonth, 400);
  assert.equal(m.meetingsHeldThisMonth, 1);
  assert.equal(m.grossThisMonth, 400);
  assert.equal(m.mrr, 0);
});

test("future-dated collections never count", () => {
  const m = computeMoney({
    agreements: [prorx],
    collections: [{ supplier: "ProRx", buyer: "Clinic E", amount: 9999, collected_on: "2026-09-01" }],
  }, AS_OF);
  assert.equal(m.totalAccounts, 0);
  assert.equal(m.unattributedCollections.length, 0);
});

console.log(`\n${passed} tests passed`);
