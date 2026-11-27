-- 0437: an org draft keeps its revisions (the draft page, PR D; the lead, 26 Nov 2026: "ability to edit").
-- Whoever may decide drafts, and the person who made one, can change the words a change proposes before it is
-- published. Each such edit is a revision: which change, the words it held and the words it holds now, a short
-- note, who and when. The draft page lists them and shows what changed between them. An edit never touches the
-- live card: it rewrites the open draft, and only a publish writes the card.
--
-- `payload_before` and `payload_after` hold a role's or circle's words, never who holds a role: only a change
-- about words can be revised.
--
-- Expand only: a new table that nothing in the previous release reads or writes.
CREATE TABLE IF NOT EXISTS `org_draft_revisions` (
  `id` varchar(64) NOT NULL,
  `draft_id` varchar(64) NOT NULL,
  `number` int NOT NULL,
  `change_id_before` varchar(64) NOT NULL,
  `change_id_after` varchar(64) NOT NULL,
  `payload_before` json NULL,
  `payload_after` json NULL,
  `note` varchar(500) NULL,
  `revised_by` varchar(64) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `org_draft_revisions_draft_idx` (`draft_id`, `number`)
);
