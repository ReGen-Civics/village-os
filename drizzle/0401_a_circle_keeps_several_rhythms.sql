-- 0401: a circle keeps several named rhythms, an agenda item can wait for one
-- of them, and a circle's own calendar can be read through a title word.
--
-- THE CONTRACT IS shared/sessionRhythm.ts (rhythms), shared/sessionLibrary.ts
-- (an item's meeting) and shared/sessionCalendar.ts (the title word).
--
-- WHY. A circle often meets more than once a week, each meeting with its own
-- day, time and length ("Monday all-staff", "Thursday steward sync"). 0271
-- keeps ONE rhythm per circle, keyed by the circle.
--
-- HOW IT STAYS EXPAND ONLY.
--   * `live_session_rhythms` keeps every row it has, unchanged, as each
--     circle's first rhythm (its key is "main" in the code). It gains a name,
--     NOT NULL with a DEFAULT of ''. The previous release names its columns on
--     every INSERT and never names this one, so the default applies to it.
--   * A circle's further rhythms go in a NEW table. The previous release never
--     reads it: put back over a migrated database, it sees each circle's first
--     rhythm exactly as before, and the further ones wait unread.
--   * `live_session_library` gains `rhythm_key`, NOT NULL DEFAULT ''. '' is
--     "the circle's next meeting, whichever rhythm", which is what every
--     existing item already means. The previous release names its columns on
--     every INSERT and never names this one.
--   * `live_session_circle_calendars` gains `title_filter`, NOT NULL DEFAULT ''.
--     '' is "every timed event counts", which is what every attached calendar
--     does today.
--
-- NO FOREIGN KEYS, the same as every table in this schema. A person here is a
-- number from `live_session_members`; 0 is a member who has since left.

ALTER TABLE `live_session_rhythms` ADD COLUMN `name` varchar(80) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS `live_session_more_rhythms` (
  -- A live circle's id.
  `circle_id` varchar(64) NOT NULL,
  -- The rhythm's own key inside its circle, never "main" (the first rhythm,
  -- in live_session_rhythms). Agenda items and skips name it.
  `rhythm_key` varchar(24) NOT NULL,
  -- What the circle calls this meeting, for example "Thursday sync".
  `name` varchar(80) NOT NULL DEFAULT '',
  -- weekly, moon or once.
  `kind` varchar(8) NOT NULL,
  -- JSON: the calendar's Recurrence, skipped dates in `exceptions`. NULL for a single meeting.
  `recurrence` text NULL,
  -- The village date of the first meeting, YYYY-MM-DD.
  `starts_on` varchar(10) NOT NULL,
  -- The time of day every meeting keeps, HH:MM, in the village's zone.
  `time_of_day` varchar(5) NOT NULL,
  `duration_min` smallint NOT NULL,
  -- Who set it last.
  `set_by_no` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Set by every write: the column has no ON UPDATE.
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`circle_id`, `rhythm_key`),
  KEY `live_session_more_rhythms_set_by_idx` (`set_by_no`)
);

ALTER TABLE `live_session_library` ADD COLUMN `rhythm_key` varchar(24) NOT NULL DEFAULT '';

ALTER TABLE `live_session_circle_calendars` ADD COLUMN `title_filter` varchar(80) NOT NULL DEFAULT '';
