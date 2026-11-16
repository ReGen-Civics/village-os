/**
 * A PLACE IN LINE for a tension a holder has taken (shared/priorities.ts):
 * where it sits on the role's list, and the week they expect to pick it up.
 * Whoever raised it reads both on their profile, in plain words, so nobody
 * has to chase. Drawn inside the holder's row in Waiting on you
 * (roleTension/TensionRespondRow.tsx).
 */
import { useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { PRIORITY_LIMITS, askPlaceApi, type AskPlace } from "@shared/priorities";
import { gameFetch } from "@/lib/gameApi";
import { BTN_QUIET, BTN_SECONDARY, HINT, INPUT, LABEL } from "@/components/sessions/roomUi";
import { dayWords, refusalOf } from "./priorityWords";

/** Weeks from now a holder can pick from: this week, next week, then every week to the limit. */
const WEEKS = Array.from({ length: PRIORITY_LIMITS.maxWeeksAhead + 1 }, (_, i) => i);

export default function PlaceInLine({ tensionId, place: initial }: { tensionId: string; place: AskPlace | null }) {
  const { t } = useLingui();
  const [place, setPlace] = useState<AskPlace | null>(initial);
  const [editing, setEditing] = useState(false);
  const [position, setPosition] = useState(initial?.position != null ? String(initial.position) : "");
  const [inWeeks, setInWeeks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const weekLabel = (n: number) => (n === 0 ? t({ message: "This week", context: "an ask's place in line, when the holder expects to pick it up" }) : n === 1 ? t({ message: "Next week", context: "an ask's place in line, when the holder expects to pick it up" }) : t({ message: `In ${n} weeks`, context: "an ask's place in line, when the holder expects to pick it up" }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await gameFetch(askPlaceApi(tensionId), {
        method: "POST",
        // Left on its first choice, the week already said stays as it is.
        body: JSON.stringify({ position: position.trim() ? Number(position) : null, ...(inWeeks === "" ? {} : { inWeeks: inWeeks === "none" ? null : Number(inWeeks) }) }),
      });
      if (!res.ok) {
        setError((await refusalOf(res)) ?? t`That did not save. Try again.`);
        return;
      }
      const body = (await res.json()) as { place?: AskPlace };
      setPlace(body.place && (body.place.position != null || body.place.expectWeek) ? body.place : null);
      setEditing(false);
    } catch {
      setError(t`That did not save. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const said = [
    place?.position != null ? t`Number ${place.position} on your list.` : null,
    place?.expectWeek ? t`Expected around the week of ${dayWords(place.expectWeek)}.` : null,
  ].filter(Boolean);

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2" data-place-in-line={tensionId}>
        <p className="text-sm text-foreground">{said.length ? said.join(" ") : t`Say where it sits on your list, so whoever raised it knows.`}</p>
        <button type="button" className={BTN_QUIET} onClick={() => setEditing(true)}>
          {said.length ? t({ message: "Change", context: "priorities, change what was set" }) : t`Give it a place`}
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor={`${ids}-pos`} className={LABEL}>
            {t`Place on your list`}
          </label>
          <input
            id={`${ids}-pos`}
            type="number"
            inputMode="numeric"
            min={1}
            max={PRIORITY_LIMITS.maxPosition}
            className={`${INPUT} mt-1 w-28`}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-wk`} className={LABEL}>
            {t`Expect to pick it up`}
          </label>
          <select id={`${ids}-wk`} className={`${INPUT} mt-1 w-auto`} value={inWeeks} onChange={(e) => setInWeeks(e.target.value)}>
            <option value="">{place?.expectWeek ? t({ message: `Week of ${dayWords(place.expectWeek)}`, context: "an ask's place in line, the week already said" }) : t({ message: "Not said", context: "an ask's place in line, no week given" })}</option>
            {place?.expectWeek && <option value="none">{t({ message: "Not said", context: "an ask's place in line, no week given" })}</option>}
            {WEEKS.map((n) => (
              <option key={n} value={String(n)}>
                {weekLabel(n)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={HINT}>{t`Whoever raised it sees this on their profile.`}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_SECONDARY} disabled={busy}>
          {t({ message: "Save", context: "priorities, save what was typed" })}
        </button>
        <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setEditing(false)}>
          {t({ message: "Cancel", context: "priorities, stop editing without saving" })}
        </button>
      </div>
    </form>
  );
}
