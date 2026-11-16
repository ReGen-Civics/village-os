-- 0398: a proposed change keeps what was live before it was accepted.
--
-- The review page (/admin/proposals) offers "Propose putting it back" on an
-- accepted change. That needs the value that was live just before the accept,
-- read the same way the page reads it (liveOf, server/lib/proposedChanges.ts).
--
-- before_json: what was live, read just before the change was applied. SQL
-- NULL means it was never read (a change accepted before this release, or a
-- kind that is never put back). The JSON text null means it was read and
-- nothing could be read then.
-- reverts_id: on a proposal that puts an earlier change back, that change's id.
--
-- EXPAND ONLY. Two nullable columns and a non-unique index. The previous
-- release names neither column, so its inserts leave them NULL and its reads
-- ignore them.
ALTER TABLE `proposed_changes` ADD COLUMN `before_json` mediumtext NULL;

ALTER TABLE `proposed_changes` ADD COLUMN `reverts_id` varchar(40) NULL;

CREATE INDEX `idx_pc_reverts` ON `proposed_changes` (`reverts_id`);
