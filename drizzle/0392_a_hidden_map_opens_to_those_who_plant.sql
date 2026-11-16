-- 0392: the hidden map. A members-only map of places the members log, with
-- photos and return visits. Each member sees only their own pins until enough
-- of them are vouched, then the whole map opens (module `hidden-map`,
-- shared/hiddenMap.ts, docs/modules/hidden-map.md).
--
-- Provisional number, claimed in the fleet ledger section 3 by the
-- vos-hidden-map lane. New tables only, every one this module will need, so
-- its later slices add no migration. Nothing here alters, narrows or drops
-- anything that exists, so the previous release runs over a migrated database
-- unchanged.
--
-- NO NAMES. A pin stores its owner's user id because "mine" and the opening
-- count need it, and no route ever sends that id. Nothing here stores a
-- display name, and the access log stores no coordinates.
--
-- No CHARSET clause on any table: they inherit the database's collation,
-- because user ids join `users.id`. No foreign keys, house norm. Comments sit
-- on their own lines and never end in a semicolon. Every column that dedupes
-- is NOT NULL, because a MySQL unique index admits any number of NULLs. No SQL
-- function appears outside the production allow-list.

-- ── The pins ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `hidden_map_pins` (
  `id` varchar(40) NOT NULL,
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  -- The device-made id, so a resent offline capture writes nothing twice.
  `client_id` varchar(64) NOT NULL,
  -- NULL once the member who logged it has erased their account: the place
  -- stays on the map with nobody attached.
  `owner_user_id` varchar(64) NULL,
  -- planting, partner or stop.
  `layer` varchar(16) NOT NULL,
  `kind` varchar(48) NOT NULL,
  `lat` decimal(9,6) NOT NULL,
  `lng` decimal(9,6) NOT NULL,
  -- exact, km or region: the finest anybody beyond the open members is ever shown.
  `shown_precision` varchar(8) NOT NULL DEFAULT 'region',
  `title` varchar(120) NULL,
  `what_went_in` text NULL,
  `notes` text NULL,
  -- seed, sprout, sapling, tree or lost; NULL for a layer with no growth.
  `stage` varchar(16) NULL,
  -- connected, visited or planted, for a partner place.
  `partner_state` varchar(16) NULL,
  `planted_on` date NULL,
  -- A library item the seed came from (optional, slice 5).
  `seed_item_id` varchar(64) NULL,
  -- The member said what went in belongs to this place (native seed in a wild place).
  `native_seed` tinyint(1) NOT NULL DEFAULT 0,
  -- The claim a planting opened on the village's planting quest once it was vouched.
  `planting_claim_id` varchar(64) NULL,
  `hidden_at` datetime NULL,
  `hidden_by` varchar(64) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hidden_map_pins_client` (`village_id`, `client_id`),
  KEY `hidden_map_pins_owner_idx` (`village_id`, `owner_user_id`),
  KEY `hidden_map_pins_layer_idx` (`village_id`, `layer`)
);

-- ── Photos: stored outside the public uploads directory, served by a gated route ──
CREATE TABLE IF NOT EXISTS `hidden_map_photos` (
  `id` varchar(40) NOT NULL,
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  `pin_id` varchar(40) NOT NULL,
  -- The return visit this photo came with, or NULL for the pin's own photos.
  `visit_id` varchar(40) NULL,
  `uploader_user_id` varchar(64) NULL,
  `filename` varchar(80) NOT NULL,
  `thumb_filename` varchar(80) NOT NULL,
  `width` int NOT NULL,
  `height` int NOT NULL,
  `bytes` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `hidden_map_photos_pin_idx` (`village_id`, `pin_id`),
  KEY `hidden_map_photos_uploader_idx` (`village_id`, `uploader_user_id`)
);

-- ── Vouches: one per member per pin; a voucher may withdraw their own ─────
CREATE TABLE IF NOT EXISTS `hidden_map_vouches` (
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  `pin_id` varchar(40) NOT NULL,
  `voucher_user_id` varchar(64) NOT NULL,
  -- open (their own map had opened) or keeper (the bootstrap power).
  `basis` varchar(8) NOT NULL,
  -- How the voucher saw it: in-person, call or photos.
  `seen` varchar(16) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `withdrawn_at` datetime NULL,
  PRIMARY KEY (`village_id`, `pin_id`, `voucher_user_id`),
  KEY `hidden_map_vouches_voucher_idx` (`village_id`, `voucher_user_id`)
);

-- ── Return visits: a later photo and the stage it saw ──────────────────────
CREATE TABLE IF NOT EXISTS `hidden_map_visits` (
  `id` varchar(40) NOT NULL,
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  `client_id` varchar(64) NOT NULL,
  `pin_id` varchar(40) NOT NULL,
  `visitor_user_id` varchar(64) NULL,
  `stage_seen` varchar(16) NULL,
  `note` text NULL,
  -- The quest claim this visit opened, when the village pays for visits.
  `claim_id` varchar(64) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hidden_map_visits_client` (`village_id`, `client_id`),
  KEY `hidden_map_visits_pin_idx` (`village_id`, `pin_id`, `created_at`),
  KEY `hidden_map_visits_visitor_idx` (`village_id`, `visitor_user_id`, `pin_id`)
);

-- ── Openings: recorded once, never undone ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `hidden_map_unlocks` (
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  `user_id` varchar(64) NOT NULL,
  `vouched_count` int NOT NULL,
  `needed` int NOT NULL,
  `opened_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`village_id`, `user_id`)
);

-- ── Exports: one member asks, a different member approves, the asker downloads once ──
CREATE TABLE IF NOT EXISTS `hidden_map_exports` (
  `id` varchar(40) NOT NULL,
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  `requested_by` varchar(64) NOT NULL,
  `shown_precision` varchar(8) NOT NULL,
  -- pending, approved, declined, withdrawn, expired or downloaded.
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `decided_by` varchar(64) NULL,
  `decided_at` datetime NULL,
  `downloaded_at` datetime NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `hidden_map_exports_status_idx` (`village_id`, `status`)
);

-- ── Who looked: every read of the shared map, every vouch and export. No coordinates ──
CREATE TABLE IF NOT EXISTS `hidden_map_access_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `village_id` varchar(64) NOT NULL DEFAULT 'local',
  `user_id` varchar(64) NULL,
  `action` varchar(24) NOT NULL,
  `pin_id` varchar(40) NULL,
  `export_id` varchar(40) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `hidden_map_access_log_time_idx` (`village_id`, `created_at`),
  KEY `hidden_map_access_log_user_idx` (`village_id`, `user_id`, `created_at`)
);
