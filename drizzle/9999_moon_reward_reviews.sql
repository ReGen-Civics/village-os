-- 9999 (the integrator renumbers): the Treasurer's review of an End of Moon line's token shares
-- (Rye, 15 Nov 2026: "the token pay and approving or adjusting those numbers (so equity is a
-- bonus on the pay and it can be adjusted up or down by the treasurer and founders and sent
-- to their accounts)").
--
-- THE CONTRACT IS shared/moonRewardReview.ts.
--
-- A share an approved End of Moon invoice records (`quest_owed_postings`, drizzle/0210,
-- source `moon_invoice_reward`) is written in its own state, `awaiting`, which no payer
-- reads: the owed-postings sweep, the launch close and the hourly retry all settle `owed`
-- rows only (the coordinator's ruling, 15 Nov 2026). A review approving it moves it to
-- `owed`; a change moves it back to `awaiting`.
--
-- One review row per share, keyed on the posting's occurrence key.
--
--   state            waiting | approved, checked in code
--   units_shared     what the split gave, in the posting's minor units, never changed
--   units_set        a Treasurer's or founder's changed amount, NULL while unchanged; the
--                    posting's own `units` is changed with it, in one transaction
--   line_key         the invoice line both of a line's token shares come from
--   line_total_minor the line's whole reward, and cash_minor its cash share, so a change is
--                    held under the pay cap of the whole line (cash, Earned Equity and Credits
--                    together); 0 on a row made for a share recorded before this table, which
--                    the code reads back off the invoice
--   set_reason       the reason the member reads, scrubbed when they leave
--   member_reply     the member's own answer to a change, scrubbed when they leave
--
-- EXPAND ONLY. A new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `moon_reward_reviews` (
  `idempotency_key` varchar(191) NOT NULL,
  `invoice_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `token_slug` varchar(32) NOT NULL,
  `units_shared` bigint NOT NULL,
  `line_key` varchar(120) NOT NULL DEFAULT '',
  `line_total_minor` bigint NOT NULL DEFAULT 0,
  `cash_minor` bigint NOT NULL DEFAULT 0,
  `currency` varchar(8) NOT NULL DEFAULT '',
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
  KEY `moon_reward_reviews_line` (`invoice_id`, `line_key`)
) ENGINE=InnoDB;

-- A share recorded before reviews existed, and not yet paid, waits for one too: nothing pays
-- unreviewed at launch (security lane, #1349 S3 5). Its review row is made the first time the
-- pay board reads it.
UPDATE `quest_owed_postings` SET `state` = 'awaiting' WHERE `source` = 'moon_invoice_reward' AND `state` = 'owed';
