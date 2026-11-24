-- 0426: a portal visitor says what draws them, and the opted-in ones reach the village's email list
-- (ops, 24 Nov 2026: "so that we can build our CRM").
--
-- THE CONTRACT IS shared/entrance.ts; the SQL is server/repos/portalEntries.ts.
--
-- Three new columns on `portal_entries` (0425):
--   interest     what the visitor chose under "What draws you here?" (`INTERESTS` in
--                shared/entrance.ts), or NULL when they chose nothing
--   synced_at    when the entry reached the village's email list (Brevo), or NULL while it has not
--   sync_error   the last reason it did not, short, or NULL
--
-- EXPAND ONLY. Three nullable columns; the previous release never names them in an INSERT.
ALTER TABLE `portal_entries` ADD COLUMN `interest` varchar(32) NULL;
ALTER TABLE `portal_entries` ADD COLUMN `synced_at` timestamp(3) NULL;
ALTER TABLE `portal_entries` ADD COLUMN `sync_error` varchar(300) NULL;
