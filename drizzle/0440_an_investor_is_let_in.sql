-- 0440: who may read the investor page (the lead, 27 Nov 2026: "gate keep this page for now and
-- only those we accept should be able to see it and get the 'investor' tag").
--
-- THE CONTRACT IS shared/investorInterest.ts; the SQL is server/repos/investorAccess.ts, and the
-- routes sit in server/routes/investorAccess.ts.
--
-- A person asks through the investor interest form; the answer is a row in `submissions` (type
-- `investor-interest`). Accepting that row in Admin writes one row here, and the investor page,
-- its summary and its packet open for whoever the row names. Declining writes nothing.
--
-- `investor_access`, one row per person let in:
--   access_key     `user:<account id>`, or `visitor:<sha256 of the address>` for a visitor whose
--                  address the entrance proved (its code, or Google), computed in TypeScript. NOT
--                  NULL and the key, so a person holds one row however often they are accepted.
--   user_id        the account, or NULL for a visitor
--   email_key      the proven address, trimmed and lowercased as on `portal_entries`, or NULL
--   submission_id  the interest answer that was accepted, or NULL
--   granted_by     the account id of whoever accepted it, or NULL
--   granted_at     when, from Node's clock
--
-- PRIVATE. Read by the investor routes and by whoever holds `intake.moderate` in Admin.
--
-- EXPAND ONLY. A new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `investor_access` (
  `access_key` varchar(80) NOT NULL,
  `user_id` varchar(64) NULL,
  `email_key` varchar(320) NULL,
  `submission_id` varchar(64) NULL,
  `granted_by` varchar(64) NULL,
  `granted_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`access_key`),
  KEY `investor_access_user` (`user_id`)
);
