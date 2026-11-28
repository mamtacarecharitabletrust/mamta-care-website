-- Staged only: separate patient agreement lifecycle; never modify staff records.
CREATE TABLE IF NOT EXISTS mcwig_beneficiary_agreement_v1 (
 id TEXT PRIMARY KEY,
 case_id TEXT NOT NULL REFERENCES mcwig_cases_v1(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 reference TEXT NOT NULL UNIQUE,
 policy_version TEXT NOT NULL,
 snapshot_json TEXT NOT NULL,
 document_key TEXT NOT NULL,
 document_digest TEXT NOT NULL,
 deposit INTEGER NOT NULL CHECK(deposit BETWEEN 0 AND 8000),
 expenses INTEGER NOT NULL CHECK(expenses BETWEEN 0 AND 2000),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','AWAITING_ACCEPTANCE','ACCEPTED','AWAITING_PAYMENT','PAID','WAIVED','SUPERSEDED')),
 created_by TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 sent_at INTEGER,
 accepted_at INTEGER,
 acceptance_reference TEXT UNIQUE,
 accepted_document_key TEXT,
 payment_email_sent_at INTEGER,
 UNIQUE(case_id,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS mcwig_one_current_agreement ON mcwig_beneficiary_agreement_v1(case_id) WHERE status!='SUPERSEDED';
CREATE TABLE IF NOT EXISTS mcwig_beneficiary_challenge_v1 (
 agreement_id TEXT PRIMARY KEY REFERENCES mcwig_beneficiary_agreement_v1(id),
 token_hash TEXT NOT NULL UNIQUE,
 otp_hash TEXT NOT NULL,
 otp_salt TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS mcwig_beneficiary_mail_v1 (
 message_id TEXT PRIMARY KEY,
 agreement_id TEXT NOT NULL REFERENCES mcwig_beneficiary_agreement_v1(id),
 kind TEXT NOT NULL CHECK(kind IN ('AGREEMENT','PAYMENT')),
 state TEXT NOT NULL CHECK(state IN ('HOLD','READY','PROCESSING','SENT','UNKNOWN','FAILED')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(agreement_id,kind)
);
CREATE TRIGGER IF NOT EXISTS mcwig_payment_mail_after_acceptance_v1
BEFORE INSERT ON mcwig_beneficiary_mail_v1
WHEN NEW.kind='PAYMENT' AND NOT EXISTS (
 SELECT 1 FROM mcwig_beneficiary_agreement_v1
 WHERE id=NEW.agreement_id AND accepted_at IS NOT NULL AND acceptance_reference IS NOT NULL AND status IN ('ACCEPTED','AWAITING_PAYMENT','PAID','WAIVED')
)
BEGIN SELECT RAISE(ABORT,'Verified acceptance required'); END;
CREATE TRIGGER IF NOT EXISTS mcwig_payment_mail_update_after_acceptance_v1
BEFORE UPDATE OF state ON mcwig_beneficiary_mail_v1
WHEN NEW.kind='PAYMENT' AND NEW.state IN ('READY','PROCESSING','SENT') AND NOT EXISTS (
 SELECT 1 FROM mcwig_beneficiary_agreement_v1 WHERE id=NEW.agreement_id AND accepted_at IS NOT NULL AND acceptance_reference IS NOT NULL AND status IN ('ACCEPTED','AWAITING_PAYMENT','PAID','WAIVED')
)
BEGIN SELECT RAISE(ABORT,'Verified acceptance required'); END;
