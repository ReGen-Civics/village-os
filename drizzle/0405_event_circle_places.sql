-- 0405: circle places at a gathering (module season-places, ships off).
-- A host gathering can take circles as well as people, up to a cap its host
-- sets for itself; over it a circle waits in order, and takes the first place
-- that frees. People still answer the gathering as people (event_rsvps); this
-- is a second count beside `events.capacity`, never instead of it.
--
-- THE CONTRACT IS shared/circlePlaces.ts; the SQL is server/repos/circlePlaces.ts.
--
-- `event_circle_settings`, one row per gathering that has said anything:
--   takes_circles        whether circles may sign up at all
--   circle_cap           at most this many circles; NULL is no cap, 0 is none
--   needs_season_place   a circle must hold a place in the season the gathering starts in
--   updated_by           the holder of event.manage who saved it
--
-- `event_circle_places`, one row per circle per gathering:
--   status        going | waiting | left, checked in code
--   answered_by   the crew member who signed the circle up, or took it out
--   queued_at     the order of the waitlist, then id
--
-- Every write that can change how many circles are going takes the
-- gathering's events row FOR UPDATE first, the same lock an RSVP takes, so
-- two crews answering the last place at once cannot both get it.
--
-- ERASURE. answered_by names a member; it is cleared when they leave
-- (server/lib/erasure.ts). The circle keeps its place.
--
-- EXPAND ONLY. Two new tables the previous release never reads.
CREATE TABLE IF NOT EXISTS `event_circle_settings` (
  `event_id` varchar(64) NOT NULL,
  `takes_circles` tinyint(1) NOT NULL DEFAULT 0,
  `circle_cap` int NULL,
  `needs_season_place` tinyint(1) NOT NULL DEFAULT 1,
  `updated_by` varchar(64) NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`)
);

CREATE TABLE IF NOT EXISTS `event_circle_places` (
  `id` varchar(40) NOT NULL,
  `event_id` varchar(64) NOT NULL,
  `circle_id` varchar(64) NOT NULL,
  `status` varchar(16) NOT NULL,
  `answered_by` varchar(64) NULL,
  `queued_at` datetime(3) NOT NULL,
  `placed_at` datetime NULL,
  `left_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_circle_places_uq` (`event_id`, `circle_id`),
  KEY `event_circle_places_queue_idx` (`event_id`, `status`, `queued_at`)
);
