-- Mamta Care Donor Desk operations v1.
-- Non-destructive schema extension. No donor records modified by this migration.
CREATE TABLE IF NOT EXISTS mcct_ops_hair_lots (
 id TEXT PRIMARY KEY NOT NULL,
 donor_id TEXT REFERENCES donors(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('donor','salon','volunteer','hospital','drive','other')),
 source_label TEXT NOT NULL DEFAULT '',
 hair_form TEXT NOT NULL CHECK(hair_form IN ('ponytail','braid','mixed','loose')),
 piece_count INTEGER NOT NULL CHECK(piece_count BETWEEN 1 AND 10000),
 length_inches REAL CHECK(length_inches IS NULL OR (length_inches BETWEEN 1 AND 80)),
 collection_mode TEXT NOT NULL CHECK(collection_mode IN ('courier','hand','salon','drive','other')),
 custodian_type TEXT NOT NULL CHECK(custodian_type IN ('staff','volunteer','salon','hospital','center','fabricator','other')),
 custodian_ref TEXT NOT NULL DEFAULT '',
 location TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'received' CHECK(stage IN ('received','in_transit','with_custodian','at_fabricator','consumed','closed')),
 note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
);
CREATE TABLE IF NOT EXISTS mcct_ops_hair_events (
 id TEXT PRIMARY KEY NOT NULL,
 lot_id TEXT NOT NULL REFERENCES mcct_ops_hair_lots(id),
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 before_json TEXT NOT NULL,
 after_json TEXT NOT NULL,
 happened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcct_ops_donor_status_events (
 id TEXT PRIMARY KEY NOT NULL,
 donor_id TEXT NOT NULL REFERENCES donors(id),
 actor TEXT NOT NULL,
 old_status TEXT NOT NULL,
 new_status TEXT NOT NULL CHECK(new_status IN ('Cancelled','Pending','Expired')),
 reason TEXT NOT NULL,
 happened_at INTEGER NOT NULL,
 version_before INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcct_ops_expiry_review (
 donor_id TEXT PRIMARY KEY NOT NULL REFERENCES donors(id),
 detected_at INTEGER NOT NULL,
 last_updated_at INTEGER NOT NULL,
 decision TEXT NOT NULL DEFAULT 'PENDING' CHECK(decision IN ('PENDING','EXCLUDED','APPROVED')),
 decided_by TEXT,
 decided_at INTEGER,
 note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS mcct_ops_notification_outbox (
 id TEXT PRIMARY KEY NOT NULL,
 donor_id TEXT NOT NULL REFERENCES donors(id),
 kind TEXT NOT NULL CHECK(kind IN ('EXPIRY_EMAIL','FEEDBACK_EMAIL','REGISTRATION_ACK')),
 delivery_state TEXT NOT NULL DEFAULT 'PENDING_CONFIGURATION' CHECK(delivery_state IN ('PENDING_CONFIGURATION','READY','SENT','FAILED','CANCELLED')),
 target TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 sent_at INTEGER,
 last_error TEXT NOT NULL DEFAULT '',
 UNIQUE(donor_id,kind)
);
CREATE TABLE IF NOT EXISTS mcct_ops_run_state (
 task TEXT PRIMARY KEY NOT NULL,
 last_run_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcct_ops_hair_custody ON mcct_ops_hair_lots(custodian_type,location,stage);
CREATE INDEX IF NOT EXISTS idx_mcct_ops_status_by_donor ON mcct_ops_donor_status_events(donor_id,happened_at);
CREATE INDEX IF NOT EXISTS idx_mcct_ops_expiry_state ON mcct_ops_expiry_review(decision,detected_at);
