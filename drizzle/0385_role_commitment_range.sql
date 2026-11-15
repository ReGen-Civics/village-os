-- 0385: a role's commitment range (Rye, 14 Nov 2026).
--
-- "We're also open to this role being with several people filling to the 100%
-- commitment we need ... we're open to proposals from 30 to 100% commitment."
--
--   org_roles.commitment_min     the least one person may propose to give the
--                                role, a whole percent from 1 to 100. NULL: the
--                                card offers 100% only, as before.
--   org_roles.commitment_target  how much commitment the role needs in all,
--                                held by one person or shared, a whole percent
--                                from 1 to 1000 (300 when it needs three whole
--                                people). NULL: 100.
--
-- Store and display only. Nothing that pays reads either column; a contract
-- sets the pay (shared/commitmentRange.ts).
--
-- EXPAND ONLY. Two nullable columns the previous release names nowhere, so it
-- keeps reading and writing org_roles unchanged if it is put back over a
-- migrated database.
ALTER TABLE org_roles ADD COLUMN commitment_min TINYINT UNSIGNED NULL;

ALTER TABLE org_roles ADD COLUMN commitment_target SMALLINT UNSIGNED NULL;
