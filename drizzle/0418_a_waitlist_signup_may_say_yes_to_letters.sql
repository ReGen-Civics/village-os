-- 0418: a waitlist sign-up may say yes to letters (the lead, 20 Nov 2026).
--
-- `role_waitlist` (0414) gains two nullable columns:
--   letters_consent  1 when the person ticked "Yes, write to me about this role and other ways into
--                    the village", 0 when they signed up without the tick, NULL on a row from before
--                    the tick existed
--   consent_at       when the tick was given, from Node's clock, NULL unless ticked
--
-- A letter to the waitlist goes only to an address whose newest row has letters_consent = 1. A row
-- from before this file (NULL) is never written to. Shared contract: shared/roleWaitlist.ts.
--
-- EXPAND ONLY. Two new nullable columns, no default needed, no index, no backfill: the previous
-- release names its own columns on INSERT and never reads these.
ALTER TABLE `role_waitlist` ADD COLUMN `letters_consent` tinyint(1) NULL;
ALTER TABLE `role_waitlist` ADD COLUMN `consent_at` timestamp(3) NULL;
