-- agency-os seed data (see docs/08-build-plan.md §Seed data)
-- Fixed UUIDs: 00000000-0000-4000-8000-XXXXXXXXXXXX. Apply after schema.sql.
begin;
select set_config('app.actor_type', 'system', true);

-- Staff users (supplier user added after suppliers)
insert into users (id, email, full_name, role, status, mfa_enabled) values
 ('00000000-0000-4000-8000-000000000101','founder@agency.test','Avery Founder','founder','active',true),
 ('00000000-0000-4000-8000-000000000102','rep@agency.test','Riley Rep','sales_rep','active',true),
 ('00000000-0000-4000-8000-000000000103','compliance@agency.test','Casey Compliance','compliance','active',true),
 ('00000000-0000-4000-8000-000000000104','books@agency.test','Alex Accountant','accountant','active',true),
 ('00000000-0000-4000-8000-000000000105','admin@agency.test','Sam Sysadmin','sysadmin','active',true);

insert into suppliers (id, legal_name, entity_type, ein, hq_address, hq_city, hq_state, hq_zip, status, risk_tier, approved_by, approved_at, next_review_date, source, created_by) values
 ('00000000-0000-4000-8000-000000000201','Sonoran Compounding Partners LLC','llc','86-1234567','100 W Fillmore St','Phoenix','AZ','85003','approved','medium','00000000-0000-4000-8000-000000000101',now(),(current_date + 300),'industry referral','00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000202','Desert Peak Labs Inc','corp',null,null,'Tempe','AZ',null,'in_review',null,null,null,null,'inbound inquiry','00000000-0000-4000-8000-000000000103');

insert into users (id, email, full_name, role, status, supplier_id, mfa_enabled) values
 ('00000000-0000-4000-8000-000000000106','ops@sonorancompounding.test','Sana Supplier','supplier_user','active','00000000-0000-4000-8000-000000000201',true);

-- Documents (sha256 placeholders)
insert into documents (id, filename, doc_kind, storage_ref, sha256, uploaded_by, related_type, related_id, retention_class) values
 ('00000000-0000-4000-8000-000000000301','s1-az-wholesale-license.pdf','license','drive:/suppliers/s1/lic.pdf',repeat('a',64),'00000000-0000-4000-8000-000000000103','supplier_licenses','00000000-0000-4000-8000-000000000201','permanent'),
 ('00000000-0000-4000-8000-000000000302','s1-product-liability-coi.pdf','insurance_coi','drive:/suppliers/s1/coi.pdf',repeat('b',64),'00000000-0000-4000-8000-000000000103','supplier_insurance','00000000-0000-4000-8000-000000000201','legal_7y'),
 ('00000000-0000-4000-8000-000000000303','s1-compensation-agreement-signed.pdf','contract','drive:/suppliers/s1/agr.pdf',repeat('c',64),'00000000-0000-4000-8000-000000000101','compensation_agreements','00000000-0000-4000-8000-000000000201','permanent'),
 ('00000000-0000-4000-8000-000000000304','counsel-memo-p1-classification.pdf','counsel_memo','drive:/products/p1/memo.pdf',repeat('d',64),'00000000-0000-4000-8000-000000000103','products','00000000-0000-4000-8000-000000000401','permanent'),
 ('00000000-0000-4000-8000-000000000305','b4-az-pharmacy-permit.pdf','license','drive:/buyers/b4/lic.pdf',repeat('e',64),'00000000-0000-4000-8000-000000000103','buyer_licenses','00000000-0000-4000-8000-000000000504','permanent'),
 ('00000000-0000-4000-8000-000000000306','b4-licensure-attestation-signed.pdf','attestation','drive:/buyers/b4/att.pdf',repeat('f',64),'00000000-0000-4000-8000-000000000102','buyer_attestations','00000000-0000-4000-8000-000000000504','legal_7y'),
 ('00000000-0000-4000-8000-000000000307','verification-evidence-screenshot.pdf','evidence_screenshot','drive:/verifications/ev1.pdf',repeat('1',64),'00000000-0000-4000-8000-000000000103','license_verifications','00000000-0000-4000-8000-000000000504','permanent'),
 ('00000000-0000-4000-8000-000000000308','q1-supplier-pricing-approval-email.pdf','evidence_screenshot','drive:/quotes/q1/ev.pdf',repeat('2',64),'00000000-0000-4000-8000-000000000102','quotes','00000000-0000-4000-8000-000000000801','legal_7y'),
 ('00000000-0000-4000-8000-000000000309','ord1-supplier-completion-confirmation.pdf','order_evidence','drive:/orders/ord1/ev.pdf',repeat('3',64),'00000000-0000-4000-8000-000000000101','orders','00000000-0000-4000-8000-000000000901','legal_7y'),
 ('00000000-0000-4000-8000-000000000310','template-intro-v1-approved.html','template','drive:/outreach/t1.html',repeat('4',64),'00000000-0000-4000-8000-000000000101','outreach_campaigns','00000000-0000-4000-8000-000000000601','permanent'),
 ('00000000-0000-4000-8000-000000000311','recall-notice-p3.pdf','other','drive:/recalls/r1.pdf',repeat('5',64),'00000000-0000-4000-8000-000000000103','recalls','00000000-0000-4000-8000-000000000403','permanent'),
 ('00000000-0000-4000-8000-000000000312','s1-july-remittance-statement.pdf','remittance','drive:/money/s1-jul.pdf',repeat('6',64),'00000000-0000-4000-8000-000000000104','collected_revenue','00000000-0000-4000-8000-000000000901','legal_7y'),
 ('00000000-0000-4000-8000-000000000313','p1-coa-lot-2026-07.pdf','coa','drive:/products/p1/coa.pdf',repeat('7',64),'00000000-0000-4000-8000-000000000103','product_documents','00000000-0000-4000-8000-000000000401','legal_7y'),
 ('00000000-0000-4000-8000-000000000314','p1-label.pdf','label','drive:/products/p1/label.pdf',repeat('8',64),'00000000-0000-4000-8000-000000000103','product_documents','00000000-0000-4000-8000-000000000401','legal_7y'),
 ('00000000-0000-4000-8000-000000000315','waiver-memo-adhoc-domain-cooldown.pdf','counsel_memo','drive:/compliance/waiver1.pdf',repeat('9',64),'00000000-0000-4000-8000-000000000101','compliance_exceptions','00000000-0000-4000-8000-000000000e01','permanent');

