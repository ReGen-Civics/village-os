-- 0439: each step of a quest can take its own submission (the lead, 27 Nov 2026: "Yes to submit data
-- (pictures docs text etc) for each step if needed").
--
-- `quests.step_needs` says which steps need one: a JSON list of booleans in the order of `steps`,
-- NULL for a quest whose steps need none, which behaves exactly as before. It has its own write
-- (PUT /api/admin/quests/:id/step-needs), so the quest's save path is unchanged.
--
-- `quest_step_submissions` holds what a member gave for one step of one claim: words, a photo or a
-- document. A file is stored on the uploads volume through the strip (server/lib/uploads.ts) and
-- only its name is kept here. `user_id` is kept beside `claim_id` so the erasure sweep can find a
-- member's rows in one read.
--
-- Expand only: one nullable column and one new table. The previous release names its own columns on
-- every quest INSERT and never reads either.
ALTER TABLE `quests` ADD COLUMN `step_needs` json NULL;

CREATE TABLE IF NOT EXISTS `quest_step_submissions` (
  `id` varchar(64) NOT NULL,
  `claim_id` varchar(64) NOT NULL,
  `quest_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `step_index` int NOT NULL,
  `kind` varchar(16) NOT NULL,
  `body` text NULL,
  `file_name` varchar(255) NULL,
  `original_name` varchar(255) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `quest_step_submissions_claim_idx` (`claim_id`, `step_index`),
  KEY `quest_step_submissions_user_idx` (`user_id`)
);
