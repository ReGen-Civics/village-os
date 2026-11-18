-- 0399 (renumbered from 9999 at compose, batch 190): a role can be shown as coming soon, or as a
-- future venture (Rye, 16 Nov 2026).
--
-- A role's four states are Open, Coming soon, Held and Unlisted, and the
-- Operations Steward added a fifth, Future venture. Held is derived from the
-- seatings and Open and Unlisted are the `listed` column, so two flags carry
-- the rest. A coming-soon role is shown under the steward who leads its circle
-- and is applied for early. A future venture is shown in its own section, with
-- no lead, and is applied for with a pitch. Both are shown even while unlisted
-- (shared/roleListing.ts), and both are role parameters beside always_checked
-- (shared/roleParams.ts).
--
-- EXPAND ONLY. Two new columns with a DEFAULT of 0. The previous release names
-- neither, so it keeps reading and writing org_roles unchanged if it is put
-- back over a migrated database.
ALTER TABLE org_roles ADD COLUMN coming_soon TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE org_roles ADD COLUMN future_venture TINYINT(1) NOT NULL DEFAULT 0;
