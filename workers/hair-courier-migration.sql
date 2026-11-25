CREATE TABLE IF NOT EXISTS mc_hair_courier_requests (
 id TEXT PRIMARY KEY, donor_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'draft'
 CHECK(state IN ('draft','pending','approved','changes_requested')),
 carrier TEXT NOT NULL DEFAULT '', awb TEXT NOT NULL DEFAULT '', dispatch_date TEXT NOT NULL DEFAULT '',
 hair TEXT, parcel TEXT, video TEXT, reviewer TEXT, reason TEXT, reviewed_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()), submitted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS mc_hair_courier_one ON mc_hair_courier_requests(donor_id)
 WHERE state IN ('draft','pending','approved');
CREATE INDEX IF NOT EXISTS mc_hair_courier_queue ON mc_hair_courier_requests(state,submitted_at);
CREATE TABLE IF NOT EXISTS mc_hair_courier_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS mc_hair_courier_expiry ON mc_hair_courier_limits(expires);
CREATE TRIGGER IF NOT EXISTS mc_hair_courier_review BEFORE UPDATE OF state ON mc_hair_courier_requests
WHEN NEW.state='approved' AND OLD.state='pending'
BEGIN
 SELECT CASE WHEN EXISTS (SELECT 1 FROM mc_donor_recycle WHERE donor_id=NEW.donor_id)
 OR NOT EXISTS(SELECT 1 FROM donors WHERE id=NEW.donor_id AND trim(coalesce(registration_id,''))!='')
 OR EXISTS(SELECT 1 FROM mcq_donor_couriers WHERE donor_id=NEW.donor_id OR (carrier=NEW.carrier AND awb=NEW.awb))
 OR EXISTS(SELECT 1 FROM mcct_parcel_receipts WHERE donor_id=NEW.donor_id)
 OR EXISTS(SELECT 1 FROM mcct_staff_hand_collections WHERE donor_id=NEW.donor_id)
 OR EXISTS(SELECT 1 FROM mcct_hand_collections h WHERE h.donor_id=NEW.donor_id AND NOT EXISTS(SELECT 1 FROM mcct_hand_collection_cancellations c WHERE c.handover_id=h.id))
 THEN RAISE(ABORT,'shipment_conflict') END;
 INSERT INTO mcq_donor_couriers(donor_id,carrier,awb,dispatch_date,status,note,created_by,updated_by,updated_at,version)
 VALUES(NEW.donor_id,NEW.carrier,NEW.awb,NEW.dispatch_date,'in_transit','Donor-submitted hair dispatch approved in Donor Desk',NEW.reviewer,NEW.reviewer,NEW.reviewed_at,1);
 INSERT INTO mcq_certificate_sync_outbox(donor_id,registration_id,courier_version,carrier,awb,dispatch_date,status,updated_at,updated_by,sync_state)
 SELECT NEW.donor_id,upper(trim(registration_id)),1,NEW.carrier,NEW.awb,NEW.dispatch_date,'in_transit',NEW.reviewed_at,NEW.reviewer,'PENDING' FROM donors WHERE id=NEW.donor_id
 ON CONFLICT(donor_id) DO UPDATE SET registration_id=excluded.registration_id,courier_version=1,carrier=excluded.carrier,awb=excluded.awb,dispatch_date=excluded.dispatch_date,status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by,sync_state='PENDING',attempts=0,last_error='',last_attempt_at=0,synced_at=0,tracking_row=0,certificate_row=0;
END;