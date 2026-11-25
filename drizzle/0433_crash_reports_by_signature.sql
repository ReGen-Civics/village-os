-- 0433: browser crash reports kept by SIGNATURE, so the admins hear about real bugs and not the noise (the lead,
-- 25 Nov 2026: "fix that so we're not bogged down in noise").
--
-- THE RULES ARE server/lib/crashTriage.ts and shared/crashNoise.ts; the route is server/routes/clientCrash.ts.
--
-- `client_crash_signatures`, one row per distinct crash (message plus top frame, with the build's hash and line
-- numbers taken out, hashed):
--   id               the signature's id, 16 hex characters
--   message          the message as first reported, scrubbed (the route scrubs before anything is kept)
--   top_frame        the top frame with the build taken out, or ''
--   ours             1 when a report of it had a frame from our own /assets/ bundle
--   first_seen_at    when it was first reported
--   last_seen_at     when it was last reported
--   seen_count       every report of it, emailed or not
--   emailed_at       when it last emailed the crash alert list, or NULL; one email a day at most
--   emails_sent      how many alert emails it has sent; part of each email's dedupe key
--
-- `client_crash_sightings`, one row per report kept:
--   id               `ccs-` and 20 hex characters
--   signature_id     the signature it is a report of
--   visitor          a digest of the reporting address under a salt that changes every day, 16 hex characters:
--                    it can count different visitors within a day and can never name or follow one
--   browser          the browser family the page sent ("Safari 17 iOS")
--   route            the page path, no query string
--   emailed          1 when this report sent the alert, else 0
--   digested_at      when the daily digest counted it, or NULL
--   at               when it arrived, from Node's clock
--
-- ADMIN ONLY, read by the crash route, Village Health and the daily digest. Holds nothing about the person.
-- EXPAND ONLY: two new tables the previous release never names.
CREATE TABLE IF NOT EXISTS `client_crash_signatures` (
  `id` char(16) NOT NULL,
  `message` varchar(300) NOT NULL,
  `top_frame` varchar(200) NOT NULL DEFAULT '',
  `ours` tinyint(1) NOT NULL DEFAULT 0,
  `first_seen_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `seen_count` int NOT NULL DEFAULT 0,
  `emailed_at` timestamp(3) NULL,
  `emails_sent` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `client_crash_signatures_seen` (`last_seen_at`)
);

CREATE TABLE IF NOT EXISTS `client_crash_sightings` (
  `id` varchar(32) NOT NULL,
  `signature_id` char(16) NOT NULL,
  `visitor` char(16) NOT NULL,
  `browser` varchar(40) NOT NULL DEFAULT '',
  `route` varchar(200) NOT NULL DEFAULT '/',
  `emailed` tinyint(1) NOT NULL DEFAULT 0,
  `digested_at` timestamp(3) NULL,
  `at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `client_crash_sightings_signature` (`signature_id`, `at`),
  KEY `client_crash_sightings_digest` (`digested_at`, `at`)
);
