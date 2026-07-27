-- agency-os schema (PostgreSQL 15+ / Supabase)
-- Authoritative field spec: docs/01-data-model.md · Permissions: docs/02-roles-permissions.md
-- Design rules: default-deny gates, append-only audit, no hard deletes, approvals human-only.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

-- ============ ENUMS ============
create type user_role as enum ('founder','sales_rep','compliance','supplier_user','accountant','sysadmin');
create type user_status as enum ('invited','active','suspended');
create type supplier_status as enum ('prospect','in_review','approved','suspended','terminated');
create type risk_tier as enum ('low','medium','high');
create type facility_type as enum ('manufacturer','503a_pharmacy','503b_outsourcing','wholesale','lab','3pl','office');
create type supplier_license_type as enum ('state_wholesale','state_manufacturer','pharmacy','503b_registration','dea_registration','device','other');
create type license_status as enum ('pending_verification','active','expiring_soon','expired','revoked','surrendered');
create type inspection_type as enum ('fda_483','fda_eir','state_board','third_party_audit','other');
create type inspection_outcome as enum ('nai','vai','oai','pass','fail','pending','unknown');
create type insurance_policy_type as enum ('product_liability','general_liability','recall','cargo','other');
create type product_status as enum ('draft','in_review','approved','suspended','discontinued');
create type reg_classification as enum ('rx_drug','otc_drug','compounded_503a','compounded_503b','api','medical_device','supplement','ruo_chemical','cosmetic','other');
create type classification_basis as enum ('counsel_memo','supplier_attestation_counsel_accepted');
create type product_doc_type as enum ('coa','label','sds','spec_sheet','counsel_memo','supplier_attestation','approved_marketing_copy','other');
create type buyer_type as enum ('pharmacy_503a','outsourcing_503b','hospital','physician_clinic','med_spa_medical_director','veterinary','research_org','wholesaler','other');
create type geo_restriction as enum ('allowed','allowed_with_conditions','prohibited');
create type buyer_status as enum ('prospect_unqualified','qualified','verified','active','suspended','do_not_contact');
create type buyer_license_type as enum ('pharmacy_permit','medical_license','dea_registration','wholesale_license','research_exemption','business_license','other');
create type attestation_type as enum ('licensure','intended_use','no_patient_resale_violation','research_use_only','other');
create type attestation_method as enum ('esignature','signed_pdf');
create type email_verif_status as enum ('unverified','deliverable','risky','undeliverable');
create type contact_outreach_status as enum ('new','eligible','enrolled','replied','opted_out','bounced');
create type verification_method as enum ('primary_source_web','api_lookup','document_review');
create type verification_result as enum ('verified_active','expired','not_found','mismatch','disciplinary_flag');
create type campaign_status as enum ('draft','pending_approval','approved','active','paused','completed');
create type message_status as enum ('blocked','queued','sent','delivered','bounced','replied','opted_out');
create type reply_class as enum ('none','positive','neutral','negative','opt_out','auto_reply');
create type suppression_reason as enum ('opt_out','hard_bounce','spam_complaint','legal_request','manual');
create type meeting_outcome as enum ('scheduled','held','no_show','cancelled');
create type opportunity_stage as enum ('qualified','meeting_held','intro_requested','intro_made','quote_requested','quoted','won','lost');
create type lost_reason as enum ('price','timing','compliance_block','competitor','no_response','other');
create type intro_status as enum ('requested','consented','introduced','declined');
create type intro_method as enum ('email','call','meeting');
create type quote_status as enum ('requested','supplier_approved','sent_to_buyer','accepted','declined','expired');
create type order_status as enum ('reported','confirmed','shipped','delivered','complete','cancelled');
create type agreement_type as enum ('percent_of_collected','flat_per_order','tiered_percent');
create type agreement_status as enum ('draft','signed_active','expired','terminated');
create type calc_status as enum ('draft','approved','invoiced','paid','disputed');
create type reorder_status as enum ('upcoming','reminder_sent','ordered','lapsed');
create type review_subject as enum ('supplier','product','buyer_entity','campaign','template','agreement','process');
create type review_type as enum ('initial','periodic','for_cause','counsel');
create type review_outcome as enum ('approved_recommend','rejected','conditional');
create type exception_status as enum ('open','in_progress','waived','resolved');
create type exception_severity as enum ('low','medium','high','critical');
create type clearable_by as enum ('compliance','founder','founder_with_counsel');
create type complaint_source as enum ('buyer','supplier','third_party');
create type complaint_status as enum ('open','forwarded','supplier_resolved','closed');
create type ae_status as enum ('open','forwarded','acknowledged','closed');
create type recall_class as enum ('class_1','class_2','class_3','market_withdrawal','unknown');
create type recall_source as enum ('fda_enforcement_report','supplier_notice','other');
create type recall_status as enum ('open','monitoring','closed');
create type buyer_notif_status as enum ('supplier_notifying','agency_assisting','complete');
create type task_type as enum ('follow_up','verification_due','document_missing','review_due','reorder_reminder','exception','close_item','other');
create type task_priority as enum ('low','normal','high','critical');
create type task_status as enum ('open','in_progress','done','cancelled');
create type doc_kind as enum ('license','insurance_coi','contract','counsel_memo','attestation','coa','label','sds','evidence_screenshot','quote','order_evidence','remittance','template','other');
create type retention_class as enum ('legal_7y','operational_3y','permanent');
create type actor_type as enum ('user','system','automation');
create type reg_impact as enum ('unreviewed','none','review_needed','action_required');

