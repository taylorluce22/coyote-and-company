# Permit Lead Pipeline

Supply-side counterpart to [[Lead Pipeline]] — instead of waiting for homeowners
to raise a hand, this finds Arizona homes with a **solar PV permit and no
battery/energy-storage permit** and turns them into a reviewable, compliance-gated
call list. Spec + running status: `docs/lead-gen-permit-system-2026.md` (repo root).

## Stages (all client-isolated, all idempotent)

1. **INGEST** — jurisdiction adapters pull permit rows. P0: Mesa (Socrata
   `dzpk-hxfb`). P1 queued: Tempe, Scottsdale.
2. **FILTER** — keyword classifier + per-APN set-difference. A combined
   permit ("PV SOLAR … WITH BATTERY") counts as battery — that parcel is
   excluded. Recency window ~6mo–5yr. Output: CSV draft for Taylor's review.
3. **ENRICH** — APN → owner (Maricopa Assessor) → phone (pluggable append,
   Datazapp first). Line-type flag mandatory; per-field provenance; numbers
   are never fabricated.
4. **COMPLY** — hard gate. No dial affordance exists until FTC SAN on file +
   AZ registration recorded (ROC path: free limited registration,
   A.R.S. 44-1272.01) + wireless suppression active + DNC scrub ≤ 31 days —
   AND `PERMITS_DIALING_ENABLED=true` is set server-side, which it is not.
   Manual click-to-dial only, one call at a time, 9am–8pm Phoenix window,
   internal DNC honored instantly (kept 10yr), compliance log kept 5yr+.

## Where it lives

- App: **Permit Leads** tab (Targets / Enrich / Comply / Call queue).
- Code: `farmhand/lib/permits/`, `farmhand/app/api/permits/`.
- Proof: `cd farmhand && npm run permits:smoke` (30 checks; `--live` hits the
  real Socrata endpoint).

## Guardrails for agents

- Lists are drafts — Taylor reviews before anything is treated as a lead.
- Never suggest enabling dialing, adding an autodialer, prerecorded/AI voice,
  ringless voicemail, or cold SMS. The gate is the product, not an obstacle.
- Permit data is public record, but enriched owner PII follows the same rule
  as [[Lead Manager]]: never in public content.
