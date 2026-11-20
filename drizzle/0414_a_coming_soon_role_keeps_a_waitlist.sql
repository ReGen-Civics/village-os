-- 0414: a coming-soon role keeps a waitlist (the lead, Anchor session of 19 Nov 2026).
--
-- THE CONTRACT IS shared/roleWaitlist.ts; the SQL is server/repos/roleWaitlist.ts
-- and the routes sit in server/routes/roleEdit.ts.
--
-- `role_waitlist`, one row per sign-up on the /roles page:
--   email_key   the address, trimmed and lowercased (shared/comms/address.ts)
--   whatsapp    an optional WhatsApp number or wa.me link, as typed, or NULL
--   role_ids    the coming-soon roles asked about, a JSON list of role ids
--   user_id     the member who signed up while signed in, or NULL
--   created_at  when, written from Node's clock
--
-- PRIVATE. Read by admins only, never shown on a public page, and nothing is
-- ever sent from it. Deleted when the member is erased (server/lib/erasure.ts,
-- step "role-waitlist-after-tombstone", by user id and address).
--
-- EXPAND ONLY. One new table the previous release never reads. No foreign key,
-- no ALTER, no UNIQUE key: a second sign-up from the same address is a second
-- row, and the admin list shows each.
CREATE TABLE IF NOT EXISTS `role_waitlist` (
  `id` varchar(36) NOT NULL,
  `email_key` varchar(191) NOT NULL,
  `whatsapp` varchar(60) NULL,
  `role_ids` text NOT NULL,
  `user_id` varchar(64) NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `role_waitlist_email` (`email_key`),
  KEY `role_waitlist_user` (`user_id`)
);
