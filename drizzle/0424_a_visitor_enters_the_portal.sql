-- 0424: a visitor enters the portal (the lead, 24 Nov 2026, from a team member's feedback).
--
-- THE CONTRACT IS shared/entrance.ts; the SQL is server/repos/portalEntries.ts and the
-- routes sit in server/routes/entrance.ts.
--
-- `portal_entries`, one row each time a signed-out visitor passes the entrance:
--   id             `pe-` and 20 hex characters; the signed cookie carries this id
--   name           the name the visitor typed
--   email          the address the visitor typed, as typed (trimmed)
--   email_key      the same address trimmed and lowercased, for finding one person's rows
--   whatsapp       an optional WhatsApp number, or NULL
--   link           an optional website or social link, or NULL
--   updates        1 when the visitor ticked "send me updates", else 0; unticked by default
--   consent_words  the privacy words the visitor saw when they entered, kept as evidence
--   next_path      the page they were going to, or NULL
--   locale         the site language they were reading, or NULL
--   human          how the human check was passed: `turnstile`, `fallback` or `smoke`
--   is_test        1 for a release smoke test's entry, which no list ever shows
--   created_at     when they entered, written from Node's clock
--
-- PRIVATE. Read only by the admin list and its CSV (server/routes/entrance.ts), behind the
-- one capability gate. Never shown to members, never sent anywhere, never emailed.
--
-- EXPAND ONLY. One new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `portal_entries` (
  `id` varchar(32) NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(320) NOT NULL,
  `email_key` varchar(320) NOT NULL,
  `whatsapp` varchar(40) NULL,
  `link` varchar(500) NULL,
  `updates` tinyint(1) NOT NULL DEFAULT 0,
  `consent_words` text NOT NULL,
  `next_path` varchar(500) NULL,
  `locale` varchar(16) NULL,
  `human` varchar(16) NOT NULL,
  `is_test` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `portal_entries_email` (`email_key`(191)),
  KEY `portal_entries_created` (`created_at`)
);
