/**
 * The feedback domain (S66): what a member reports, and what the village does
 * with it.
 *
 *   GET  /api/feedback/config        what the form must disclose before anyone types
 *   POST /api/feedback               a bug, an idea or feedback, from a member or a stranger,
 *                                    with a screenshot when one is attached (the guide's panel)
 *   GET  /api/admin/feedback         the local queue, and whether the relay is real
 *   GET  /api/admin/feedback/:id/screenshot   the picture sent with an item, to an admin
 *   PUT  /api/admin/feedback/:id     triage, and the sentence the reporter gets back
 *
 * MOVED OUT OF server/index.ts UNCHANGED. Every line of the four handlers
 * below is byte for byte what stood in the monolith, with one substitution:
 * `mergedConfig().project.name` is now `projectName()`, the same function under
 * the name AppDeps already gives it. Registration happens at exactly the point
 * these routes used to be registered, because Express matches in registration
 * order.
 *
 * WHY THE TWO RELAY QUESTIONS ARE NOT HERE. `feedbackIsShared` and
 * `feedbackHubUrl` moved to `server/lib/feedback.ts`, beside `recordFeedback`
 * and `relayFeedback` that answer to them. They were module-level helpers in
 * server/index.ts, and the relay job there still asks them, so a copy in this
 * module would have been a second answer to "is anything actually leaving",
 * which is the one question this domain must never answer two ways.
 */
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import multer from "multer";
import type { AppDeps } from "../lib/appDeps";
import { boolVar } from "../lib/variables";
import { recordEvent } from "../lib/events";
import {
  FEEDBACK_SHOT_PREFIX,
  feedbackHubName,
  feedbackHubUrl,
  feedbackIsShared,
  feedbackShotName,
  feedbackShotsDir,
  feedbackStatusNotice,
  recordFeedback,
} from "../lib/feedback";
import { CarriesLocationData, LocationDataSurvived, sanitiseForVolume, stampedName, writeToVolume } from "../lib/uploads";
import { attachmentHeaders } from "../lib/submissionAttachments";
import { clearFeedbackShot } from "../repos/feedbackScreenshots";
import { FEEDBACK_DETAIL_MIN, FEEDBACK_SHOT_MAX_BYTES, FEEDBACK_TITLE_MIN, isFeedbackKind, suggestTitle } from "../../shared/feedbackItems";

// The screenshot's folder and its names live beside the rest of the feedback spine (server/lib/feedback.ts),
// because erasure takes the files off too.
export { FEEDBACK_SHOT_DIRNAME, feedbackShotName, feedbackShotsDir } from "../lib/feedback";

type Deps = Pick<
  AppDeps,
  "isAdmin" | "authedUser" | "getPool" | "notify" | "overLimit" | "clientIp" | "projectName" | "uploadsDir"
>;

/** multipart/form-data with one `screenshot`; JSON goes on through as it always did. */
const takeShot = multer({ storage: multer.memoryStorage(), limits: { fileSize: FEEDBACK_SHOT_MAX_BYTES, files: 1 } }).single("screenshot");

function parseShot(req: Request, res: Response): Promise<string | null> {
  if (!String(req.headers["content-type"] ?? "").startsWith("multipart/form-data")) return Promise.resolve(null);
  return new Promise((resolve) => {
    takeShot(req as any, res as any, (err: any) => {
      if (!err) return resolve(null);
      resolve(String(err?.code ?? "") === "LIMIT_FILE_SIZE" ? "That screenshot is too large. Try a smaller one." : "That screenshot did not arrive. Try again, or send it without one.");
    });
  });
}

