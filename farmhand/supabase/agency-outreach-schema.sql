-- ============================================================
-- Agency OS · Outreach queue — Sonoran Clinical Partners
-- ============================================================
-- Run ONCE in the same Supabase project as agency-schema.sql:
--   Dashboard → SQL Editor → New query → paste → Run.
-- Same env keys the app already reads. Idempotent — safe to re-run.
--
-- What this is: a mirror of real Gmail drafts, so the OS can show the
-- outreach queue and open any draft in one click. It is NOT a sender.
-- Nothing in this schema or the app transmits mail; Taylor sends from
-- Gmail and the OS records that it happened. Every row here points at a
-- draft that actually exists — no row is ever created speculatively.
-- ============================================================

create table if not exists public.agency_outreach (
  id               uuid primary key default gen_random_uuid(),
  workspace        text not null default 'agency',
  facility         text not null,
  email            text not null,
  stage            text not null default 'A2',       -- A1 | A2 | A3 | A4 | intro | reorder
  subject          text not null default '',
  status           text not null default 'queued',   -- queued | sent | replied | skipped
  gmail_draft_id   text,                             -- Gmail draft id (r-...)
  gmail_thread_id  text,                             -- thread the draft lives in
  drafted_on       date not null default current_date,
  sent_on          date,
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists agency_out_ws_status on public.agency_outreach (workspace, status);
create index if not exists agency_out_ws_drafted on public.agency_outreach (workspace, drafted_on desc);

-- one queue row per Gmail draft: re-running the seed can't duplicate the queue
create unique index if not exists agency_out_draft_uniq
  on public.agency_outreach (workspace, gmail_draft_id)
  where gmail_draft_id is not null;

-- RLS on, no policies: server-only via service_role, same as every other table.
alter table public.agency_outreach enable row level security;

-- ---- seed: the 39 A2 follow-ups drafted 2026-08-10 ----
-- Every draft below was created in Taylor's Gmail on 8/10 as a threaded
-- reply to the original 8/5 batch message, and is unsent. Facilities that
-- replied (ProRx, Globyz/NexGen, Assure), bounced (Belmar's batch alias,
-- Carie Boyd's pharmacistconsult@, Galaxy) or are handled in a live thread
-- are deliberately absent — this is the no-reply set only.
insert into public.agency_outreach
  (workspace, facility, email, stage, subject, status, gmail_draft_id, gmail_thread_id, drafted_on)
select v.workspace, v.facility, v.email, v.stage, v.subject, 'queued', v.draft_id, v.thread_id, date '2026-08-10'
from (values
  ('agency','Orion Specialty Labs','info@gldlp.com','A2','Re: Introduction work for 503B facilities','r-7469388703508281323','19fd04fba4dba0fc'),
  ('agency','BPI Labs','info@bpi-labs.com','A2','Re: Introduction work for 503B facilities','r-8153482198675440811','19fd28e247277095'),
  ('agency','GFC Pharma','info@wespharma.com','A2','Re: Introduction work for 503B facilities','r-9006336523382409281','19fd04f3c3d5ab96'),
  ('agency','Apertus Pharma','info@apertuspharma.com','A2','Re: Introduction work for 503B facilities','r-7919708360363959955','19fd04ee9f8a7cf1'),
  ('agency','OurPharma','sales@ourpharma.net','A2','Re: Introduction work for 503B facilities','r-2510365079476322826','19fd04eb9ec7546f'),
  ('agency','SCA Pharmaceuticals','customerservice@scapharma.com','A2','Re: Introduction work for 503B facilities','r-3937693260654211295','19fd04e9811de2d4'),
  ('agency','Fagron Sterile Services','marketing@fagronsterile.com','A2','Re: Introduction work for 503B facilities','r-1931093067539665197','19fd04e7a5920c1d'),
  ('agency','PQ Pharmacy','order@pqpharmacy.com','A2','Re: Introduction work for 503B facilities','r3059030654603681823','19fd04e2e2ce56c3'),
  ('agency','PGRrx','info@pgrrx.com','A2','Re: Introduction work for 503B facilities','r8158741613900229157','19fd04e0daa080aa'),
  ('agency','Olympia Pharmacy','ocs@olympiapharmacy.com','A2','Re: Introduction work for 503B facilities','r-2018889646067549183','19fd35b956365707'),
  ('agency','Ocyon Bio','info@ocyonbio.com','A2','Re: Introduction work for 503B facilities','r-1140150654581880119','19fd04dc15fdc8de'),
  ('agency','Wilcrest Pharma','info@wilcrestpharma.com','A2','Re: Introduction work for 503B facilities','r-921231497702859636','19fd04d9ca95d530'),
  ('agency','Wesley Pharmaceuticals','info@wesleypharmaceuticals.com','A2','Re: Introduction work for 503B facilities','r7545638700733299392','19fd04d7c625e875'),
  ('agency','Wells Pharmacy Network','OCS1@wellsrx.com','A2','Re: Introduction work for 503B facilities','r-3385114824093259759','19fd04d59eed4f75'),
  ('agency','Wells Pharma','Sales@wellspharmatx.com','A2','Re: Introduction work for 503B facilities','r6811571625552730740','19fd04d37e3ab924'),
  ('agency','US Specialty Formulations','info@ussfgmp.com','A2','Re: Introduction work for 503B facilities','r-2727648289296281846','19fd04d164fa4f82'),
  ('agency','Turbare','info@turbare.org','A2','Re: Introduction work for 503B facilities','r2172815353566544394','19fd04ce570a1503'),
  ('agency','Medivant Health','customerservice@medivanthealth.com','A2','Re: Introduction work for 503B facilities','r542661046953568304','19fd04cb865b0bee'),
  ('agency','STAQ Pharma','staqpharma@staqpharma.com','A2','Re: Introduction work for 503B facilities','r3475837028106943234','19fd04c9739c1c4a'),
  ('agency','SKNV','info@sknv.com','A2','Re: Introduction work for 503B facilities','r2201338367102368704','19fd04c75c3136fe'),
  ('agency','RC Outsourcing','info@rcoutsourcing.com','A2','Re: Introduction work for 503B facilities','r7810254956290222643','19fd04c5624a0044'),
  ('agency','QuVa Pharma','customer.service@quvapharma.com','A2','Re: Introduction work for 503B facilities','r502995090158663685','19fd04c360377c96'),
  ('agency','OSRX Pharmaceuticals','support@osrxpharmaceuticals.com','A2','Re: Introduction work for 503B facilities','r-7104260816454086139','19fd04c0b55b2021'),
  ('agency','Nephron Pharmaceuticals','NOFaccounts@nephronpharm.com','A2','Re: Introduction work for 503B facilities','r1753745179081659352','19fd04bab4db041f'),
  ('agency','Navinta','sales@navinta.com','A2','Re: Introduction work for 503B facilities','r-1128054979055546256','19fd04b8891a5c1f'),
  ('agency','Medi-Fare Drug','info@medifaredrug.com','A2','Re: Introduction work for 503B facilities','r-4946064670909891837','19fd04b553010040'),
  ('agency','Cost Plus Drugs','503b@costplusdrugs.com','A2','Re: Introduction work for 503B facilities','r3437020509541189189','19fd04b33fc3fd09'),
  ('agency','IntegraDose','craig@integradose.org','A2','Re: Introduction work for 503B facilities','r-1004193880585985881','19fd04b06d489c43'),
  ('agency','ImprimisRx','order@imprimisrx.com','A2','Re: Introduction work for 503B facilities','r-119933271264986246','19fd04adf2c3f88e'),
  ('agency','Hybrid Pharma','info@hybridpharma.com','A2','Re: Introduction work for 503B facilities','r3485774648694847896','19fd04ab8266f0f9'),
  ('agency','GenoGenix','orders@genogenix.com','A2','Re: Introduction work for 503B facilities','r5817230148104090705','19fd04a8c1ecedcd'),
  ('agency','FarmaKeio Outsourcing','contact@fko-outsourcing.com','A2','Re: Introduction work for 503B facilities','r6344776368133746943','19fd04a691ded775'),
  ('agency','Empower Pharmacy','officeuse@empowerpharmacy.com','A2','Re: Introduction work for 503B facilities','r-4881234468421112504','19fd04a41ca2a5a2'),
  ('agency','Leiters Health','info@leiters.com','A2','Re: Introduction work for 503B facilities','r-585172594066515266','19fd045b6d333fed'),
  ('agency','CAPS Pharmacy','customerservice@capspharmacy.com','A2','Re: Introduction work for 503B facilities','r-859927267659960422','19fd04594ef1f52d'),
  ('agency','Brookfield Medical','Brookfield503B@gmail.com','A2','Re: Introduction work for 503B facilities','r6196810585682971571','19fd045254c75792'),
  ('agency','Carie Boyd Pharmaceuticals','orders@carieboyd.com','A2','Re: Introduction work for 503B facilities','r-3403609809611346252','19fd35c15fc9553a'),
  ('agency','Apollo Care','contactus@apollocare.net','A2','Re: Introduction agency for 503B facilities — Sonoran Clinical Partners','r-7010013827955657546','19fd3ad435a9f891'),
  ('agency','New Life Rx','cs@newliferx.com','A2','Re: Correction to my note — Sonoran Clinical Partners','r-3518624653788776616','19fd3af6116e52d1')
) as v(workspace, facility, email, stage, subject, draft_id, thread_id)
where not exists (
  select 1 from public.agency_outreach o
  where o.workspace = v.workspace and o.gmail_draft_id = v.draft_id
);
