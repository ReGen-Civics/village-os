-- 0411: the platform's contribution token stops being called equity.
--
-- WHY. 0266 seeded the token End of Moon issues as a role's non-cash share as
-- "Earned Equity". The lead ruled on 19 Nov 2026 that no member or applicant
-- surface calls it equity: it tracks contributions, what it becomes is still
-- being defined, and it is at risk. A fresh village therefore reads the neutral
-- platform default "Contribution tokens", the same default the client and
-- server fall back to (shared/contributionToken.ts). A village names it its own
-- way in Admin, Tokens.
--
-- ONLY THE UNTOUCHED DEFAULT MOVES. The WHERE names the exact seeded name, so a
-- village that already renamed the token keeps its own name, and a second run
-- matches zero rows. The slug `earned-equity` never moves: every ledger row,
-- balance and repeat-protection key is written against it.
--
-- WORDS ONLY. The description column, which decides whether held shares may
-- issue, is not touched. No DDL. The release before this one reads the same
-- column at the same type and shows whatever name it holds.

UPDATE `tokens` SET `name` = 'Contribution tokens' WHERE `slug` = 'earned-equity' AND `name` = 'Earned Equity';
