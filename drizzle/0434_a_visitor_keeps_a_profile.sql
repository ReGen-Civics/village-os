-- 0434: a portal visitor keeps a profile, signs back in, and may ask to become a member (the lead,
-- 25 Nov 2026, after a visitor who applied for a role could not get back in).
--
-- THE CONTRACT IS shared/visitorProfile.ts; the SQL is server/repos/portalVisitors.ts, and the
-- routes sit in server/routes/visitorProfile.ts.
--
-- A visitor is NOT an account: the platform's own accounts are members and those joining by
-- invitation. A visitor is the person behind a verified address on `portal_entries` (0425, 0428),
-- signed in by the entry cookie the entrance already sets. This table holds the little a visitor
-- has beyond their entries: whether they asked for an invitation, and what became of it.
--
-- `portal_visitors`, one row per verified address that asked for something:
--   id               `pvp-` and 20 hex characters
--   email_key        the address, trimmed and lowercased, as on `portal_entries`
--   invite_status    `requested`, `declined` or `promoted`, or NULL when they never asked
--   invite_note      the few words they wrote with the request, or NULL
--   requested_at     when they last asked
--   decided_at       when the request was answered
--   decided_by       the account id of whoever answered it
--   decline_words    the words they read on their profile when it was declined, or NULL
--   promoted_user_id the member account the promotion made or admitted
--   created_at       when the row was first written, from Node's clock
--
-- PRIVATE. Read by the visitor themselves and by whoever holds `intake.moderate` in Admin. Removed
-- with every entry when the visitor deletes their data or asks to be forgotten.
--
-- EXPAND ONLY. A new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `portal_visitors` (
  `id` varchar(32) NOT NULL,
  `email_key` varchar(320) NOT NULL,
  `invite_status` varchar(16) NULL,
  `invite_note` text NULL,
  `requested_at` timestamp(3) NULL,
  `decided_at` timestamp(3) NULL,
  `decided_by` varchar(64) NULL,
  `decline_words` text NULL,
  `promoted_user_id` varchar(64) NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `portal_visitors_email` (`email_key`(191)),
  KEY `portal_visitors_status` (`invite_status`, `requested_at`)
);
