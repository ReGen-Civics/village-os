-- 0443: feedback moves into the village guide's panel
-- (the lead, 26 Nov 2026: "share with scarlet and that goes into our own queue").
--
-- THE CONTRACT IS shared/feedbackItems.ts; the SQL is server/lib/feedback.ts and the routes sit in
-- server/routes/feedback.ts.
--
-- (1) A third kind, `feedback`: how something felt, beside a bug and an idea. Adding a value at the
-- end of an enum is an expansion: the previous release never writes it, and its admin list prints
-- the kind as text, so a rollback over this column reads every row it finds.
ALTER TABLE `feedback_items`
  MODIFY COLUMN `kind` enum('bug','idea','feedback') NOT NULL;

-- (2) The screenshot a member attached, by its stamped name in the private folder beside the
-- uploads volume (DATA_DIR/private-feedback-shots). Never on the public volume, and never relayed:
-- the hub gets the words, and a picture of a page can show other people's names. NULL means none,
-- which is every row the previous release writes.
ALTER TABLE `feedback_items`
  ADD COLUMN `screenshot_file` varchar(128) NULL;
