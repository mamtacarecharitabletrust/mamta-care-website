-- Mamta Care verified donor email relay audit, strictly additive.
-- Never changes official registration IDs, certificates, existing Google Sheet or donor history.
CREATE TABLE IF NOT EXISTS mcct_notification_dispatch_events (
 id TEXT PRIMARY KEY NOT NULL,
 outbox_id TEXT NOT NULL REFERENCES mcct_ops_notification_outbox(id),
 event_state TEXT NOT NULL CHECK(event_state IN ('RESERVED','PROVIDER_ACCEPTED','UNCERTAIN','RECONCILED','DISABLED')),
 actor TEXT NOT NULL DEFAULT 'mailapp_relay',
 detail TEXT NOT NULL DEFAULT '',
 happened_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcct_dispatch_outbox_date ON mcct_notification_dispatch_events(outbox_id,happened_at);
