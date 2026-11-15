-- 9999 (the integrator renumbers): the Treasurer's review of an End of Moon line's token shares
-- (Rye, 15 Nov 2026: "the token pay and approving or adjusting those numbers (so equity is a
-- bonus on the pay and it can be adjusted up or down by the treasurer and founders and sent
-- to their accounts)").
--
-- THE CONTRACT IS shared/moonRewardReview.ts.
--
-- One row per owed posting an approved End of Moon invoice records (`quest_owed_postings`,
-- drizzle/0210, source `moon_invoice_reward`), keyed on the same occurrence key. A posting
-- with a review row issues only once the row reads approved. A moon posting recorded before
-- this table existed has no row, and pays as it did.
--
--   state            waiting | approved, checked in code
--   units_shared     what the split gave, in the posting's minor units, never changed
--   units_set        a Treasurer's or founder's changed amount, NULL while unchanged; the
--                    posting's own `units` is changed with it, in one transaction
--   line_total_minor the line's whole reward, so a changed amount is held under the pay cap
--   member_reply     the member's own answer to a change, scrubbed when they leave
--
-- EXPAND ONLY. A new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `moon_reward_reviews` (
  `idempotency_key` varchar(191) NOT NULL,
  `invoice_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `token_slug` varchar(32) NOT NULL,
  `units_shared` bigint NOT NULL,
  `line_total_minor` bigint NOT NULL,
  `currency` varchar(8) NOT NULL,
  `state` varchar(16) NOT NULL DEFAULT 'waiting',
  `units_set` bigint NULL,
  `set_reason` varchar(500) NULL,
  `set_by` varchar(64) NULL,
  `set_at` timestamp NULL,
  `approved_by` varchar(64) NULL,
  `approved_at` timestamp NULL,
  `approved_alone` tinyint(1) NOT NULL DEFAULT 0,
  `member_reply` varchar(1000) NULL,
  `member_reply_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idempotency_key`),
  KEY `moon_reward_reviews_user` (`user_id`, `created_at`),
  KEY `moon_reward_reviews_created` (`created_at`)
) ENGINE=InnoDB;