-- ============ CORE ============
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  full_name text not null,
  role user_role not null,
  status user_status not null default 'invited',
  supplier_id uuid, -- FK added after suppliers
  mfa_enabled boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  constraint supplier_user_scoped check ((role = 'supplier_user') = (supplier_id is not null))
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null unique,
  dba text,
  entity_type text not null,
  ein text check (ein ~ '^[0-9]{2}-?[0-9]{7}$'),
  hq_address text, hq_city text, hq_state char(2), hq_zip text,
  website text,
  status supplier_status not null default 'prospect',
  risk_tier risk_tier,
  approved_by uuid references users(id),
  approved_at timestamptz,
  next_review_date date,
  source text not null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  constraint approval_complete check (status <> 'approved' or (approved_by is not null and approved_at is not null and next_review_date is not null and risk_tier is not null)),
  constraint no_self_approval check (approved_by is null or created_by is null or approved_by <> created_by)
);
alter table users add constraint users_supplier_fk foreign key (supplier_id) references suppliers(id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  doc_kind doc_kind not null,
  storage_ref text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references users(id),
  related_type text not null,
  related_id uuid not null,
  retention_class retention_class not null,
  effective_date date,
  expiry_date date,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table supplier_facilities (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  name text not null,
  facility_type facility_type not null,
  address text not null, city text not null, state char(2) not null, zip text not null,
  fei_number text,
  state_license_required boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table supplier_licenses (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  facility_id uuid references supplier_facilities(id),
  license_type supplier_license_type not null,
  jurisdiction text not null,
  license_number text not null,
  issued_date date,
  expiration_date date not null,
  status license_status not null default 'pending_verification',
  document_id uuid not null references documents(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (jurisdiction, license_type, license_number)
);

create table supplier_inspections (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  facility_id uuid references supplier_facilities(id),
  inspection_type inspection_type not null,
  inspection_date date not null,
  outcome inspection_outcome not null,
  summary text not null,
  document_id uuid references documents(id),
  reviewed_by uuid not null references users(id),
  review_date date not null,
  created_at timestamptz not null default now()
);

create table supplier_insurance (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  policy_type insurance_policy_type not null,
  carrier text not null,
  policy_number text not null,
  coverage_amount numeric(14,2) not null check (coverage_amount > 0),
  effective_date date not null,
  expiration_date date not null,
  agency_additional_insured boolean not null default false,
  document_id uuid not null references documents(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============ PRODUCTS ============
create table products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  name text not null,
  generic_name text, strength text, form text, unit text,
  ndc text, sku text,
  description text not null,
  status product_status not null default 'draft',
  counsel_review_required boolean not null default false,
  approved_by uuid references users(id),
  approved_at timestamptz,
  next_review_date date,
  source text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  unique (supplier_id, name),
  constraint product_approval_complete check (status <> 'approved' or (approved_by is not null and approved_at is not null and next_review_date is not null)),
  constraint no_self_approval check (approved_by is null or created_by is null or approved_by <> created_by)
);

create table product_regulatory_classifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  classification reg_classification not null,
  basis text not null,
  determined_by classification_basis not null,
  basis_document_id uuid not null references documents(id),
  effective_date date not null,
  review_date date not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  doc_type product_doc_type not null,
  document_id uuid not null references documents(id),
  valid_from date not null,
  valid_to date,
  verified_by uuid not null references users(id),
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table product_approved_buyer_types (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  buyer_type buyer_type not null,
  basis text not null,
  basis_document_id uuid not null references documents(id),
  approved_by uuid not null references users(id),
  approved_at timestamptz not null,
  review_date date not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (product_id, buyer_type),
  constraint no_self_approval check (created_by is null or approved_by <> created_by)
);

create table product_geographic_restrictions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  state char(2) not null,
  restriction_type geo_restriction not null,
  conditions text,
  basis text not null,
  basis_document_id uuid not null references documents(id),
  approved_by uuid not null references users(id),
  approved_at timestamptz not null,
  review_date date not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (product_id, state),
  constraint conditions_required check (restriction_type <> 'allowed_with_conditions' or conditions is not null)
);

-- ============ BUYERS ============
create table buyer_entities (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  dba text,
  buyer_type buyer_type,
  npi_org text check (npi_org ~ '^[0-9]{10}$'),
  state_of_formation char(2),
  website text,
  status buyer_status not null default 'prospect_unqualified',
  owner_id uuid not null references users(id),
  source text not null,
  first_contact_date date,
  first_order_date date,
  next_review_date date,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz,
  constraint qualified_needs_type check (status in ('prospect_unqualified','do_not_contact') or buyer_type is not null)
);
create unique index buyer_dedupe on buyer_entities (lower(legal_name), coalesce(state_of_formation,'--')) where archived_at is null;

create table buyer_facilities (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  name text not null,
  address text not null, city text not null, state char(2) not null, zip text not null,
  facility_type text,
  npi text check (npi ~ '^[0-9]{10}$'),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table buyer_contacts (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  full_name text not null,
  title text,
  email citext not null,
  email_verification_status email_verif_status not null default 'unverified',
  phone text,
  outreach_status contact_outreach_status not null default 'new',
  source text not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (buyer_entity_id, email)
);

create table buyer_licenses (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  facility_id uuid references buyer_facilities(id),
  license_type buyer_license_type not null,
  jurisdiction text not null,
  license_number text not null,
  expiration_date date not null,
  status license_status not null default 'pending_verification',
  document_id uuid references documents(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table buyer_attestations (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  attestation_type attestation_type not null,
  template_version text not null,
  signed_by_name text not null,
  signed_by_title text not null,
  signed_at timestamptz not null,
  method attestation_method not null,
  document_id uuid not null references documents(id),
  expires_at date not null,
  created_at timestamptz not null default now()
);

create table license_verifications (
  id uuid primary key default gen_random_uuid(),
  supplier_license_id uuid references supplier_licenses(id),
  buyer_license_id uuid references buyer_licenses(id),
  verification_source text not null,
  method verification_method not null,
  result verification_result not null,
  evidence_document_id uuid not null references documents(id),
  verified_by uuid not null references users(id),
  verified_at timestamptz not null,
  next_verification_due date not null,
  created_at timestamptz not null default now(),
  constraint exactly_one_license check (num_nonnulls(supplier_license_id, buyer_license_id) = 1)
);

-- ============ OUTREACH ============
create table outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_buyer_type buyer_type not null,
  product_ids uuid[] not null,
  template_ids uuid[] not null,
  sending_domain text not null,
  from_identity text not null,
  daily_cap int not null check (daily_cap between 1 and 200),
  status campaign_status not null default 'draft',
  approved_by_founder uuid references users(id),
  approved_by_compliance uuid references users(id),
  start_date date not null,
  end_date date,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint dual_approval check (status not in ('approved','active') or (approved_by_founder is not null and approved_by_compliance is not null))
);

create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references outreach_campaigns(id),
  contact_id uuid not null references buyer_contacts(id),
  template_version text not null,
  subject text not null,
  body_snapshot text not null,
  gate_check_result jsonb not null,
  status message_status not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  provider_message_id text,
  reply_classification reply_class not null default 'none',
  created_at timestamptz not null default now()
);

create table suppression_list (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  domain citext,
  contact_id uuid references buyer_contacts(id),
  reason suppression_reason not null,
  source text not null,
  suppressed_at timestamptz not null default now(),
  permanent boolean not null default true,
  created_at timestamptz not null default now(),
  constraint email_or_domain check (num_nonnulls(email, domain) >= 1)
);

-- ============ PIPELINE ============
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  supplier_id uuid references suppliers(id),
  product_id uuid references products(id),
  stage opportunity_stage not null default 'qualified',
  est_monthly_value numeric(12,2),
  owner_id uuid not null references users(id),
  expected_close date,
  lost_reason lost_reason,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint lost_needs_reason check (stage <> 'lost' or lost_reason is not null),
  constraint intro_needs_parties check (stage not in ('intro_requested','intro_made','quote_requested','quoted','won') or (supplier_id is not null and product_id is not null))
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  contact_id uuid not null references buyer_contacts(id),
  rep_id uuid not null references users(id),
  scheduled_at timestamptz not null,
  held_at timestamptz,
  outcome meeting_outcome not null default 'scheduled',
  notes text,
  opportunity_id uuid references opportunities(id),
  booking_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table supplier_introductions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id),
  supplier_id uuid not null references suppliers(id),
  buyer_entity_id uuid not null references buyer_entities(id),
  requested_by uuid not null references users(id),
  supplier_consent_at timestamptz,
  introduced_at timestamptz,
  method intro_method not null default 'email',
  status intro_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint consent_before_intro check (introduced_at is null or supplier_consent_at is not null)
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id),
  supplier_id uuid not null references suppliers(id),
  buyer_entity_id uuid not null references buyer_entities(id),
  quote_number text not null unique,
  line_items jsonb not null,
  currency char(3) not null default 'USD',
  total numeric(14,2) not null check (total >= 0),
  status quote_status not null default 'requested',
  supplier_approved_by_name text,
  supplier_approval_evidence_id uuid references documents(id),
  valid_until date not null,
  document_id uuid references documents(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint evidence_before_send check (status in ('requested') or (supplier_approved_by_name is not null and supplier_approval_evidence_id is not null))
);

-- ============ ORDERS & MONEY ============
create table orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  buyer_entity_id uuid not null references buyer_entities(id),
  opportunity_id uuid references opportunities(id),
  quote_id uuid references quotes(id),
  supplier_order_ref text not null,
  order_date date not null,
  status order_status not null default 'reported',
  reported_by uuid not null references users(id),
  currency char(3) not null default 'USD',
  subtotal numeric(14,2) not null check (subtotal >= 0),
  total numeric(14,2) not null check (total >= 0),
  completion_evidence_id uuid references documents(id),
  is_first_order boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (supplier_id, supplier_order_ref),
  constraint complete_needs_evidence check (status <> 'complete' or completion_evidence_id is not null)
);

create table order_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  qty numeric(12,3) not null check (qty > 0),
  uom text not null,
  unit_price numeric(12,4) not null check (unit_price >= 0),
  extended numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table collected_revenue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  supplier_id uuid not null references suppliers(id),
  amount numeric(14,2) not null check (amount > 0),
  collected_date date not null,
  evidence_document_id uuid references documents(id),
  reported_by uuid not null references users(id),
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table compensation_agreements (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  agreement_type agreement_type not null,
  rate_schedule jsonb not null,
  commission_basis text not null default 'collected_revenue' check (commission_basis = 'collected_revenue'),
  effective_date date not null,
  end_date date,
  signed_date date not null,
  document_id uuid not null references documents(id),
  status agreement_status not null default 'draft',
  payment_terms_days int not null check (payment_terms_days between 0 and 120),
  counsel_reviewed boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint active_needs_counsel check (status <> 'signed_active' or counsel_reviewed),
  constraint no_overlap exclude using gist (supplier_id with =, daterange(effective_date, coalesce(end_date,'9999-12-31'::date), '[]') with &&) where (status = 'signed_active')
);

create table commission_calculations (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references compensation_agreements(id),
  collected_revenue_id uuid not null unique references collected_revenue(id),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  basis_amount numeric(14,2) not null,
  rate_applied numeric(7,4) not null,
  commission_amount numeric(14,2) not null,
  calculated_by text not null default 'system' check (calculated_by = 'system'),
  status calc_status not null default 'draft',
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint approval_recorded check (status = 'draft' or (approved_by is not null and approved_at is not null))
);

create table commission_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  amount numeric(14,2) not null check (amount > 0),
  received_date date not null,
  method text not null,
  reference text not null,
  applied_calculation_ids uuid[] not null,
  reconciled boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table reorders (
  id uuid primary key default gen_random_uuid(),
  buyer_entity_id uuid not null references buyer_entities(id),
  product_id uuid not null references products(id),
  supplier_id uuid not null references suppliers(id),
  prior_order_id uuid not null references orders(id),
  cadence_days int not null check (cadence_days > 0),
  expected_reorder_date date not null,
  status reorder_status not null default 'upcoming',
  task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============ COMPLIANCE ============
create table compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_type review_subject not null,
  subject_id uuid not null,
  review_type review_type not null,
  reviewer_id uuid not null references users(id),
  checklist jsonb not null,
  outcome review_outcome not null,
  conditions text,
  reviewed_at timestamptz not null,
  next_review_date date not null,
  document_ids uuid[],
  created_at timestamptz not null default now()
);

create table compliance_exceptions (
  id uuid primary key default gen_random_uuid(),
  gate_code text not null,
  subject_type text not null,
  subject_id uuid,
  blocking_record_type text not null,
  blocking_record_id uuid,
  description text not null,
  required_remedy text not null,
  clearable_by_role clearable_by not null,
  severity exception_severity not null,
  status exception_status not null default 'open',
  raised_by_type actor_type not null,
  raised_by_user uuid references users(id),
  assigned_to uuid not null references users(id),
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  resolution_note text,
  waiver_memo_document_id uuid references documents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint closure_complete check (status in ('open','in_progress') or (resolved_by is not null and resolved_at is not null and resolution_note is not null)),
  constraint waiver_needs_memo check (status <> 'waived' or waiver_memo_document_id is not null),
  constraint unwaivable_gates check (status <> 'waived' or gate_code not in ('G5','G10'))
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  source complaint_source not null,
  buyer_entity_id uuid references buyer_entities(id),
  order_id uuid references orders(id),
  product_id uuid references products(id),
  received_at timestamptz not null,
  description text not null,
  severity exception_severity not null,
  is_adverse_event boolean not null default false,
  forwarded_to_supplier_at timestamptz,
  supplier_ack_at timestamptz,
  status complaint_status not null default 'open',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table adverse_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints(id),
  product_id uuid not null references products(id),
  order_id uuid references orders(id),
  event_date date not null,
  description text not null,
  reported_to_supplier_at timestamptz,
  supplier_confirmation_document_id uuid references documents(id),
  regulatory_reporting_owner text not null default 'supplier' check (regulatory_reporting_owner = 'supplier'),
  status ae_status not null default 'open',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table recalls (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  product_id uuid not null references products(id),
  recall_class recall_class not null,
  initiated_date date not null,
  source recall_source not null,
  source_ref text,
  scope text not null,
  affected_order_ids uuid[] not null default '{}',
  buyer_notification_status buyer_notif_status not null default 'supplier_notifying',
  status recall_status not null default 'open',
  document_id uuid references documents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ============ OPS ============
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type task_type not null,
  due_date date not null,
  assigned_to uuid not null references users(id),
  related_type text,
  related_id uuid,
  priority task_priority not null default 'normal',
  status task_status not null default 'open',
  cancellation_note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint cancel_needs_note check (status <> 'cancelled' or cancellation_note is not null)
);
alter table reorders add constraint reorders_task_fk foreign key (task_id) references tasks(id);

create table audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_type actor_type not null,
  actor_id uuid,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  before jsonb,
  after jsonb,
  gate_code text,
  context jsonb
);

create table regulatory_updates (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  source_name text not null,
  source_url text not null,
  title text not null,
  summary text not null,
  received_at timestamptz not null default now(),
  affected_classifications reg_classification[],
  affected_product_ids uuid[],
  impact reg_impact not null default 'unreviewed',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  linked_review_id uuid references compliance_reviews(id),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint classified_by_human check (impact = 'unreviewed' or (reviewed_by is not null and reviewed_at is not null)),
  constraint action_needs_review check (impact <> 'action_required' or linked_review_id is not null)
);

-- ============ IMMUTABILITY & AUDIT ============
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% on % is prohibited (append-only)', tg_op, tg_table_name;
end $$;

create trigger audit_logs_append_only before update or delete on audit_logs
  for each row execute function forbid_mutation();
create trigger suppression_no_delete before delete on suppression_list
  for each row execute function forbid_mutation();

create or replace function write_audit() returns trigger language plpgsql security definer as $$
begin
  insert into audit_logs (actor_type, actor_id, action, subject_type, subject_id, before, after)
  values (
    case when current_setting('app.actor_type', true) in ('system','automation') then current_setting('app.actor_type', true)::actor_type else 'user' end,
    nullif(current_setting('app.actor_id', true), '')::uuid,
    lower(tg_table_name) || '.' || lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(old)->>'id')::uuid else (to_jsonb(new)->>'id')::uuid end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not in ('audit_logs')
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function write_audit()', t, t);
  end loop;
end $$;

-- ============ ROW-LEVEL SECURITY ============
-- Full permission matrix: docs/02-roles-permissions.md. Default-deny: RLS enabled on every
-- table; policies grant only what the matrix allows. Representative policies below; the
-- generated per-table policy set follows the same three helpers.
create or replace function current_app_role() returns user_role language sql stable as
  $$ select role from users where id = nullif(current_setting('app.actor_id', true), '')::uuid $$;
create or replace function current_app_supplier() returns uuid language sql stable as
  $$ select supplier_id from users where id = nullif(current_setting('app.actor_id', true), '')::uuid $$;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Staff read (founder/compliance/sysadmin) — example pattern
create policy staff_read on suppliers for select using (current_app_role() in ('founder','compliance','sysadmin','accountant') or (current_app_role() = 'sales_rep' and status = 'approved') or (current_app_role() = 'supplier_user' and id = current_app_supplier()));
-- Supplier row-scoping — example pattern (repeat per supplier-owned table)
create policy supplier_own_orders on orders for all using (current_app_role() in ('founder','compliance','sysadmin','accountant','sales_rep') or (current_app_role() = 'supplier_user' and supplier_id = current_app_supplier()));
-- Human-only verification writes: automation identities carry app.actor_type <> 'user'
create policy verifications_human_only on license_verifications for insert
  with check (current_app_role() in ('compliance','founder') and coalesce(current_setting('app.actor_type', true), 'user') = 'user');
-- Suppression: anyone may add, nobody may delete (delete also blocked by trigger)
create policy suppression_insert on suppression_list for insert with check (true);
create policy suppression_read on suppression_list for select using (current_app_role() is not null);
