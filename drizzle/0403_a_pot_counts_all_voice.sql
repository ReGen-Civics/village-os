-- 0403: Funding rounds, the lead's rulings on S4 (2026-11-18, relayed by the
-- coordinator).
--
-- "Count all voice for now": a new pot counts every member's whole Voice.
-- Work-only Voice stays available, and a holder of pot.steward switches a pot
-- between the two. The repo names this column on every INSERT and writes the
-- value itself, so the DEFAULT is the schema telling the same story, never
-- the thing a write relies on. Existing pots keep the value they hold.
--
-- Held quests reserve their pot money: while a round's divergence vote runs,
-- the larger of the two sides' costs is held back from the pot's free money,
-- so another round on the same pot cannot spend it first. The reservation
-- counts only while the round's divergence result is NULL, so settling the
-- vote releases it with no second write.
--
-- A changed DEFAULT and a new nullable column: the previous release reads
-- and writes both tables exactly as before.

ALTER TABLE `funding_pots` ALTER COLUMN `counted_voice` SET DEFAULT 'all';

ALTER TABLE `funding_rounds` ADD COLUMN `reserved_minor` bigint NULL;
