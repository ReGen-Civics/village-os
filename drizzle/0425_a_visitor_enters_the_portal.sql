-- 0425: a visitor enters the portal (the lead, 24 Nov 2026, from a team member's feedback, and the
-- gate design the lead confirmed that evening).
--
-- THE CONTRACT IS shared/entrance.ts; the SQL is server/repos/portalEntries.ts and
-- server/repos/portalViews.ts, and the routes sit in server/routes/entrance.ts.
--
-- `portal_entries`, one row each time a signed-out visitor passes the entrance:
--   id             `pe-` and 20 hex characters; the signed cookie carries this id
--   name           the name the visitor typed
--   email          the address the visitor typed, as typed (trimmed)
--   email_key      the same address trimmed and lowercased, for finding one person's rows
--   whatsapp       an optional WhatsApp number, or NULL
--   link           an optional website or social link, or NULL
--   interest       what they chose under "What draws you here?", or NULL (shared/entrance.ts INTERESTS)
--   updates        their answer to "Do you want us to keep you updated...": `yes`, `no`, or NULL while
--                  unanswered. Only a `yes` ever reaches a list.
--   consent_words  the privacy words the visitor saw when they entered, kept as evidence
--   updates_words  the question they answered, as they saw it, or NULL while unanswered
--   next_path      the page they were trying to reach when the entrance caught them, or NULL
--   locale         the site language they were reading, or NULL
--   human          how the human check was passed: `turnstile`, `fallback` or `smoke`
--   is_test        1 for a release smoke test's entry, which no list ever shows
--   synced_at      when a `yes` reached the village's email list (Brevo), or NULL
--   sync_error     the last reason it did not, short, or NULL
--   created_at     when they entered, written from Node's clock
--
-- `portal_views`, the pages an entered visitor opened, first-party and never for members:
--   id             `pv-` and 20 hex characters
--   entry_id       the entry the visitor's cookie carries
--   path           the page's path, without its query
--   role_slug      the role's address when the page was a role, or NULL
--   at             when, from Node's clock
--
-- PRIVATE. Read only by Admin, Portal visitors, behind the one capability gate. Never shown to members,
-- never sent anywhere but the village's own email list on a `yes`, never emailed by the platform.
--
-- EXPAND ONLY. Two new tables the previous release never reads.
CREATE TABLE IF NOT EXISTS `portal_entries` (
  `id` varchar(32) NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(320) NOT NULL,
  `email_key` varchar(320) NOT NULL,
  `whatsapp` varchar(40) NULL,
  `link` varchar(500) NULL,
  `interest` varchar(32) NULL,
  `updates` varchar(8) NULL,
  `consent_words` text NOT NULL,
  `updates_words` text NULL,
  `next_path` varchar(500) NULL,
  `locale` varchar(16) NULL,
  `human` varchar(16) NOT NULL,
  `is_test` tinyint(1) NOT NULL DEFAULT 0,
  `synced_at` timestamp(3) NULL,
  `sync_error` varchar(300) NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `portal_entries_email` (`email_key`(191)),
  KEY `portal_entries_created` (`created_at`)
);
CREATE TABLE IF NOT EXISTS `portal_views` (
  `id` varchar(32) NOT NULL,
  `entry_id` varchar(32) NOT NULL,
  `path` varchar(500) NOT NULL,
  `role_slug` varchar(200) NULL,
  `at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `portal_views_entry` (`entry_id`, `at`),
  KEY `portal_views_at` (`at`)
);
