-- 0388: caps on voting weight by source, and the hand-mint's cash or other tag
--
-- A village weighing votes by a token can cap how much of one member's balance
-- a ballot counts from cash put in and from every other contribution, each by
-- its own switch and whole-token number (governance.weight_cap_cash_on and
-- governance.weight_cap_cash, the same pair for other). The cap is applied when
-- a ballot opens and never at the mint, so the ledger keeps every contribution
-- in full. THE CONTRACT IS shared/voiceSourceCaps.ts.
--
-- ballot_electorate gains the BASIS each frozen weight was counted from, in
-- the weight's own minor units, so anyone can recompute it:
--   held_weight   the member's whole balance of the weight token at open
--   held_cash     the part of it that came from cash (the rest came from other)
--   cap_cash      the cash cap it was counted under, NULL when that cap was off
--   cap_other     the other cap, NULL when off
-- All four are NULL on a ballot opened with no caps by source, and on every
-- ballot opened before this file, so those rows read exactly as before.
--
-- admin_mint_requests gains the tag a hand-mint over the co-sign threshold
-- carries while it waits: cash or other, checked in code. The insert names its
-- columns, so a previous release writing a request leaves it to the DEFAULT,
-- which is what every hand-mint meant before the tag existed.
--
-- Expand only: four nullable columns and one NOT NULL column with a DEFAULT on
-- a table written by raw SQL that names its columns.

ALTER TABLE `ballot_electorate`
  ADD COLUMN `held_weight` decimal(18,4) NULL,
  ADD COLUMN `held_cash` decimal(18,4) NULL,
  ADD COLUMN `cap_cash` decimal(18,4) NULL,
  ADD COLUMN `cap_other` decimal(18,4) NULL;

ALTER TABLE `admin_mint_requests`
  ADD COLUMN `contribution_kind` varchar(8) NOT NULL DEFAULT 'other';
