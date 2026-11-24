-- 0423: an application can be saved to finish later (the lead, 24 Nov 2026, from an applicant reviewer's feedback).
--
-- THE CONTRACT IS shared/applicationDrafts.ts; the SQL is server/repos/applicationDrafts.ts
-- and the routes sit in server/routes/applicationDrafts.ts.
--
-- `application_drafts`, one row per unsent application saved with "Save and finish later":
--   id           `ad-` and 20 hex characters; the draft's files live in a folder of this name
--   token_hash   SHA-256 of the private resume token, hex; the token itself is never stored
--   role_id      the role the application is for
--   link         the personal link the form was opened with, or NULL
--   email        the address the applicant typed, or NULL while none is typed
--   emailed_to   the address the resume link was last emailed to, or NULL
--   body         the answers, as JSON
--   files        the kept files' references, as a JSON list
--   step         the step they stopped on
--   created_at   when it was first saved, written from Node's clock
--   updated_at   when it was last saved; the cleanup job deletes a draft 30 days after this
--
-- PRIVATE. An unsent draft is never shown to the team and never counted as an application:
-- nothing outside the draft routes reads this table.
--
-- EXPAND ONLY. One new table the previous release never reads. The UNIQUE key is on a new
-- table, so no existing row can break it.
CREATE TABLE IF NOT EXISTS `application_drafts` (
  `id` varchar(32) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `role_id` varchar(128) NOT NULL,
  `link` varchar(200) NULL,
  `email` varchar(320) NULL,
  `emailed_to` varchar(320) NULL,
  `body` mediumtext NOT NULL,
  `files` text NOT NULL,
  `step` int NOT NULL DEFAULT 0,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_drafts_token` (`token_hash`),
  KEY `application_drafts_updated` (`updated_at`)
);
