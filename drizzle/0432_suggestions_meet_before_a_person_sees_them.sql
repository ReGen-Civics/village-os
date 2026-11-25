-- 0432: suggestions meet before a person sees them (the review engine, docs/REVIEW_INBOX_PLAN.md).
--
-- The lead, 23 Nov 2026: suggestions from Sera, agents and every other stream land in staging
-- first and are integrated into one coherent stream before anything reaches the review page, so
-- streams never contradict or duplicate each other. The engine that integrates them is pure
-- (shared/suggestionPipeline/engine.ts); these are the two tables it reads and writes, and the
-- three columns the published stream needs.
--
-- ── suggestion_staging ───────────────────────────────────────────────────────
--
-- One row per filing, as it arrived. Nothing here is shown to anybody until the engine has put
-- it on a card; a held row keeps its reason as a fixed code with fields (`held_code`,
-- `held_fields_json`), never prose, so no filer's words reach another filer.
--
-- `stream` and `filer` are written by the server from the route the filing arrived on and the
-- signed-in principal. Nothing in a payload sets them, so no filing can claim to be Sera.
-- `filer` is an opaque reference: a member's id, an agent account's id, or a module id.
-- A member's own rows are deleted by the erasure sweep ("suggestion-staging-after-tombstone").
--
-- `dedupe_key` is NOT NULL and in a UNIQUE key with `stream`, which is what makes a re-send a
-- no-op: MySQL unique indexes exempt NULLs, so a nullable column here would admit endless copies.
-- The server derives it from the value and the filer (shared/suggestionPipeline/engine.ts,
-- `digest`), never from anything the filer names.
--
-- `keys_json` is what the suggestion is about, as the engine reads it. It is not indexed: the
-- open set is read whole and compared in memory, which is how the engine stays one pure function.
--
-- ── suggestion_outcomes ──────────────────────────────────────────────────────
--
-- One row per decision, whichever door it came through. `id` is the decision's own id, so a
-- put-back or a released reconsider of the same item records a second decision without
-- colliding; (`stream`, `source_id`) is an ordinary index. It names the CAPABILITY that decided,
-- never the person, and holds no amounts and no words: the value is a digest and the edit is
-- counted, so there is nothing in it for erasure to find. Discards here are what the engine's
-- 30-day window reads; accepts are the recorded decisions it holds later suggestions against.
--
-- ── proposed_changes: three nullable columns ─────────────────────────────────
--
-- `conflict_group`  the card a row belongs to, when the engine published it
-- `options_json`    a card with options: every option, each credited. Such a row carries the
--                   status `choose`, which the previous release neither lists nor accepts
--                   (server/repos/proposedChanges.ts reads 'proposed','failed','unknown'), so a
--                   rollback can never accept two options of one card.
-- `credits_json`    who sent it, by stream and kind of proposer, never by person
--
-- EXPAND ONLY. Two new tables the previous release never reads, three nullable columns it never
-- names (its inserts leave them NULL, its reads ignore them), and one non-unique index. No
-- function calls, no backfill here: the outcomes of decisions already made are written in
-- TypeScript, each write guarded by a WHERE.
CREATE TABLE IF NOT EXISTS `suggestion_staging` (
  `id` varchar(40) NOT NULL,
  `stream` varchar(16) NOT NULL,
  `stream_ref` varchar(64) NOT NULL,
  `filer` varchar(64) NOT NULL,
  `filer_kind` varchar(12) NOT NULL,
  `kind` varchar(32) NOT NULL,
  `target_json` text NOT NULL,
  `body_json` mediumtext NOT NULL,
  `why` varchar(1000) NULL,
  `evidence_json` text NULL,
  `reconsider_json` text NULL,
  `touches_person` tinyint(1) NOT NULL DEFAULT 0,
  `needs_json` text NULL,
  `provides_json` text NULL,
  `keys_json` text NOT NULL,
  `value_digest` char(16) NOT NULL,
  `dedupe_key` char(16) NOT NULL,
  `state` varchar(12) NOT NULL DEFAULT 'staged',
  `held_code` varchar(24) NULL,
  `held_fields_json` text NULL,
  `released_by_capability` varchar(64) NULL,
  `released_at` datetime(3) NULL,
  `card_id` varchar(48) NULL,
  `published_change_id` varchar(40) NULL,
  `received_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staging_dedupe` (`stream`, `dedupe_key`),
  KEY `idx_staging_state` (`state`, `received_at`),
  KEY `idx_staging_filer` (`filer`, `received_at`)
);

CREATE TABLE IF NOT EXISTS `suggestion_outcomes` (
  `id` varchar(40) NOT NULL,
  `stream` varchar(16) NOT NULL,
  `source_id` varchar(64) NOT NULL,
  `kind` varchar(32) NOT NULL,
  `value_digest` char(16) NOT NULL,
  `keys_json` text NOT NULL,
  `proposer_kind` varchar(12) NOT NULL,
  `outcome` varchar(16) NOT NULL,
  `fields_edited` int NOT NULL DEFAULT 0,
  `decided_by_capability` varchar(64) NOT NULL,
  `filed_at` datetime(3) NOT NULL,
  `decided_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_outcome_source` (`stream`, `source_id`),
  KEY `idx_outcome_recent` (`outcome`, `decided_at`)
);

ALTER TABLE `proposed_changes` ADD COLUMN `conflict_group` varchar(48) NULL;

ALTER TABLE `proposed_changes` ADD COLUMN `options_json` mediumtext NULL;

ALTER TABLE `proposed_changes` ADD COLUMN `credits_json` mediumtext NULL;

CREATE INDEX `idx_pc_conflict` ON `proposed_changes` (`conflict_group`);
