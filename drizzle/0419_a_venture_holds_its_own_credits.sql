-- 0419: a venture holds its own credits (the lead, 23 Nov 2026).
--
-- Members spend credits; only ventures redeem them. So a venture needs an account on the ledger
-- that can receive credits, and the village needs to know which venture role that account belongs
-- to, because the people seated in that role are the ones who run it.
--
-- WHERE THE CREDITS LIVE, WHICH IS NOT HERE. The tokens sit in a real ledger account,
-- `org:<orgRoleId>`, written into `ledger_accounts` with kind 'org' and faucet 0 by
-- server/lib/orgAccounts.ts when an account is opened. Every movement in or out goes through
-- `postTransfer` in server/lib/ledger.ts. Neither table below has a balance column:
-- `token_balances` is the only cache of a balance and it is recomputed, never incremented.
--
-- org_accounts          one row per venture role that holds credits. The org role is the key, so
--                       a venture has one account for life (credits never expire, and an account
--                       that could be closed and reopened would split one venture's history in
--                       two). `label` is the name the village reads, copied from the role when the
--                       account is opened and editable later. Which venture is the first one is
--                       DATA a village enters: nothing in the platform names one.
-- org_account_services  which priced services a venture runs, so a fee paid for one can go to the
--                       venture's account instead of the village treasury. `service_kind` is
--                       'event' today (a gathering with a seat fee). Routing happens only while
--                       the dial `ledger.org_service_routing` is on, and it ships off.
--
-- EXPAND ONLY. Two new tables, created IF NOT EXISTS. The unique keys are on NEW tables, which the
-- previous release has never heard of and never writes, so they cannot refuse its INSERTs. No
-- column is added to any existing table and no row of any existing table is changed.
CREATE TABLE IF NOT EXISTS `org_accounts` (
  `org_role_id` varchar(64) NOT NULL,
  `account_id` varchar(80) NOT NULL,
  `label` varchar(120) NOT NULL,
  `opened_by` varchar(64) NULL,
  `opened_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`org_role_id`),
  UNIQUE KEY `org_accounts_account_uq` (`account_id`)
);

CREATE TABLE IF NOT EXISTS `org_account_services` (
  `service_kind` varchar(32) NOT NULL,
  `service_id` varchar(64) NOT NULL,
  `org_role_id` varchar(64) NOT NULL,
  `set_by` varchar(64) NULL,
  `set_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`service_kind`, `service_id`),
  KEY `org_account_services_org` (`org_role_id`)
);
