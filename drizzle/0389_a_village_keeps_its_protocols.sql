-- 0389: a village keeps its protocols, and every run a member walks.
--
-- Four new tables and nothing else, so this file is expand-only: the previous
-- release neither reads nor writes them, and rolling an image back over a
-- migrated database leaves four tables nobody asks about. The number is
-- provisional (fleet ledger section 3); the integrator assigns it at compose.
--
-- THE CONTRACT IS shared/protocols.ts. The module ships off; no row here
-- means a village that never turned it on.
--
-- WHY FOUR TABLES:
--   - `protocols`: one row per checklist, pointing at its current version.
--   - `protocol_versions`: every save is a new row and no row is ever
--     updated, so a run started on version 3 still reads version 3's steps
--     after somebody edits the list. `steps` is JSON text, validated by
--     `checkProtocolDraft` before it is written.
--   - `protocol_runs`: one walk through one version. The id is made on the
--     member's phone, which is what lets a run started with no signal arrive
--     later as the same run, and a repeat of it be a no-op.
--   - `protocol_run_ticks`: one row per tick or untick, keyed by the phone's
--     id for the same reason. A run's state is read from these events, never
--     stored as booleans, so two phones that ticked offline merge.
--
-- Times are DATETIME(3), written from Node in UTC, so no session time zone
-- moves them on the way back.
--
-- NO FOREIGN KEYS, the same as every table in this schema. Member ids are
-- read through `users` at display time, so an erased member shows as the
-- platform's erased name and nothing here carries their words.

CREATE TABLE IF NOT EXISTS `protocols` (
  `id` varchar(64) NOT NULL,
  `title` varchar(160) NOT NULL,
  `summary` text NOT NULL,
  `current_version` int NOT NULL,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `sort_order` int NOT NULL DEFAULT 0,
  `created_by` varchar(64) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `protocol_versions` (
  `protocol_id` varchar(64) NOT NULL,
  `version` int NOT NULL,
  `title` varchar(160) NOT NULL,
  `summary` text NOT NULL,
  -- JSON: ProtocolStep[] (shared/protocols.ts).
  `steps` mediumtext NOT NULL,
  `created_by` varchar(64) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`protocol_id`, `version`)
);

CREATE TABLE IF NOT EXISTS `protocol_runs` (
  `id` varchar(64) NOT NULL,
  `protocol_id` varchar(64) NOT NULL,
  `version` int NOT NULL,
  `started_by` varchar(64) NOT NULL,
  -- When it began on the phone; `received_at` is when the server heard.
  `started_at` datetime(3) NOT NULL,
  `received_at` datetime(3) NOT NULL,
  `status` enum('open','complete','set-aside') NOT NULL DEFAULT 'open',
  `ended_at` datetime(3) NULL,
  `ended_by` varchar(64) NULL,
  PRIMARY KEY (`id`),
  KEY `protocol_runs_status` (`status`, `started_at`),
  KEY `protocol_runs_protocol` (`protocol_id`, `started_at`)
);

CREATE TABLE IF NOT EXISTS `protocol_run_ticks` (
  `id` varchar(64) NOT NULL,
  `run_id` varchar(64) NOT NULL,
  `step_id` varchar(64) NOT NULL,
  `done` tinyint(1) NOT NULL,
  `ticked_by` varchar(64) NOT NULL,
  `ticked_at` datetime(3) NOT NULL,
  `received_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `protocol_run_ticks_run` (`run_id`, `ticked_at`)
);
