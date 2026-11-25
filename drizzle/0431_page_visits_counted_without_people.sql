-- 0431: the pages members visit, counted without people (the responsive bottom bar, 24 Nov 2026).
--
-- THE CONTRACT IS shared/navPopularity.ts; the SQL is server/repos/navVisits.ts and the
-- routes sit in server/routes/navBar.ts.
--
-- `nav_path_visits`, one row per page per day:
--   day      the UTC day, written from Node's clock
--   path     a page's address, only a fixed address the client draws (no ids, no query)
--   visits   how many signed-in visits that page had that day, each member at most once a
--            session; the phone sends the address and nothing else
--
-- NO PERSON. There is no member, session, address or device column, by design: members are
-- never tracked per person on the server. The site-wide bar reads the sums.
--
-- EXPAND ONLY. One new table the previous release never reads.
CREATE TABLE IF NOT EXISTS `nav_path_visits` (
  `day` date NOT NULL,
  `path` varchar(191) NOT NULL,
  `visits` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`day`, `path`)
);