export function register(app: Express, deps: Deps): void {
  const { isAdmin, authedUser, getPool, notify, overLimit, clientIp, projectName, uploadsDir } = deps;
  const shotsDir = feedbackShotsDir(uploadsDir);

  /**
   * What the submission form needs to disclose, honestly, before anyone types.
   *
   * Two things decide it: the dial the village set, and whether this
   * deployment was told where the hub is. The hub is no longer defaulted to
   * anybody's address, so a deployment with the dial ON and `FEEDBACK_HUB_URL`
   * unset shares nothing. Reporting the dial on its own would promise a person
   * their words are travelling somewhere while they stay home.
   */
  app.get("/api/feedback/config", async (_req, res) => {
    const relayOn = feedbackIsShared();
    res.json({
      relayOn,
      villageName: projectName(),
      // Who receives the copy, named by where the relay sends (the hub's host), so the form can say it.
      hubName: relayOn ? feedbackHubName() : null,
    });
  });

  app.post("/api/feedback", async (req, res) => {
    // Same anti-abuse posture as every public form: an IP limit and a honeypot. The limit is read BEFORE the
    // body is parsed, so an address over it never gets a screenshot buffered into memory (fold QA round 1).
    if (await overLimit(`feedback:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "That's a lot of feedback for one hour. Thank you, and give it a rest" });
    }
    // The guide's panel sends a screenshot as multipart, with the words as fields beside it.
    const refused = await parseShot(req, res);
    if (refused) return res.status(400).json({ error: refused });
    if (typeof req.body?.hp === "string" && req.body.hp.length > 0) return res.json({ success: true });
    const kind = isFeedbackKind(req.body?.kind) ? req.body.kind : null;
    const detail = String(req.body?.detail ?? "").trim();
    // The member's title, or the guide's suggestion from their own first line when they left it empty.
    const typed = String(req.body?.title ?? "").trim();
    const suggested = suggestTitle(detail);
    const title = typed.length >= FEEDBACK_TITLE_MIN ? typed : suggested.length >= FEEDBACK_TITLE_MIN ? suggested : detail.slice(0, 72);
    if (!kind || title.length < FEEDBACK_TITLE_MIN || detail.length < FEEDBACK_DETAIL_MIN) {
      return res.status(400).json({ error: "Say what kind it is, and enough detail to act on" });
    }
    // The screenshot goes through the strip (no metadata, no location) before a byte is kept.
    let screenshotFile: string | null = null;
    let shotBytes: Buffer | null = null;
    const file = (req as any).file as { buffer?: Buffer; originalname?: string } | undefined;
    if (file?.buffer?.length) {
      try {
        const clean = await sanitiseForVolume(file.buffer, String(file.originalname ?? ""));
        if (clean.kind !== "image") return res.status(400).json({ error: "That screenshot is not a picture. Try a PNG, JPEG or WebP." });
        screenshotFile = stampedName(FEEDBACK_SHOT_PREFIX, clean.ext || ".png");
        shotBytes = clean.bytes;
      } catch (e) {
        if (e instanceof CarriesLocationData || e instanceof LocationDataSurvived) {
          return res.status(400).json({ error: "That screenshot kept hidden data through the strip, so it was not stored. Try another." });
        }
        return res.status(400).json({ error: "That screenshot could not be read. Try a PNG, JPEG or WebP." });
      }
    }
    const user = await authedUser(req);
    // The disclosure the form showed IS the consent, so it is recorded with
    // the item rather than re-derived from the setting at relay time.
    const mayRelay = feedbackIsShared();
    const r = await recordFeedback(getPool(), {
      kind, title, detail,
      pageUrl: typeof req.body?.pageUrl === "string" ? req.body.pageUrl : null,
      submittedBy: user?.id ?? null,
      screenshotFile,
    }, mayRelay);
    /*
     * The file is written only once the row that names it exists (fold QA round 1), so a refused INSERT leaves
     * no picture nobody can find or erase. A write that fails after it takes the name off the row: the report
     * still lands, without a screenshot the admin view would then fail to open.
     */
    if (screenshotFile && shotBytes) {
      try {
        writeToVolume(shotsDir, screenshotFile, shotBytes);
      } catch (e) {
        console.error(`[feedback] ${r.id}: the screenshot was not stored: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
        await clearFeedbackShot(getPool(), r.id);
      }
    }
    void recordEvent(getPool(), {
      kind: "audit", text: `feedback:${kind}:${title.slice(0, 60)}`,
      actorUserId: user?.id ?? null, entityType: "feedback", entityRef: r.id, audience: "admin",
    });
    res.json({
      success: true,
      id: r.id,
      shared: feedbackIsShared(),
    });
  });

  app.get("/api/admin/feedback", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const [rows] = await getPool().query<any[]>(
      "SELECT f.*, u.name AS submitter_name FROM feedback_items f LEFT JOIN users u ON u.id = f.submitted_by " +
        "ORDER BY f.created_at DESC LIMIT 300",
    );
    /*
     * Three facts, because two of them can disagree and an admin who cannot
     * see the disagreement cannot fix it. `relayOn` is whether anything is
     * actually leaving. `relayDialOn` is what the village set. `hubConfigured`
     * is whether the server was told where to send. A dial reading ON beside a
     * queue that is going nowhere needs a screen that says which half is
     * missing.
     */
    res.json({
      items: rows,
      relayOn: feedbackIsShared(),
      relayDialOn: boolVar("platform.feedback_relay"),
      hubConfigured: feedbackHubUrl().length > 0,
    });
  });

  /**
   * The screenshot a member sent with an item, to an admin alone, with the attachment door's
   * headers: `private, no-store`, nosniff and a sandboxing CSP, so no shared cache keeps it.
   */
  app.get("/api/admin/feedback/:id/screenshot", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const [[row]] = await getPool().query<any[]>("SELECT screenshot_file FROM feedback_items WHERE id = ? LIMIT 1", [req.params.id]);
    const name = feedbackShotName(row?.screenshot_file);
    if (!name) return res.status(404).json({ error: "Not found" });
    const file = path.join(shotsDir, name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Not found" });
    res.set(attachmentHeaders(name));
    res.sendFile(file);
  });

  app.put("/api/admin/feedback/:id", async (req, res) => {
    if (!(await isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    const status = String(req.body?.status ?? "");
    if (!["new", "seen", "planned", "done", "declined"].includes(status)) {
      return res.status(400).json({ error: "unknown status" });
    }
    /*
     * SWEEP (the incomplete loop). Triage moved and the member who reported
     * the problem was never told, so the honest answer to "did anyone see
     * this?" was "open the admin panel and find out", which is exactly the
     * door they do not have.
     *
     * Read first, for three reasons: to know WHO to write to, to know
     * whether the status actually moved, and because MySQL counts CHANGED
     * rows, so re-selecting the status an item already held reported zero
     * affected rows and answered 404 for an item that plainly exists.
     */
    const [[before]] = await getPool().query<any[]>(
      "SELECT id, kind, title, status, submitted_by FROM feedback_items WHERE id = ? LIMIT 1",
      [req.params.id],
    );
    if (!before) return res.status(404).json({ error: "no such item" });
    if (String(before.status) === status) return res.json({ success: true, notified: false });
    await getPool().query("UPDATE feedback_items SET status = ? WHERE id = ?", [status, req.params.id]);

    /*
     * The public form takes feedback from strangers too, and `submitted_by`
     * is null for those. There is no address on the row and no account to
     * put a notification in, so an anonymous report stays anonymous.
     *
     * The key is (item, status): one word per item per landing place, so a
     * founder who sets "planned" twice, or walks an item back and forward
     * again, rings once. It says the member's OWN title back to them,
     * because a village clearing a backlog produces a run of these and
     * "your report" alone would not tell them which.
     */
    const notice = feedbackStatusNotice(status, String(before.kind ?? "bug"));
    let notified = false;
    if (before.submitted_by && notice) {
      const title = String(before.title ?? "").slice(0, 120);
      await notify({
        userId: String(before.submitted_by),
        type: "feedback",
        title: `${notice.headline}: ${title}`,
        body: notice.line,
        link: "/profile",
        dedupeKey: `feedback:${String(before.id)}:${status}`,
      });
      notified = true;
    }
    res.json({ success: true, notified });
  });
}
