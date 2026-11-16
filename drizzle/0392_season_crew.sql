-- 0392: season crew (module season-places, ships off).
-- Every season starts fresh: each member applies to sail that season, and each
-- circle's picker for the season picks its crew from everyone who applied, up
-- to the circle's berths.
--
-- THE CONTRACT IS shared/seasonCrew.ts; the SQL is server/repos/seasonCrew.ts.
--
-- `season_crew_applications`, one row per member per season:
--   wants_circle_id   the circle they would like to sail with, or NULL for any
--   words             what they wrote, at most 600 characters
--   status            applied | picked | withdrawn, checked in code
--   picked_circle_id  the circle that picked them
--   picked_by         the picker who did
--
-- `season_crew_berths`, one row per circle per season that has said how many
-- it takes. NULL berths is no limit; 0 is none.
--
-- Picks take the season's lock row (`season_place_locks`, 0390) first, so two
-- circles cannot pick the same person, and a circle cannot pick past its berths.
--
-- ERASURE. A member who leaves loses their applications; their name comes off
-- every pick they made (server/lib/erasure.ts).
--
-- EXPAND ONLY. Two new tables the previous release never reads.
CREATE TABLE IF NOT EXISTS `season_crew_applications` (
  `id` varchar(40) NOT NULL,
  `season_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `wants_circle_id` varchar(64) NULL,
  `words` varchar(600) NULL,
  `status` varchar(16) NOT NULL,
  `picked_circle_id` varchar(64) NULL,
  `picked_by` varchar(64) NULL,
  `picked_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `season_crew_applications_uq` (`season_id`, `user_id`),
  KEY `season_crew_applications_status_idx` (`season_id`, `status`),
  KEY `season_crew_applications_circle_idx` (`season_id`, `picked_circle_id`)
);

CREATE TABLE IF NOT EXISTS `season_crew_berths` (
  `season_id` varchar(64) NOT NULL,
  `circle_id` varchar(64) NOT NULL,
  `berths` int NULL,
  `set_by` varchar(64) NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`season_id`, `circle_id`)
);
