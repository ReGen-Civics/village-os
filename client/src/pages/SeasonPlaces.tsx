/**
 * `/season-places`: JOIN THE SEASON (module `season-places`), built to the
 * village onboarding design's season screen.
 *
 *   THE SEASON    its goals, and circles taking part against the cap
 *   PICKED        "You're in this season!" once a circle's picker picks you
 *   APPLICATION   the circles picking this season (or any), what you bring, apply
 *   THE STEPS     applied, the picker picks, you're in
 *   YOU PICK      for a picker: spots, and everyone who applied, to pick or release
 *   GATHERINGS    each one that takes circles, and where your circle stands
 *
 * Lazy-loaded. Every colour is a theme slot, and the paper card reads the
 * optional `--paper` tokens with their fallbacks, so a village's look reaches
 * it and no village's words live here.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import ModuleGate, { SignInDoors } from "@/components/modules/ModuleGate";
import { useModule, useModules } from "@/modules/ModuleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { BreathingLoader } from "@/components/natural";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, LEDE, LINK, WORLD } from "@/components/journey/look";
import { ask, ordinal, SEASON_WORDS as W, type CrewPayload, type GatheringRow, type PlacesPayload } from "@/components/seasonPlaces/seasonApi";

const PANEL = "rounded-2xl border border-border bg-card/60 p-4";
const PAPER = "flex items-center gap-4 rounded-2xl p-5 shadow-sm bg-[var(--paper,var(--tone-cream))] text-[var(--paper-foreground,var(--card-foreground))]";
const BAR = "mt-2 h-2 overflow-hidden rounded-full bg-muted";

export default function SeasonPlaces() {
  const { user } = useAuth();
  const modules = useModules();
  const on = useModule("season-places");
  const [crew, setCrew] = useState<CrewPayload | null>(null);
  const [places, setPlaces] = useState<PlacesPayload | null>(null);
  const [gatherings, setGatherings] = useState<GatheringRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "members" | "error">("loading");
  const [message, setMessage] = useState("");
  const [choice, setChoice] = useState<string>("");
  const [words, setWords] = useState("");
  const [spots, setSpots] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const season = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("season") ?? "" : "";
  const q = season ? `?season=${encodeURIComponent(season)}` : "";

  const load = useCallback(async () => {
    const [c, p, g] = await Promise.all([ask(`/api/season-places/crew${q}`), ask(`/api/season-places${q}`), ask("/api/season-places/gatherings")]);
    if (c.status === 401) return setState("members");
    if (!c.ok) { setMessage(c.data?.message ?? W.failed); return setState("error"); }
    setCrew(c.data);
    setChoice(c.data?.mine?.wantsCircleId ?? "");
    setWords(c.data?.mine?.words ?? "");
    if (p.ok) setPlaces(p.data);
    if (g.ok) setGatherings(g.data?.gatherings ?? []);
    setState("ready");
  }, [q]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  async function act(path: string, method: "POST" | "PUT", body: unknown = {}) {
    setBusy(true);
    setMessage("");
    const out = await ask(path, method, body);
    setBusy(false);
    if (!out.ok) setMessage(out.data?.message ?? W.failed);
    await load();
  }

  if (modules.loaded && !on) return <ModuleGate moduleId="season-places" name="Season places" />;
  if (!user || state === "members") {
    return (
      <Layout>
        <div className={`${WORLD} py-8`}>
          <div className={`mx-auto max-w-xl px-4 ${CARD} text-center`}>
            <h1 className={H2}>{W.membersOnly}</h1>
            {!user && <div className="mt-5"><SignInDoors next="/season-places" /></div>}
          </div>
        </div>
      </Layout>
    );
  }

  const mine = crew?.mine && crew.mine.status !== "withdrawn" ? crew.mine : null;
  const picked = mine?.status === "picked";
  const pickedCircle = crew?.circles.find((c) => c.circleId === mine?.pickedCircleId) ?? null;
  const taken = places?.taken ?? 0;
  const cap = places?.dials.cap ?? null;
  const step = (done: boolean, now: boolean) =>
    `rounded-xl border p-3 text-center text-sm ${now ? "border-primary bg-primary/10" : done ? "border-chart-3/60" : "border-border"}`;
  const nameOf = (id: string) => crew?.circles.find((c) => c.circleId === id)?.name ?? id;
  // The place the picked circle holds this season, when places are by circle. Any status short of
  // taking part gets a line, so "You're in" never sits beside a count that leaves the circle out.
  const pickedPlace = picked && places?.dials.who === "circle" ? places.places.find((p) => p.subjectId === mine?.pickedCircleId) ?? null : null;
  const placeUnsettled = picked && places?.dials.who === "circle" && pickedPlace?.status !== "taking_part";

  return (
    <Layout>
      <div className={`${WORLD} py-6 sm:py-10`}>
        <div className="mx-auto max-w-xl space-y-5 px-4">
          {state === "loading" && <div className="flex justify-center py-16"><BreathingLoader label={W.loading} /></div>}
          {message && <p role="alert" className="text-destructive">{message}</p>}
          {state === "ready" && crew && !crew.season && <p className={LEDE}>{W.noSeason}</p>}
          {state === "ready" && crew?.season && (
            <>
              <section className={PANEL}>
                <p className={EYEBROW}>{crew.season.name ?? W.thisSeason}</p>
                {crew.goals.length > 0 && <h1 className="mt-1 font-display text-2xl leading-snug text-foreground">{crew.goals.map((g) => g.text).join(" · ")}</h1>}
                <div className="mt-3 flex justify-between text-sm"><span>{W.circlesTakingPart}</span><span className="text-muted-foreground">{W.of(taken, cap)}</span></div>
                {cap !== null && cap > 0 && <div className={BAR}><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((taken / cap) * 100))}%` }} /></div>}
              </section>

              {picked && (
                <section className={PAPER} aria-live="polite">
                  <div className="grid size-20 shrink-0 rotate-[-8deg] place-items-center rounded-full border-2 border-[var(--stamp-alt,var(--chart-3))] p-2 text-center text-[10px] font-semibold uppercase text-[var(--stamp-alt,var(--chart-3))]">{W.pickedStamp}</div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--seal,var(--primary))]">{W.picked}</p>
                    <p className="font-display text-2xl leading-tight">{W.youreIn}</p>
                    <p className="mt-1 text-sm opacity-80">
                      {W.pickedLine(pickedCircle?.pickedBy ? `${pickedCircle.pickedBy.role} (${pickedCircle.pickedBy.names.join(", ")})` : nameOf(mine?.pickedCircleId ?? ""), mine?.pickedCircleName ?? "")}
                    </p>
                    {placeUnsettled && <p className="mt-2 text-sm opacity-80">{W.placeUnsettled(mine?.pickedCircleName ?? nameOf(mine?.pickedCircleId ?? ""), pickedPlace?.status ?? null)}</p>}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h2 className={H2}>{W.yourApplication}</h2>
                {[...crew.circles.map((c) => ({ id: c.circleId, title: c.name, line: W.circleLine(c) })), { id: "", title: W.anyCircle, line: W.anyCircleLine }].map((o) => (
                  <label key={o.id || "any"} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${choice === o.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="circle" className="mt-1 size-5 accent-[var(--primary)]" checked={choice === o.id} onChange={() => setChoice(o.id)} disabled={picked} />
                    <span><b className="block text-foreground">{o.title}</b><span className={HINT}>{o.line}</span></span>
                  </label>
                ))}
                {!picked && (
                  <label className="block space-y-1">
                    <span className={LABEL}>{W.wordsLabel}</span>
                    <textarea className={FIELD} rows={3} maxLength={600} value={words} onChange={(e) => setWords(e.target.value)} />
                  </label>
                )}
                {!picked && (
                  <button type="button" disabled={busy} className={`${BTN_PRIMARY} w-full`} onClick={() => act("/api/season-places/crew/apply", "POST", { seasonId: crew.season?.id, circleId: choice || undefined, words: words || undefined })}>
                    {mine ? W.update : W.apply}
                  </button>
                )}
                {mine && (
                  <button type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/crew/${mine.id}/withdraw`, "POST")}>{W.withdraw}</button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className={step(Boolean(mine), false)}><b className="block">{W.stepApplied}</b>{W.stepAppliedLine}</div>
                  <div className={step(picked, Boolean(mine) && !picked)}><b className="block">{W.stepPicks}</b>{W.stepPicksLine}</div>
                  <div className={step(false, picked)}><b className="block">{W.stepIn}</b>{W.stepInLine}</div>
                </div>
                <p className={HINT}>{W.fresh}</p>
              </section>

              {crew.picksFor.map((circleId) => {
                const c = crew.circles.find((x) => x.circleId === circleId);
                const pool = crew.pool ?? [];
                return (
                  <section key={circleId} className={`${PANEL} space-y-3`}>
                    <h2 className={H2}>{W.youPick(nameOf(circleId))}</h2>
                    <div className="flex items-end gap-2">
                      <label className="flex-1 space-y-1">
                        <span className={LABEL}>{W.spots}</span>
                        <input className={FIELD} inputMode="numeric" value={spots[circleId] ?? (c?.berths === null || c?.berths === undefined ? "" : String(c.berths))} onChange={(e) => setSpots({ ...spots, [circleId]: e.target.value })} />
                      </label>
                      <button type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/crew/circles/${encodeURIComponent(circleId)}/berths`, "PUT", { seasonId: crew.season?.id, berths: (spots[circleId] ?? "").trim() === "" ? null : Number(spots[circleId]) })}>{W.saveSpots}</button>
                    </div>
                    {pool.length === 0 && <p className={HINT}>{W.noApplicants}</p>}
                    <ul className="space-y-2">
                      {pool.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                          <span>
                            <b className="text-foreground">{a.name ?? "?"}</b>
                            {a.wantsCircleId && <span className={`${CHIP_SOFT} ml-2`}>{nameOf(a.wantsCircleId)}</span>}
                            {a.words && <span className={`block ${HINT}`}>{a.words}</span>}
                          </span>
                          {a.status === "applied" && <button type="button" disabled={busy} className={BTN_PRIMARY} onClick={() => act(`/api/season-places/crew/${a.id}/pick`, "POST", { circleId })}>{W.pick}</button>}
                          {a.status === "picked" && a.pickedCircleId === circleId && <button type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/crew/${a.id}/release`, "POST", { circleId })}>{W.release}</button>}
                          {a.status === "picked" && a.pickedCircleId !== circleId && <span className={CHIP_SOFT}>{W.pickedElsewhere}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}

              {gatherings.length > 0 && (
                <section className="space-y-3">
                  <h2 className={H2}>{W.gatherings}</h2>
                  {gatherings.map((g) => (
                    <div key={g.eventId} className={`${PANEL} space-y-2`}>
                      <p className="font-display text-xl leading-tight text-foreground">{g.title}</p>
                      <p className={HINT}>{W.rigsAt(g.going, g.circleCap)}</p>
                      {g.mine.map((m) => m.status === "going"
                        ? <span key={m.circleId} className={CHIP_SOFT}>{W.isGoing(m.name)}</span>
                        : <p key={m.circleId} className="flex items-center gap-3"><span className="font-display text-4xl text-primary">{ordinal(m.position ?? 1)}</span><span className="text-sm">{W.waitlistLine(m.name)}</span></p>)}
                      {crew.picksFor.map((cid) => {
                        const there = g.mine.find((m) => m.circleId === cid);
                        return there
                          ? <button key={cid} type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/gatherings/${encodeURIComponent(g.eventId)}/circles/${encodeURIComponent(cid)}/leave`, "POST")}>{W.takeOut(nameOf(cid))}</button>
                          : <button key={cid} type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/gatherings/${encodeURIComponent(g.eventId)}/circles`, "POST", { circleId: cid })}>{W.signUp(nameOf(cid))}</button>;
                      })}
                    </div>
                  ))}
                  <p className={HINT}>{W.capsNote(cap)}</p>
                </section>
              )}

              {Array.from(new Map((crew.pickerRoles ?? []).map((r) => [r.name.toLowerCase(), r])).values()).map((r) => (
                <Link key={r.id} href={`/role-path/${encodeURIComponent(r.id)}`} className={`${PANEL} block`}>
                  <p className="font-semibold text-foreground">{W.pathTitle(r.name)}</p>
                  <p className={HINT}>{W.pathLine}</p>
                </Link>
              ))}
              <Link href="/season-places/circles" className={LINK}>{W.seeCircles}</Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
