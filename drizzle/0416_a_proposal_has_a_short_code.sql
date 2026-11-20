-- 0416: every proposal batch and every proposed change has a short code.
--
-- The review page (/admin/proposals) and the connector now name a batch B-27
-- and its second change B-27.2, so a list an agent sends can be matched to a
-- card. The long ids (pcb_..., pc_...) stay the keys.
--
-- code_no: the batch's number in this village's filing order. The code is B-<code_no>.
-- code: the code as shown, on a batch (B-27) and on a change (B-27.2, its place in its batch).
--
-- EXPAND ONLY. Three nullable columns, no index and no constraint. The previous
-- release names none of them, so its inserts leave them NULL and its reads
-- ignore them. The backfill by filing order runs in TypeScript on the first
-- read or write of the queue (server/repos/proposedChanges.ts, ensureCodes),
-- and every UPDATE in it carries a WHERE on a NULL code.
ALTER TABLE `proposed_change_batches` ADD COLUMN `code_no` int NULL;

ALTER TABLE `proposed_change_batches` ADD COLUMN `code` varchar(16) NULL;

ALTER TABLE `proposed_changes` ADD COLUMN `code` varchar(24) NULL;
