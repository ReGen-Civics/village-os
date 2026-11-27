-- 0444: each conversation of an application keeps its own private notes and files (the lead, 27 Nov 2026).
--
-- THE CONTRACT IS shared/conversationNotes.ts; the SQL is server/repos/applicationConversationNotes.ts and
-- the doors are server/routes/applicantOnboarding.ts.
--
-- `application_conversation_notes`, one row per note or file:
--   application_ref  the application's ref
--   interview_id     the conversation it belongs to (`application_interviews.id`)
--   author_user_id   the interviewer who added it
--   kind             text, transcript, recording or file
--   body             the words of a written note, else NULL
--   file_name        the stored file's name in the private notes folder, else NULL
--   original_name    the file's name as it was sent, else NULL
--   created_at       when, written from Node's clock
--
-- NOTES ONLY. No score, rank, level or rating column. Never shown to the applicant, read by no model,
-- deleted with the application's review (`clearReviewOf`) and with the member who wrote them
-- (`forgetMemberReview`).
--
-- EXPAND ONLY. One new table the previous release never reads. No UNIQUE key, no foreign key, no ALTER.
CREATE TABLE IF NOT EXISTS `application_conversation_notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_ref` varchar(64) NOT NULL,
  `interview_id` bigint NOT NULL,
  `author_user_id` varchar(64) NOT NULL,
  `kind` varchar(16) NOT NULL,
  `body` mediumtext NULL,
  `file_name` varchar(120) NULL,
  `original_name` varchar(255) NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `application_conversation_notes_ref` (`application_ref`, `interview_id`),
  KEY `application_conversation_notes_author` (`author_user_id`)
) ENGINE=InnoDB;
