/**
 * THE POWERS THIS VILLAGE HAS, AND WHO LOOKS AFTER EACH ONE (0098).
 *
 * R54: these villages are meant to be taken over by their electorate, so the
 * admin panel is scaffolding to be dismantled. A member could never see what
 * the scaffolding was holding. The one explainer that existed answered "can
 * this person moderate?" to an admin, for one member at a time, and there was
 * no way at all to ask "who moderates here?".
 *
 * ── THE RULES FOR THIS SURFACE, WHICH ARE NOT NEGOTIABLE (R55) ─────────────
 *
 * The handover is a journey to celebrate and never a scorecard to fail. A
 * village holding two powers is young, and a village holding all of them is
 * older. This page has to feel good to both, so:
 *
 *  - No fraction, no denominator, no total, no percentage, no progress bar.
 *  - No count of anything, anywhere, including a quiet "3 powers held".
 *  - NEVER sorted or grouped by held and unheld. That single choice draws a
 *    completion bar out of a plain list, and it is one careless afternoon
 *    away at all times. The order comes from the server's registry and it is
 *    the same order for every village on earth.
 *  - No phase label computed from how many are held. Seed, sprout and rooted
 *    tree may describe ONE power's journey; a village's aggregate phase is
 *    percentage-incomplete with nicer nouns.
 *  - No date on a crossing. A crossing has a date and it belongs on the
 *    decision's own record, where it is a story. Here it would be the only
 *    number on the page, and a column of dates is a timeline somebody reads
 *    as a pace.
 *
 * The layout renders identically for a village holding none of these and a
 * village holding every one. Same cards, same order, same tone, different
 * sentence in one place.
 *
 * `client/src/lib/powersCopy.test.ts` reads this file and asserts it carries
 * no percent sign, no "N of M", and no progress component, so a later
 * afternoon cannot quietly add one. The sentences themselves live in
 * `powersCopy.ts` so they are testable without a browser (this repo's client
 * tests are pure logic; there is no jsdom).
 */
import Layout from "@/components/Layout";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authToken, useCatalyst } from "@/lib/gameApi";
import { ChevronDown, KeyRound } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { CARD, EYEBROW, H1, H2, HINT, LEDE, NOTE, TILE, WORLD } from "@/components/journey/look";
import { holderSentence, inFamilies, suggestionSentence, visitorHolderSentence, type PowerRow } from "@/lib/powersCopy";
import HandsForPower, { type HandRow } from "@/components/power/HandsForPower";

