-- Additive staged payment-link table. Apply only after release review.
CREATE TABLE IF NOT EXISTS mcwig_beneficiary_payment_link_v1 (
 agreement_id TEXT PRIMARY KEY REFERENCES mcwig_beneficiary_agreement_v1(id),
 token_hash TEXT NOT NULL UNIQUE,
 destination_digest TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount BETWEEN 0 AND 10000),
 expires_at INTEGER NOT NULL
);
