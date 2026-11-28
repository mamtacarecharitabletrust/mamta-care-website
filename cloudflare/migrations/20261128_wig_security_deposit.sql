-- Additive only. Apply first to a disposable/staging database.
CREATE TABLE IF NOT EXISTS mcwig_deposit_v1 (
 case_id TEXT PRIMARY KEY,
 state TEXT NOT NULL CHECK(state IN ('AWAITING_PAYMENT','PAID','WAIVED','WITH_PATIENT','RETURNED','INSPECTED','REFUND_APPROVED','REFUNDED','RETENTION_REVIEW','RETAINED')),
 revision INTEGER NOT NULL DEFAULT 1,
 policy_version TEXT NOT NULL,
 accepted_at TEXT NOT NULL,
 accepted_evidence TEXT NOT NULL,
 actor TEXT NOT NULL,
 amount INTEGER NOT NULL DEFAULT 0 CHECK(amount IN (0,10000)),
 payment_utr TEXT UNIQUE,
 payment_date TEXT,
 receipt_no TEXT UNIQUE,
 delivery_date TEXT,
 deadline TEXT,
 return_requested_date TEXT,
 returned_date TEXT,
 inspection_note TEXT,
 damage_cost INTEGER NOT NULL DEFAULT 0 CHECK(damage_cost BETWEEN 0 AND 8000),
 refund_amount INTEGER CHECK(refund_amount BETWEEN 0 AND 8000),
 refund_utr TEXT UNIQUE,
 refund_date TEXT,
 extension_reason TEXT,
 settlement_note TEXT,
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS mcwig_deposit_v1_state_deadline ON mcwig_deposit_v1(state,deadline);
CREATE TABLE IF NOT EXISTS mcwig_deposit_audit_v1 (
 id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, revision INTEGER NOT NULL,
 state TEXT NOT NULL, actor TEXT NOT NULL, snapshot TEXT NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(case_id,revision)
);
CREATE TABLE IF NOT EXISTS mcwig_deposit_mail_v1 (
 id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, kind TEXT NOT NULL,
 revision INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'HOLD' CHECK(state IN ('HOLD','PENDING','PROCESSING','DONE','FAILED')),
 created_at INTEGER NOT NULL, UNIQUE(case_id,revision,kind)
);
CREATE TRIGGER IF NOT EXISTS mcwig_deposit_insert_audit AFTER INSERT ON mcwig_deposit_v1 BEGIN
 INSERT INTO mcwig_deposit_audit_v1(case_id,revision,state,actor,snapshot,created_at) VALUES(new.case_id,new.revision,new.state,new.actor,json_object('policy',new.policy_version,'accepted_at',new.accepted_at,'evidence',new.accepted_evidence),new.updated_at);
 INSERT INTO mcwig_deposit_mail_v1(case_id,kind,revision,created_at) VALUES(new.case_id,'DEPOSIT_REQUEST',new.revision,new.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS mcwig_deposit_update_audit AFTER UPDATE ON mcwig_deposit_v1 BEGIN
 INSERT INTO mcwig_deposit_audit_v1(case_id,revision,state,actor,snapshot,created_at) VALUES(new.case_id,new.revision,new.state,new.actor,json_object('amount',new.amount,'payment_utr',new.payment_utr,'payment_date',new.payment_date,'receipt',new.receipt_no,'delivery',new.delivery_date,'deadline',new.deadline,'return_requested',new.return_requested_date,'returned',new.returned_date,'inspection',new.inspection_note,'damage_cost',new.damage_cost,'refund_amount',new.refund_amount,'refund_utr',new.refund_utr,'refund_date',new.refund_date,'extension_reason',new.extension_reason,'settlement',new.settlement_note),new.updated_at);
 INSERT INTO mcwig_deposit_mail_v1(case_id,kind,revision,created_at)
 SELECT new.case_id,CASE WHEN new.state='PAID' THEN 'PAYMENT_RECEIVED' WHEN new.state='WAIVED' THEN 'WAIVER_CONFIRMED' WHEN new.state='WITH_PATIENT' AND old.state<>new.state THEN 'DELIVERY_CONFIRMED' WHEN new.state='WITH_PATIENT' AND new.deadline<>old.deadline THEN 'EXTENSION_CONFIRMED' WHEN new.state='RETURNED' THEN 'RETURN_RECEIVED' WHEN new.state='REFUNDED' THEN 'REFUND_CONFIRMED' WHEN new.state='RETAINED' THEN 'RETENTION_SETTLEMENT' END,new.revision,new.updated_at
 WHERE (new.state<>old.state AND new.state IN ('PAID','WAIVED','WITH_PATIENT','RETURNED','REFUNDED','RETAINED')) OR (new.state='WITH_PATIENT' AND new.deadline<>old.deadline);
END;