-- Supplier detail
insert into supplier_facilities (id, supplier_id, name, facility_type, address, city, state, zip, state_license_required) values
 ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000201','Phoenix 503B Facility','503b_outsourcing','200 S 7th Ave','Phoenix','AZ','85007',true);
insert into supplier_licenses (id, supplier_id, facility_id, license_type, jurisdiction, license_number, expiration_date, status, document_id, created_by) values
 ('00000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000211','state_wholesale','AZ','AZ-WH-77821',(current_date + 200),'active','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000106');
insert into supplier_inspections (supplier_id, facility_id, inspection_type, inspection_date, outcome, summary, reviewed_by, review_date) values
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000211','state_board',(current_date - 400),'pass','Routine state board inspection, no findings.','00000000-0000-4000-8000-000000000103',current_date - 30);
insert into supplier_insurance (supplier_id, policy_type, carrier, policy_number, coverage_amount, effective_date, expiration_date, agency_additional_insured, document_id, created_by) values
 ('00000000-0000-4000-8000-000000000201','product_liability','Sample Mutual','PL-99120',2000000,(current_date - 100),(current_date + 265),true,'00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000106');

-- Products
insert into products (id, supplier_id, name, description, status, counsel_review_required, approved_by, approved_at, next_review_date, source, created_by) values
 ('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000201','Sterile Compound A 10mg/mL vial','Supplier-compounded sterile preparation. Sold to licensed facilities only.','approved',true,'00000000-0000-4000-8000-000000000101',now(),(current_date + 300),'supplier submission 2026-06','00000000-0000-4000-8000-000000000106'),
 ('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000201','Compound B topical','Draft submission pending counsel classification memo.','draft',true,null,null,null,'supplier submission 2026-07','00000000-0000-4000-8000-000000000106'),
 ('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000201','Sterile Compound C 5mg/mL vial','Suspended pending recall closure.','suspended',true,null,null,(current_date + 60),'supplier submission 2026-05','00000000-0000-4000-8000-000000000106');

insert into product_regulatory_classifications (product_id, classification, basis, determined_by, basis_document_id, effective_date, review_date, created_by) values
 ('00000000-0000-4000-8000-000000000401','compounded_503b','Counsel memo 2026-06-12 §2: product qualifies as 503B outsourcing facility compounded preparation.','counsel_memo','00000000-0000-4000-8000-000000000304',current_date - 45,current_date + 320,'00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000403','compounded_503b','Counsel memo 2026-06-12 §3.','counsel_memo','00000000-0000-4000-8000-000000000304',current_date - 45,current_date + 320,'00000000-0000-4000-8000-000000000103');

