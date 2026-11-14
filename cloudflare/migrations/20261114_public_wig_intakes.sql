-- Mamta Care NGO free wig intake: minimal, consent-based information.
-- Fully additive, no changes to existing wig requests, donor IDs or certificates.
CREATE TABLE IF NOT EXISTS mcct_public_wig_intakes (
 id TEXT PRIMARY KEY NOT NULL,
 recipient_name TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 city TEXT NOT NULL,
 hair_material TEXT NOT NULL CHECK(hair_material IN ('Any','Human hair','Synthetic','Blend')),
 cap_size TEXT NOT NULL DEFAULT '',
 urgency TEXT NOT NULL CHECK(urgency IN ('Normal','Urgent')),
 note TEXT NOT NULL DEFAULT '',
 consent_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IMPORTED','REJECTED')),
 reviewed_by TEXT NOT NULL DEFAULT '',
 reviewed_at INTEGER NOT NULL DEFAULT 0,
 review_note TEXT NOT NULL DEFAULT '',
 wig_request_id TEXT UNIQUE REFERENCES wig_requests(id),
 contact_hash TEXT NOT NULL,
 day_ist TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(contact_hash,day_ist)
);
CREATE TABLE IF NOT EXISTS mcct_public_wig_rate (
 bucket TEXT PRIMARY KEY NOT NULL,
 day_ist TEXT NOT NULL,
 submissions INTEGER NOT NULL CHECK(submissions>=1 AND submissions<=5),
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcct_public_wig_reviews ON mcct_public_wig_intakes(status,created_at);
