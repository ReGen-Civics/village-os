-- 0420: a venture redeems its credits (the lead, 23 Nov 2026, credits lane 2).
--
-- Members spend credits and only ventures redeem them. A person seated in the venture's role asks
-- to redeem some of what the venture's account `org:<orgRoleId>` holds (0419), in one of the
-- currencies the village offers, and says where the money should go. The credits are HELD at once.
-- Somebody holding the redemption key (`redemption.confirm`, the Treasury role) pays the venture
-- outside the platform and then confirms with the payment's reference, and only then are the held
-- credits destroyed. A refusal or a cancel gives them back. Nobody who runs the venture may
-- confirm its own redemption.
--
-- WHY A TABLE OF ITS OWN AND NOT A COLUMN ON `redemptions` (0201). That table is a member's
-- request: the exit desk blocks a member from leaving while one is open, its per-member caps and
-- its vote path read `user_id` as the person redeeming, and its hold account's reconciliation sums
-- every open row. A venture's request is the venture's, not the person who pressed the button, so
-- a venture row there would block that person's exit, spend their per-member count, and be summed
-- against a hold it never posted to. The decisions and the money arithmetic are reused from the
-- member module in code; the rows and the hold are kept apart.
--
-- THE HOLD. `sys:org-redemption-hold`, NOT a faucet, for 0201's reason: credits held against an
-- open request have to have come from somebody, and a faucet there would let a redemption create
-- what it redeems. The hold posting and the row are written in ONE transaction, so a waiting row
-- always has its hold behind it, and the account's balance per token is the sum of the waiting
-- rows by construction. A confirmed redemption burns from the hold to `sys:redeemed` (0201), the
-- sink that only ever receives, so issued supply does not fall and the retired total rises.
--
-- WHAT A REDEMPTION WAS WORTH IS WRITTEN ONCE, AT THE ASK. `currency` is what the venture chose,
-- `peg_currency` and `peg_rate` are what one credit was worth that day (1 USD by the lead's
-- decision, a dial), `fx_rate` and `fx_as_of` are the daily rate used to reach `currency` from
-- the peg (NULL when the two are the same), `rate_minor` is minor units of `currency` per whole
-- credit, and `gross_minor` is what the Treasury is asked to pay. Nothing reads a dial back to
-- re-price a row.
--
-- THE MOON CAP is counted from these rows: every redemption asked for since the cycle began that
-- is still waiting or confirmed, across every venture (`org_redemptions_cycle_idx`).
--
-- WHERE TO PAY, SEALED. Account details are sealed at rest with the platform's one sealing primitive
-- (server/lib/sealedBox.ts, AES-256-GCM under VILLAGE_SECRETS_KEY): `pay_to_sealed` holds the sealed
-- JSON and `pay_to_last4` the last four characters, which is all anyone but the venture's own people
-- and the redemption key holders is shown. A village with no key cannot take details at all; the
-- venture gives a payment reference instead (`pay_ref`), which carries no account number.
--
-- WHAT WAS ACTUALLY PAID. The confirmer may record what went out, which can differ from what was
-- asked (the bank's rate on the day): `paid_currency`, `paid_minor`, `paid_rate_minor` (minor units
-- per whole credit) and `paid_fx_rate` (paid currency per unit of the peg). NULL until confirmed. The
-- requested figures stay beside them, untouched.
--
-- EXPAND ONLY. One new table and one new system account row, `INSERT IGNORE`. The UNIQUE keys are
-- on the NEW table, which the previous release never writes. No existing table changes.
-- `--` comments sit on their own lines and never end in a semicolon (the 0015 trap).

INSERT IGNORE INTO `ledger_accounts` (`id`, `kind`, `user_id`, `label`, `faucet`) VALUES
  ('sys:org-redemption-hold', 'system', NULL, 'Held against a venture redemption', 0);

CREATE TABLE IF NOT EXISTS `org_redemptions` (
  `id` varchar(64) NOT NULL,
  `org_role_id` varchar(64) NOT NULL,
  `account_id` varchar(80) NOT NULL,
  `requested_by` varchar(64) NOT NULL,
  `token_slug` varchar(64) NOT NULL,
  `amount` bigint NOT NULL,
  `currency` char(3) NOT NULL,
  `peg_currency` char(3) NOT NULL,
  `peg_rate` decimal(20,6) NOT NULL,
  `fx_rate` decimal(24,10) NULL,
  `fx_as_of` varchar(10) NULL,
  `rate_minor` bigint NOT NULL,
  `gross_minor` bigint NOT NULL,
  `pay_to_sealed` text NULL,
  `pay_to_last4` varchar(8) NULL,
  `pay_ref` varchar(200) NULL,
  `state` varchar(16) NOT NULL DEFAULT 'requested',
  `hold_key` varchar(160) NOT NULL,
  `burn_key` varchar(160) NOT NULL,
  `release_key` varchar(160) NOT NULL,
  `decided_by` varchar(64) NULL,
  `decided_at` timestamp NULL,
  `payment_ref` varchar(200) NULL,
  `paid_currency` char(3) NULL,
  `paid_minor` bigint NULL,
  `paid_rate_minor` bigint NULL,
  `paid_fx_rate` decimal(24,10) NULL,
  `decision_note` varchar(500) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_redemptions_hold` (`hold_key`),
  UNIQUE KEY `org_redemptions_burn` (`burn_key`),
  UNIQUE KEY `org_redemptions_release` (`release_key`),
  KEY `org_redemptions_org_idx` (`org_role_id`, `state`, `created_at`),
  KEY `org_redemptions_queue_idx` (`state`, `created_at`),
  KEY `org_redemptions_cycle_idx` (`created_at`, `state`)
) ENGINE=InnoDB;
