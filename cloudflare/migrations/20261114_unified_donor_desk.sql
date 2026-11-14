-- Mamta Care Donor Desk unified administration extension — 2026-11-14
-- Additive only. Never touches existing donors, certificates, photos or assignments.
CREATE TABLE IF NOT EXISTS mcct_ops_review_links (
  submission_uuid TEXT PRIMARY KEY NOT NULL REFERENCES website_form_intakes(submission_uuid),
  donor_id TEXT NOT NULL UNIQUE REFERENCES donors(id),
  registration_id TEXT NOT NULL UNIQUE,
  verified_by TEXT NOT NULL REFERENCES staff(username),
  verified_at INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS mcct_ops_hair_split_keys (
  request_key TEXT PRIMARY KEY NOT NULL,
  parent_lot_id TEXT NOT NULL REFERENCES mcct_ops_hair_lots(id),
  child_lot_id TEXT NOT NULL UNIQUE REFERENCES mcct_ops_hair_lots(id),
  moved_pieces INTEGER NOT NULL CHECK(moved_pieces > 0),
  actor TEXT NOT NULL REFERENCES staff(username),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcct_ops_manual_comms (
 id TEXT PRIMARY KEY NOT NULL,
 donor_id TEXT NOT NULL REFERENCES donors(id),
 channel TEXT NOT NULL CHECK(channel IN ('WHATSAPP','SMS','EMAIL')),
 template TEXT NOT NULL CHECK(template IN ('REGISTRATION_ACK','CERTIFICATE_FEEDBACK','EXPIRY_NOTICE')),
 day_ist TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','OPENED_UNVERIFIED','CANCELLED')),
 consent_attested_by TEXT NOT NULL REFERENCES staff(username),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(donor_id,channel,template,day_ist)
);
CREATE INDEX IF NOT EXISTS mcct_ops_review_links_by_donor ON mcct_ops_review_links(donor_id);
CREATE INDEX IF NOT EXISTS mcct_ops_comms_by_day ON mcct_ops_manual_comms(day_ist,state);
