/**
 * Today's card for yourself (shared/myCard.ts):
 *   GET  /api/me/today-card?date=YYYY-MM-DD   the day's card if drawn, and where the member stands with the guide
 *   POST /api/me/today-card                   body `{ date, sky, today }`: draw (or answer) the day's card
 *   POST /api/me/today-card/consent           body `{ provider, operator, source }`: the one tap, yes to the guide
 *                                             reading their lines and to the provider line it was shown
 * Behind the Gene Keys module, since it reads the member's own lines; a signed-in member only. The rules live
 * in server/lib/myCard.ts.
 */
import type { Express, Response } from "express";
import type { AppDeps } from "../lib/appDeps";
import { requireModule } from "../lib/modules";
import { consentToCard, pullTodayCard, readTodayCard, type MyCardDeps, type MyCardOutcome } from "../lib/myCard";
import { MY_CARD_API, MY_CARD_CONSENT_API, MY_CARD_PER_HOUR } from "../../shared/myCard";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "overLimit" | "members"> & { villageName(): string; guideName?(): string };

const HOUR_MS = 60 * 60 * 1000;
/** Reads one member may make in an hour: the page and the profile each read once per visit. */
const READS_PER_HOUR = 240;
/** Yeses one member may give in an hour. */
const CONSENTS_PER_HOUR = 20;

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, overLimit, members } = deps;
  const card: MyCardDeps = {
    getPool,
    overLimit,
    villageName: deps.villageName,
    guideName: deps.guideName,
    // `prefs` is a JSON column the record carries untyped, as the companion's consent route reads it.
    updateMember: async (id, mutate) => (await members.update(id, (m) => mutate(m as unknown as { prefs?: unknown }))) as unknown as { prefs?: unknown } | null,
  };
  const answer = <T>(res: Response, out: MyCardOutcome<T>) => {
    res.setHeader("Cache-Control", "private, no-store");
    return out.ok ? res.json(out.value) : res.status(out.status).json({ error: out.error });
  };

  app.get(MY_CARD_API, requireModule("gene-keys"), async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const uid = String(me.id);
    if (await overLimit(`my-card-read:${uid}`, READS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "The card is being read very often. Try again in a little while." });
    }
    return answer(res, await readTodayCard(card, { id: uid, prefs: me.prefs }, req.query.date, Date.now()));
  });

  app.post(MY_CARD_API, requireModule("gene-keys"), async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const uid = String(me.id);
    if (await overLimit(`my-card:${uid}`, MY_CARD_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of cards for one hour. Try again a little later." });
    }
    return answer(res, await pullTodayCard(card, { id: uid, prefs: me.prefs }, req.body, Date.now()));
  });

  app.post(MY_CARD_CONSENT_API, requireModule("gene-keys"), async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const uid = String(me.id);
    if (await overLimit(`my-card-consent:${uid}`, CONSENTS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "Try again in a little while." });
    }
    return answer(res, await consentToCard(card, { id: uid, prefs: me.prefs }, req.body, Date.now()));
  });
}
