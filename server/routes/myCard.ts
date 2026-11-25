/**
 * Today's card for yourself (shared/myCard.ts):
 *   POST /api/me/today-card    body `{ sky }`, the day's sky read in the browser; answers the member's own card
 * Behind the Gene Keys module, since it reads the member's own lines; a signed-in member only.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { requireModule } from "../lib/modules";
import { readMyCard } from "../lib/myCard";
import { MY_CARD_API, MY_CARD_PER_HOUR } from "../../shared/myCard";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "overLimit">;

const HOUR_MS = 60 * 60 * 1000;

export function register(app: Express, deps: Deps): void {
  const { authedUser, getPool, overLimit } = deps;
  app.post(MY_CARD_API, requireModule("gene-keys"), async (req, res) => {
    const me = await authedUser(req);
    if (!me) return res.status(401).json({ error: "auth_required" });
    const uid = String(me.id);
    if (await overLimit(`my-card:${uid}`, MY_CARD_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of cards for one hour. Try again a little later." });
    }
    const out = await readMyCard(getPool(), uid, req.body, Date.now());
    res.setHeader("Cache-Control", "private, no-store");
    return out.ok ? res.json(out.value) : res.status(out.status).json({ error: out.error });
  });
}
