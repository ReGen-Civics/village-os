-- 9999 (the integrator renumbers at compose): translated village content
-- (Rye, 15 Nov 2026: role cards and village content get translated, a
-- machine draft shows marked until a person approves it).
--
-- THE CONTRACT IS shared/contentTranslation.ts.
--
--   kind          role_card | role_card_sections | page_section, checked in code
--   ref_key       the role id, or the page section ("page-journey-steward")
--   field         the field address inside it ("aim", "intro.title")
--   locale        a language the village offers, never the source
--   text          the translation, validated like the source field
--   source_hash   sha256 hex of the English it was made from; a mismatch means
--                 the English changed and the reader falls back to it
--   status        ai_draft | approved, checked in code
--   created_by    who wrote or drafted it (a member id, or NULL for a machine)
--   approved_by   who approved it, NULL while a draft
--
-- Legal and binding pages take no row here (the code refuses them).
--
-- ERASURE. A translation is village content, not the translator's own words
-- about themselves, so it stays when they leave; created_by and approved_by
-- then name the tombstoned id, which resolves to no name, as an edit stamp does.
--
-- EXPAND ONLY. A new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `content_translations` (
  `kind` varchar(32) NOT NULL,
  `ref_key` varchar(80) NOT NULL,
  `field` varchar(120) NOT NULL,
  `locale` varchar(16) NOT NULL,
  `text` text NOT NULL,
  `source_hash` char(64) NOT NULL,
  `status` varchar(16) NOT NULL,
  `created_by` varchar(64) NULL,
  `approved_by` varchar(64) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`kind`, `ref_key`, `field`, `locale`)
);
