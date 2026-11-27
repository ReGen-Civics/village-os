/**
 * `/season-places/circles`: THE SEASON'S CIRCLES (module `season-places`),
 * built to the village onboarding design's circles view.
 *
 *   THIS SEASON      the season's goals
 *   TAKING PART      circles taking part against the cap, each with who picks and its team
 *   BRING YOURS      a circle the reader is in that has no place yet, and its proposal
 *   GATHERINGS       each one that takes circles: capacity dots, where yours stands
 *   NEXT TEAMS       apply for the season
 *   THE PATH         what the picking role asks first
 *
 * Lazy-loaded; theme slots only; no village words.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import ModuleGate, { SignInDoors } from "@/components/modules/ModuleGate";
import { useModule, useModules } from "@/modules/ModuleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { BreathingLoader } from "@/components/natural";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, H2, HINT, LEDE, LINK, WORLD } from "@/components/journey/look";
import { ask, ordinal, roleWithHolders, SEASON_WORDS as W, type CrewPayload, type GatheringRow, type PlacesPayload } from "@/components/seasonPlaces/seasonApi";

const PANEL = "rounded-2xl border border-border bg-card/60 p-4";
const BAR = "mt-2 h-2 overflow-hidden rounded-full bg-muted";

function Dots({ going, cap }: { going: number; cap: number | null }) {
  if (cap === null || cap > 60) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
      {Array.from({ length: cap }, (_, i) => <span key={i} className={`h-2.5 w-4 rounded-sm ${i < going ? "bg-primary" : "bg-muted"}`} />)}
    </div>
  );
}

export default function SeasonCircles() {
  const { user } = useAuth();
  const modules = useModules();
  const on = useModule("season-places");
  const [crew, setCrew] = useState<CrewPayload | null>(null);
  const [places, setPlaces] = useState<PlacesPayload | null>(null);
  const [gatherings, setGatherings] = useState<GatheringRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "members">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, p, g] = await Promise.all([ask("/api/season-places/crew"), ask("/api/season-places"), ask("/api/season-places/gatherings")]);
    if (c.status === 401) return setState("members");
    if (c.ok) setCrew(c.data);
    if (p.ok) setPlaces(p.data);
    if (g.ok) setGatherings(g.data?.gatherings ?? []);
    if (!c.ok) setMessage(c.data?.message ?? W.failed);
    setState("ready");
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);

  if (modules.loaded && !on) return <ModuleGate moduleId="season-places" name="Season places" />;
  if (!user || state === "members") {
    return (
      <Layout>
        <div className={`${WORLD} py-8`}>
          <div className={`mx-auto max-w-xl px-4 ${CARD} text-center`}>
            <h1 className={H2}>{W.membersOnly}</h1>
            {!user && <div className="mt-5"><SignInDoors next="/season-places/circles" /></div>}
          </div>
        </div>
      </Layout>
    );
  }

  const taken = places?.taken ?? 0;
  const cap = places?.dials.cap ?? null;
  const taking = (places?.places ?? []).filter((p) => p.status === "taking_part");
  const unplaced = (places?.mine ?? []).filter((m) => !m.place);
  const paths = Array.from(new Map((crew?.pickerRoles ?? []).map((r) => [r.name.toLowerCase(), r])).values());

  async function propose(circleId: string) {
    setBusy(true);
    setMessage("");
    const out = await ask("/api/season-places", "POST", { circleId });
    setBusy(false);
    if (!out.ok) setMessage(out.data?.message ?? W.failed);
    await load();
  }

  return (
    <Layout>
      <div className={`${WORLD} py-6 sm:py-10`}>
        <div className="mx-auto max-w-xl space-y-5 px-4">
          {state === "loading" && <div className="flex justify-center py-16"><BreathingLoader label={W.loading} /></div>}
          {message && <p role="alert" className="text-destructive">{message}</p>}
          {state === "ready" && !crew?.season && <p className={LEDE}>{W.noSeason}</p>}
          {state === "ready" && crew?.season && (
            <>
              <section className={PANEL}>
                <p className={EYEBROW}>{crew.season.name ?? W.thisSeason}</p>
                {crew.goals.length === 0 && <p className={HINT}>{W.goalsEmpty}</p>}
                <ul className="mt-2 space-y-2">
                  {crew.goals.map((g, i) => (
                    <li key={i} className="flex justify-between gap-3 text-sm"><span className="text-foreground">{g.text}</span><span className="text-muted-foreground">{g.done ? W.done : W.underway}</span></li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline gap-2"><h2 className={H2}>{W.circlesTakingPart}</h2><span className={HINT}>{W.of(taken, cap)}</span></div>
                {cap !== null && cap > 0 && <div className={BAR}><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((taken / cap) * 100))}%` }} /></div>}
                {taking.map((p) => {
                  const c = crew.circles.find((x) => x.circleId === p.subjectId);
                  return (
                    <div key={p.id} className={`${PANEL} flex items-center justify-between gap-3`}>
                      <div>
                        <p className="font-display text-xl text-foreground">{p.name}</p>
                        <p className={HINT}>{[c?.pickedBy ? roleWithHolders(c.pickedBy.role, c.pickedBy.names) : null, W.teamOf(c?.picked ?? 0)].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className={CHIP_SOFT}>{W.takingPart}</span>
                    </div>
                  );
                })}
              </section>

              {unplaced.length > 0 && (
                <section className={`${PANEL} space-y-2 border-dashed text-center`}>
                  <h2 className={H2}>{W.bringYours}</h2>
                  <p className={HINT}>{W.bringYoursLine}</p>
                  {unplaced.map((m) => <button key={m.subjectId} type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => propose(m.subjectId)}>{W.propose(m.name)}</button>)}
                </section>
              )}

              {gatherings.length > 0 && (
                <section className="space-y-3">
                  <h2 className={H2}>{W.gatherings}</h2>
                  {gatherings.map((g) => (
                    <div key={g.eventId} className={PANEL}>
                      <p className="font-display text-xl text-foreground">{g.title}</p>
                      <Dots going={g.going} cap={g.circleCap} />
                      <p className={`mt-1 ${HINT}`}>{W.rigsAt(g.going, g.circleCap)}</p>
                      {g.mine.map((m) => <p key={m.circleId} className="mt-1 text-sm">{m.status === "going" ? W.isGoing(m.name) : `${ordinal(m.position ?? 1)} ${W.waitlistLine(m.name)}`}</p>)}
                    </div>
                  ))}
                </section>
              )}

              <section className={`${PANEL} space-y-3`}>
                <p className={EYEBROW}>{W.nextSeason}</p>
                <p className="text-sm text-foreground">{W.nextSeasonLine}</p>
                <Link href="/season#join" className={`${BTN_PRIMARY} w-full`}>{W.applyCta}</Link>
              </section>

              {paths.map((r) => (
                <Link key={r.id} href={`/role-path/${encodeURIComponent(r.id)}`} className={`${PANEL} block`}>
                  <p className="font-semibold text-foreground">{W.pathTitle(r.name)}</p>
                  <p className={HINT}>{W.pathLine}</p>
                </Link>
              ))}
              <Link href="/season#join" className={LINK}>{W.yourApplication}</Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
