-- 0412: a shortlisted applicant names references, and each reference has a follow-up owner.
--
-- THE CONTRACT IS shared/applicantOnboarding.ts; the SQL is
-- server/repos/applicantOnboarding.ts and the work server/lib/applicantOnboarding.ts.
-- The shortlist, the request for references and their arrival are steps in
-- `application_steps` (0364), so they need no table here.
--
-- `application_references`, one row per reference an applicant gave:
--   application_ref   the application's own id (op-... or sa-...), no foreign key
--   position          1, 2, 3 in the order the applicant gave them
--   name, contact     who they are and how to reach them (an email or a phone)
--   how_known         how they know the applicant
--   why_ally          why they might be an ally or partner of the village, or ''
--   owner_role_id     the role that follows up, '' for none; defaults at arrival
--                     to the village's setting `org.reference_followup_role`
--   owner_user_id     a member the team picked instead, or NULL
--   notes             the owner's follow-up notes
--   followed_up_at    when the owner said the follow-up is done
--
-- PRIVATE. Personal data of people who never signed up. Read only by the
-- reviewers, the role that makes the final call and the reference's owner
-- (`mayReadReference`). No model reads it
-- (server/lib/applicationReview.refusal.test.ts). Deleted with the application's
-- review (`clearReviewOf`), when the proposal is anonymised and when the member
-- who wrote notes is erased.
--
-- EXPAND ONLY. One new table the previous release never reads. The UNIQUE key
-- sits on the table this file creates, so no existing row can break it, and its
-- columns are NOT NULL. No foreign key, no ALTER. Instants are timestamp(3),
-- written from Node's clock and read back with UNIX_TIMESTAMP.
CREATE TABLE IF NOT EXISTS `application_references` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_ref` varchar(64) NOT NULL,
  `position` int NOT NULL,
  `name` varchar(80) NOT NULL,
  `contact` varchar(120) NOT NULL,
  `how_known` varchar(300) NOT NULL,
  `why_ally` varchar(400) NOT NULL DEFAULT '',
  `owner_role_id` varchar(64) NOT NULL DEFAULT '',
  `owner_user_id` varchar(64) NULL,
  `notes` text NULL,
  `notes_by` varchar(64) NULL,
  `notes_at` timestamp(3) NULL,
  `followed_up_at` timestamp(3) NULL,
  `added_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_references_once` (`application_ref`, `position`),
  KEY `application_references_owner_user` (`owner_user_id`),
  KEY `application_references_owner_role` (`owner_role_id`)
) ENGINE=InnoDB;
