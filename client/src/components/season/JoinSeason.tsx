/**
 * JOIN THE SEASON, the Join tab of `/season` (module `season-places`). It was
 * the page `/season-places` until the season fold (27 Nov 2026).
 *
 *   PICKED        "You're in this season!" once a circle's picker picks you
 *   APPLICATION   the circles picking this season (or any), what you bring, apply
 *   PLACES        circles taking part against the season's cap
 *   YOU PICK      for a picker: spots, and everyone who applied, to pick or release
 *   GATHERINGS    each one that takes circles, and where your circle stands
 *   PATHS         what the picking role asks first, and every circle this season
 *
 * Where the application stands (applied, picked) is the Join stone in the
 * page's hero, so the three-step row left with the fold. The season's goals left this panel: the page draws them once, on its
 * Season tab. Every colour is a semantic token, and no village's words live
 * here: circle names, gathering titles and role titles come from its data.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { BreathingLoader } from "@/components/natural";
import ReadFailed from "./ReadFailed";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  CHIP_SOFT,
  DOOR,
  EYEBROW,
  FIELD,
  H2,
  HINT,
  LABEL,
  TILE,
  TICK,
} from "@/components/journey/look";
import {
  ask,
  ordinal,
  SEASON_WORDS as W,
  type CrewPayload,
  type GatheringRow,
  type PlacesPayload,
} from "@/components/seasonPlaces/seasonApi";

export type JoinState =
  "loading" | "members" | "error" | "none" | "applied" | "picked" | "no-season";

const BAR = "mt-2 h-2 overflow-hidden rounded-full bg-muted";

export default function JoinSeason({
  onStatus,
}: {
  onStatus?: (s: JoinState) => void;
}) {
  const [crew, setCrew] = useState<CrewPayload | null>(null);
  const [places, setPlaces] = useState<PlacesPayload | null>(null);
  const [gatherings, setGatherings] = useState<GatheringRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "members" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [choice, setChoice] = useState<string>("");
  const [words, setWords] = useState("");
  const [spots, setSpots] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const season =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("season") ?? "")
      : "";
  const q = season ? `?season=${encodeURIComponent(season)}` : "";

  const load = useCallback(async () => {
    const [c, p, g] = await Promise.all([
      ask(`/api/season-places/crew${q}`),
      ask(`/api/season-places${q}`),
      ask("/api/season-places/gatherings"),
    ]);
    if (c.status === 401) return setState("members");
    if (!c.ok) {
      setMessage(c.data?.message ?? W.failed);
      return setState("error");
    }
    setCrew(c.data);
    setChoice(c.data?.mine?.wantsCircleId ?? "");
    setWords(c.data?.mine?.words ?? "");
    if (p.ok) setPlaces(p.data);
    if (g.ok) setGatherings(g.data?.gatherings ?? []);
    setState("ready");
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine =
    crew?.mine && crew.mine.status !== "withdrawn" ? crew.mine : null;
  const picked = mine?.status === "picked";

  useEffect(() => {
    if (!onStatus) return;
    if (state !== "ready") onStatus(state);
    else if (!crew?.season) onStatus("no-season");
    else onStatus(picked ? "picked" : mine ? "applied" : "none");
  }, [onStatus, state, crew, mine, picked]);

  async function act(path: string, method: "POST" | "PUT", body: unknown = {}) {
    setBusy(true);
    setMessage("");
    const out = await ask(path, method, body);
    setBusy(false);
    if (!out.ok) setMessage(out.data?.message ?? W.failed);
    await load();
  }

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <BreathingLoader label={W.loading} />
      </div>
    );
  }
  if (state === "members") {
    return (
      <div className={`${CARD} text-center`}>
        <p className={HINT}>{W.membersOnly}</p>
      </div>
    );
  }
  if (state === "error" || !crew) {
    return (
      <ReadFailed message={message || W.failed} onRetry={() => void load()} />
    );
  }
  if (!crew.season) {
    return (
      <div className={CARD}>
        <p className={HINT}>{W.noSeason}</p>
      </div>
    );
  }

  const pickedCircle =
    crew.circles.find(c => c.circleId === mine?.pickedCircleId) ?? null;
  const taken = places?.taken ?? 0;
  const cap = places?.dials.cap ?? null;
  const nameOf = (id: string) =>
    crew.circles.find(c => c.circleId === id)?.name ?? id;
  // The place the picked circle holds this season, when places are by circle. Any status short of
  // taking part gets a line, so "You're in" never sits beside a count that leaves the circle out.
  const pickedPlace =
    picked && places?.dials.who === "circle"
      ? (places.places.find(p => p.subjectId === mine?.pickedCircleId) ?? null)
      : null;
  const placeUnsettled =
    picked &&
    places?.dials.who === "circle" &&
    pickedPlace?.status !== "taking_part";
  const options = [
    ...crew.circles.map(c => ({
      id: c.circleId,
      title: c.name,
      line: W.circleLine(c),
    })),
    { id: "", title: W.anyCircle, line: W.anyCircleLine },
  ];
  const pickerRoles = Array.from(
    new Map(
      (crew.pickerRoles ?? []).map(r => [r.name.toLowerCase(), r])
    ).values()
  );

  return (
    <div className="space-y-5">
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}

      <section aria-labelledby="join-h" className={CARD}>
        <p className={EYEBROW}>{crew.season.name ?? W.thisSeason}</p>
        <h2 id="join-h" className={`${H2} mt-1`}>
          {picked ? W.youreIn : W.yourApplication}
        </h2>

        {picked && (
          <div
            className="mt-4 flex items-start gap-3 rounded-xl border-2 border-open/60 bg-open/10 p-4"
            aria-live="polite"
            data-join-picked=""
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-open text-open"
              aria-hidden="true"
            >
              <Check className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-foreground">
                {W.pickedLine(
                  pickedCircle?.pickedBy
                    ? `${pickedCircle.pickedBy.role} (${pickedCircle.pickedBy.names.join(", ")})`
                    : nameOf(mine?.pickedCircleId ?? ""),
                  mine?.pickedCircleName ?? ""
                )}
              </p>
              {placeUnsettled && (
                <p className={`${HINT} mt-1`}>
                  {W.placeUnsettled(
                    mine?.pickedCircleName ??
                      nameOf(mine?.pickedCircleId ?? ""),
                    pickedPlace?.status ?? null
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {!picked && (
          <fieldset className="mt-6 space-y-2">
            <legend className={LABEL}>
              <Trans context="season join, the circle picker">
                Which circle you ask to join
              </Trans>
            </legend>
            {options.map(o => (
              <label
                key={o.id || "any"}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 ${choice === o.id ? "border-notice bg-notice/10" : "border-border bg-muted"}`}
              >
                <input
                  type="radio"
                  name="circle"
                  className={`${TICK} mt-0.5`}
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                />
                <span>
                  <b className="block text-foreground">{o.title}</b>
                  <span className={HINT}>{o.line}</span>
                </span>
              </label>
            ))}
            <label className="block space-y-1 pt-2">
              <span className={LABEL}>{W.wordsLabel}</span>
              <textarea
                className={FIELD}
                rows={3}
                maxLength={600}
                value={words}
                onChange={e => setWords(e.target.value)}
              />
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {!picked && (
            <button
              type="button"
              disabled={busy}
              className={`${BTN_PRIMARY} sm:flex-1`}
              onClick={() =>
                act("/api/season-places/crew/apply", "POST", {
                  seasonId: crew.season?.id,
                  circleId: choice || undefined,
                  words: words || undefined,
                })
              }
            >
              {mine ? W.update : W.apply}
            </button>
          )}
          {mine && (
            <button
              type="button"
              disabled={busy}
              className={BTN_SECONDARY}
              onClick={() =>
                act(`/api/season-places/crew/${mine.id}/withdraw`, "POST")
              }
            >
              {W.withdraw}
            </button>
          )}
        </div>
        <p className={`${HINT} mt-3`}>{W.fresh}</p>
      </section>

      <section aria-labelledby="join-places-h" className={CARD}>
        <h2 id="join-places-h" className={H2}>
          {W.circlesTakingPart}
        </h2>
        <p className="mt-2 font-display text-3xl text-foreground">
          {W.of(taken, cap)}
        </p>
        {cap !== null && cap > 0 && (
          <div className={BAR} aria-hidden="true">
            <div
              className="h-full rounded-full bg-notice"
              style={{
                width: `${Math.min(100, Math.round((taken / cap) * 100))}%`,
              }}
            />
          </div>
        )}
        <div className="mt-4 grid gap-2">
          {pickerRoles.map(r => (
            <Link
              key={r.id}
              href={`/role-path/${encodeURIComponent(r.id)}`}
              className={DOOR}
            >
              <span>
                <span className="block">{W.pathTitle(r.name)}</span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {W.pathLine}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-notice"
                aria-hidden="true"
              />
            </Link>
          ))}
          <Link href="/season-places/circles" className={DOOR}>
            <span>{W.seeCircles}</span>
            <ArrowRight
              className="size-4 shrink-0 text-notice"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      {crew.picksFor.map(circleId => {
        const c = crew.circles.find(x => x.circleId === circleId);
        const pool = crew.pool ?? [];
        return (
          <section key={circleId} className={`${CARD} space-y-3`}>
            <h2 className={H2}>{W.youPick(nameOf(circleId))}</h2>
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1">
                <span className={LABEL}>{W.spots}</span>
                <input
                  className={`${FIELD} min-h-11`}
                  inputMode="numeric"
                  value={
                    spots[circleId] ??
                    (c?.berths === null || c?.berths === undefined
                      ? ""
                      : String(c.berths))
                  }
                  onChange={e =>
                    setSpots({ ...spots, [circleId]: e.target.value })
                  }
                />
              </label>
              <button
                type="button"
                disabled={busy}
                className={BTN_SECONDARY}
                onClick={() =>
                  act(
                    `/api/season-places/crew/circles/${encodeURIComponent(circleId)}/berths`,
                    "PUT",
                    {
                      seasonId: crew.season?.id,
                      berths:
                        (spots[circleId] ?? "").trim() === ""
                          ? null
                          : Number(spots[circleId]),
                    }
                  )
                }
              >
                {W.saveSpots}
              </button>
            </div>
            {pool.length === 0 && <p className={HINT}>{W.noApplicants}</p>}
            <ul className="space-y-2">
              {pool.map(a => (
                <li
                  key={a.id}
                  className={`${TILE} flex flex-wrap items-center justify-between gap-2`}
                >
                  <span>
                    <b className="text-foreground">{a.name ?? "?"}</b>
                    {a.wantsCircleId && (
                      <span className={`${CHIP_SOFT} ml-2`}>
                        {nameOf(a.wantsCircleId)}
                      </span>
                    )}
                    {a.words && (
                      <span className={`block ${HINT}`}>{a.words}</span>
                    )}
                  </span>
                  {a.status === "applied" && (
                    <button
                      type="button"
                      disabled={busy}
                      className={BTN_PRIMARY}
                      onClick={() =>
                        act(`/api/season-places/crew/${a.id}/pick`, "POST", {
                          circleId,
                        })
                      }
                    >
                      {W.pick}
                    </button>
                  )}
                  {a.status === "picked" && a.pickedCircleId === circleId && (
                    <button
                      type="button"
                      disabled={busy}
                      className={BTN_SECONDARY}
                      onClick={() =>
                        act(`/api/season-places/crew/${a.id}/release`, "POST", {
                          circleId,
                        })
                      }
                    >
                      {W.release}
                    </button>
                  )}
                  {a.status === "picked" && a.pickedCircleId !== circleId && (
                    <span className={CHIP_SOFT}>{W.pickedElsewhere}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {gatherings.length > 0 && (
        <section
          aria-labelledby="join-gatherings-h"
          className={`${CARD} space-y-3`}
        >
          <h2 id="join-gatherings-h" className={H2}>
            {W.gatherings}
          </h2>
          {gatherings.map(g => (
            <div key={g.eventId} className={`${TILE} space-y-2`}>
              <p className="font-display text-xl leading-tight text-foreground">
                {g.title}
              </p>
              <p className={HINT}>{W.rigsAt(g.going, g.circleCap)}</p>
              {g.mine.map(m =>
                m.status === "going" ? (
                  <span key={m.circleId} className={CHIP_SOFT}>
                    {W.isGoing(m.name)}
                  </span>
                ) : (
                  <p key={m.circleId} className="flex items-center gap-3">
                    <span className="font-display text-4xl text-notice">
                      {ordinal(m.position ?? 1)}
                    </span>
                    <span className="text-sm">{W.waitlistLine(m.name)}</span>
                  </p>
                )
              )}
              {crew.picksFor.map(cid => {
                const there = g.mine.find(m => m.circleId === cid);
                return there ? (
                  <button
                    key={cid}
                    type="button"
                    disabled={busy}
                    className={BTN_SECONDARY}
                    onClick={() =>
                      act(
                        `/api/season-places/gatherings/${encodeURIComponent(g.eventId)}/circles/${encodeURIComponent(cid)}/leave`,
                        "POST"
                      )
                    }
                  >
                    {W.takeOut(nameOf(cid))}
                  </button>
                ) : (
                  <button
                    key={cid}
                    type="button"
                    disabled={busy}
                    className={BTN_SECONDARY}
                    onClick={() =>
                      act(
                        `/api/season-places/gatherings/${encodeURIComponent(g.eventId)}/circles`,
                        "POST",
                        { circleId: cid }
                      )
                    }
                  >
                    {W.signUp(nameOf(cid))}
                  </button>
                );
              })}
            </div>
          ))}
          <p className={HINT}>{W.capsNote(cap)}</p>
        </section>
      )}
    </div>
  );
}
