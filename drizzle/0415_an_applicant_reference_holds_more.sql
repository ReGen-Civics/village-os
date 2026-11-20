-- 0413: a reference an applicant gives on their status page holds three times as much.
--
-- THE LIMITS ARE shared/applyLimits.ts (APPLY_TEXT.statusRef*), read by
-- shared/applicantOnboarding.ts REF_NAME_MAX and its siblings. The ops request
-- of 19 Nov 2026 tripled every limit an applicant meets, and the columns that
-- hold a reference were exactly the old limits (0412), so each widens to the
-- new one:
--
--   name        80 to 240
--   contact     120 to 360
--   how_known   300 to 900
--   why_ally    400 to 1200
--
-- EXPAND ONLY. A wider varchar holds everything the narrower one did, and the
-- release before this one still writes what it always wrote. Each column keeps
-- its NOT NULL and its default. Rolling back leaves the columns wide, which the
-- older code reads and writes as before.

ALTER TABLE `application_references`
  MODIFY COLUMN `name` varchar(240) NOT NULL,
  MODIFY COLUMN `contact` varchar(360) NOT NULL,
  MODIFY COLUMN `how_known` varchar(900) NOT NULL,
  MODIFY COLUMN `why_ally` varchar(1200) NOT NULL DEFAULT '';
