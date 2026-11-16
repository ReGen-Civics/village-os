/**
 * `/season-places`: WHO TAKES PART THIS SEASON (module `season-places`).
 *
 * Members only; the read answers 401 to a visitor and this page says so.
 *
 *   THE HEADER    the season, places taken against the cap, and the dials
 *   YOUR CIRCLES  each circle the reader is crew in: seasons served, whether it
 *                 needs a proposal, and a button to propose or join
 *   THE SEASON    every circle taking part, then the waitlist in order, then
 *                 proposals waiting on a decision, each with what the reader
 *                 may do (adopt, decline, put to the village, withdraw)
 *
 * The dials are not edited here. They live on the module card and the dials
 * page, where any member may propose a change.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import ModuleGate, { SignInDoors } from "@/components/modules/ModuleGate";
import { useModule, useModules } from "@/modules/ModuleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { BreathingLoader } from "@/components/natural";
import { authToken } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H1, H2, HINT, LABEL, LEDE, LINK, WORLD } from "@/components/journey/look";

interface PlaceRow {
  id: string;
  name: string;
  status: string;
  statusWords: string;
  roadWords: string;
  position: number | null;
  words: string | null;
  mine: boolean;
  mayDecide: boolean;
  mayPutToVillage: boolean;
  mayWithdraw: boolean;
}

interface Payload {
  seasons: Array<{ id: string; name: string | null }>;
  dials: { who: "circle" | "member"; freeAfter: number | null; cap: number | null };
  season: { id: string; name: string | null } | null;
  taken?: number;
  waiting?: number;
  free?: number | null;
  overCap?: number;
  places: PlaceRow[];
  mine: Array<{ subjectId: string; name: string; served: number; road: "proposal" | "served"; place: { id: string; status: string } | null }>;
}

export const SEASON_PLACES_WORDS = {
  title: "Who takes part this season",
  membersOnly: "Members read who takes part each season.",
  noSeason: "There is no season open yet. The village's seasons are dated in Admin, Season.",
  places: (taken: number, cap: number | null) => (cap === null ? `${taken} taking part, with no cap` : `${taken} of ${cap} places taken`),
  overCap: (n: number) => `${n} more than the cap hold a place, because lowering the cap removes nobody.`,
  freeAfter: (n: number | null) => (n === null ? "Every season needs a proposal." : n === 0 ? "No proposal is needed." : `After ${n} ${n === 1 ? "season" : "seasons"} with a place, no proposal is needed.`),
  served: (n: number) => (n === 0 ? "No earlier seasons with a place" : `${n} earlier ${n === 1 ? "season" : "seasons"} with a place`),
  propose: "Propose for this season",
  join: "Take part this season",
  wordsLabel: "What your crew brings this season (optional)",
  dialsLink: "See and propose changes to these numbers",
  empty: "Nobody has proposed for this season yet.",
} as const;

async function ask(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const t = authToken();
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function SeasonPlaces() {
  const { user } = useAuth();
  const modules = useModules();
  const on = useModule("season-places");
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "members" | "error">("loading");
  const [message, setMessage] = useState("");
  const [words, setWords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const season = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("season") ?? "" : "";

  const load = useCallback(async () => {
    const out = await ask(`/api/season-places${season ? `?season=${encodeURIComponent(season)}` : ""}`);
    if (out.ok) { setData(out.data); setState("ready"); }
    else if (out.status === 401) setState("members");
    else { setMessage(out.data?.message ?? "The season's places could not be read."); setState("error"); }
  }, [season]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  async function act(path: string, body: unknown = {}) {
    setBusy(true);
    setMessage("");
    const out = await ask(path, body);
    setBusy(false);
    if (!out.ok) setMessage(out.data?.message ?? out.data?.error ?? "That did not go through. Try again.");
    await load();
  }

  if (modules.loaded && !on) return <ModuleGate moduleId="season-places" name="Season places" />;

  if (!user || state === "members") {
    return (
      <Layout>
        <div className={`${WORLD} py-8 sm:py-12`}>
          <div className={`mx-auto max-w-xl px-4 ${CARD} text-center`}>
            <h1 className={H2}>{SEASON_PLACES_WORDS.membersOnly}</h1>
            {!user && <div className="mt-5"><SignInDoors next="/season-places" /></div>}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`${WORLD} py-8 sm:py-12`}>
        <div className="mx-auto max-w-3xl space-y-6 px-4">
          {state === "loading" && <div className="flex justify-center py-16"><BreathingLoader label="Reading the season's places" /></div>}
          {message && <p role="alert" className="text-coral">{message}</p>}
          {state === "ready" && data && !data.season && <p className={LEDE}>{SEASON_PLACES_WORDS.noSeason}</p>}
          {state === "ready" && data?.season && (
            <>
              <header className="space-y-2">
                <p className={EYEBROW}>{data.season.name ?? "This season"}</p>
                <h1 className={H1}>{SEASON_PLACES_WORDS.title}</h1>
                <p className={LEDE}>
                  {SEASON_PLACES_WORDS.places(data.taken ?? 0, data.dials.cap)}. {SEASON_PLACES_WORDS.freeAfter(data.dials.freeAfter)}
                </p>
                {(data.overCap ?? 0) > 0 && <p className={HINT}>{SEASON_PLACES_WORDS.overCap(data.overCap ?? 0)}</p>}
                <Link href="/modules/season-places" className={LINK}>{SEASON_PLACES_WORDS.dialsLink}</Link>
              </header>

              {data.mine.length > 0 && (
                <section className={`${CARD} space-y-4`}>
                  <h2 className={H2}>{data.dials.who === "member" ? "You" : "Your circles"}</h2>
                  {data.mine.map((m) => (
                    <div key={m.subjectId} className="space-y-2 border-t border-border pt-4 first:border-0 first:pt-0">
                      <p className="font-semibold text-card-foreground">{m.name}</p>
                      <p className={HINT}>{SEASON_PLACES_WORDS.served(m.served)}</p>
                      {m.place ? (
                        <span className={CHIP_SOFT}>{data.places.find((p) => p.id === m.place?.id)?.statusWords ?? m.place.status}</span>
                      ) : (
                        <>
                          {m.road === "proposal" && (
                            <label className="block space-y-1">
                              <span className={LABEL}>{SEASON_PLACES_WORDS.wordsLabel}</span>
                              <textarea
                                className={FIELD}
                                maxLength={600}
                                rows={3}
                                value={words[m.subjectId] ?? ""}
                                onChange={(e) => setWords({ ...words, [m.subjectId]: e.target.value })}
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            className={BTN_PRIMARY}
                            onClick={() => act("/api/season-places", { seasonId: data.season?.id, circleId: m.subjectId, words: words[m.subjectId] || undefined })}
                          >
                            {m.road === "served" ? SEASON_PLACES_WORDS.join : SEASON_PLACES_WORDS.propose}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </section>
              )}

              <section className={`${CARD} space-y-4`}>
                <h2 className={H2}>{data.season.name ?? "This season"}</h2>
                {data.places.length === 0 && <p className={HINT}>{SEASON_PLACES_WORDS.empty}</p>}
                <ul className="space-y-3">
                  {data.places.map((p) => (
                    <li key={p.id} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-card-foreground">{p.name}</span>
                        <span className={CHIP_SOFT}>{p.position ? `${p.statusWords}, number ${p.position}` : p.statusWords}</span>
                        <span className={HINT}>{p.roadWords}</span>
                      </div>
                      {p.words && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.words}</p>}
                      <div className="flex flex-wrap gap-2">
                        {p.mayDecide && <button type="button" disabled={busy} className={BTN_PRIMARY} onClick={() => act(`/api/season-places/${p.id}/adopt`)}>Adopt</button>}
                        {p.mayDecide && <button type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/${p.id}/decline`)}>Not this season</button>}
                        {p.mayPutToVillage && <button type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/${p.id}/put-to-village`)}>Put it to the village</button>}
                        {p.mayWithdraw && <button type="button" disabled={busy} className={BTN_SECONDARY} onClick={() => act(`/api/season-places/${p.id}/withdraw`)}>Withdraw</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
