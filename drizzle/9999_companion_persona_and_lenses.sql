-- 9999 (the integrator renumbers): a companion's personality, and the member's
-- private lenses (Rye, 14 Nov 2026, "Meet your companion").
--
-- THE CONTRACT IS shared/companionPersona.ts.
--
--   companions.persona          JSON: { character, dials, help, speak }. How
--                               ONE companion talks to its member. NULL: the
--                               companion has not been given one, and talks
--                               as before.
--   member_companion_lenses     one row per member per lens (vedic, type,
--                               own). What the member fed in so their
--                               companions understand them. Private: only
--                               the member reads it, nothing ranks, selects or
--                               scores anyone by it, and the erasure sweep's
--                               "companions" step deletes it whole.
--
-- NO BIRTH DETAILS. A Vedic lens holds two small numbers worked out in the
-- member's browser (the Moon's sign and nakshatra), the way member_gene_keys
-- holds a chart and never a birth date, time or place.
--
-- EXPAND ONLY. A nullable column the previous release names nowhere (its
-- SELECT and INSERT list their columns), and a new table it never reads.
ALTER TABLE companions ADD COLUMN persona TEXT NULL;

CREATE TABLE IF NOT EXISTS `member_companion_lenses` (
  `user_id` varchar(64) NOT NULL,
  -- vedic | type | own, checked in code. A varchar, so a new lens costs no migration.
  `lens` varchar(16) NOT NULL,
  -- JSON, per lens, validated by readLens at every write.
  `data` text NOT NULL,
  `consented_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `lens`)
);
