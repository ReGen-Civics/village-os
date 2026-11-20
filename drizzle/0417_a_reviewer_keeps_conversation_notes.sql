-- 0417: a reviewer keeps notes against the role's selection criteria (the lead, 20 Nov 2026, idea 23).
--
-- THE CONTRACT IS shared/conversationGuide.ts; the SQL is server/repos/applicationGuide.ts and the
-- door is server/routes/applicantOnboarding.ts.
--
-- `application_guide_notes`, one row per reviewer, criterion and application:
--   application_ref  the application's ref, an open proposal's id
--   item_key         which line of the guide: `c:<criterion id>` or `q:<n>` for a quality
--   author_user_id   the reviewer or final-call holder who wrote it
--   note             their words, a few lines
--   updated_at       when, written from Node's clock
--
-- NOTES ONLY. There is no score, rank, level or rating column and there never will be one here: a
-- criterion is a conversation prompt. Read by the reviewers and the final-call role (not the
-- applicant, not a recused reviewer), read by no model, deleted with the application's review
-- (`clearReviewOf`) and with the member who wrote them (`forgetMemberReview`).
--
-- EXPAND ONLY. One new table the previous release never reads. The UNIQUE key sits on the table
-- this file creates, so no existing row can break it, and its columns are NOT NULL. No foreign key,
-- no ALTER.
CREATE TABLE IF NOT EXISTS `application_guide_notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_ref` varchar(64) NOT NULL,
  `item_key` varchar(64) NOT NULL,
  `author_user_id` varchar(64) NOT NULL,
  `note` text NOT NULL,
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_guide_notes_once` (`application_ref`, `item_key`, `author_user_id`),
  KEY `application_guide_notes_author` (`author_user_id`)
) ENGINE=InnoDB;
