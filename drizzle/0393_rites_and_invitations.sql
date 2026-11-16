-- Rites and invitations: the stamps a member's rites leave, the ceremonies
-- that stamp spoken ones, the mark a member draws, the buddy beside a
-- newcomer, the way a newcomer chose to arrive, a member's lasting door code,
-- the line an inviter writes on an invitation, and names left at a door that
-- is not open yet.
--
-- Nine new tables and nothing else, so this file is expand-only: the previous
-- release neither reads nor writes them. The number is the integrator's to
-- give at compose (fleet ledger section 3, provisional 0393).
--
-- THE CONTRACT IS shared/rites.ts. The module ships off; no rows here means a
-- village that never turned it on.
--
-- WHAT IS WHERE:
--   - `rite_stamps`: one row per member and rite, written once by the stamp.
--     The rite's words live in the village's document, so a renamed rite
--     renames every stamp of it.
--   - `rite_ceremonies`: one ceremony for one candidate and one spoken rite.
--     The lines are copied in as JSON when it opens, so an edit to the rite
--     never changes a ceremony under way. `open_key` holds candidate and rite
--     while it is open and is NULL after, so the unique key allows one open
--     ceremony per pair and any number closed (MySQL unique keys skip NULLs).
--   - `rite_witnesses`: who joined each ceremony, how (present or on a call),
--     and when they confirmed.
--   - `member_marks`: the path of a member's drawn mark, at most once per
--     member, fixed once their rite is stamped.
--   - `rite_buddies`: who walks beside a newcomer, and the greeting they wrote.
--   - `rite_aboard`: the door a newcomer chose and their line from the heart.
--   - `rite_door_codes`: a member's lasting code for a printed QR. Replacing it
--     sets `ended_at` on the old row.
--   - `invite_letters`: the inviter's own line on one invitation.
--   - `rite_interest`: a name and an address left at a door marked interest only.
--
-- Times are DATETIME(3), written from Node in UTC. No foreign keys, the same as
-- every table in this schema.

CREATE TABLE IF NOT EXISTS `rite_stamps` (
  `user_id` varchar(64) NOT NULL,
  `rite_id` varchar(40) NOT NULL,
  `stamped_at` datetime(3) NOT NULL,
  `ceremony_id` varchar(64) NULL,
  `witness_user_id` varchar(64) NULL,
  PRIMARY KEY (`user_id`, `rite_id`),
  KEY `rite_stamps_rite` (`rite_id`)
);

CREATE TABLE IF NOT EXISTS `rite_ceremonies` (
  `id` varchar(64) NOT NULL,
  `rite_id` varchar(40) NOT NULL,
  `candidate_user_id` varchar(64) NOT NULL,
  `opened_by` varchar(64) NOT NULL,
  `opened_at` datetime(3) NOT NULL,
  `place` varchar(16) NULL,
  `lines_json` mediumtext NOT NULL,
  `answer` varchar(120) NULL,
  `mark_needed` tinyint(1) NOT NULL DEFAULT 0,
  `witnesses_needed` int NOT NULL,
  `spoken` int NOT NULL DEFAULT 0,
  `status` enum('open','sworn','set-aside') NOT NULL DEFAULT 'open',
  `closed_at` datetime(3) NULL,
  `open_key` varchar(110) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rite_ceremonies_open` (`open_key`),
  KEY `rite_ceremonies_candidate` (`candidate_user_id`),
  KEY `rite_ceremonies_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `rite_witnesses` (
  `ceremony_id` varchar(64) NOT NULL,
  `witness_user_id` varchar(64) NOT NULL,
  `via` enum('present','call') NOT NULL,
  `joined_at` datetime(3) NOT NULL,
  `confirmed_at` datetime(3) NULL,
  PRIMARY KEY (`ceremony_id`, `witness_user_id`),
  KEY `rite_witnesses_witness` (`witness_user_id`)
);

CREATE TABLE IF NOT EXISTS `member_marks` (
  `user_id` varchar(64) NOT NULL,
  `path` text NOT NULL,
  `made_at` datetime(3) NOT NULL,
  `fixed_at` datetime(3) NULL,
  PRIMARY KEY (`user_id`)
);

CREATE TABLE IF NOT EXISTS `rite_buddies` (
  `newcomer_user_id` varchar(64) NOT NULL,
  `buddy_user_id` varchar(64) NOT NULL,
  `paired_by` varchar(64) NOT NULL,
  `paired_at` datetime(3) NOT NULL,
  `greeting` text NULL,
  PRIMARY KEY (`newcomer_user_id`),
  KEY `rite_buddies_buddy` (`buddy_user_id`)
);

CREATE TABLE IF NOT EXISTS `rite_aboard` (
  `user_id` varchar(64) NOT NULL,
  `door_id` varchar(40) NULL,
  `why` text NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`user_id`)
);

CREATE TABLE IF NOT EXISTS `rite_door_codes` (
  `code` varchar(16) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `made_at` datetime(3) NOT NULL,
  `ended_at` datetime(3) NULL,
  PRIMARY KEY (`code`),
  KEY `rite_door_codes_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `invite_letters` (
  `invite_id` varchar(80) NOT NULL,
  `line` varchar(400) NOT NULL,
  `written_at` datetime(3) NOT NULL,
  PRIMARY KEY (`invite_id`)
);

CREATE TABLE IF NOT EXISTS `rite_interest` (
  `id` varchar(64) NOT NULL,
  `door_id` varchar(40) NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(254) NOT NULL,
  `left_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `rite_interest_door` (`door_id`)
);