insert into product_documents (product_id, doc_type, document_id, valid_from, valid_to, verified_by, verified_at) values
 ('00000000-0000-4000-8000-000000000401','coa','00000000-0000-4000-8000-000000000313',current_date - 20,current_date + 160,'00000000-0000-4000-8000-000000000103',now()),
 ('00000000-0000-4000-8000-000000000401','label','00000000-0000-4000-8000-000000000314',current_date - 45,null,'00000000-0000-4000-8000-000000000103',now());

insert into product_approved_buyer_types (product_id, buyer_type, basis, basis_document_id, approved_by, approved_at, review_date, created_by) values
 ('00000000-0000-4000-8000-000000000401','pharmacy_503a','Counsel eligibility matrix row 4.','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000101',now(),current_date + 320,'00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000401','physician_clinic','Counsel eligibility matrix row 5 (office administration only).','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000101',now(),current_date + 320,'00000000-0000-4000-8000-000000000103');

insert into product_geographic_restrictions (product_id, state, restriction_type, conditions, basis, basis_document_id, approved_by, approved_at, review_date, created_by) values
 ('00000000-0000-4000-8000-000000000401','AZ','allowed',null,'Counsel state survey §AZ.','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000101',now(),current_date + 320,'00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000401','TX','allowed_with_conditions','Buyer must hold TX out-of-state pharmacy registration.','Counsel state survey §TX.','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000101',now(),current_date + 320,'00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000401','CA','prohibited',null,'Counsel state survey §CA: distribution model not permitted.','00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000101',now(),current_date + 320,'00000000-0000-4000-8000-000000000103');

-- Buyers
insert into buyer_entities (id, legal_name, buyer_type, state_of_formation, status, owner_id, source, first_contact_date, first_order_date, next_review_date, created_by) values
 ('00000000-0000-4000-8000-000000000501','Cactus Wellness Group','physician_clinic','AZ','prospect_unqualified','00000000-0000-4000-8000-000000000102','import batch 2026-07-01',null,null,null,'00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000502','Mesa Family Medicine PLC','physician_clinic','AZ','qualified','00000000-0000-4000-8000-000000000102','import batch 2026-07-01',current_date - 20,null,null,'00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000503','Saguaro Pharmacy LLC','pharmacy_503a','AZ','verified','00000000-0000-4000-8000-000000000102','referral',current_date - 60,null,current_date + 300,'00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000504','Gila Bend Pharmacy Inc','pharmacy_503a','AZ','active','00000000-0000-4000-8000-000000000102','referral',current_date - 120,current_date - 75,current_date + 250,'00000000-0000-4000-8000-000000000102');

insert into buyer_facilities (id, buyer_entity_id, name, address, city, state, zip) values
 ('00000000-0000-4000-8000-000000000511','00000000-0000-4000-8000-000000000503','Saguaro Pharmacy Main','12 E Main St','Mesa','AZ','85201'),
 ('00000000-0000-4000-8000-000000000512','00000000-0000-4000-8000-000000000504','Gila Bend Pharmacy','88 N Pima Rd','Gila Bend','AZ','85337');

insert into buyer_contacts (id, buyer_entity_id, full_name, title, email, email_verification_status, outreach_status, source, last_verified_at) values
 ('00000000-0000-4000-8000-000000000521','00000000-0000-4000-8000-000000000502','Dana Doctor','Practice Manager','dana@mesafamilymed.test','deliverable','eligible','import batch 2026-07-01',now() - interval '10 days'),
 ('00000000-0000-4000-8000-000000000522','00000000-0000-4000-8000-000000000503','Pat Pharmacist','Pharmacist in Charge','pat@saguarorx.test','deliverable','enrolled','referral',now() - interval '5 days'),
 ('00000000-0000-4000-8000-000000000523','00000000-0000-4000-8000-000000000504','Gale Owner','Owner','gale@gilabendrx.test','deliverable','replied','referral',now() - interval '30 days'),
 ('00000000-0000-4000-8000-000000000524','00000000-0000-4000-8000-000000000502','Ono Optout','Front Desk','ono@mesafamilymed.test','deliverable','opted_out','import batch 2026-07-01',now() - interval '10 days');

insert into suppression_list (email, contact_id, reason, source, permanent) values
 ('ono@mesafamilymed.test','00000000-0000-4000-8000-000000000524','opt_out','reply keyword: unsubscribe',true);