export default function Powers() {
  const { user } = useAuth();
  // The word only. Reaching past a power the village holds is still the same
  // act by the same people, and it still writes the same line on the feed.
  const catalyst = useCatalyst();
  const [powers, setPowers] = useState<PowerRow[] | null>(null);
  // Families group by what a power does, never by who holds it (R55), and
  // the guidance is a village's usual choice at launch (Rye, Q11).
  const [families, setFamilies] = useState<Array<{ id: string; title: string }>>([]);
  const [guidance, setGuidance] = useState<Record<string, string>>({});
  // Rye, 2026-09-23: the hands that are up, and what their authors wrote, are
  // read by any member. The server decides per hand who may put one to the
  // village, so nothing here is drawn from a stale opinion about who holds what.
  const [hands, setHands] = useState<readonly HandRow[]>([]);

  const readHands = useCallback(() => {
    const token = authToken();
    if (!token) return;
    fetch("/api/powers/hands", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHands(d?.hands ?? []))
      .catch(() => setHands([]));
  }, []);

  // A visitor reads the list too (the lead, 24 Nov 2026): the powers, the roles that hold them and first names
  // only, which is all the server sends. The raised hands and the suggestion doors stay with members.
  useEffect(() => {
    const token = authToken();
    fetch("/api/village/powers", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setPowers(d?.powers ?? []);
        setFamilies(d?.families ?? []);
        setGuidance(d?.guidance ?? {});
      })
      .catch(() => setPowers([]));
    readHands();
  }, [user?.id, readHands]);

  /*
   * THE VISITOR'S VIEW (public launch, 24 Nov 2026). The page is public now,
   * and a first-time visitor read it as dense and technical. For a visitor:
   * each family is folded shut under its plain title, each power says what it
   * lets someone do and who looks after it in plain words
   * (visitorHolderSentence), and the screens, launch guidance and the
   * mechanics of a handover stay with members. Same order, same cards, no
   * count, for a village holding none of these or all of them (R55).
   */
  const visitor = !user;

  return (
    <Layout>
      <div className={WORLD}>
      <section className="container max-w-3xl pt-12 pb-6 sm:pt-16">
        <p className={EYEBROW}>
          <Trans context="powers page eyebrow">How the village is held</Trans>
        </p>
        <h1 className={`${H1} mt-2`}>
          <Trans>What this village looks after</Trans>
        </h1>
        <p className={`${LEDE} mt-4`}>
          {visitor ? (
            <Trans>
              Every shared responsibility here has someone who looks after it. Open a theme to see what each one lets a
              person do, and which role holds it today.
            </Trans>
          ) : (
            <Trans>
              Every power here has a place it lives. Some of them sit with the admin panel, which is how a village starts.
              Some of them the village has taken on. This page says which is which, and who to ask.
            </Trans>
          )}
        </p>
      </section>

      <section className="container max-w-3xl pb-16">
        {powers === null && (
          <p className={HINT}>
            <Trans>Reading the village's own record.</Trans>
          </p>
        )}

        {powers !== null && (
          <ul className="space-y-4" data-testid="powers-list">
            {inFamilies(powers, families).map((f) => (
              <li key={`family-${f.id}`}>
                <details className={`${CARD} group`} open={!visitor}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <h2 className={H2}>{f.title}</h2>
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="mt-5 space-y-3">
                    {f.powers.map((p) => (
                      <li key={p.capability} className={TILE} data-testid={`power-${p.capability}`}>
                        <div className="flex items-start gap-3">
                          <KeyRound className="mt-1 h-5 w-5 shrink-0 text-notice" aria-hidden />
                          <div className="min-w-0">
                            <h3 className="font-display text-lg text-foreground">{p.title}</h3>
                            {!visitor && p.surface && <p className={`${HINT} mt-1`}>{p.surface}.</p>}
                            <p className="mt-2 text-base text-foreground">
                              <Trans>Whoever holds this can {p.consequence}.</Trans>
                            </p>
                            <p className={`${NOTE} mt-2`}>{visitor ? visitorHolderSentence(p) : holderSentence(p)}</p>
                            {p.heldBy?.byBallot && (
                              <p className="mt-1 text-sm text-open">
                                <Trans>The village voted this one across.</Trans>
                              </p>
                            )}
                            {user && <p className={`${HINT} mt-1`}>{suggestionSentence(p)}</p>}
                            {!visitor && p.guidance && guidance[p.guidance] && (
                              <p className={`${HINT} mt-1`}>{guidance[p.guidance]}</p>
                            )}
                            {user && <HandsForPower capability={p.capability} hands={hands} onOpened={readHands} />}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}

        {powers !== null && visitor && (
          <p className={`${NOTE} mt-10`}>
            <Trans>
              As the village grows, it takes these on through its own decisions, and this page changes with it.
            </Trans>
          </p>
        )}

        {powers !== null && !visitor && (
          <div className={`${CARD} mt-10`}>
            <h2 className={H2}>
              <Trans>How a power moves</Trans>
            </h2>
            <p className={`${NOTE} mt-3`}>
              <Trans>
                A power moves in two steps, and the order matters. First a role is given the power, so there is somebody
                who can act. Then the village takes it on, and from that day the admin panel stops being the answer:
                whoever sits in that role acts on their own account.
              </Trans>
            </p>
            <p className={`${NOTE} mt-3`}>
              <Trans>
                {catalyst.aNameCap} can still reach past a power the village holds, on a day something has gone wrong.
                Doing it writes a line on the village's own feed naming the power and the person, and it tells whoever
                holds it. That is the whole of the arrangement: the way back exists, and the village sees it used.
              </Trans>
            </p>
          </div>
        )}
      </section>
      </div>
    </Layout>
  );
}
