-- 0395: season places (module season-places, ships off).
-- A circle, or a member, proposes to take part in a season until it has held
-- a place for `season_places.free_after` seasons; a season holds at most
-- `season_places.cap` places, and over it a subject waits in order.
--
-- THE CONTRACT IS shared/seasonPlaces.ts; the SQL is server/repos/seasonPlaces.ts.
--
--   season_id      the season document's id (server/lib/seasonCalendar.ts)
--   subject_kind   circle | member, checked in code
--   subject_id     the circle id, or the member's user id
--   status         proposed | voting | waitlisted | taking_part | declined | withdrawn, checked in code
--   road           proposal | served: how it became eligible, checked in code
--   words          what its crew wrote with the proposal, at most 600 characters
--   proposed_by    the member who proposed or joined
--   decided_by     the holder who adopted it, or the ballot id that carried it
--   queued_at      when it became eligible; the waitlist is in this order, then id
--
-- One row per subject per season. Proposing again after a withdrawal or a no
-- writes the same row again, so the unique key never admits a twin.
--
-- `season_place_locks` holds one row per season. Every write that can change
-- how many places are taken locks it first (SELECT ... FOR UPDATE), so two
-- adoptions at the same moment cannot both take the last place.
--
-- ERASURE. A member who leaves loses the words they wrote; a member subject's
-- rows are deleted (server/lib/erasure.ts).
--
-- EXPAND ONLY. Two new tables the previous release never reads.
CREATE TABLE IF NOT EXISTS `season_places` (
  `id` varchar(40) NOT NULL,
  `season_id` varchar(64) NOT NULL,
  `subject_kind` varchar(16) NOT NULL,
  `subject_id` varchar(64) NOT NULL,
  `status` varchar(16) NOT NULL,
  `road` varchar(16) NOT NULL,
  `words` varchar(600) NULL,
  `proposed_by` varchar(64) NOT NULL,
  `decided_by` varchar(64) NULL,
  `queued_at` datetime(3) NULL,
  `placed_at` datetime NULL,
  `decided_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `season_places_subject_uq` (`season_id`, `subject_kind`, `subject_id`),
  KEY `season_places_queue_idx` (`season_id`, `status`, `queued_at`),
  KEY `season_places_history_idx` (`subject_kind`, `subject_id`)
);

CREATE TABLE IF NOT EXISTS `season_place_locks` (
  `season_id` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`season_id`)
);
