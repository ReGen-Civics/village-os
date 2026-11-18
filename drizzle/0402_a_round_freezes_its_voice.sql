-- 0402: Funding rounds, S4. The counted-Voice guardrails.
--
-- Work-only Voice (Rye, 2026-11-08, relayed by the master coordinator): a
-- pot's choose step counts only Voice earned through work. Voice from
-- donations, investment or backing never weighs a pot ballot.
--
-- The snapshot: each member's counted Voice is read ONCE, when choosing
-- opens, and written here. The harvest count reads these rows, never live
-- balances, so Voice earned or bought while the round is choosing cannot
-- move it. One row per member on the voting roll at that moment, a member
-- holding no work Voice included at zero, so the people's count and the
-- quorum read the same roll.
--
-- The divergence vote: when the two counts fund different quests, the
-- quests they disagree on are held back and a 48-hour village vote decides
-- them through the ordinary ballot engine. The ballot id, how it was settled
-- and when are kept on the round.
--
-- New table and nullable columns only, so the previous release ignores
-- them. Raw SQL through server/repos/fundingRounds.ts, and every INSERT
-- names every column it writes.

CREATE TABLE IF NOT EXISTS `funding_round_voice` (
  `round_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  -- Counted Voice in Voice's minor units (2 decimals), before any cap.
  `voice` bigint NOT NULL,
  PRIMARY KEY (`round_id`, `user_id`),
  KEY `funding_round_voice_user_idx` (`user_id`)
);

ALTER TABLE `funding_rounds`
  ADD COLUMN `voice_frozen_at` datetime NULL,
  ADD COLUMN `voice_unclassified` json NULL,
  ADD COLUMN `divergence_ballot_id` varchar(64) NULL,
  ADD COLUMN `divergence_result` enum('decider','other') NULL,
  ADD COLUMN `divergence_note` varchar(255) NULL,
  ADD COLUMN `divergence_settled_at` datetime NULL;
