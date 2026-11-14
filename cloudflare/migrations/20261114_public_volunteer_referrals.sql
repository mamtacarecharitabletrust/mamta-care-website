-- Public volunteer interest intake: safe, additive, no volunteer ID issuance.
-- Existing mca_referrals remains the canonical Administrator approval queue.
CREATE TABLE IF NOT EXISTS mcct_public_volunteer_intakes (
 referral_id TEXT PRIMARY KEY NOT NULL REFERENCES mca_referrals(id),
 contact_hash TEXT NOT NULL,
 day_ist TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(contact_hash,day_ist)
);
CREATE TABLE IF NOT EXISTS mcct_public_volunteer_rate (
 bucket TEXT PRIMARY KEY NOT NULL,
 day_ist TEXT NOT NULL,
 submissions INTEGER NOT NULL CHECK(submissions>=1 AND submissions<=5),
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcct_volunteer_source_day ON mcct_public_volunteer_intakes(day_ist,created_at);
