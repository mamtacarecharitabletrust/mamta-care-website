-- Mamta Care public donor tracking — privacy-preserving rate limit.
-- Never changes existing donor, receipt, certificate, or Google Sheets tables.
CREATE TABLE IF NOT EXISTS mcct_public_tracking_rate (
  bucket TEXT PRIMARY KEY NOT NULL,
  hour_utc INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 20),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcct_tracking_rate_hour ON mcct_public_tracking_rate(hour_utc);