insert into buyer_licenses (id, buyer_entity_id, facility_id, license_type, jurisdiction, license_number, expiration_date, status, document_id, created_by) values
 ('00000000-0000-4000-8000-000000000531','00000000-0000-4000-8000-000000000503','00000000-0000-4000-8000-000000000511','pharmacy_permit','AZ','PHX-33871',(current_date + 150),'active',null,'00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000532','00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000512','pharmacy_permit','AZ','PHX-21054',(current_date + 45),'expiring_soon','00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000102');

insert into buyer_attestations (buyer_entity_id, attestation_type, template_version, signed_by_name, signed_by_title, signed_at, method, document_id, expires_at) values
 ('00000000-0000-4000-8000-000000000504','licensure','ATT-LIC-v1','Gale Owner','Owner',now() - interval '70 days','esignature','00000000-0000-4000-8000-000000000306',current_date + 295);

insert into license_verifications (supplier_license_id, buyer_license_id, verification_source, method, result, evidence_document_id, verified_by, verified_at, next_verification_due) values
 ('00000000-0000-4000-8000-000000000221',null,'https://pharmacy.az.gov/license-verification','primary_source_web','verified_active','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000103',now() - interval '40 days',current_date + 200),
 (null,'00000000-0000-4000-8000-000000000531','https://pharmacy.az.gov/license-verification','primary_source_web','verified_active','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000103',now() - interval '20 days',current_date + 150),
 (null,'00000000-0000-4000-8000-000000000532','https://pharmacy.az.gov/license-verification','primary_source_web','verified_active','00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000103',now() - interval '80 days',current_date + 45);

-- Outreach
insert into outreach_campaigns (id, name, target_buyer_type, product_ids, template_ids, sending_domain, from_identity, daily_cap, status, approved_by_founder, approved_by_compliance, start_date, created_by) values
 ('00000000-0000-4000-8000-000000000601','AZ 503A pharmacies — Compound A intro','pharmacy_503a','{00000000-0000-4000-8000-000000000401}','{00000000-0000-4000-8000-000000000310}','get.agencybrand.test','Riley Rep <riley@get.agencybrand.test>',30,'active','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000103',current_date - 14,'00000000-0000-4000-8000-000000000102');

insert into outreach_messages (campaign_id, contact_id, template_version, subject, body_snapshot, gate_check_result, status, scheduled_at, sent_at, provider_message_id, reply_classification) values
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000522','T1-v1','Sourcing introduction for Saguaro Pharmacy','[full sent body incl. postal address + opt-out link]','{"G1":"pass","G2":"pass","G3":"pass","G4":"pass","G5":"pass","G9":"pass","G10":"pass"}','sent',now() - interval '6 days',now() - interval '6 days','prov-msg-001','none'),
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000521','T1-v1','(blocked)','(not sent)','{"G1":"fail:entity_not_verified_for_product_campaign"}','blocked',now() - interval '6 days',null,null,'none');

-- Pipeline
insert into opportunities (id, buyer_entity_id, supplier_id, product_id, stage, est_monthly_value, owner_id, created_by) values
 ('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000503',null,null,'qualified',4000,'00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'),
 ('00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000401','won',6000,'00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102');

insert into meetings (buyer_entity_id, contact_id, rep_id, scheduled_at, held_at, outcome, opportunity_id, booking_source) values
 ('00000000-0000-4000-8000-000000000503','00000000-0000-4000-8000-000000000522','00000000-0000-4000-8000-000000000102',now() + interval '2 days',null,'scheduled','00000000-0000-4000-8000-000000000701','cal.com/agency/intro');

insert into supplier_introductions (opportunity_id, supplier_id, buyer_entity_id, requested_by, supplier_consent_at, introduced_at, method, status) values
 ('00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000102',now() - interval '85 days',now() - interval '84 days','email','introduced');

insert into quotes (id, opportunity_id, supplier_id, buyer_entity_id, quote_number, line_items, total, status, supplier_approved_by_name, supplier_approval_evidence_id, valid_until, created_by) values
 ('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000504','Q-2026-0001','[{"product_id":"00000000-0000-4000-8000-000000000401","qty":100,"uom":"vial","unit_price":120.00}]',12000,'accepted','Sana Supplier','00000000-0000-4000-8000-000000000308',current_date + 10,'00000000-0000-4000-8000-000000000102');

