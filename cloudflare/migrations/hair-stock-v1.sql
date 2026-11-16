-- Mamta Care Hair Stock v1. Additive only; do not alter existing donors, logins, collection, certificate or courier tables.
-- Physical custody is independent from public donor follow-up status.
CREATE TABLE IF NOT EXISTS mcst_lots (
 donor_id TEXT PRIMARY KEY REFERENCES donors(id),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('staff','volunteer')),
 source_ref TEXT NOT NULL,
 origin_id TEXT NOT NULL,
 holder_kind TEXT NOT NULL CHECK(holder_kind IN ('staff','volunteer','maker','center','transit')),
 holder_id TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'held' CHECK(stage IN ('held','reserved','transit','legacy_in_transit','center')),
 lock_transfer TEXT NOT NULL DEFAULT '',
 braids INTEGER NOT NULL DEFAULT 1 CHECK(braids BETWEEN 1 AND 100),
 weight_grams INTEGER DEFAULT NULL CHECK(weight_grams IS NULL OR (weight_grams BETWEEN 1 AND 100000)),
 length_cm INTEGER DEFAULT NULL CHECK(length_cm IS NULL OR (length_cm BETWEEN 1 AND 200)),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS mcst_lots_holder ON mcst_lots(holder_kind,holder_id,stage);
CREATE INDEX IF NOT EXISTS mcst_lots_lock ON mcst_lots(lock_transfer,stage);
CREATE UNIQUE INDEX IF NOT EXISTS mcst_lots_source ON mcst_lots(source_kind,source_ref);

CREATE TABLE IF NOT EXISTS mcst_transfers (
 id TEXT PRIMARY KEY,
 from_kind TEXT NOT NULL CHECK(from_kind IN ('staff','volunteer','maker')),
 from_id TEXT NOT NULL,
 to_kind TEXT NOT NULL CHECK(to_kind IN ('staff','volunteer','maker','center')),
 to_id TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('pending','approved','rejected','received','received_difference')),
 dispatch_weight_grams INTEGER DEFAULT NULL CHECK(dispatch_weight_grams IS NULL OR dispatch_weight_grams BETWEEN 1 AND 10000000),
 receipt_weight_grams INTEGER DEFAULT NULL CHECK(receipt_weight_grams IS NULL OR receipt_weight_grams BETWEEN 1 AND 10000000),
 note TEXT NOT NULL DEFAULT '',
 receive_note TEXT NOT NULL DEFAULT '',
 approved_by TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 approved_at INTEGER NOT NULL DEFAULT 0,
 received_at INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mcst_transfer_to ON mcst_transfers(to_kind,to_id,stage,created_at);
CREATE INDEX IF NOT EXISTS mcst_transfer_from ON mcst_transfers(from_kind,from_id,stage,created_at);
CREATE INDEX IF NOT EXISTS mcst_transfer_admin ON mcst_transfers(stage,created_at);

CREATE TABLE IF NOT EXISTS mcst_transfer_items (
 transfer_id TEXT NOT NULL REFERENCES mcst_transfers(id),
 donor_id TEXT NOT NULL REFERENCES mcst_lots(donor_id),
 PRIMARY KEY(transfer_id,donor_id)
);
CREATE INDEX IF NOT EXISTS mcst_items_lot ON mcst_transfer_items(donor_id,transfer_id);

CREATE TABLE IF NOT EXISTS mcst_events (
 id TEXT PRIMARY KEY,
 transfer_id TEXT NOT NULL REFERENCES mcst_transfers(id),
 actor_kind TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mcst_events_transfer ON mcst_events(transfer_id,created_at);

CREATE TABLE IF NOT EXISTS mcst_admin_alerts (
 id TEXT PRIMARY KEY,
 transfer_id TEXT NOT NULL REFERENCES mcst_transfers(id),
 alert_type TEXT NOT NULL CHECK(alert_type IN ('sent','received_difference')),
 created_at INTEGER NOT NULL,
 read_at INTEGER NOT NULL DEFAULT 0,
 UNIQUE(transfer_id,alert_type)
);
CREATE INDEX IF NOT EXISTS mcst_alerts_unread ON mcst_admin_alerts(read_at,created_at);
