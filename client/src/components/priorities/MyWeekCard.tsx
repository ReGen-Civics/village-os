/**
 * YOUR TOP PRIORITY THIS WEEK, on the profile (shared/priorities.ts). One
 * line and the season goal it serves, if any. It carries forward until the
 * member sets a new one, and the team sees it on "The season so far".
 *
 * It reads `GET /api/session-templates/week`, which sits behind Live
 * Sessions: with the module off, or for a guest, the read is refused and the
 * card draws nothing.
 */
import { useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { PRIORITY_LIMITS, WEEK_API, type WeekPayload } from "@shared/priorities";
import { PRIORITY_OUTCOME_LABEL, SEASON_VIEW_PATH } from "@shared/sessionTemplates";
import { gameFetch } from "@/lib/gameApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP_SOFT, EYEBROW, FIELD, H2, HINT, LABEL, LINK } from "@/components/journey/look";
import { ServesPicker } from "@/components/sessions/ServesPicker";
import { dayWords, refusalOf } from "./priorityWords";

export default function MyWeekCard() {
  const { t } = useLingui();
  const [week, setWeek] = useState<WeekPayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [serves, setServes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  useEffect(() => {
    let alive = true;
    gameFetch(WEEK_API)
      .then(async (res) => (res.ok ? ((await res.json()) as WeekPayload) : null))
      .then((w) => alive && setWeek(w))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!week) return null;
  const mine = week.mine;
  const carried = mine != null && mine.weekOf !== week.weekOf;

  const open = () => {
    setText(carried ? "" : (mine?.text ?? ""));
    setServes(carried ? null : (mine?.servesGoalId ?? null));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await gameFetch(WEEK_API, { method: "PUT", body: JSON.stringify({ text, servesGoalId: serves }) });
      if (!res.ok) {
        setError((await refusalOf(res)) ?? t`That did not save. Try again.`);
        return;
      }
      setWeek((await res.json()) as WeekPayload);
      setEditing(false);
    } catch {
      setError(t`That did not save. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${fieldId}-h`} className={CARD} data-my-week>
      <p className={EYEBROW}>{t({ message: `Week of ${dayWords(week.weekOf)}`, context: "weekly top priority, the week it is for" })}</p>
      <h2 id={`${fieldId}-h`} className={`mt-1 ${H2}`}>
        {t`Your top priority this week`}
      </h2>

      {!editing && (
        <div className="mt-3 space-y-2">
          {mine ? (
            <>
              <p className="text-lg text-foreground">{mine.text}</p>
              <p className="flex flex-wrap gap-2">
                {mine.servesGoal && <span className={CHIP_SOFT}>{t({ message: `Serves: ${mine.servesGoal}`, context: "weekly top priority, the season goal it serves" })}</span>}
                {mine.outcome && <span className={CHIP_SOFT}>{PRIORITY_OUTCOME_LABEL[mine.outcome]}</span>}
                {carried && <span className={CHIP_SOFT}>{t`Carried from the week of ${dayWords(mine.weekOf)}`}</span>}
              </p>
            </>
          ) : (
            <p className={HINT}>{t`Name the one thing you'll put first this week. The team sees it.`}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" className={mine && !carried ? BTN_SECONDARY : BTN_PRIMARY} onClick={open}>
              {mine && !carried ? t({ message: "Change it", context: "profile, change your top priority for this week" }) : t({ message: "Set this week's", context: "profile, set your top priority for this week" })}
            </button>
            <Link href={SEASON_VIEW_PATH} className={LINK}>
              {t`See the team's week`}
            </Link>
          </div>
        </div>
      )}

      {editing && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor={fieldId} className={LABEL}>
            {t({ message: "Your top priority", context: "profile, label for your top priority this week" })}
          </label>
          <input
            id={fieldId}
            className={FIELD}
            value={text}
            maxLength={PRIORITY_LIMITS.text}
            placeholder={t({ message: "One line", context: "placeholder for a top priority" })}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <ServesPicker goals={week.goals} value={serves} onChange={setServes} disabled={busy} />
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={busy || !text.trim()}>
              {t({ message: "Save", context: "priorities, save what was typed" })}
            </button>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => setEditing(false)}>
              {t({ message: "Cancel", context: "priorities, stop editing without saving" })}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