-- Orders & money
insert into orders (id, supplier_id, buyer_entity_id, opportunity_id, quote_id, supplier_order_ref, order_date, status, reported_by, subtotal, total, completion_evidence_id, is_first_order) values
 ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000801','SO-1001',current_date - 75,'complete','00000000-0000-4000-8000-000000000106',12000,12000,'00000000-0000-4000-8000-000000000309',true),
 ('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000504',null,null,'SO-1002',current_date - 15,'delivered','00000000-0000-4000-8000-000000000106',12000,12000,null,false);

insert into order_line_items (order_id, product_id, qty, uom, unit_price, extended) values
 ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000401',100,'vial',120.00,12000),
 ('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000401',100,'vial',120.00,12000);

insert into collected_revenue (id, order_id, supplier_id, amount, collected_date, evidence_document_id, reported_by) values
 ('00000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000201',12000,current_date - 45,'00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000106'),
 ('00000000-0000-4000-8000-000000000912','00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000201',12000,current_date - 2,null,'00000000-0000-4000-8000-000000000106');

insert into compensation_agreements (id, supplier_id, agreement_type, rate_schedule, effective_date, signed_date, document_id, status, payment_terms_days, counsel_reviewed, created_by) values
 ('00000000-0000-4000-8000-000000000921','00000000-0000-4000-8000-000000000201','percent_of_collected','{"percent":0.15}',current_date - 100,current_date - 100,'00000000-0000-4000-8000-000000000303','signed_active',30,true,'00000000-0000-4000-8000-000000000101');

insert into commission_calculations (id, agreement_id, collected_revenue_id, period, basis_amount, rate_applied, commission_amount, status, approved_by, approved_at) values
 ('00000000-0000-4000-8000-000000000931','00000000-0000-4000-8000-000000000921','00000000-0000-4000-8000-000000000911',to_char(current_date - 45,'YYYY-MM'),12000,0.15,1800,'paid','00000000-0000-4000-8000-000000000101',now() - interval '40 days'),
 ('00000000-0000-4000-8000-000000000932','00000000-0000-4000-8000-000000000921','00000000-0000-4000-8000-000000000912',to_char(current_date,'YYYY-MM'),12000,0.15,1800,'draft',null,null);

insert into commission_payments (supplier_id, amount, received_date, method, reference, applied_calculation_ids, reconciled, created_by) values
 ('00000000-0000-4000-8000-000000000201',1800,current_date - 20,'ach','ACH-58291','{00000000-0000-4000-8000-000000000931}',true,'00000000-0000-4000-8000-000000000101');

insert into reorders (buyer_entity_id, product_id, supplier_id, prior_order_id, cadence_days, expected_reorder_date, status) values
 ('00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000902',60,current_date + 45,'upcoming');

-- Compliance records
insert into compliance_reviews (id, subject_type, subject_id, review_type, reviewer_id, checklist, outcome, reviewed_at, next_review_date) values
 ('00000000-0000-4000-8000-000000000a01','supplier','00000000-0000-4000-8000-000000000201','initial','00000000-0000-4000-8000-000000000103','{"licenses_verified":true,"insurance_min_met":true,"inspections_reviewed":true,"contract_counsel_reviewed":true}','approved_recommend',now() - interval '100 days',current_date + 300),
 ('00000000-0000-4000-8000-000000000a02','product','00000000-0000-4000-8000-000000000403','for_cause','00000000-0000-4000-8000-000000000103','{"recall_scope_confirmed":true,"orders_swept":true}','conditional',now() - interval '3 days',current_date + 30);

insert into complaints (id, source, buyer_entity_id, order_id, product_id, received_at, description, severity, is_adverse_event, forwarded_to_supplier_at, status, created_by) values
 ('00000000-0000-4000-8000-000000000b01','buyer','00000000-0000-4000-8000-000000000504','00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000401',now() - interval '4 days','Buyer reports two vials arrived with compromised seals.','high',true,now() - interval '4 days','forwarded','00000000-0000-4000-8000-000000000102');

insert into adverse_events (complaint_id, product_id, order_id, event_date, description, reported_to_supplier_at, status, created_by) values
 ('00000000-0000-4000-8000-000000000b01','00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000901',current_date - 4,'Compromised seals reported; no patient exposure reported by buyer.',now() - interval '4 days','forwarded','00000000-0000-4000-8000-000000000103');

insert into recalls (supplier_id, product_id, recall_class, initiated_date, source, source_ref, scope, buyer_notification_status, status, document_id) values
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000403','class_2',current_date - 5,'supplier_notice','SN-2026-014','Lots C-2206 through C-2209','supplier_notifying','open','00000000-0000-4000-8000-000000000311');

