-- 0445: a role card says when its applications close (the lead, 27 Nov 2026: "we review 1-2 weeks after the
-- application deadline so a stage that waits more than 3 days would nudge").
--
-- `org_roles.apply_by`, the last day applications are taken for the role (a civil date, YYYY-MM-DD), or NULL when the
-- role takes them all the time. Read by shared/roleParams.ts (`applyBy`). With a date, the applicant's first letter
-- and page say "We review applications 1 to 2 weeks after" it, and an application waiting before that review is not
-- stalled: the team's nudges start once the review window opens.
--
-- Expand only: one new nullable column. The previous release never names it and runs as before.
ALTER TABLE `org_roles` ADD COLUMN `apply_by` date NULL
