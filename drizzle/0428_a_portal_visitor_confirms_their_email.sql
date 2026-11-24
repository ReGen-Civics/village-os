-- 0428: a portal visitor confirms their email with a 6-digit code (the lead, 24 Nov 2026: "a short
-- look, then the code").
--
-- THE CONTRACT IS shared/entrance.ts; the SQL is server/repos/portalEntries.ts and
-- server/repos/portalCodes.ts, and the routes sit in server/routes/entrance.ts.
--
-- On `portal_entries`, three new columns:
--   code_required  1 when the entry was made while the village could send email, so its visitor has
--                  a short look and then needs the code; 0 for an entry made without a mail provider,
--                  a release smoke's entry, or one made from Google (already verified)
--   user_id        the account this address already had, when there was one, or NULL
--   verified_at    when the visitor proved they read the address (the code, or Google), or NULL
--
-- `portal_codes`, one row per code sent:
--   id          `pc-` and 20 hex characters
--   entry_id    the entry the code confirms
--   user_id     the existing account a correct code signs into, or NULL
--   email_key   the address it went to, trimmed and lowercased, for the per-address limits
--   code_hash   HMAC-SHA256 of the code under the server's secret, hex; the code itself is never kept
--   expires_at  15 minutes after it was sent
--   attempts    wrong tries so far; 5 spends it
--   used_at     when a correct code was taken, or NULL; a used code never works again
--   created_at  when it was sent, from Node's clock
--
-- PRIVATE, read only by the entrance's own routes. EXPAND ONLY: three new columns the previous
-- release never names (it writes portal_entries with an INSERT that names its own columns, so the
-- DEFAULT applies), and a new table.
ALTER TABLE `portal_entries`
  ADD COLUMN `code_required` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `user_id` varchar(64) NULL,
  ADD COLUMN `verified_at` timestamp(3) NULL;
CREATE TABLE IF NOT EXISTS `portal_codes` (
  `id` varchar(32) NOT NULL,
  `entry_id` varchar(32) NOT NULL,
  `user_id` varchar(64) NULL,
  `email_key` varchar(320) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `expires_at` timestamp(3) NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `used_at` timestamp(3) NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `portal_codes_entry` (`entry_id`, `created_at`),
  KEY `portal_codes_email` (`email_key`(191), `created_at`)
);