-- Exceptions: live gate examples + one waived + RC register
insert into compliance_exceptions (id, gate_code, subject_type, subject_id, blocking_record_type, blocking_record_id, description, required_remedy, clearable_by_role, severity, status, raised_by_type, assigned_to) values
 ('00000000-0000-4000-8000-000000000e02','G1','buyer_contacts','00000000-0000-4000-8000-000000000521','buyer_entities','00000000-0000-4000-8000-000000000502','Product-specific campaign enrollment blocked: entity is qualified but not verified.','Complete WF7 license verification for Mesa Family Medicine PLC.','compliance','medium','open','system','00000000-0000-4000-8000-000000000103'),
 ('00000000-0000-4000-8000-000000000e03','G7','suppliers','00000000-0000-4000-8000-000000000202','compensation_agreements',null,'No signed compensation agreement exists for Desert Peak Labs; commission calculation is blocked.','Execute compensation agreement; founder sets signed_active with executed contract attached.','founder','high','open','system','00000000-0000-4000-8000-000000000101'),
 ('00000000-0000-4000-8000-000000000e04','G2','products','00000000-0000-4000-8000-000000000403','recalls',null,'Product suspended by open recall; cannot be attached to campaigns, quotes, or introductions.','Recall closure + compliance review + founder un-suspension (WF20).','founder','critical','in_progress','system','00000000-0000-4000-8000-000000000103');
insert into compliance_exceptions (id, gate_code, subject_type, subject_id, blocking_record_type, blocking_record_id, description, required_remedy, clearable_by_role, severity, status, raised_by_type, raised_by_user, assigned_to, resolved_by, resolved_at, resolution_note, waiver_memo_document_id) values
 ('00000000-0000-4000-8000-000000000e01','ADHOC','outreach_campaigns','00000000-0000-4000-8000-000000000601','outreach_campaigns','00000000-0000-4000-8000-000000000601','Domain cooldown guideline (14-day warm-up) shortened to 10 days.','Founder waiver memo.','founder','low','waived','user','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',now() - interval '14 days','Waived per memo; volume held at 50% of cap for first week.','00000000-0000-4000-8000-000000000315');

insert into compliance_exceptions (gate_code, subject_type, blocking_record_type, description, required_remedy, clearable_by_role, severity, status, raised_by_type, assigned_to)
select 'RC' || n, 'process', 'counsel_signoff',
 'Requires-counsel item RC' || n || ' (see docs/00-decision-table.md §4) is unresolved; dependent workflow is blocked.',
 'Counsel written sign-off recorded as a compliance_review with linked document.',
 'founder_with_counsel','high','open','system','00000000-0000-4000-8000-000000000101'
from generate_series(1,12) n;

-- Tasks & regulatory updates
insert into tasks (title, task_type, due_date, assigned_to, related_type, related_id, priority) values
 ('Verify renewed pharmacy permit for Gila Bend Pharmacy','verification_due',current_date + 30,'00000000-0000-4000-8000-000000000103','buyer_licenses','00000000-0000-4000-8000-000000000532','high'),
 ('Chase missing insurance COI from Desert Peak Labs','document_missing',current_date + 7,'00000000-0000-4000-8000-000000000103','suppliers','00000000-0000-4000-8000-000000000202','normal'),
 ('Reorder follow-up: Gila Bend Pharmacy — Compound A','reorder_reminder',current_date + 31,'00000000-0000-4000-8000-000000000102','buyer_entities','00000000-0000-4000-8000-000000000504','normal');

insert into regulatory_updates (jurisdiction, source_name, source_url, title, summary, impact, reviewed_by, reviewed_at, linked_review_id) values
 ('US-FED','FDA Enforcement Reports','https://www.fda.gov/safety/recalls','Weekly enforcement report','Automated feed item awaiting triage.','unreviewed',null,null,null),
 ('AZ','AZ Board of Pharmacy','https://pharmacy.az.gov','Board bulletin July','No impact on approved products.','none','00000000-0000-4000-8000-000000000103',now() - interval '5 days',null),
 ('US-FED','FDA','https://www.fda.gov','Compounding guidance update affecting 503B labeling','Labeling guidance change; product review opened.','action_required','00000000-0000-4000-8000-000000000103',now() - interval '3 days','00000000-0000-4000-8000-000000000a02');

commit;
