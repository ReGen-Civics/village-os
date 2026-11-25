-- 0430: a member may hold more than one email address (the lead, 24 Nov 2026).
--
-- A member who signed up with a personal address and later gets a village address keeps
-- one account and attaches the second. THE CONTRACT IS shared/memberEmails.ts; the SQL is
-- server/repos/memberEmails.ts and the routes sit in server/routes/memberEmails.ts.
--
-- `member_emails`, one row per EXTRA address, each one proved by a code mailed to it:
--   email        the address, trimmed and lower-cased; one account only, across the village
--   user_id      the account it belongs to
--   verified_at  when the code mailed to it was entered; no row exists before that
--   gets_mail    1 for the one extra address the member's mail goes to when they choose
--                "the other address" or "both"; 0 for the rest
--   created_at   when the row was written
--
-- `users.email` STAYS THE MAIN ADDRESS, so every reader that knows only that column keeps
-- working. `users.email_delivery` is where the member's mail goes: NULL or 'main' for the
-- main address only (today's behaviour), 'other' for the extra address marked gets_mail,
-- 'both' for the two of them.
--
-- EXPAND ONLY. One new table the previous release never reads, and one new nullable column
-- the previous release never names. The UNIQUE key is on the new table, so no existing row
-- can break it, and its column is NOT NULL because a UNIQUE index lets NULLs repeat.
CREATE TABLE IF NOT EXISTS `member_emails` (
  `email` varchar(320) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `verified_at` timestamp(3) NOT NULL,
  `gets_mail` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`email`),
  KEY `member_emails_user` (`user_id`)
);
ALTER TABLE `users` ADD COLUMN `email_delivery` varchar(16) NULL;
